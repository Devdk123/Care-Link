"""Splits the master dataset into 3 simulated hospitals (50/30/20, stratified),
giving each federated client its own private training/test set."""
import pandas as pd
import os
from sklearn.model_selection import train_test_split

class FederatedDataSimulator:
    def __init__(self):
        self.data_path = "data/readmission_master.csv"
        
    def fetch_local_data(self):
        """Loads the secure local dataset (currently using the synthetic twin)."""
        print(f"Loading local dataset from {self.data_path}...")
        
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(
                f"[ERROR] Data file not found at {self.data_path}. "
                "Ensure you have run the synthetic generator script."
            )
            
        df = pd.read_csv(self.data_path)
        print(f"Successfully loaded {len(df)} patient records.")
        return df

    def create_hospital_nodes(self, num_nodes=3):
        df = self.fetch_local_data()

        # shuffle once so the splits are fair random samples (just different sizes)
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)

        target_column = "readmitted_30days"
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' missing.")

        y = df[target_column]
        drop_cols = [target_column]
        for c in ["subject_id", "hadm_id"]:
            if c in df.columns:
                drop_cols.append(c)
        X = df.drop(columns=drop_cols)

        # --- Unequal hospital sizes: 50% / 30% / 20% (realistic) ---
        fractions = [0.5, 0.3, 0.2]
        n = len(df)
        bounds, cum = [0], 0.0
        for f in fractions:
            cum += f
            bounds.append(int(n * cum))
        bounds[-1] = n   # make sure the last node takes the remainder

        print(f"\nPartitioning {n} records into 3 hospitals (50/30/20)...")
        nodes_data = []
        for i in range(num_nodes):
            start, end = bounds[i], bounds[i + 1]
            X_chunk, y_chunk = X.iloc[start:end], y.iloc[start:end]

            # 80/20 train/test INSIDE each hospital (stratified)
            X_train, X_test, y_train, y_test = train_test_split(
                X_chunk, y_chunk, test_size=0.2, random_state=42, stratify=y_chunk)

            nodes_data.append({
                "hospital_id": f"Hospital_Node_{i+1}",
                "X_train": X_train, "X_test": X_test,
                "y_train": y_train, "y_test": y_test,
            })
            print(f"  {nodes_data[-1]['hospital_id']}: {len(X_chunk)} patients "
                  f"({len(X_train)} train / {len(X_test)} test)")
        return nodes_data
