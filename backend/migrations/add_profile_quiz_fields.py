"""
Migration: Add new profile quiz fields
Adds is_college_student, college_level, and main_subject fields to comprehensive_user_profiles
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine

def upgrade():
    """Add new fields to comprehensive_user_profiles table"""
    with engine.connect() as connection:
        try:
            # Check if columns exist first
            result = connection.execute(text("PRAGMA table_info(comprehensive_user_profiles)"))
            existing_columns = [row[1] for row in result]
            
            # Add is_college_student column if it doesn't exist
            if 'is_college_student' not in existing_columns:
                connection.execute(text("""
                    ALTER TABLE comprehensive_user_profiles 
                    ADD COLUMN is_college_student BOOLEAN DEFAULT 1
                """))
                print("✅ Added is_college_student column")
            
            # Add college_level column if it doesn't exist
            if 'college_level' not in existing_columns:
                connection.execute(text("""
                    ALTER TABLE comprehensive_user_profiles 
                    ADD COLUMN college_level VARCHAR(100)
                """))
                print("✅ Added college_level column")
            
            # Add main_subject column if it doesn't exist
            if 'main_subject' not in existing_columns:
                connection.execute(text("""
                    ALTER TABLE comprehensive_user_profiles 
                    ADD COLUMN main_subject VARCHAR(200)
                """))
                print("✅ Added main_subject column")
            
            connection.commit()
            print("✅ Migration completed: Added profile quiz fields")
            
        except Exception as e:
            connection.rollback()
            print(f"❌ Migration failed: {str(e)}")
            raise

def downgrade():
    """Remove the added fields"""
    with engine.connect() as connection:
        try:
            connection.execute(text("""
                ALTER TABLE comprehensive_user_profiles 
                DROP COLUMN IF EXISTS is_college_student,
                DROP COLUMN IF EXISTS college_level,
                DROP COLUMN IF EXISTS main_subject
            """))
            
            connection.commit()
            print("✅ Migration rollback completed")
            
        except Exception as e:
            connection.rollback()
            print(f"❌ Migration rollback failed: {str(e)}")
            raise

if __name__ == "__main__":
    upgrade()
