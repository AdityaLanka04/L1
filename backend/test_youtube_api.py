#!/usr/bin/env python
"""Test YouTube Transcript API"""

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    
    print("✓ Module imported successfully")
    print(f"Type: {type(YouTubeTranscriptApi)}")
    print(f"Available methods: {[m for m in dir(YouTubeTranscriptApi) if not m.startswith('_')]}")
    
    # Test with a video
    video_id = "QIDDIDS2Tjk"
    print(f"\nTesting with video ID: {video_id}")
    
    # Create instance
    api = YouTubeTranscriptApi()
    
    # Try list method
    try:
        transcripts = api.list(video_id)
        print(f"✓ List method works: {transcripts}")
    except Exception as e:
        print(f"✗ List error: {e}")
    
    # Try fetch method  
    try:
        transcript = api.fetch(video_id)
        print(f"✓ Fetch method works with {len(transcript)} segments")
        print(f"First segment: {transcript[0]}")
    except Exception as e:
        print(f"✗ Fetch error: {e}")
        
except ImportError as e:
    print(f"✗ Import error: {e}")
except Exception as e:
    print(f"✗ Error: {e}")
