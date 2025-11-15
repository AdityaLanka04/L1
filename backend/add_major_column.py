import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    result = conn.execute(text('PRAGMA table_info(comprehensive_user_profiles)'))
    cols = [row[1] for row in result]
    
    if 'major' not in cols:
        conn.execute(text('ALTER TABLE comprehensive_user_profiles ADD COLUMN major VARCHAR(200)'))
        conn.commit()
        print('✅ Added major column')
    else:
        print('✅ Major column already exists')
