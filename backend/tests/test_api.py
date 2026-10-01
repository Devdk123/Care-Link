import sys
import pytest
import httpx
import json
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock
from backend.model import HospitalReadmissionModel

# Create a valid dummy XGBoost model blob to bypass XGBoost loading errors
temp_model = HospitalReadmissionModel()
# 86 features are expected by the API, but the API gets features from the DB row.
# We will just supply dummy features. Let's provide 10 features.
dummy_features = [f"feature_{i}" for i in range(10)]
temp_model.train_local_model(pd.DataFrame(np.random.rand(10, 10), columns=dummy_features), pd.Series(np.random.randint(0, 2, 10)))
valid_blob = temp_model.booster.save_raw("json")

# Create mocks
mock_psycopg2 = MagicMock()
mock_conn = MagicMock()
mock_cur = MagicMock()
mock_psycopg2.connect.return_value = mock_conn
mock_conn.cursor.return_value = mock_cur
mock_psycopg2.extras.RealDictCursor = "RealDictCursor"

# Define what fetchone returns for the module-level queries:
# 1. model_store query
# 2. ensure_model_registered query
mock_cur.fetchone.side_effect = [
    (valid_blob, 0.5, json.dumps(dummy_features)),  
    (1,), 
]

# Inject mock into sys.modules BEFORE importing backend.api
sys.modules['psycopg2'] = mock_psycopg2
sys.modules['psycopg2.extras'] = MagicMock()

from backend.api import app

@pytest.fixture
def mock_db():
    # Reset the mock for each test to avoid side_effect exhaustion
    mock_cur.reset_mock()
    yield mock_cur

@pytest.mark.asyncio
async def test_health_endpoint():
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert response.json() == {"status": "online", "model_features": 10, "threshold": 0.5}

@pytest.mark.asyncio
async def test_list_patients(mock_db):
    mock_db.fetchall.return_value = [
        {"patient_id": 1, "external_ref": "REF1", "probability": 0.8, "risk_tier": "High"}
    ]
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/patients")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["patient_id"] == 1

@pytest.mark.asyncio
async def test_predict_valid_patient(mock_db):
    # Mock for predict:
    # 1. fetchone for patient features
    # 2. fetchone for inserted prediction_id
    mock_db.fetchone.side_effect = [
        {"patient_id": 1, "external_ref": "REF1", "features": {f: 0 for f in dummy_features}},
        {"prediction_id": 123}
    ]
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/predict/1")
        assert response.status_code == 200
        data = response.json()
        assert "probability" in data
        assert "risk_tier" in data
        assert "top_factors" in data

@pytest.mark.asyncio
async def test_predict_invalid_id(mock_db):
    mock_db.fetchone.return_value = None
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/predict/99999")
        assert response.status_code == 200
        data = response.json()
        assert "error" in data

@pytest.mark.asyncio
async def test_feedback_confirm(mock_db):
    mock_db.fetchone.return_value = [456] # Returning feedback_id
    
    payload = {
        "prediction_id": 123,
        "action": "confirmed",
        "clinician_ref": "Dr. Smith"
    }
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["feedback_id"] == 456
        assert data["status"] == "saved"

@pytest.mark.asyncio
async def test_feedback_override(mock_db):
    mock_db.fetchone.return_value = [789] # Returning feedback_id
    
    payload = {
        "prediction_id": 123,
        "action": "overridden",
        "corrected_label": 1,
        "note": "Patient looks sick",
        "clinician_ref": "Dr. Jones"
    }
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["feedback_id"] == 789
        assert data["status"] == "saved"
