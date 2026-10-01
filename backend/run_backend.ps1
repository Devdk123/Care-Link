cd c:\Users\nisha\OneDrive\Documents\Downloads\carelink\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install fastapi uvicorn pandas xgboost scikit-learn psycopg2-binary flwr pydantic httpx
uvicorn api:app --reload --port 8001
