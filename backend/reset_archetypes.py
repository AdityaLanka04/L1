import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

cursor.execute('UPDATE comprehensive_user_profiles SET primary_archetype = NULL, secondary_archetype = NULL, archetype_scores = NULL, archetype_description = NULL')

conn.commit()
conn.close()

print("✅ All user archetypes have been reset. Users will be prompted to take the quiz.")