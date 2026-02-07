"""
Migrate database schema to Supabase PostgreSQL
This script will:
1. Drop all existing tables in Supabase
2. Create all tables from models.py
3. Initialize with fresh schema
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Import database Base and all models
from database import Base
import models  # This imports all models and registers them with Base
import media_models  # Additional media models

# Load environment variables - try multiple files
env_files = ['.env.production', '.env', '../.env.production', '../.env']
loaded = False

for env_file in env_files:
    if os.path.exists(env_file):
        load_dotenv(env_file)
        print(f"📄 Loaded environment from: {env_file}")
        loaded = True
        break

if not loaded:
    print("⚠️  No .env file found, using system environment variables")

# Get database URL
DATABASE_URL = os.getenv('DATABASE_URL')

print(f"🔍 DATABASE_URL found: {DATABASE_URL[:50] if DATABASE_URL else 'None'}...")

if not DATABASE_URL or 'postgresql' not in DATABASE_URL:
    print("\n❌ ERROR: DATABASE_URL must be a PostgreSQL connection string")
    print("Example: postgresql://user:pass@host:5432/dbname")
    print("\nCurrent DATABASE_URL:", DATABASE_URL)
    print("\nMake sure you have DATABASE_URL set in one of these files:")
    print("  - .env.production")
    print("  - .env")
    print("  - Or as an environment variable")
    exit(1)

print(f"🔗 Connecting to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'database'}")

# Create engine
engine = create_engine(DATABASE_URL, echo=True)

def drop_all_tables():
    """Drop all tables in the database"""
    print("\n🗑️  Dropping all existing tables...")
    
    with engine.connect() as conn:
        # Get all table names
        result = conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result]
        
        if tables:
            print(f"Found {len(tables)} tables to drop: {', '.join(tables)}")
            
            # Drop all tables with CASCADE
            for table in tables:
                try:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    print(f"  ✓ Dropped {table}")
                except Exception as e:
                    print(f"  ⚠ Could not drop {table}: {e}")
            
            conn.commit()
            print("✅ All tables dropped")
        else:
            print("No tables found to drop")

def create_all_tables():
    """Create all tables from models.py"""
    print("\n📦 Creating all tables from models.py...")
    
    try:
        # This creates all tables defined in Base metadata
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        
        # List created tables
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """))
            tables = [row[0] for row in result]
            print(f"\n📋 Created {len(tables)} tables:")
            for table in tables:
                print(f"  ✓ {table}")
                
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise

def main():
    print("=" * 60)
    print("🚀 Supabase PostgreSQL Migration")
    print("=" * 60)
    
    # Confirm before proceeding
    print("\n⚠️  WARNING: This will DELETE ALL DATA in your Supabase database!")
    response = input("Type 'YES' to continue: ")
    
    if response != 'YES':
        print("❌ Migration cancelled")
        return
    
    try:
        # Step 1: Drop all tables
        drop_all_tables()
        
        # Step 2: Create all tables
        create_all_tables()
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Restart your backend: docker-compose restart backend")
        print("2. Test the API: curl https://api.cerbyl.com/api/health")
        print("3. Create a new user account to test")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("Your database may be in an inconsistent state.")
        print("You may need to manually fix it in Supabase dashboard.")

if __name__ == "__main__":
    main()
