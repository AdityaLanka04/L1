"""
Migration script to add missing columns to flashcard tables
"""
import sqlite3
import os
import random
import string

def generate_share_code():
    """Generate a random 6-character share code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def migrate_database(db_path):
    """Add missing columns to flashcard_sets and flashcards tables"""
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    success = True
    
    try:
        # ===== MIGRATE flashcard_sets TABLE =====
        print("\n--- Checking flashcard_sets table ---")
        cursor.execute("PRAGMA table_info(flashcard_sets)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'share_code' not in columns:
            print("Adding share_code column to flashcard_sets table...")
            cursor.execute("""
                ALTER TABLE flashcard_sets 
                ADD COLUMN share_code VARCHAR(6)
            """)
            
            # Generate unique share codes for existing sets
            cursor.execute("SELECT id FROM flashcard_sets")
            existing_sets = cursor.fetchall()
            
            used_codes = set()
            for (set_id,) in existing_sets:
                # Generate unique code
                while True:
                    code = generate_share_code()
                    if code not in used_codes:
                        used_codes.add(code)
                        break
                
                cursor.execute(
                    "UPDATE flashcard_sets SET share_code = ? WHERE id = ?",
                    (code, set_id)
                )
            
            print(f"✓ Added share_code column and generated codes for {len(existing_sets)} existing sets")
        else:
            print("✓ share_code column already exists")
        
        # ===== MIGRATE flashcards TABLE =====
        print("\n--- Checking flashcards table ---")
        cursor.execute("PRAGMA table_info(flashcards)")
        flashcard_columns = [col[1] for col in cursor.fetchall()]
        
        # Add is_edited column
        if 'is_edited' not in flashcard_columns:
            print("Adding is_edited column to flashcards table...")
            cursor.execute("""
                ALTER TABLE flashcards 
                ADD COLUMN is_edited BOOLEAN DEFAULT 0
            """)
            print("✓ Added is_edited column")
        else:
            print("✓ is_edited column already exists")
        
        # Add edited_at column
        if 'edited_at' not in flashcard_columns:
            print("Adding edited_at column to flashcards table...")
            cursor.execute("""
                ALTER TABLE flashcards 
                ADD COLUMN edited_at DATETIME
            """)
            print("✓ Added edited_at column")
        else:
            print("✓ edited_at column already exists")
        
        conn.commit()
        print("\n✓ All migrations completed successfully")
        return True
        
    except sqlite3.Error as e:
        print(f"\n✗ Database error: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    # Migrate both databases
    databases = [
        "brainwave_tutor.db",
        "../brainwave_tutor.db"
    ]
    
    success_count = 0
    for db_path in databases:
        if os.path.exists(db_path):
            print(f"\nMigrating {db_path}...")
            if migrate_database(db_path):
                success_count += 1
        else:
            print(f"Skipping {db_path} (not found)")
    
    print(f"\n{'='*50}")
    print(f"Migration complete: {success_count} database(s) updated")
    print(f"{'='*50}")
