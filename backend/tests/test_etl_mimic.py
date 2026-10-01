import pytest
import pandas as pd
import numpy as np
from backend.etl_mimic import build_label, engineer

@pytest.fixture
def mimic_synthetic():
    np.random.seed(42)
    # Mock admissions
    adm = pd.DataFrame({
        "subject_id": [1, 1, 2, 3, 3, 3],
        "hadm_id": [100, 101, 102, 103, 104, 105],
        "admittime": pd.to_datetime(["2020-01-01", "2020-01-15", "2020-02-01", "2020-03-01", "2020-04-01", "2020-04-10"]),
        "dischtime": pd.to_datetime(["2020-01-05", "2020-01-20", "2020-02-05", "2020-03-05", "2020-04-05", "2020-04-15"]),
        "hospital_expire_flag": [0, 0, 0, 0, 0, 0],
        "admission_type": ["EMER", "URGENT", "EW EMER.", "ELECTIVE", "URGENT", "EMER"],
        "admission_location": ["ER", "CLINIC", "ER", "REFERRAL", "CLINIC", "ER"],
        "discharge_location": ["HOME", "HOME", "HOME", "HOME", "HOME", "HOME"],
        "insurance": ["Other", "Medicare", "Medicaid", "Other", "Medicare", "Medicaid"],
        "marital_status": ["MARRIED", "SINGLE", "SINGLE", "DIVORCED", "WIDOWED", "MARRIED"],
        "race": ["WHITE", "BLACK", "ASIAN", "WHITE", "WHITE", "OTHER"]
    })
    
    # Mock patients
    pat = pd.DataFrame({
        "subject_id": [1, 2, 3],
        "gender": ["F", "M", "M"],
        "anchor_age": [45, 60, 72]
    })
    
    # Mock diagnoses (give hadm_id 100 some diabetes codes)
    dx = pd.DataFrame({
        "subject_id": [1, 1, 2, 3],
        "hadm_id": [100, 100, 102, 103],
        "icd_code": ["25000", "4280", "5859", "140"]
    })
    
    return adm, pat, dx

def test_build_label(mimic_synthetic):
    adm, _, _ = mimic_synthetic
    labeled_adm = build_label(adm)
    
    assert "readmitted_30days" in labeled_adm.columns
    # Check that values are only 0 or 1
    assert set(labeled_adm["readmitted_30days"].unique()).issubset({0, 1})
    
    # Patient 1 readmitted in 10 days (100 -> 101) => 1
    # Patient 3 readmitted in 27 days (103 -> 104) => 1, then in 5 days (104 -> 105) => 1
    assert labeled_adm[labeled_adm["hadm_id"] == 100]["readmitted_30days"].iloc[0] == 1

def test_engineer_has_comorbidity_flags(mimic_synthetic):
    adm, pat, dx = mimic_synthetic
    labeled_adm = build_label(adm)
    engineered_df = engineer(labeled_adm, pat, dx)
    
    assert "has_diabetes" in engineered_df.columns
    assert "has_heart_failure" in engineered_df.columns
    assert "has_renal" in engineered_df.columns
    assert "has_cancer" in engineered_df.columns
    
    # hadm_id 100 had 25000 (diabetes) and 4280 (HF)
    # The engineered dataframe doesn't keep hadm_id, but the first row corresponds to it
    assert engineered_df.iloc[0]["has_diabetes"] == 1
    assert engineered_df.iloc[0]["has_heart_failure"] == 1
