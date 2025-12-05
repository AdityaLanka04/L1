"""
Migration: Add Learning Playlist Tables
Date: 2024-12-06
Description: Creates all tables needed for the Learning Playlist feature
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Base, LearningPlaylist, PlaylistItem, PlaylistFollower, PlaylistFork, PlaylistCollaborator, PlaylistComment
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def run_migration():
    """Run the migration to add playlist tables"""
    print("🚀 Starting Learning Playlist Migration...")
    
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )
    
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    print(f"📊 Found {len(existing_tables)} existing tables")
    
    # Tables to create
    playlist_tables = [
        'learning_playlists',
        'playlist_items',
        'playlist_followers',
        'playlist_forks',
        'playlist_collaborators',
        'playlist_comments'
    ]
    
    tables_to_create = [table for table in playlist_tables if table not in existing_tables]
    
    if not tables_to_create:
        print("✅ All playlist tables already exist!")
        return
    
    print(f"📝 Creating {len(tables_to_create)} new tables: {', '.join(tables_to_create)}")
    
    try:
        # Create only the playlist tables
        Base.metadata.create_all(
            bind=engine,
            tables=[
                Base.metadata.tables['learning_playlists'],
                Base.metadata.tables['playlist_items'],
                Base.metadata.tables['playlist_followers'],
                Base.metadata.tables['playlist_forks'],
                Base.metadata.tables['playlist_collaborators'],
                Base.metadata.tables['playlist_comments']
            ],
            checkfirst=True
        )
        
        print("✅ Successfully created playlist tables!")
        
        # Verify tables were created
        inspector = inspect(engine)
        new_tables = inspector.get_table_names()
        
        for table in playlist_tables:
            if table in new_tables:
                columns = inspector.get_columns(table)
                print(f"  ✓ {table} ({len(columns)} columns)")
            else:
                print(f"  ✗ {table} - FAILED TO CREATE")
        
        print("\n🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        raise

def rollback_migration():
    """Rollback the migration (drop playlist tables)"""
    print("⚠️  Rolling back Learning Playlist Migration...")
    
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )
    
    playlist_tables = [
        'playlist_comments',
        'playlist_collaborators',
        'playlist_forks',
        'playlist_followers',
        'playlist_items',
        'learning_playlists'
    ]
    
    with engine.connect() as conn:
        for table in playlist_tables:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                conn.commit()
                print(f"  ✓ Dropped {table}")
            except Exception as e:
                print(f"  ✗ Failed to drop {table}: {str(e)}")
    
    print("✅ Rollback completed!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Learning Playlist Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    args = parser.parse_args()
    
    if args.rollback:
        rollback_migration()
    else:
        run_migration()
