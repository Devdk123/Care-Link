"""FastAPI inference server. Loads the trained model FROM Aurora (model_store),
serves /patients, /predict/{id} (with SHAP), and /feedback. Runs on EC2 #2."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
from psycopg2.extras import RealDictCursor
import psycopg2
import json
import datetime
import pandas as pd
import xgboost as xgb
from model import HospitalReadmissionModel
import os
app = FastAPI(title="Hospital X — Readmission Risk API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------- Database (defined BEFORE loading the model) ----------
DB = dict(
    host="aurora-hospital-db.cluster-ch02wk02ky83.ap-south-1.rds.amazonaws.com",
    port="5432", dbname="postgres", user="postgres", password=os.environ.get("AURORA_PASSWORD", ""),
)

def get_conn():
    return psycopg2.connect(**DB)

# ---------- Load the model FROM AURORA (model_store) ----------
_conn = get_conn()
_cur = _conn.cursor()
_cur.execute(
    "SELECT model_blob, threshold, feature_columns "
    "FROM model_store ORDER BY uploaded_at DESC LIMIT 1;"
)
_row = _cur.fetchone()
_cur.close(); _conn.close()
if _row is None:
    raise RuntimeError("No model in model_store — run upload_model.py first.")

_blob, _threshold, _features = _row
THRESHOLD = float(_threshold)
FEATURE_COLUMNS = _features if isinstance(_features, list) else json.loads(_features)

model = HospitalReadmissionModel()
model.booster = xgb.Booster()
model.booster.load_model(bytearray(_blob))      # load from the DB bytes, not a file
model.threshold = THRESHOLD
print(f"Model loaded FROM AURORA — {len(FEATURE_COLUMNS)} features, threshold {THRESHOLD}")


# ---------- Register the active model in Aurora (run once) ----------
def ensure_model_registered():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT model_id FROM model_registry WHERE is_active = TRUE LIMIT 1;")
    existing = cur.fetchone()
    if existing:
        model_id = existing[0]
    else:
        cur.execute("""
            INSERT INTO model_registry
              (model_version, algorithm, federated_rounds, num_hospitals,
               roc_auc, recall, cohen_kappa, decision_threshold, is_active)
            VALUES (%s, 'XGBoost-Federated', 5, 3, %s, %s, %s, %s, TRUE)
            RETURNING model_id;
        """,  (f"fed-xgb-{datetime.date.today()}", 0.703, 0.445, 0.251, THRESHOLD))
        model_id = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()
    return model_id

MODEL_ID = ensure_model_registered()
print(f"Active model_id = {MODEL_ID}")


#  Helper: turn a stored patient into model-ready features 
def preprocess_patient(raw: dict) -> pd.DataFrame:
    """Turn one stored MIMIC patient into the model's 86 feature columns."""
    df = pd.DataFrame([raw])

    # drop anything that isn't a feature
    df = df.drop(columns=[c for c in ["external_ref", "readmitted_30days"] if c in df.columns])

    # one-hot the categoricals (same columns the ETL encoded)
    nominal = ["gender", "admission_type", "admission_location",
               "discharge_location", "insurance", "marital_status", "race"]
    nominal = [c for c in nominal if c in df.columns]
    df = pd.get_dummies(df, columns=nominal, dtype=int)

    # align to the EXACT training columns (add missing as 0, drop extras, fix order)
    df = df.reindex(columns=FEATURE_COLUMNS, fill_value=0)
    return df


#  Shape of the feedback the frontend sends 
class FeedbackIn(BaseModel):
    prediction_id:   int
    action:          Literal["confirmed", "overridden"]
    corrected_label: Optional[int] = None
    note:            Optional[str] = None
    clinician_ref:   Optional[str] = None



#  ROUTES

#  Health check 
@app.get("/")
def health():
    return {
        "status": "online",
        "model_features": len(FEATURE_COLUMNS),
        "threshold": THRESHOLD,
    }


