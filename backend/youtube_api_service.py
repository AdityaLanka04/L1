"""
YouTube Transcript Service - Production Ready (FREE)
Uses YouTube Data API v3 + youtube-transcript-api for reliable caption extraction

This approach:
- Uses official YouTube Data API v3 (free tier: 10,000 quota/day)
- Falls back to youtube-transcript-api library
- Aggressive caching to minimize API usage
- Works reliably on all platforms
"""
import os
import re
import json
import logging
import subprocess
import tempfile
import hashlib
from typing import Dict, Optional, Any, List
from pathlib import Path
import asyncio

logger = logging.getLogger(__name__)

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
    TRANSCRIPT_API_AVAILABLE = True
except ImportError:
    YouTubeTranscriptApi = None
    TranscriptsDisabled = Exception
    NoTranscriptFound = Exception
    VideoUnavailable = Exception
    TRANSCRIPT_API_AVAILABLE = False
    logger.warning("youtube-transcript-api not installed. Install with: pip install youtube-transcript-api")

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_API_AVAILABLE = True
except ImportError:
    build = None
    HttpError = Exception
    GOOGLE_API_AVAILABLE = False
    logger.warning("google-api-python-client not installed. Install with: pip install google-api-python-client")

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_API_KEY")

CACHE_DIR = Path("backend/cache/transcripts")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class YouTubeAPIService:
    """
    Production-ready YouTube Transcript Service
    
    Features:
    - Uses youtube-transcript-api (most reliable)
    - Falls back to yt-dlp if needed
    - Uses YouTube Data API v3 for metadata
    - Aggressive caching (fetch once, use forever)
    - No complex dependencies
    """
    
    def __init__(self):
        self.cache_dir = CACHE_DIR
        self.youtube_api = None
        
        if GOOGLE_API_AVAILABLE and YOUTUBE_API_KEY:
            try:
                self.youtube_api = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
                logger.info("✅ YouTube Data API v3 initialized")
            except Exception as e:
                logger.warning(f"Could not initialize YouTube Data API: {e}")
        else:
            if not YOUTUBE_API_KEY:
                logger.warning("No YOUTUBE_API_KEY found in environment")
            if not GOOGLE_API_AVAILABLE:
                logger.warning("google-api-python-client not installed")
    
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
        Get video transcript using multiple methods
        Priority: 1) Cache, 2) youtube-transcript-api, 3) yt-dlp
        """
        cached = self._load_from_cache(video_id)
        if cached:
            return cached
        
        if TRANSCRIPT_API_AVAILABLE:
            result = await self._fetch_with_transcript_api(video_id, language)
            if result.get("success"):
                self._save_to_cache(video_id, result)
                return result
            logger.warning(f"youtube-transcript-api failed: {result.get('error')}")
        
        result = await self._fetch_with_ytdlp(video_id, language)
        
        if result.get("success"):
            self._save_to_cache(video_id, result)
        
        return result
    
    async def _fetch_with_transcript_api(self, video_id: str, language: str = "en") -> Dict:
        """Fetch transcript using youtube-transcript-api library"""
        try:
            logger.info(f"Fetching transcript with youtube-transcript-api for: {video_id}")
            
            loop = asyncio.get_event_loop()
            transcript_data, is_auto_generated, transcript_lang = await loop.run_in_executor(
                None,
                lambda: self._fetch_transcript_data_compat(video_id, language)
            )
            
            if not transcript_data:
                return {"success": False, "error": "Transcript data is empty"}
            
            segments = []
            full_text = []
            
            for entry in transcript_data:
                text = str(self._entry_value(entry, 'text', '')).strip()
                if text:
                    start = float(self._entry_value(entry, 'start', 0) or 0)
                    duration = float(self._entry_value(entry, 'duration', 0) or 0)
                    segments.append({
                        "start": start,
                        "end": start + duration,
                        "duration": duration,
                        "text": text
                    })
                    full_text.append(text)
            
            if not segments:
                return {"success": False, "error": "No transcript segments found"}
            
            video_info = await self._get_video_metadata(video_id)
            
            logger.info(f"✅ Successfully fetched transcript: {len(full_text)} segments, {len(' '.join(full_text))} chars")
            
            return {
                "success": True,
                "transcript": " ".join(full_text),
                "segments": segments,
                "language": transcript_lang,
                "is_auto_generated": is_auto_generated,
                "has_timestamps": True,
                "title": video_info.get("title", f"YouTube Video {video_id}"),
                "author": video_info.get("author", "Unknown"),
                "duration": video_info.get("duration", 0),
                "thumbnail": video_info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"),
                "description": video_info.get("description", "")
            }
            
        except TranscriptsDisabled:
            return {"success": False, "error": "Transcripts are disabled for this video"}
        except VideoUnavailable:
            return {"success": False, "error": "Video is unavailable or private"}
        except NoTranscriptFound:
            return {"success": False, "error": "No transcripts found for this video"}
        except Exception as e:
            logger.error(f"youtube-transcript-api error: {e}", exc_info=True)
            error_text = str(e).lower()
            if "transcript" in error_text and "disabled" in error_text:
                return {"success": False, "error": "Transcripts are disabled for this video"}
            if "video unavailable" in error_text or "private" in error_text:
                return {"success": False, "error": "Video is unavailable or private"}
            if "no transcripts" in error_text or "no transcript" in error_text:
                return {"success": False, "error": "No transcripts found for this video"}
            return {"success": False, "error": f"Failed to fetch transcript: {str(e)}"}

    def _entry_value(self, entry: Any, key: str, default: Any = None) -> Any:
        if isinstance(entry, dict):
            return entry.get(key, default)
        return getattr(entry, key, default)

    def _get_transcript_list_compat(self, video_id: str):
        """Support both old and new youtube-transcript-api interfaces."""
        if hasattr(YouTubeTranscriptApi, "list_transcripts"):
            return YouTubeTranscriptApi.list_transcripts(video_id)

        api_client = YouTubeTranscriptApi() if callable(YouTubeTranscriptApi) else YouTubeTranscriptApi
        if hasattr(api_client, "list"):
            return api_client.list(video_id)
        if hasattr(api_client, "list_transcripts"):
            return api_client.list_transcripts(video_id)
        raise AttributeError("No transcript list method found in youtube-transcript-api")

    def _fetch_transcript_data_compat(self, video_id: str, language: str):
        """Fetch transcript data across youtube-transcript-api versions."""
        lang_candidates = []
        for langs in ([language], ['en', 'en-US', 'en-GB'], ['en']):
            if langs not in lang_candidates:
                lang_candidates.append(langs)

        errors = []

        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            for langs in lang_candidates:
                try:
                    data = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
                    return data, False, langs[0]
                except Exception as exc:
                    errors.append(exc)

        api_client = None
        try:
            api_client = YouTubeTranscriptApi() if callable(YouTubeTranscriptApi) else YouTubeTranscriptApi
        except Exception as exc:
            errors.append(exc)

        if api_client and hasattr(api_client, "fetch"):
            for langs in lang_candidates:
                try:
                    data = api_client.fetch(video_id, languages=langs)
                    transcript_lang = getattr(data, "language_code", langs[0])
                    is_generated = bool(getattr(data, "is_generated", False))
                    if hasattr(data, "snippets"):
                        data = data.snippets
                    return data, is_generated, transcript_lang
                except Exception as exc:
                    errors.append(exc)

        try:
            transcript_list = self._get_transcript_list_compat(video_id)
        except Exception as exc:
            errors.append(exc)
            transcript_list = None

        if transcript_list:
            transcript = None
            transcript_lang = language
            is_generated = False

            if hasattr(transcript_list, "find_transcript"):
                for langs in lang_candidates:
                    try:
                        transcript = transcript_list.find_transcript(langs)
                        transcript_lang = langs[0]
                        break
                    except Exception as exc:
                        errors.append(exc)

            if transcript is None and hasattr(transcript_list, "find_generated_transcript"):
                for langs in lang_candidates:
                    try:
                        transcript = transcript_list.find_generated_transcript(langs)
                        transcript_lang = langs[0]
                        is_generated = True
                        break
                    except Exception as exc:
                        errors.append(exc)

            if transcript is None:
                try:
                    available = list(transcript_list)
                    if available:
                        transcript = available[0]
                        transcript_lang = getattr(transcript, "language_code", transcript_lang)
                        is_generated = bool(getattr(transcript, "is_generated", False))
                except Exception as exc:
                    errors.append(exc)

            if transcript is not None:
                data = transcript.fetch()
                return data, is_generated, transcript_lang

        if errors:
            raise RuntimeError(str(errors[-1]))
        raise RuntimeError("No transcripts available")
    
    async def _get_video_metadata(self, video_id: str) -> Dict:
        """Get video metadata using YouTube Data API v3"""
        try:
            if self.youtube_api:
                loop = asyncio.get_event_loop()
                request = self.youtube_api.videos().list(
                    part="snippet,contentDetails",
                    id=video_id
                )
                response = await loop.run_in_executor(None, request.execute)
                
                if response.get("items"):
                    item = response["items"][0]
                    snippet = item.get("snippet", {})
                    content_details = item.get("contentDetails", {})
                    
                    duration_str = content_details.get("duration", "PT0S")
                    duration = self._parse_duration(duration_str)
                    
                    return {
                        "title": snippet.get("title", f"YouTube Video {video_id}"),
                        "author": snippet.get("channelTitle", "Unknown"),
                        "thumbnail": snippet.get("thumbnails", {}).get("maxres", {}).get("url") or 
                                   snippet.get("thumbnails", {}).get("high", {}).get("url") or
                                   f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                        "duration": duration,
                        "description": snippet.get("description", "")[:500]
                    }
        except Exception as e:
            logger.warning(f"Could not fetch video metadata: {e}")
        
        return {
            "title": f"YouTube Video {video_id}",
            "author": "Unknown",
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
            "duration": 0,
            "description": ""
        }
    
    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration (PT1H2M10S) to seconds"""
        try:
            import re
            match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
            if match:
                hours = int(match.group(1) or 0)
                minutes = int(match.group(2) or 0)
                seconds = int(match.group(3) or 0)
                return hours * 3600 + minutes * 60 + seconds
        except:
            pass
        return 0
    
    async def _fetch_with_ytdlp(self, video_id: str, language: str = "en") -> Dict:
        """Fetch transcript using yt-dlp with aggressive caption detection"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            
            with tempfile.TemporaryDirectory() as tmpdir:
                list_cmd = [
                    "yt-dlp",
                    "--list-subs",
                    url
                ]
                
                logger.info(f"Checking available subtitles for video: {video_id}")
                
                loop = asyncio.get_event_loop()
                list_process = await loop.run_in_executor(
                    None,
                    lambda: subprocess.run(
                        list_cmd,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                )
                
                logger.info(f"Available subtitles output: {list_process.stdout[:500]}")
                
                sub_lang_options = [
                    f"{language},en",
                    "en",
                    "en-US,en-GB,en",
                    "*",
                ]
                
                subtitle_file = None
                video_info = {}
                
                for sub_langs in sub_lang_options:
                    logger.info(f"Trying subtitle languages: {sub_langs}")
                    
                    cmd = [
                        "yt-dlp",
                        "--write-auto-sub",
                        "--write-sub",
                        "--sub-lang", sub_langs,
                        "--sub-format", "vtt",
                        "--skip-download",
                        "--print-json",
                        "-o", f"{tmpdir}/%(id)s.%(ext)s",
                        url
                    ]
                    
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
                        logger.warning(f"yt-dlp attempt failed with {sub_langs}: {error_msg[:200]}")
                        
                        if "Video unavailable" in error_msg:
                            return {"success": False, "error": "Video is unavailable or private"}
                        if "Sign in" in error_msg:
                            return {"success": False, "error": "Video requires sign-in (age-restricted)"}
                        
                        continue
                    
                    if process.stdout:
                        try:
                            video_info = json.loads(process.stdout)
                        except json.JSONDecodeError:
                            pass
                    
                    tmppath = Path(tmpdir)
                    
                    vtt_files = list(tmppath.glob("*.vtt"))
                    if vtt_files:
                        subtitle_file = vtt_files[0]
                        logger.info(f"Found subtitle file: {subtitle_file.name}")
                        break
                    
                    for pattern in ["*.en.vtt", "*.en-*.vtt", f"*.{language}.vtt", "*auto*.vtt"]:
                        matches = list(tmppath.glob(pattern))
                        if matches:
                            subtitle_file = matches[0]
                            logger.info(f"Found subtitle file with pattern {pattern}: {subtitle_file.name}")
                            break
                    
                    if subtitle_file:
                        break
                
                if not subtitle_file:
                    if video_info:
                        subs = video_info.get("subtitles", {})
                        auto_subs = video_info.get("automatic_captions", {})
                        
                        if subs or auto_subs:
                            available_langs = list(subs.keys()) + list(auto_subs.keys())
                            logger.error(f"Subtitles exist ({available_langs}) but could not be downloaded")
                            return {
                                "success": False, 
                                "error": f"Subtitles exist ({', '.join(available_langs[:5])}) but could not be downloaded. Please try again."
                            }
                    
                    logger.error("No subtitle files found after all attempts")
                    return {"success": False, "error": "No captions available for this video"}
                
                transcript_data = self._parse_vtt(subtitle_file)
                
                if not transcript_data.get("segments"):
                    logger.error("Could not parse subtitle file")
                    return {"success": False, "error": "Could not parse subtitle file"}
                
                title = video_info.get("title", f"YouTube Video {video_id}")
                author = video_info.get("uploader", video_info.get("channel", "Unknown"))
                duration = video_info.get("duration", 0)
                thumbnail = video_info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg")
                description = video_info.get("description", "")
                
                logger.info(f"Successfully extracted transcript: {len(transcript_data['transcript'])} chars, {len(transcript_data['segments'])} segments")
                
                return {
                    "success": True,
                    "transcript": transcript_data["transcript"],
                    "segments": transcript_data["segments"],
                    "language": language,
                    "is_auto_generated": "auto" in str(subtitle_file).lower() or "automatic" in str(subtitle_file).lower(),
                    "has_timestamps": True,
                    "title": title,
                    "author": author,
                    "duration": duration,
                    "thumbnail": thumbnail,
                    "description": description[:500] if description else ""
                }
                
        except subprocess.TimeoutExpired:
            logger.error("yt-dlp request timed out")
            return {"success": False, "error": "Request timed out. Please try again."}
        except FileNotFoundError:
            logger.error("yt-dlp not found")
            return {"success": False, "error": "yt-dlp not installed. Please install it: pip install yt-dlp"}
        except Exception as e:
            logger.error(f"yt-dlp fetch error: {e}", exc_info=True)
            return {"success": False, "error": f"Error processing video: {str(e)}"}
    
    def _parse_vtt(self, vtt_path: Path) -> Dict:
        """Parse VTT subtitle file to transcript"""
        try:
            with open(vtt_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                logger.error("VTT file is empty")
                return {"transcript": "", "segments": []}
            
            segments = []
            full_text = []
            
            lines = content.split('\n')
            i = 0
            
            while i < len(lines) and not re.match(r'\d{2}:\d{2}', lines[i]):
                i += 1
            
            if i >= len(lines):
                logger.error("No timestamp lines found in VTT file")
                return {"transcript": "", "segments": []}
            
            current_start = 0
            current_end = 0
            current_text = []
            
            while i < len(lines):
                line = lines[i].strip()
                
                timestamp_match = re.match(
                    r'(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})',
                    line
                )
                
                if timestamp_match:
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
                    
                    groups = timestamp_match.groups()
                    start_h = int(groups[0]) if groups[0] else 0
                    start_m = int(groups[1])
                    start_s = int(groups[2])
                    start_ms = int(groups[3])
                    
                    end_h = int(groups[4]) if groups[4] else 0
                    end_m = int(groups[5])
                    end_s = int(groups[6])
                    end_ms = int(groups[7])
                    
                    current_start = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
                    current_end = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000
                    current_text = []
                
                elif line and not line.isdigit() and not line.startswith('NOTE') and not line.startswith('WEBVTT'):
                    current_text.append(line)
                
                i += 1
            
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
            
            if not segments:
                logger.error("No segments extracted from VTT file")
                return {"transcript": "", "segments": []}
            
            deduped_segments = []
            deduped_text = []
            prev_text = ""
            
            for seg in segments:
                if seg["text"] != prev_text:
                    deduped_segments.append(seg)
                    deduped_text.append(seg["text"])
                    prev_text = seg["text"]
            
            logger.info(f"Parsed VTT: {len(deduped_segments)} segments, {len(' '.join(deduped_text))} chars")
            
            return {
                "transcript": " ".join(deduped_text),
                "segments": deduped_segments
            }
            
        except Exception as e:
            logger.error(f"VTT parse error: {e}", exc_info=True)
            return {"transcript": "", "segments": []}
    
    def _clean_vtt_text(self, text: str) -> str:
        """Clean VTT text - remove tags, timestamps, etc."""
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'align:start position:\d+%', '', text)
        text = re.sub(r'\s+', ' ', text)
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

youtube_service = YouTubeAPIService()
