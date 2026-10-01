import pytest
import numpy as np
import pandas as pd
from backend.model import HospitalReadmissionModel

def test_train_local_model(synthetic_data):
    X_train, y_train = synthetic_data
    model = HospitalReadmissionModel()
    booster = model.train_local_model(X_train, y_train)
    assert booster is not None
    assert model.booster is not None

def test_evaluate_returns_accuracy(synthetic_data):
    X, y = synthetic_data
    model = HospitalReadmissionModel()
    model.train_local_model(X, y)
    acc = model.evaluate_model(X, y)
    assert 0.0 <= acc <= 1.0

def test_tune_threshold(synthetic_data):
    X, y = synthetic_data
    model = HospitalReadmissionModel()
    model.train_local_model(X, y)
    best_t = model.tune_threshold(X, y)
    assert 0.1 <= best_t <= 0.9

def test_predict_with_shap(synthetic_data):
    X, y = synthetic_data
    model = HospitalReadmissionModel()
    model.train_local_model(X, y)
    result = model.predict_with_shap(X.iloc[[0]])
    
    assert 0.0 <= result["probability"][0] <= 1.0
    assert result["prediction"][0] in [0, 1]
    assert len(result["shap_values"][0]) == X.shape[1]

def test_explain_patient(synthetic_data):
    X, y = synthetic_data
    model = HospitalReadmissionModel()
    model.train_local_model(X, y)
    explanation = model.explain_patient(X.iloc[[0]])
    
    assert explanation["risk_tier"] in ['Low', 'Medium', 'High']
    assert 0.0 <= explanation["probability"] <= 1.0
    assert len(explanation["top_factors"]) > 0

def test_get_set_weights_roundtrip(synthetic_data):
    X, y = synthetic_data
    model1 = HospitalReadmissionModel()
    model1.train_local_model(X, y)
    
    weights = model1.get_weights()
    
    model2 = HospitalReadmissionModel()
    model2.set_weights(weights)
    
    weights2 = model2.get_weights()
    
    # Assert that the roundtrip produces identical bytes
    np.testing.assert_array_equal(weights[0], weights2[0])
