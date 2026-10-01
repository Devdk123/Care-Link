import psycopg2
import os
conn = psycopg2.connect(
    host="aurora-hospital-db.cluster-ch02wk02ky83.ap-south-1.rds.amazonaws.com",
    port="5432",
    dbname="postgres",
    user="postgres",
    password=os.environ.get("AURORA_PASSWORD", ""),
)
conn.autocommit = True
cur = conn.cursor()

# 1. Wipe EVERYTHING in the public schema 
cur.execute("DROP SCHEMA public CASCADE;")
cur.execute("CREATE SCHEMA public;")
print("✅ Aurora wiped clean.")

# 2. Build our fresh schema from the file.
with open("schema.sql", "r") as f:
    cur.execute(f.read())
print("✅ Fresh tables created.")

# 3. Show what now exists.
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name;
""")
for row in cur.fetchall():
    print("  -", row[0])

cur.close()
conn.close()