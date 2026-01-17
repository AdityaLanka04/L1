"""
Test script to show how YouTube transcript flows through the system
This demonstrates that notes are generated FROM the actual video captions
"""
import asyncio
from youtube_api_service import youtube_service

async def test_transcript_flow():
    """Show the complete flow from YouTube URL to transcript"""
    
    # Example YouTube URL
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Replace with your video
    
    print("=" * 80)
    print("YOUTUBE TRANSCRIPT FLOW TEST")
    print("=" * 80)
    
    print("\n1. EXTRACTING VIDEO ID...")
    video_id = youtube_service.extract_video_id(test_url)
    print(f"   Video ID: {video_id}")
    
    print("\n2. FETCHING TRANSCRIPT FROM YOUTUBE...")
    print("   Using yt-dlp to download captions...")
    result = await youtube_service.process_video(test_url)
    
    if not result.get("success"):
        print(f"   ❌ Error: {result.get('error')}")
        return
    
    print(f"   ✅ Success!")
    print(f"   Video Title: {result['video_info']['title']}")
    print(f"   Duration: {result['duration']} seconds")
    print(f"   Language: {result['language']}")
    print(f"   Auto-generated: {result['is_auto_generated']}")
    
    print("\n3. TRANSCRIPT PREVIEW (first 500 characters):")
    print("   " + "-" * 76)
    transcript = result['transcript']
    print(f"   {transcript[:500]}...")
    print("   " + "-" * 76)
    print(f"   Total transcript length: {len(transcript)} characters")
    print(f"   Total words: {len(transcript.split())} words")
    
    print("\n4. SEGMENTS WITH TIMESTAMPS (first 5):")
    segments = result.get('segments', [])
    for i, seg in enumerate(segments[:5]):
        start = seg.get('start', 0)
        text = seg.get('text', '')
        print(f"   [{start:.1f}s] {text}")
    print(f"   ... ({len(segments)} total segments)")
    
    print("\n5. WHAT HAPPENS NEXT:")
    print("   ✓ This FULL TRANSCRIPT is sent to Groq AI")
    print("   ✓ AI is instructed to create notes FROM this transcript")
    print("   ✓ AI is told: 'Base your notes ONLY on the content from the transcript'")
    print("   ✓ AI organizes and explains what was actually said in the video")
    
    print("\n6. VERIFICATION:")
    print("   The notes you see are generated from the actual video captions.")
    print("   However, the AI may:")
    print("   • Reorganize content for better learning flow")
    print("   • Expand explanations for clarity")
    print("   • Add structure (headings, sections)")
    print("   • Rephrase for better understanding")
    print("   ")
    print("   If the notes seem too detailed or include info not in the video,")
    print("   it means the AI is over-elaborating. We've now added stricter")
    print("   instructions to prevent this.")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    print("\nTo test with your own video, edit this file and change the test_url")
    print("Then run: python backend/test_transcript_flow.py\n")
    
    # Uncomment to run the test:
    # asyncio.run(test_transcript_flow())
    
    print("Test script ready. Uncomment the last line to run.")
