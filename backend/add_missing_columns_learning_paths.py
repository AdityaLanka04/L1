"""
Migration script to add missing columns to learning_path_nodes table
Adds: prerequisites, resources
"""
import sqlite3
import sys
import os

def migrate():
    """Add missing columns to learning_path_nodes table"""
    db_path = os.path.join(os.path.dirname(__file__), "brainwave_tutor.db")
    
    print(f"🔄 Adding missing columns to learning_path_nodes table...")
    print(f"Database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check existing columns
        cursor.execute("PRAGMA table_info(learning_path_nodes);")
        existing_columns = [row[1] for row in cursor.fetchall()]
        print(f"\nExisting columns: {existing_columns}")
        
        # Add prerequisites column if missing
        if 'prerequisites' not in existing_columns:
            print("\n➕ Adding 'prerequisites' column...")
            cursor.execute("""
                ALTER TABLE learning_path_nodes 
                ADD COLUMN prerequisites JSON
            """)
            print("✅ Added 'prerequisites' column")
        else:
            print("\n✓ 'prerequisites' column already exists")
        
        # Add resources column if missing
        if 'resources' not in existing_columns:
            print("\n➕ Adding 'resources' column...")
            cursor.execute("""
                ALTER TABLE learning_path_nodes 
                ADD COLUMN resources JSON
            """)
            print("✅ Added 'resources' column")
        else:
            print("\n✓ 'resources' column already exists")
        
        conn.commit()
        conn.close()
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()
