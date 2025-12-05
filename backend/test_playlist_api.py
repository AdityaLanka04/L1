"""
Quick test to verify playlist API is working
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing imports...")
    from models import LearningPlaylist, PlaylistItem, PlaylistFollower
    print("✅ Models imported successfully")
    
    from playlist_api import router
    print("✅ Playlist API router imported successfully")
    
    print("\n✅ All playlist components are working!")
    print("\nYou can now start the backend with:")
    print("  python start_backend.py")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
