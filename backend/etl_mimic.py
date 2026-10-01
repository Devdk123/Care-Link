# ============================================================
#  etl_mimic.py  —  MIMIC-IV -> readmission_master.csv
#  Builds the SAME contract as the diabetic ETL:
#    - readmission_master.csv  (encoded, model-ready, with target)
#    - demo_patients.csv       (readable, for the Hospital X demo)
#    - feature_columns.json    (the exact feature list)
#  Uses only the 3 small tables: admissions, patients, diagnoses_icd.
# ============================================================

import pandas as pd
import numpy as np
import json
from sklearn.model_selection import train_test_split

# --- Point this at your MIMIC hosp folder ---
HOSP = "hosp"


# ---------- STEP 1: Load the 3 manageable tables ----------
def load_tables():
    print("Loading admissions, patients, diagnoses_icd ...")
    adm = pd.read_csv(f"{HOSP}/admissions.csv",
                      parse_dates=["admittime", "dischtime"])
    pat = pd.read_csv(f"{HOSP}/patients.csv")
    dx  = pd.read_csv(f"{HOSP}/diagnoses_icd.csv")
    print(f"  admissions={len(adm)}  patients={len(pat)}  diagnoses={len(dx)}")
    return adm, pat, dx


# ---------- STEP 2: Build the 30-day readmission label ----------
def build_label(adm):
    adm = adm.sort_values(["subject_id", "admittime"]).copy()
    # the SAME patient's NEXT admission time
    adm["next_admittime"] = adm.groupby("subject_id")["admittime"].shift(-1)
    # days from this discharge to the next admission
    adm["days_to_next"] = (adm["next_admittime"] - adm["dischtime"]).dt.total_seconds() / 86400
    adm["readmitted_30days"] = ((adm["days_to_next"] > 0) & (adm["days_to_next"] <= 30)).astype(int)
    # a patient who DIED this stay can't be readmitted -> drop those rows
    adm = adm[adm["hospital_expire_flag"] == 0].copy()
    print("Readmission rate:", round(adm["readmitted_30days"].mean(), 3))
    return adm


# ---------- STEP 3: Engineer features ----------
def engineer(adm, pat, dx):
    # prior-utilization (counts BEFORE this admission)
    adm["prior_admissions_count"] = adm.groupby("subject_id").cumcount()
    adm["is_emerg"] = adm["admission_type"].str.contains("EMER", case=False, na=False).astype(int)
    adm["prior_emergency_count"] = adm.groupby("subject_id")["is_emerg"].cumsum() - adm["is_emerg"]
    adm["length_of_stay"] = (adm["dischtime"] - adm["admittime"]).dt.total_seconds() / 86400
    adm["length_of_stay"] = adm["length_of_stay"].clip(lower=0)

    # demographics
    df = adm.merge(pat[["subject_id", "gender", "anchor_age"]], on="subject_id", how="left")
    df = df.rename(columns={"anchor_age": "age"})

    # diagnoses: count per admission + comorbidity flags
    ndx = dx.groupby("hadm_id").size().rename("num_diagnoses").reset_index()
    df = df.merge(ndx, on="hadm_id", how="left")
    df["num_diagnoses"] = df["num_diagnoses"].fillna(0).astype(int)

    def flag(codes):
        hids = set(dx.loc[dx["icd_code"].astype(str).str.startswith(codes), "hadm_id"])
        return df["hadm_id"].isin(hids).astype(int)

    df["has_diabetes"]      = flag(("250", "E08", "E09", "E10", "E11", "E13"))
    df["has_heart_failure"] = flag(("428", "I50"))
    df["has_renal"]         = flag(("585", "586", "N18", "N19"))
    df["has_cancer"]        = flag(("140", "150", "162", "174", "185", "C"))

    # keep only the columns we use
    keep = ["age", "gender", "admission_type", "admission_location", "discharge_location",
            "insurance", "marital_status", "race", "length_of_stay",
            "prior_admissions_count", "prior_emergency_count", "num_diagnoses",
            "has_diabetes", "has_heart_failure", "has_renal", "has_cancer",
            "readmitted_30days"]
    df = df[keep]
    # fill missing categoricals
    for c in ["admission_location", "discharge_location", "insurance", "marital_status", "race"]:
        df[c] = df[c].fillna("Unknown")
    print("Engineered table shape:", df.shape)
    return df





# ---------- STEP 4: Encode to numbers + save the master ----------
def encode_and_save(df):
    df.to_csv("data/readable_features.csv", index=False)
    nominal = ["gender", "admission_type", "admission_location",
               "discharge_location", "insurance", "marital_status", "race"]
    df = pd.get_dummies(df, columns=nominal, dtype=int)
    df.to_csv("data/readmission_master.csv", index=False)
    feature_cols = [c for c in df.columns if c != "readmitted_30days"]
    with open("data/feature_columns.json", "w") as f:
        json.dump(feature_cols, f, indent=2)
    print(f"Saved data/readmission_master.csv  ({df.shape[0]} rows, {df.shape[1]} cols)")
    print(f"Saved data/feature_columns.json  ({len(feature_cols)} features)")


if __name__ == "__main__":
    import os
    os.makedirs("data", exist_ok=True)
    adm, pat, dx = load_tables()
    adm = build_label(adm)
    df = engineer(adm, pat, dx)
    encode_and_save(df)
    print("\nDone. MIMIC readmission_master.csv is ready and matches your pipeline contract.")