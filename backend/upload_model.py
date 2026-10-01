"""Reads global_model.json + metadata and INSERTs the model into Aurora's
model_store table (run on EC2 #1 after training)."""
import psycopg2
import json
import os
# 1. Read the trained model bytes and its metadata
with open("global_model.json", "rb") as f:      # "rb" = read as raw bytes
    model_bytes = f.read()
with open("model_meta.json") as f:
    meta = json.load(f)

# 2. Connect to Aurora
conn = psycopg2.connect(
    host="aurora-hospital-db.cluster-ch02wk02ky83.ap-south-1.rds.amazonaws.com",
    port="5432", dbname="postgres", user="postgres", password=os.environ.get("AURORA_PASSWORD", ""),
)
conn.autocommit = True
cur = conn.cursor()

# 3. Keep only the latest model, then insert this one
cur.execute("DELETE FROM model_store;")
cur.execute("""
    INSERT INTO model_store (model_blob, threshold, feature_columns)
    VALUES (%s, %s, %s);
""", (psycopg2.Binary(model_bytes), meta["threshold"], json.dumps(meta["feature_columns"])))

print(f"Model uploaded to Aurora: {len(model_bytes)} bytes, {len(meta['feature_columns'])} features.")
cur.close()
conn.close()
