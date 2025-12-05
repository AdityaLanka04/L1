"""
Universal Database Migration Script
Handles both local SQLite and deployed PostgreSQL databases
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect, MetaData
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Base
from dotenv import load_dotenv

load_dotenv()

class DatabaseMigration:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
        self.is_postgres = "postgres" in self.database_url
        self.engine = create_engine(
            self.database_url,
            connect_args={"check_same_thread": False} if not self.is_postgres else {}
        )
        self.inspector = inspect(self.engine)
        
    def get_existing_tables(self):
        """Get list of existing tables"""
        return self.inspector.get_table_names()
    
    def get_table_columns(self, table_name):
        """Get columns for a specific table"""
        try:
            return {col['name']: col for col in self.inspector.get_columns(table_name)}
        except Exception:
            return {}
    
    def create_missing_tables(self):
        """Create any missing tables"""
        print(f"\n{'='*60}")
        print(f"🗄️  Database: {'PostgreSQL' if self.is_postgres else 'SQLite'}")
        print(f"{'='*60}\n")
        
        existing_tables = self.get_existing_tables()
        print(f"📊 Found {len(existing_tables)} existing tables")
        
        # Get all tables defined in models
        all_model_tables = Base.metadata.tables.keys()
        missing_tables = [table for table in all_model_tables if table not in existing_tables]
        
        if not missing_tables:
            print("✅ All tables exist!")
            return True
        
        print(f"\n📝 Creating {len(missing_tables)} missing tables:")
        for table in missing_tables:
            print(f"  • {table}")
        
        try:
            # Create all missing tables
            Base.metadata.create_all(bind=self.engine, checkfirst=True)
            
            print("\n✅ Successfully created missing tables!")
            
            # Verify
            new_tables = self.inspector.get_table_names()
            for table in missing_tables:
                if table in new_tables:
                    columns = self.inspector.get_columns(table)
                    print(f"  ✓ {table} ({len(columns)} columns)")
                else:
                    print(f"  ✗ {table} - FAILED")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Error creating tables: {str(e)}")
            return False
    
    def add_missing_columns(self):
        """Add any missing columns to existing tables"""
        print(f"\n{'='*60}")
        print("🔧 Checking for missing columns...")
        print(f"{'='*60}\n")
        
        changes_made = False
        
        # Define expected columns for key tables
        expected_columns = {
            'learning_playlists': [
                ('creator_id', 'INTEGER'),
                ('title', 'VARCHAR(200)'),
                ('description', 'TEXT'),
                ('category', 'VARCHAR(100)'),
                ('difficulty_level', 'VARCHAR(20)'),
                ('estimated_hours', 'FLOAT'),
                ('is_public', 'BOOLEAN'),
                ('is_collaborative', 'BOOLEAN'),
                ('cover_color', 'VARCHAR(20)'),
                ('tags', 'JSON'),
                ('fork_count', 'INTEGER'),
                ('follower_count', 'INTEGER'),
                ('completion_count', 'INTEGER'),
                ('created_at', 'TIMESTAMP'),
                ('updated_at', 'TIMESTAMP'),
            ],
            'playlist_items': [
                ('playlist_id', 'INTEGER'),
                ('order_index', 'INTEGER'),
                ('item_type', 'VARCHAR(50)'),
                ('item_id', 'INTEGER'),
                ('title', 'VARCHAR(300)'),
                ('url', 'TEXT'),
                ('description', 'TEXT'),
                ('duration_minutes', 'INTEGER'),
                ('is_required', 'BOOLEAN'),
                ('notes', 'TEXT'),
                ('created_at', 'TIMESTAMP'),
            ],
            'playlist_followers': [
                ('playlist_id', 'INTEGER'),
                ('user_id', 'INTEGER'),
                ('started_at', 'TIMESTAMP'),
                ('last_accessed', 'TIMESTAMP'),
                ('progress_percentage', 'FLOAT'),
                ('completed_items', 'JSON'),
                ('is_completed', 'BOOLEAN'),
                ('completed_at', 'TIMESTAMP'),
            ],
            'playlist_forks': [
                ('original_playlist_id', 'INTEGER'),
                ('forked_playlist_id', 'INTEGER'),
                ('forked_by_id', 'INTEGER'),
                ('forked_at', 'TIMESTAMP'),
            ],
            'playlist_collaborators': [
                ('playlist_id', 'INTEGER'),
                ('user_id', 'INTEGER'),
                ('permission', 'VARCHAR(20)'),
                ('added_at', 'TIMESTAMP'),
                ('added_by_id', 'INTEGER'),
            ],
            'playlist_comments': [
                ('playlist_id', 'INTEGER'),
                ('user_id', 'INTEGER'),
                ('comment_text', 'TEXT'),
                ('rating', 'INTEGER'),
                ('created_at', 'TIMESTAMP'),
                ('updated_at', 'TIMESTAMP'),
            ]
        }
        
        existing_tables = self.get_existing_tables()
        
        with self.engine.connect() as conn:
            for table_name, columns in expected_columns.items():
                if table_name not in existing_tables:
                    continue
                
                existing_columns = self.get_table_columns(table_name)
                missing_columns = [col for col, _ in columns if col not in existing_columns and col != 'id']
                
                if missing_columns:
                    print(f"\n📋 Table: {table_name}")
                    print(f"  Missing columns: {', '.join(missing_columns)}")
                    
                    for col_name, col_type in columns:
                        if col_name in missing_columns:
                            try:
                                # Adjust SQL for PostgreSQL vs SQLite
                                if self.is_postgres:
                                    sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                                else:
                                    sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                                
                                conn.execute(text(sql))
                                conn.commit()
                                print(f"  ✓ Added column: {col_name}")
                                changes_made = True
                            except Exception as e:
                                print(f"  ✗ Failed to add {col_name}: {str(e)}")
        
        if not changes_made:
            print("✅ All columns exist!")
        else:
            print("\n✅ Column additions completed!")
        
        return True
    
    def run_full_migration(self):
        """Run complete migration"""
        print(f"\n{'='*60}")
        print(f"🚀 Starting Database Migration")
        print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        
        success = True
        
        # Step 1: Create missing tables
        if not self.create_missing_tables():
            success = False
        
        # Step 2: Add missing columns
        if not self.add_missing_columns():
            success = False
        
        print(f"\n{'='*60}")
        if success:
            print("🎉 Migration completed successfully!")
        else:
            print("⚠️  Migration completed with errors")
        print(f"{'='*60}\n")
        
        return success

def migrate_local():
    """Migrate local SQLite database"""
    print("\n🏠 Migrating LOCAL database...")
    # Use absolute path to backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, "brainwave_tutor.db")
    local_url = f"sqlite:///{db_path}"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        print("   Creating new database...")
    
    migration = DatabaseMigration(local_url)
    return migration.run_full_migration()

def migrate_production():
    """Migrate production PostgreSQL database"""
    print("\n☁️  Migrating PRODUCTION database...")
    prod_url = os.getenv("DATABASE_URL")
    if not prod_url or "sqlite" in prod_url:
        print("❌ No production database URL found in environment")
        return False
    
    migration = DatabaseMigration(prod_url)
    return migration.run_full_migration()

def migrate_both():
    """Migrate both local and production databases"""
    print("\n🌍 Migrating BOTH databases...")
    
    local_success = migrate_local()
    prod_success = migrate_production()
    
    return local_success and prod_success

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Migration Tool')
    parser.add_argument('--local', action='store_true', help='Migrate local database only')
    parser.add_argument('--production', action='store_true', help='Migrate production database only')
    parser.add_argument('--both', action='store_true', help='Migrate both databases')
    
    args = parser.parse_args()
    
    if args.production:
        migrate_production()
    elif args.both:
        migrate_both()
    else:
        # Default to local
        migrate_local()
