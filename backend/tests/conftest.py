import pytest
import numpy as np
import pandas as pd

@pytest.fixture
def synthetic_data():
    np.random.seed(42)
    # 100 rows, 10 features
    X = pd.DataFrame(np.random.rand(100, 10), columns=[f'feature_{i}' for i in range(10)])
    y = pd.Series(np.random.randint(0, 2, 100))
    return X, y

@pytest.fixture
def synthetic_df():
    np.random.seed(42)
    # Synthetic dataframe for ETL testing
    df = pd.DataFrame({
        'subject_id': range(50),
        'hadm_id': range(1000, 1050),
        'readmitted_30days': np.random.randint(0, 2, 50),
        'has_diabetes': np.random.randint(0, 2, 50),
        'has_heart_failure': np.random.randint(0, 2, 50),
        'length_of_stay': np.random.rand(50) * 10
    })
    return df
