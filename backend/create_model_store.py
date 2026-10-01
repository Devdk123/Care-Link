"""Creates the model_store table in Aurora (BYTEA model bytes + JSONB metadata)."""
import psycopg2
import os
conn = psycopg2.connect(
    host="aurora-hospital-db.cluster-ch02wk02ky83.ap-south-1.rds.amazonaws.com",
    port="5432", dbname="postgres", user="postgres", password=os.environ.get("AURORA_PASSWORD", ""),
)
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS model_store (
    model_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_blob      BYTEA NOT NULL,
    threshold       NUMERIC(4,3) NOT NULL,
    feature_columns JSONB NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
""")
print("model_store table ready.")

cur.close()
conn.close()
