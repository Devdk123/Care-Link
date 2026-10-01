# score_all.py
# Run ONCE on EC2 (in the app folder) to score every patient.
# Reuses api.py's model, DB connection, and preprocessing, then writes
# a prediction (+ SHAP factors) for each patient so /patients shows them all.

from api import get_conn, preprocess_patient, model, MODEL_ID, THRESHOLD
from psycopg2.extras import RealDictCursor

conn = get_conn()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT patient_id, features FROM patients ORDER BY patient_id;")
patients = cur.fetchall()
print(f"Scoring {len(patients)} patients...")

done = 0
failed = 0
for p in patients:
    pid = p["patient_id"]
    try:
        X = preprocess_patient(p["features"])
        result = model.explain_patient(X)

        cur.execute(
            """
            INSERT INTO predictions
              (patient_id, model_id, probability, risk_tier,
               predicted_label, threshold_used)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING prediction_id;
            """,
            (pid, MODEL_ID, result["probability"], result["risk_tier"],
             result["prediction"], THRESHOLD),
        )
        prediction_id = cur.fetchone()["prediction_id"]

        for rank, factor in enumerate(result["top_factors"], start=1):
            cur.execute(
                """
                INSERT INTO shap_values (prediction_id, feature_name, impact, abs_rank)
                VALUES (%s, %s, %s, %s);
                """,
                (prediction_id, factor["feature"], factor["impact"], rank),
            )

        conn.commit()
        done += 1
        if done % 20 == 0:
            print(f"  scored {done}/{len(patients)}")
    except Exception as e:
        conn.rollback()
        failed += 1
        print(f"  ! patient {pid} failed: {e}")

cur.close()
conn.close()
print(f"Done - scored {done} patients, {failed} failed.")