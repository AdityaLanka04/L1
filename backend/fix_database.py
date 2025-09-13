# Create this file as fix_database.py and run it
import sqlite3
import os
from datetime import datetime

def fix_database_schema():
    """Add missing columns to existing database"""
    
    db_path = "brainwave.db"
    
    if not os.path.exists(db_path):
        print("Database file not found. Creating new one...")
        return
    
    print("Fixing database schema...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add missing columns to chat_messages table
        columns_to_add = [
            "ALTER TABLE chat_messages ADD COLUMN user_sentiment REAL",
            "ALTER TABLE chat_messages ADD COLUMN ai_confidence REAL", 
            "ALTER TABLE chat_messages ADD COLUMN response_rating INTEGER",
            "ALTER TABLE chat_messages ADD COLUMN topics_discussed TEXT",
            "ALTER TABLE chat_messages ADD COLUMN difficulty_level TEXT",
            "ALTER TABLE chat_messages ADD COLUMN response_time REAL"
        ]
        
        for column_sql in columns_to_add:
            try:
                cursor.execute(column_sql)
                column_name = column_sql.split("ADD COLUMN")[1].split()[0]
                print(f"✅ Added column: {column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    column_name = column_sql.split("ADD COLUMN")[1].split()[0]
                    print(f"⚠️  Column already exists: {column_name}")
                else:
                    print(f"❌ Error adding column: {e}")
        
        # Add missing columns to other tables that might need them
        other_columns = [
            "ALTER TABLE chat_sessions ADD COLUMN session_summary TEXT",
            "ALTER TABLE chat_sessions ADD COLUMN emotional_tone TEXT", 
            "ALTER TABLE chat_sessions ADD COLUMN difficulty_level TEXT",
            "ALTER TABLE activities ADD COLUMN question_type TEXT",
            "ALTER TABLE activities ADD COLUMN difficulty_level TEXT",
            "ALTER TABLE activities ADD COLUMN user_satisfaction INTEGER",
            "ALTER TABLE notes ADD COLUMN ai_generated BOOLEAN DEFAULT 0",
            "ALTER TABLE notes ADD COLUMN source_chat_sessions TEXT",
            "ALTER TABLE notes ADD COLUMN difficulty_level TEXT",
            "ALTER TABLE notes ADD COLUMN estimated_study_time INTEGER",
            "ALTER TABLE user_stats ADD COLUMN total_concepts_learned INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN favorite_learning_time TEXT",
            "ALTER TABLE user_stats ADD COLUMN average_session_rating REAL DEFAULT 0.0",
            "ALTER TABLE user_stats ADD COLUMN total_questions_asked INTEGER DEFAULT 0"
        ]
        
        for column_sql in other_columns:
            try:
                cursor.execute(column_sql)
                column_name = column_sql.split("ADD COLUMN")[1].split()[0]
                print(f"✅ Added optional column: {column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    pass  # Already exists, that's fine
                elif "no such table" in str(e).lower():
                    pass  # Table doesn't exist, that's fine
                else:
                    print(f"⚠️  Optional column issue: {e}")
        
        conn.commit()
        print("\n✅ Database schema updated successfully!")
        
        # Test the fix
        print("\n🧪 Testing the fix...")
        try:
            cursor.execute("SELECT user_sentiment, ai_confidence, difficulty_level FROM chat_messages LIMIT 1")
            print("✅ New columns are accessible")
        except Exception as e:
            print(f"❌ Test failed: {e}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error fixing database: {e}")
        return False

def backup_database():
    """Create a backup before making changes"""
    db_path = "brainwave.db"
    
    if os.path.exists(db_path):
        backup_name = f"brainwave_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        import shutil
        shutil.copy2(db_path, backup_name)
        print(f"📦 Created backup: {backup_name}")
        return backup_name
    return None

if __name__ == "__main__":
    print("🔧 Brainwave Database Schema Fix")
    print("=" * 40)
    
    # Create backup
    backup_file = backup_database()
    
    # Fix the schema
    success = fix_database_schema()
    
    if success:
        print(f"\n🎉 Database fixed successfully!")
        print(f"📦 Backup saved as: {backup_file}")
        print(f"\n📋 Next steps:")
        print(f"1. Restart your FastAPI server")
        print(f"2. Test your AI chat")
        print(f"3. The AI should work now!")
    else:
        print(f"\n💥 Fix failed. Your backup is safe at: {backup_file}")