#  List all patients (for the dashboard) 
@app.get("/patients")
def list_patients():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT patient_id, external_ref, age, gender,
               admission_type, discharge_location,
               probability::float AS probability, risk_tier
        FROM v_patient_latest_risk
        ORDER BY patient_id;
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows


#  Predict + explain one patient, then save to Aurora 
@app.get("/predict/{patient_id}")
def predict(patient_id: int):
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Fetch the patient.
    cur.execute(
        "SELECT patient_id, external_ref, features FROM patients WHERE patient_id = %s",
        (patient_id,),
    )
    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        return {"error": f"No patient with id {patient_id}"}

    # 2. Encode + predict + explain.
    X = preprocess_patient(row["features"])
    result = model.explain_patient(X)

    # 3. Save the prediction (and get its new id).
    cur.execute("""
        INSERT INTO predictions
          (patient_id, model_id, probability, risk_tier, predicted_label, threshold_used)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING prediction_id;
    """, (patient_id, MODEL_ID, result["probability"], result["risk_tier"],
          result["prediction"], THRESHOLD))
    prediction_id = cur.fetchone()["prediction_id"]

    # 4. Save each SHAP factor.
    for rank, factor in enumerate(result["top_factors"], start=1):
        cur.execute("""
            INSERT INTO shap_values (prediction_id, feature_name, impact, abs_rank)
            VALUES (%s, %s, %s, %s);
        """, (prediction_id, factor["feature"], factor["impact"], rank))

    # 5. Save an audit record.
    cur.execute("""
        INSERT INTO audit_log (event_type, entity_type, entity_id, payload)
        VALUES ('PREDICTION_MADE', 'prediction', %s, %s);
    """, (prediction_id, json.dumps({
        "patient_id": patient_id,
        "probability": result["probability"],
        "risk_tier": result["risk_tier"],
    })))

    conn.commit()
    cur.close(); conn.close()

    # 6. Send the answer back to the dashboard.
    return {
        "prediction_id": prediction_id,
        "patient_id":    row["patient_id"],
        "external_ref":  row["external_ref"],
        "probability":   result["probability"],
        "risk_tier":     result["risk_tier"],
        "prediction":    result["prediction"],
        "top_factors":   result["top_factors"],
    }


#  Save clinician feedback (Confirm / Override) 
@app.post("/feedback")
def submit_feedback(fb: FeedbackIn):
    conn = get_conn()
    cur = conn.cursor()

    # 1. Save the clinician's decision.
    cur.execute("""
        INSERT INTO clinician_feedback
          (prediction_id, clinician_ref, action, corrected_label, notes)
        VALUES (%s, %s, %s, %s, %s) RETURNING feedback_id;
    """, (fb.prediction_id, fb.clinician_ref, fb.action, fb.corrected_label, fb.note))
    feedback_id = cur.fetchone()[0]

    # 2. Save an audit record.
    cur.execute("""
        INSERT INTO audit_log (event_type, entity_type, entity_id, payload)
        VALUES ('FEEDBACK_GIVEN', 'feedback', %s, %s);
    """, (feedback_id, json.dumps({
        "prediction_id": fb.prediction_id,
        "action": fb.action,
    })))

    conn.commit()
    cur.close(); conn.close()
    return {"feedback_id": feedback_id, "status": "saved"}


#  Privacy Report 
@app.get("/privacy-report")
def privacy_report():
    from model import accountant
    return {
        "epsilon_spent": round(accountant.total_spent, 2),
        "delta": accountant.delta,
        "noise_multiplier": round(accountant.get_noise_multiplier(), 4),
        "rounds_completed": int(accountant.total_spent / accountant.epsilon_spent_per_round) if accountant.epsilon_spent_per_round else 0,
        "privacy_guarantee": f"Patient data is protected with ({accountant.total_spent:.2f}, {accountant.delta})-DP"
    }

