"""
YouTube Transcript Service - Production Ready (FREE)
Uses yt-dlp for caption extraction + caching

This approach:
- 100% free, no API keys needed
- Works on VPS (Render, Railway, DigitalOcean, Hetzner)
- User-initiated, cached results
- Legal (captions only, transformative use)
"""
import os
import re
import json
import logging
import subprocess
import tempfile
import hashlib
from typing import Dict, Optional, Any
from pathlib import Path
import asyncio

logger = logging.getLogger(__name__)

# Cache directory for transcripts
CACHE_DIR = Path("backend/cache/transcripts")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class YouTubeAPIService:
    """
    Production-ready YouTube Transcript Service using yt-dlp
    
    Features:
    - Extracts captions (auto or manual) via yt-dlp
    - Aggressive caching (fetch once, use forever)
    - No API keys required
    - Works on VPS deployments
    """
    
    def __init__(self):
        self.cache_dir = CACHE_DIR
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from various YouTube URL formats"""
        if not url:
            return None
            
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
            return url
            
        return None
    
    def _get_cache_path(self, video_id: str) -> Path:
        """Get cache file path for a video"""
        return self.cache_dir / f"{video_id}.json"
    
    def _load_from_cache(self, video_id: str) -> Optional[Dict]:
        """Load cached transcript if exists"""
        cache_path = self._get_cache_path(video_id)
        if cache_path.exists():
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"Loaded transcript from cache: {video_id}")
                    return data
            except Exception as e:
                logger.warning(f"Cache read error: {e}")
        return None
    
    def _save_to_cache(self, video_id: str, data: Dict):
        """Save transcript to cache"""
        try:
            cache_path = self._get_cache_path(video_id)
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved transcript to cache: {video_id}")
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    async def get_transcript(self, video_id: str, language: str = "en") -> Dict[str, Any]:
        """
        Get video transcript using yt-dlp
        Checks cache first, then fetches if needed
        """
        # Check cache first
        cached = self._load_from_cache(video_id)
        if cached:
            return cached
        
        # Fetch using yt-dlp
        result = await self._fetch_with_ytdlp(video_id, language)
        
        # Cache successful results
        if result.get("success"):
            self._save_to_cache(video_id, result)
        
        return result
    
    async def _fetch_with_ytdlp(self, video_id: str, language: str = "en") -> Dict:
        """Fetch transcript using yt-dlp"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            
            with tempfile.TemporaryDirectory() as tmpdir:
                # yt-dlp command to get subtitles and video info
                cmd = [
                    "yt-dlp",
                    "--write-auto-sub",
                    "--write-sub",
                    "--sub-lang", f"{language},en",
                    "--sub-format", "vtt",
                    "--skip-download",
                    "--print-json",
                    "-o", f"{tmpdir}/%(id)s.%(ext)s",
                    url
                ]
                
                logger.info(f"Running yt-dlp for video: {video_id}")
                
                # Run yt-dlp
                loop = asyncio.get_event_loop()
                process = await loop.run_in_executor(
                    None,
                    lambda: subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=60
                    )
                )
                
                if process.returncode != 0:
                    error_msg = process.stderr or "Unknown error"
                    logger.error(f"yt-dlp error: {error_msg}")
                    
                    # Check for specific errors
                    if "Video unavailable" in error_msg:
                        return {"success": False, "error": "Video is unavailable or private"}
                    if "Sign in" in error_msg:
                        return {"success": False, "error": "Video requires sign-in (age-restricted)"}
                    
                    return {"success": False, "error": f"Failed to fetch video: {error_msg[:200]}"}
                
                # Parse video info from JSON output
                video_info = {}
                if process.stdout:
                    try:
                        video_info = json.loads(process.stdout)
                    except json.JSONDecodeError:
                        pass
                
                # Find and parse subtitle file
                subtitle_file = None
                tmppath = Path(tmpdir)
                
                # Look for VTT files
                for ext in [f".{language}.vtt", ".en.vtt", ".vtt"]:
                    for f in tmppath.glob(f"*{ext}"):
                        subtitle_file = f
                        break
                    if subtitle_file:
                        break
                
                if not subtitle_file:
                    # Check if subtitles exist in video info
                    if video_info.get("subtitles") or video_info.get("automatic_captions"):
                        return {"success": False, "error": "Subtitles exist but could not be downloaded"}
                    return {"success": False, "error": "No captions available for this video"}
                
                # Parse VTT file
                transcript_data = self._parse_vtt(subtitle_file)
                
                if not transcript_data.get("segments"):
                    return {"success": False, "error": "Could not parse subtitle file"}
                
                # Get video metadata
                title = video_info.get("title", f"YouTube Video {video_id}")
                author = video_info.get("uploader", video_info.get("channel", "Unknown"))
                duration = video_info.get("duration", 0)
                thumbnail = video_info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg")
                
                return {
                    "success": True,
                    "transcript": transcript_data["transcript"],
                    "segments": transcript_data["segments"],
                    "language": language,
                    "is_auto_generated": "auto" in str(subtitle_file).lower(),
                    "has_timestamps": True,
                    "title": title,
                    "author": author,
                    "duration": duration,
                    "thumbnail": thumbnail
                }
                
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Request timed out. Please try again."}
        except FileNotFoundError:
            return {"success": False, "error": "yt-dlp not installed. Please install it: pip install yt-dlp"}
        except Exception as e:
            logger.error(f"yt-dlp fetch error: {e}")
            return {"success": False, "error": str(e)}
    
    def _parse_vtt(self, vtt_path: Path) -> Dict:
        """Parse VTT subtitle file to transcript"""
        try:
            with open(vtt_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            segments = []
            full_text = []
            
            # VTT format parsing
            # Skip header
            lines = content.split('\n')
            i = 0
            
            # Skip WEBVTT header and any metadata
            while i < len(lines) and not re.match(r'\d{2}:\d{2}', lines[i]):
                i += 1
            
            current_start = 0
            current_end = 0
            current_text = []
            
            while i < len(lines):
                line = lines[i].strip()
                
                # Timestamp line: 00:00:00.000 --> 00:00:05.000
                timestamp_match = re.match(
                    r'(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})',
                    line
                )
                
                if timestamp_match:
                    # Save previous segment
                    if current_text:
                        text = ' '.join(current_text).strip()
                        text = self._clean_vtt_text(text)
                        if text:
                            segments.append({
                                "start": current_start,
                                "end": current_end,
                                "duration": current_end - current_start,
                                "text": text
                            })
                            full_text.append(text)
                    
                    # Parse new timestamps
                    groups = timestamp_match.groups()
                    start_h = int(groups[0][:-1]) if groups[0] else 0
                    start_m = int(groups[1])
                    start_s = int(groups[2])
                    start_ms = int(groups[3])
                    
                    end_h = int(groups[4][:-1]) if groups[4] else 0
                    end_m = int(groups[5])
                    end_s = int(groups[6])
                    end_ms = int(groups[7])
                    
                    current_start = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
                    current_end = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000
                    current_text = []
                
                elif line and not line.isdigit() and not line.startswith('NOTE'):
                    # Text line
                    current_text.append(line)
                
                i += 1
            
            # Don't forget last segment
            if current_text:
                text = ' '.join(current_text).strip()
                text = self._clean_vtt_text(text)
                if text:
                    segments.append({
                        "start": current_start,
                        "end": current_end,
                        "duration": current_end - current_start,
                        "text": text
                    })
                    full_text.append(text)
            
            # Deduplicate consecutive identical segments (common in auto-captions)
            deduped_segments = []
            deduped_text = []
            prev_text = ""
            
            for seg in segments:
                if seg["text"] != prev_text:
                    deduped_segments.append(seg)
                    deduped_text.append(seg["text"])
                    prev_text = seg["text"]
            
            return {
                "transcript": " ".join(deduped_text),
                "segments": deduped_segments
            }
            
        except Exception as e:
            logger.error(f"VTT parse error: {e}")
            return {"transcript": "", "segments": []}
    
    def _clean_vtt_text(self, text: str) -> str:
        """Clean VTT text - remove tags, timestamps, etc."""
        # Remove VTT tags like <c>, </c>, <00:00:00.000>
        text = re.sub(r'<[^>]+>', '', text)
        # Remove position/alignment tags
        text = re.sub(r'align:start position:\d+%', '', text)
        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)
        # Remove common filler words (optional, can be aggressive)
        # text = re.sub(r'\b(um|uh|like|you know)\b', '', text, flags=re.IGNORECASE)
        return text.strip()
    
    async def get_video_info(self, video_id: str) -> Dict[str, Any]:
        """Get video info using yt-dlp (no download)"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--no-download",
                url
            ]
            
            loop = asyncio.get_event_loop()
            process = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            )
            
            if process.returncode == 0 and process.stdout:
                info = json.loads(process.stdout)
                return {
                    "success": True,
                    "title": info.get("title", f"YouTube Video {video_id}"),
                    "author": info.get("uploader", info.get("channel", "Unknown")),
                    "thumbnail": info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"),
                    "length": info.get("duration", 0),
                    "description": info.get("description", "")[:500]
                }
            
            return self._fallback_video_info(video_id)
            
        except Exception as e:
            logger.error(f"Error fetching video info: {e}")
            return self._fallback_video_info(video_id)
    
    def _fallback_video_info(self, video_id: str) -> Dict:
        return {
            "success": True,
            "title": f"YouTube Video {video_id}",
            "author": "Unknown",
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
            "length": 0,
            "description": ""
        }
    
    async def process_video(self, url: str) -> Dict[str, Any]:
        """Main entry point - process YouTube video"""
        try:
            video_id = self.extract_video_id(url)
            if not video_id:
                return {"success": False, "error": f"Invalid YouTube URL: {url}"}
            
            logger.info(f"Processing YouTube video: {video_id}")
            
            # Get transcript (includes video info)
            result = await self.get_transcript(video_id)
            
            if not result.get("success"):
                return result
            
            return {
                "success": True,
                "video_id": video_id,
                "video_info": {
                    "title": result.get("title", f"YouTube Video {video_id}"),
                    "author": result.get("author", "Unknown"),
                    "length": result.get("duration", 0),
                    "description": "",
                    "thumbnail": result.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg")
                },
                "transcript": result.get("transcript", ""),
                "segments": result.get("segments", []),
                "language": result.get("language", "en"),
                "is_auto_generated": result.get("is_auto_generated", False),
                "has_timestamps": result.get("has_timestamps", True),
                "duration": result.get("duration", 0)
            }
            
        except Exception as e:
            logger.error(f"Video processing error: {e}")
            return {"success": False, "error": str(e)}
    
    def clear_cache(self, video_id: str = None):
        """Clear cache for a specific video or all videos"""
        if video_id:
            cache_path = self._get_cache_path(video_id)
            if cache_path.exists():
                cache_path.unlink()
                logger.info(f"Cleared cache for: {video_id}")
        else:
            for f in self.cache_dir.glob("*.json"):
                f.unlink()
            logger.info("Cleared all transcript cache")


# Global instance
youtube_service = YouTubeAPIService()
