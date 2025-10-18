"""
Complete migration script - adds ALL missing columns to comprehensive_user_profiles
"""
import sqlite3
import os
from datetime import datetime

DATABASE_PATH = "./brainwave_tutor.db"

def get_missing_columns(cursor):
    """Compare model definition with actual database columns"""
    
    # Expected columns from your ComprehensiveUserProfile model
    expected_columns = {
        'id': 'INTEGER PRIMARY KEY',
        'user_id': 'INTEGER',
        'preferred_subjects': 'TEXT',
        'brainwave_goal': 'VARCHAR(100)',
        'difficulty_level': 'VARCHAR(50)',
        'learning_pace': 'VARCHAR(50)',
        'best_study_times': 'TEXT',
        'weak_areas': 'TEXT',
        'strong_areas': 'TEXT',
        'quiz_responses': 'TEXT',
        'quiz_completed': 'BOOLEAN',
        'primary_archetype': 'VARCHAR(50)',
        'secondary_archetype': 'VARCHAR(50)',
        'archetype_scores': 'TEXT',
        'archetype_description': 'TEXT',
        'created_at': 'DATETIME',
        'updated_at': 'DATETIME'
    }
    
    # Get current columns from database
    cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
    current_columns = {column[1]: column[2] for column in cursor.fetchall()}
    
    # Find missing columns
    missing = {}
    for col_name, col_type in expected_columns.items():
        if col_name not in current_columns:
            missing[col_name] = col_type
    
    return missing, current_columns, expected_columns


def run_complete_migration():
    """Add all missing columns to comprehensive_user_profiles table"""
    
    print("=" * 70)
    print("🔧 COMPLETE DATABASE MIGRATION")
    print("=" * 70)
    print(f"\nTarget database: {DATABASE_PATH}\n")
    
    if not os.path.exists(DATABASE_PATH):
        print(f"❌ Error: Database not found at {DATABASE_PATH}")
        return False
    
    try:
        # Backup
        print("Step 1: Creating backup...")
        backup_path = f"{DATABASE_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(DATABASE_PATH, backup_path)
        print(f"✅ Backup created: {backup_path}\n")
        
        # Connect
        print("Step 2: Connecting to database...")
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        print("✅ Connected successfully\n")
        
        # Check table exists
        print("Step 3: Checking table...")
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='comprehensive_user_profiles'
        """)
        if not cursor.fetchone():
            print("❌ Table 'comprehensive_user_profiles' not found!")
            conn.close()
            return False
        print("✅ Table found\n")
        
        # Find missing columns
        print("Step 4: Analyzing table structure...")
        missing_cols, current_cols, expected_cols = get_missing_columns(cursor)
        
        print(f"📊 Current columns: {len(current_cols)}")
        print(f"📊 Expected columns: {len(expected_cols)}")
        print(f"📊 Missing columns: {len(missing_cols)}\n")
        
        if not missing_cols:
            print("✅ All columns are present! No migration needed.\n")
            conn.close()
            return True
        
        # Show what's missing
        print("Missing columns to be added:")
        for col_name, col_type in missing_cols.items():
            print(f"  🆕 {col_name} ({col_type})")
        print()
        
        # Add each missing column
        print("Step 5: Adding missing columns...")
        for col_name, col_type in missing_cols.items():
            try:
                # Determine default value based on type
                default_value = ""
                if 'BOOLEAN' in col_type:
                    default_value = " DEFAULT 0"
                elif 'INTEGER' in col_type and col_name != 'id':
                    default_value = " DEFAULT 0"
                elif 'DATETIME' in col_type:
                    default_value = ""
                
                sql = f"ALTER TABLE comprehensive_user_profiles ADD COLUMN {col_name} {col_type}{default_value}"
                print(f"  Adding {col_name}...", end=" ")
                cursor.execute(sql)
                conn.commit()
                print("✅")
                
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print("⚠️  (already exists)")
                else:
                    print(f"❌ Error: {e}")
                    raise
        
        print()
        
        # Verify all columns
        print("Step 6: Verifying migration...")
        cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
        final_columns = [column[1] for column in cursor.fetchall()]
        
        all_present = all(col in final_columns for col in expected_cols.keys())
        
        if all_present:
            print("✅ All columns verified successfully!\n")
            print(f"Final table structure ({len(final_columns)} columns):")
            
            # Show columns with markers
            for col in final_columns:
                if col in missing_cols:
                    print(f"  🆕 {col}")
                else:
                    print(f"     {col}")
        else:
            print("❌ Verification failed - some columns still missing")
            missing_after = [col for col in expected_cols.keys() if col not in final_columns]
            print(f"\nStill missing: {missing_after}")
            conn.close()
            return False
        
        # Check existing records
        cursor.execute("SELECT COUNT(*) FROM comprehensive_user_profiles")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total records in table: {count}")
        if count > 0 and missing_cols:
            print("   New columns will have default values for existing records")
            print("   This is expected and safe ✓")
        
        conn.close()
        
        print("\n" + "=" * 70)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print("\n🚀 Next steps:")
        print("   1. Restart your FastAPI server")
        print("   2. Test the /get_comprehensive_profile endpoint")
        print("   3. All errors should be resolved!\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n")
    
    if not os.path.exists(DATABASE_PATH):
        print(f"❌ Database not found at: {DATABASE_PATH}")
        print("💡 Make sure you're in the correct directory")
        exit(1)
    
    success = run_complete_migration()
    
    if success:
        print("=" * 70)
        print("✨ All done! Your database is fully synchronized.")
        print("=" * 70)
        exit(0)
    else:
        print("\n" + "=" * 70)
        print("❌ Migration failed - please check the errors above")
        print("=" * 70)
        exit(1)