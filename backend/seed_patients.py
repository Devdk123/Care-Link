"""Runs schema.sql against Aurora to create all tables (first-time DB setup)."""
import psycopg2
import json
import pandas as pd
import os

# Load the synthetic MIMIC demo patients (public-safe)
df = pd.read_csv("data/demo_patients.csv")
df = df.astype(object).where(pd.notnull(df), None)   # NaN -> None for SQL

conn = psycopg2.connect(
    host="aurora-hospital-db.cluster-ch02wk02ky83.ap-south-1.rds.amazonaws.com",
    port="5432", dbname="postgres", user="postgres", password=os.environ.get("AURORA_PASSWORD", ""),
)
conn.autocommit = True
cur = conn.cursor()

# Start fresh so re-running is safe
cur.execute("DELETE FROM patients;")

insert_sql = """
    INSERT INTO patients
      (external_ref, age, gender, admission_type, discharge_location,
       insurance, length_of_stay, prior_admissions, num_diagnoses, features)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

for i, row in df.iterrows():
    cur.execute(insert_sql, (
        row.get("external_ref") or f"HX-{i:04d}",
        int(row["age"]) if row["age"] is not None else None,
        row["gender"],
        row["admission_type"],
        row["discharge_location"],
        row["insurance"],
        float(row["length_of_stay"]) if row["length_of_stay"] is not None else None,
        int(row["prior_admissions_count"]) if row["prior_admissions_count"] is not None else 0,
        int(row["num_diagnoses"]) if row["num_diagnoses"] is not None else 0,
        json.dumps(row.to_dict()),     # full MIMIC record -> features (model input)
    ))

cur.execute("SELECT COUNT(*) FROM patients;")
print("Patients loaded:", cur.fetchone()[0])

cur.close()
conn.close()
