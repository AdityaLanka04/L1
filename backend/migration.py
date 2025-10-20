import os
import sys
from sqlalchemy import create_engine, MetaData, Table, inspect
from sqlalchemy.orm import sessionmaker
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import models

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def get_existing_tables(engine):
    inspector = inspect(engine)
    return set(inspector.get_table_names())

def get_model_tables():
    return set(models.Base.metadata.tables.keys())

def run_migration():
    print("=" * 60)
    print("BRAINWAVE DATABASE MIGRATION TOOL")
    print("=" * 60)
    print(f"Database: {DATABASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    try:
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        
        print("\n[1/4] Connecting to database...")
        engine.connect()
        print("SUCCESS: Database connection established")
        
        print("\n[2/4] Analyzing database schema...")
        existing_tables = get_existing_tables(engine)
        model_tables = get_model_tables()
        
        print(f"   Existing tables in database: {len(existing_tables)}")
        print(f"   Tables defined in models: {len(model_tables)}")
        
        missing_tables = model_tables - existing_tables
        extra_tables = existing_tables - model_tables
        
        if missing_tables:
            print(f"\n   MISSING TABLES ({len(missing_tables)}):")
            for table in sorted(missing_tables):
                print(f"      - {table}")
        else:
            print("\n   No missing tables detected")
        
        if extra_tables:
            print(f"\n   EXTRA TABLES (not in models) ({len(extra_tables)}):")
            for table in sorted(extra_tables):
                print(f"      - {table}")
        
        print("\n[3/4] Creating missing tables...")
        
        if missing_tables:
            models.Base.metadata.create_all(bind=engine, checkfirst=True)
            print(f"SUCCESS: Created {len(missing_tables)} missing table(s)")
            for table in sorted(missing_tables):
                print(f"   CREATED: {table}")
        else:
            print("   No tables to create")
        
        print("\n[4/4] Verifying database schema...")
        final_tables = get_existing_tables(engine)
        still_missing = model_tables - final_tables
        
        if model_tables.issubset(final_tables):
            print("SUCCESS: All model tables exist in database")
        else:
            print(f"WARNING: {len(still_missing)} table(s) still missing:")
            for table in sorted(still_missing):
                print(f"   - {table}")
        
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Total tables in database: {len(final_tables)}")
        print(f"Tables created: {len(missing_tables)}")
        print(f"Status: {'COMPLETE' if len(still_missing) == 0 else 'INCOMPLETE'}")
        print("=" * 60)
        
        print("\nALL TABLES IN DATABASE:")
        for i, table in enumerate(sorted(final_tables), 1):
            print(f"   {i:2d}. {table}")
        
        return True
        
    except Exception as e:
        print("\n" + "=" * 60)
        print("ERROR: Migration failed")
        print("=" * 60)
        print(f"Error: {str(e)}")
        print(f"Type: {type(e).__name__}")
        import traceback
        print("\nFull traceback:")
        traceback.print_exc()
        return False

def verify_critical_tables():
    print("\n" + "=" * 60)
    print("CRITICAL TABLES VERIFICATION")
    print("=" * 60)
    
    critical_tables = [
        "users",
        "chat_sessions",
        "chat_messages",
        "notes",
        "flashcard_sets",
        "learning_reviews",
        "uploaded_slides",
        "question_sets",
        "questions"
    ]
    
    try:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        
        existing_tables = get_existing_tables(engine)
        
        all_present = True
        for table in critical_tables:
            status = "PRESENT" if table in existing_tables else "MISSING"
            symbol = "✓" if table in existing_tables else "✗"
            print(f"   {symbol} {table:30s} [{status}]")
            if status == "MISSING":
                all_present = False
        
        print("=" * 60)
        if all_present:
            print("SUCCESS: All critical tables are present")
        else:
            print("WARNING: Some critical tables are missing")
        
        return all_present
        
    except Exception as e:
        print(f"ERROR: Verification failed - {str(e)}")
        return False

def show_table_details():
    print("\n" + "=" * 60)
    print("DETAILED TABLE INFORMATION")
    print("=" * 60)
    
    try:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        
        inspector = inspect(engine)
        tables = sorted(inspector.get_table_names())
        
        for table_name in tables:
            columns = inspector.get_columns(table_name)
            print(f"\n{table_name.upper()}")
            print("-" * 60)
            print(f"   Columns: {len(columns)}")
            for col in columns:
                col_type = str(col['type'])
                nullable = "NULL" if col['nullable'] else "NOT NULL"
                print(f"      - {col['name']:30s} {col_type:20s} {nullable}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: Could not retrieve table details - {str(e)}")
        return False

def backup_database():
    if "sqlite" in DATABASE_URL:
        try:
            import shutil
            db_file = DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
            if os.path.exists(db_file):
                backup_file = f"{db_file}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(db_file, backup_file)
                print(f"\nBACKUP: Created backup at {backup_file}")
                return True
        except Exception as e:
            print(f"\nWARNING: Could not create backup - {str(e)}")
    return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Brainwave Database Migration Tool")
    parser.add_argument("--verify", action="store_true", help="Verify critical tables only")
    parser.add_argument("--details", action="store_true", help="Show detailed table information")
    parser.add_argument("--backup", action="store_true", help="Backup database before migration")
    parser.add_argument("--force", action="store_true", help="Force migration without prompts")
    
    args = parser.parse_args()
    
    if args.verify:
        verify_critical_tables()
        return
    
    if args.details:
        show_table_details()
        return
    
    if args.backup or not args.force:
        backup_database()
    
    if not args.force:
        response = input("\nProceed with migration? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Migration cancelled")
            return
    
    success = run_migration()
    
    if success:
        verify_critical_tables()
        print("\n" + "=" * 60)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print("You can now run your application")
        print("Command: python main.py")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("MIGRATION FAILED")
        print("=" * 60)
        print("Please check the error messages above")
        print("=" * 60)

if __name__ == "__main__":
    main()