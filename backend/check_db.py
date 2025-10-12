import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

cursor.execute("SELECT * FROM daily_learning_metrics")
for row in cursor.fetchall():
    print(row)

conn.close()