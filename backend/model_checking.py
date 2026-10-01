"""Evaluates the trained model — ROC-AUC, recall, Cohen's Kappa, threshold tuning —
to sanity-check it before deployment."""
from federated_nodes import FederatedDataSimulator
from model import HospitalReadmissionModel

nodes = FederatedDataSimulator().create_hospital_nodes(num_nodes=3)
m = HospitalReadmissionModel()
m.train_local_model(nodes[0]["X_train"], nodes[0]["y_train"])
print("Trained! Number of trees:", m.booster.num_boosted_rounds())
m.tune_threshold(nodes[0]["X_train"], nodes[0]["y_train"])
m.evaluate_model(nodes[0]["X_test"], nodes[0]["y_test"])
w = m.get_weights()
print("Serialized model size:", w[0].shape, "bytes")

m2 = HospitalReadmissionModel()
m2.set_weights(w)
m2.evaluate_model(nodes[0]["X_test"], nodes[0]["y_test"])
out = m.predict_with_shap(nodes[0]["X_test"].iloc[[0]])
print("Risk probability:", out["probability"][0])
print("Prediction:", out["prediction"][0])
print("Top feature pushes:", out["shap_values"][0][:5])
import json
explanation = m.explain_patient(nodes[0]["X_test"].iloc[[0]])
print(json.dumps(explanation, indent=2))
