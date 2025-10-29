import sys
sys.path.insert(0, 'd:\\Brainwave\\L1\\backend')

from models import Base, Question, engine
import sqlalchemy

print("="*60)
print("Checking Question model definition")
print("="*60)

# Get the model's columns
print("\nQuestion model columns:")
for col in Question.__table__.columns:
    print(f"  {col.name}: {col.type}")

# Get actual database table columns
print("\nActual database table columns:")
import sqlite3
conn = sqlite3.connect('d:\\Brainwave\\L1\\brainwave_tutor.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(questions)")
for row in cursor.fetchall():
    print(f"  {row[1]}: {row[2]}")
conn.close()

# Compare
print("\nMismatch check:")
model_cols = {col.name for col in Question.__table__.columns}
db_cols = set()
conn = sqlite3.connect('d:\\Brainwave\\L1\\brainwave_tutor.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(questions)")
for row in cursor.fetchall():
    db_cols.add(row[1])
conn.close()

print(f"Model has: {model_cols}")
print(f"DB has: {db_cols}")
print(f"Missing from DB: {model_cols - db_cols}")
print(f"Extra in DB: {db_cols - model_cols}")