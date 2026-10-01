"""Orchestrates a full federated training run end-to-end, producing global_model.json."""
from model import HospitalReadmissionModel
import pandas as pd
import json

# Load the full training data (this stands in for the federated global model).
df = pd.read_csv("data/readmission_master.csv")
X = df.drop(columns=["readmitted_30days"])
y = df["readmitted_30days"]

# Train and tune.
m = HospitalReadmissionModel()

#  activate imbalance handling for MIMIC's real ~10% imbalance 
neg, pos = (y == 0).sum(), (y == 1).sum()
m.params["scale_pos_weight"] = neg / pos
print("scale_pos_weight =", round(neg / pos, 2))
m.train_local_model(X, y)
m.tune_threshold(X, y)

# Save the two things the API needs to reload this exact model.
m.booster.save_model("global_model.json")           # the trained trees
with open("model_meta.json", "w") as f:
    json.dump({
        "threshold": float(m.threshold),
        "feature_columns": list(X.columns),          # exact column order
    }, f, indent=2)

print(" Saved global_model.json and model_meta.json")
print("Threshold:", round(m.threshold, 3), "| Features:", len(X.columns))
