import pytest
from unittest.mock import patch
import pandas as pd
import numpy as np
from backend.federated_nodes import FederatedDataSimulator

@pytest.fixture
def simulator(synthetic_df):
    sim = FederatedDataSimulator()
    # Mock fetch_local_data to return synthetic dataframe
    sim.fetch_local_data = lambda: synthetic_df
    return sim

def test_create_hospital_nodes_returns_3(simulator):
    nodes = simulator.create_hospital_nodes(num_nodes=3)
    assert len(nodes) == 3

def test_node_sizes_sum_to_total(simulator, synthetic_df):
    nodes = simulator.create_hospital_nodes(num_nodes=3)
    total_train = sum(len(n["X_train"]) for n in nodes)
    total_test = sum(len(n["X_test"]) for n in nodes)
    assert total_train + total_test == len(synthetic_df)

def test_stratification(simulator):
    nodes = simulator.create_hospital_nodes(num_nodes=3)
    for node in nodes:
        y_train = node["y_train"]
        # Ensure both classes are present in the training set
        assert 0 in y_train.values
        assert 1 in y_train.values
