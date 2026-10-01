"""Federated aggregation server (Flower). Receives each hospital's XGBoost model
and combines them by bagging (merging trees) into one global model on EC2 #1."""
import flwr as fl
import xgboost as xgb
import numpy as np
import json
from flwr.common import parameters_to_ndarrays, ndarrays_to_parameters

NUM_ROUNDS = 1
MIN_CLIENTS = 3


def combine_boosters(a_bytes, b_bytes):
    """Merge model B's trees into model A (bagging). JSON bytes in, JSON bytes out."""
    a = json.loads(bytearray(a_bytes))
    b = json.loads(bytearray(b_bytes))
    am = a["learner"]["gradient_booster"]["model"]
    bm = b["learner"]["gradient_booster"]["model"]
    n_a = int(am["gbtree_model_param"]["num_trees"])
    for tree in bm["trees"]:
        tree = dict(tree)
        tree["id"] = n_a + tree["id"]
        am["trees"].append(tree)
    am["tree_info"].extend(bm["tree_info"])
    am["gbtree_model_param"]["num_trees"] = str(n_a + int(bm["gbtree_model_param"]["num_trees"]))
    if "iteration_indptr" in am and "iteration_indptr" in bm:
        last = am["iteration_indptr"][-1]
        for v in bm["iteration_indptr"][1:]:
            am["iteration_indptr"].append(last + v)
    return json.dumps(a).encode()


class XGBoostBaggingStrategy(fl.server.strategy.FedAvg):
    def aggregate_fit(self, server_round, results, failures):
        if not results:
            return None, {}

        def to_json_bytes(model_bytes):
            # load ANY format (UBJ or JSON) and re-export as JSON
            bst = xgb.Booster()
            bst.load_model(bytearray(model_bytes))
            return bytes(bst.save_raw("json"))

        global_bytes = None
        for _, fit_res in results:
            raw = parameters_to_ndarrays(fit_res.parameters)[0].tobytes()
            model_json = to_json_bytes(raw)            # normalize to JSON first
            if global_bytes is None:
                global_bytes = model_json
            else:
                global_bytes = combine_boosters(global_bytes, model_json)

        booster = xgb.Booster()
        booster.load_model(bytearray(global_bytes))
        booster.save_model("global_model.json")
        print(f"[Round {server_round}] Bagged {len(results)} hospital models "
              f"-> {booster.num_boosted_rounds()} trees. Saved global_model.json")
              
        try:
            from model import accountant
            print(f"Privacy Guarantee: No individual patient record changes model output by more than "
                  f"{accountant.sensitivity} with probability > 1 - {accountant.delta}.")
            print(f"Privacy spent globally: epsilon={accountant.total_spent:.2f}, delta={accountant.delta}")
        except ImportError:
            pass
            
        return ndarrays_to_parameters([np.frombuffer(global_bytes, dtype=np.uint8)]), {}


def start_cloud_server():
    print("Starting Federated Bagging Server on :8080")
    strategy = XGBoostBaggingStrategy(
        fraction_fit=1.0,
        fraction_evaluate=1.0,
        min_fit_clients=MIN_CLIENTS,
        min_evaluate_clients=MIN_CLIENTS,
        min_available_clients=MIN_CLIENTS,
    )
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=NUM_ROUNDS),
        strategy=strategy,
    )


if __name__ == "__main__":
    start_cloud_server()
