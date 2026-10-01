"""Federated client = one hospital node. Trains a local XGBoost model on its own
data shard and sends only the model (never data) to the central server."""
import flwr as fl
import argparse
import sys
from model import HospitalReadmissionModel  # <-- FIX 1: Updated to new class name
from federated_nodes import FederatedDataSimulator

class HospitalClient(fl.client.NumPyClient):
    def __init__(self, model, X_train, y_train, X_test, y_test, hospital_id):
        self.model = model
        self.X_train = X_train
        self.y_train = y_train
        self.X_test = X_test
        self.y_test = y_test
        self.hospital_id = hospital_id

    def get_parameters(self, config):
        # Extracts the XGBoost Booster bytes to send to AWS
        return self.model.get_weights()

    def fit(self, parameters, config):
        print(f"\n---> [{self.hospital_id}] Received Global Weights. Training locally...")
        self.model.set_weights(parameters)
        self.model.train_local_model(self.X_train, self.y_train)

        score=self.model.get_auc(self.X_test,self.y_test)
        print(f"[{self.hospital_id}] Local ROC-AUC={score:.4F}")

        try:
            from model import accountant
            print(f"Privacy spent: epsilon={accountant.total_spent:.2f}, delta={accountant.delta}")
        except ImportError:
            pass

        return self.model.get_weights(),len(self.X_train),{"score":float(score)}
        
        

    def evaluate(self, parameters, config):
        self.model.set_weights(parameters)
        
        self.model.tune_threshold(self.X_train, self.y_train)
        accuracy=self.model.evaluate_model(self.X_test, self.y_test)
        print(f"[{self.hospital_id}] Local evaluation accuracy: {accuracy * 100:.2f}%")
        return float(1.0 - accuracy), len(self.X_test), {"accuracy": float(accuracy)}

      

def start_hospital_node():
    # 1. Parse command line arguments to identify which hospital this is
    parser = argparse.ArgumentParser(description="Hospital FL Client")
    parser.add_argument("--node", type=int, required=True, help="Node ID (0, 1, or 2)")
    # We default to AWS IP for testing
    parser.add_argument("--server", type=str, default="13.233.100.191:8080", help="AWS Server IP")
    args = parser.parse_args()

    print(f"Booting Secure Edge Client for Hospital Node {args.node}...")

    

    # 2. Load the specifically isolated dataset for this specific node
    simulator = FederatedDataSimulator()
    nodes_data = simulator.create_hospital_nodes(num_nodes=3)
    my_data = nodes_data[args.node]
    
    # 3. Initialize the XGBoost architecture
    local_model = HospitalReadmissionModel()
    client = HospitalClient(
        model=local_model,
        X_train=my_data["X_train"],
        y_train=my_data["y_train"],
        X_test=my_data["X_test"],
        y_test=my_data["y_test"],
        hospital_id=my_data["hospital_id"]
    )

    # 5. Connect securely to the Central Server
    print(f"Attempting to connect to AWS Aggregator at {args.server}...")
    fl.client.start_numpy_client(server_address=args.server, client=client)

if __name__ == "__main__":
    start_hospital_node()
