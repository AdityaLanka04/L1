import sys
sys.path.append('backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import LearningPlaylist, PlaylistItem, Note
import asyncio
from import_export_service import ImportExportService

# Database setup
DATABASE_URL = "sqlite:///./backend/learning_platform.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

async def test_playlist_conversion():
    db = SessionLocal()
    
    try:
        # Get first playlist with items
        playlist = db.query(LearningPlaylist).first()
        if not playlist:
            print("No playlists found")
            return
        
        print(f"Testing playlist: {playlist.title} (ID: {playlist.id})")
        
        # Check items
        items = db.query(PlaylistItem).filter(
            PlaylistItem.playlist_id == playlist.id
        ).all()
        
        print(f"Found {len(items)} items:")
        for item in items:
            print(f"  - {item.title} ({item.item_type})")
            if item.description:
                print(f"    Description: {item.description[:100]}...")
            if item.notes:
                print(f"    Notes: {item.notes[:100]}...")
        
        # Test conversion
        service = ImportExportService(db)
        result = await service.playlist_to_notes(
            playlist_id=playlist.id,
            user_id=1
        )
        
        print("\nConversion result:")
        print(f"Success: {result.get('success')}")
        if result.get('success'):
            print(f"Note ID: {result.get('note_id')}")
            print(f"Note Title: {result.get('note_title')}")
            print(f"Items Count: {result.get('items_count')}")
            
            # Check the actual note content
            note = db.query(Note).filter(Note.id == result.get('note_id')).first()
            if note:
                print(f"\nNote content length: {len(note.content)} characters")
                print(f"First 500 chars:\n{note.content[:500]}")
        else:
            print(f"Error: {result.get('error')}")
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_playlist_conversion())
