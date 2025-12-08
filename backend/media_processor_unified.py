"""
Unified Media Processor
Handles PDFs, Audio, Video, and YouTube URLs
"""
from pdf_processor import PDFProcessor
from audio_transcriber import AudioTranscriber
from youtube_transcript_api import YouTubeTranscriptApi
import logging

logger = logging.getLogger(__name__)


class MediaProcessor:
    """Unified processor for all media types"""
    
    def __init__(self):
        self.pdf_processor = PDFProcessor()
        self.audio_transcriber = AudioTranscriber()
    
    async def process_file(self, file):
        """
        Process any media file and extract text
        
        Args:
            file: UploadFile object
            
        Returns:
            dict: {
                'type': str,
                'text': str,
                'metadata': dict
            }
        """
        content_type = file.content_type.lower()
        
        # PDF Processing
        if content_type == "application/pdf" or file.filename.lower().endswith('.pdf'):
            return await self._process_pdf(file)
        
        # Audio/Video Processing
        elif content_type.startswith(("audio/", "video/")):
            return await self._process_audio(file)
        
        else:
            raise ValueError(f"Unsupported file type: {content_type}")
    
    async def _process_pdf(self, file):
        """Process PDF file"""
        logger.info(f"Processing PDF: {file.filename}")
        
        try:
            result = self.pdf_processor.extract_with_metadata(file)
            
            return {
                'type': 'pdf',
                'text': result['text'],
                'metadata': {
                    'page_count': result['page_count'],
                    'word_count': result['word_count'],
                    'title': result['metadata'].get('title', ''),
                    'author': result['metadata'].get('author', ''),
                    'file_size': file.size if hasattr(file, 'size') else 0
                }
            }
        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            raise ValueError(f"Failed to process PDF: {str(e)}")
    
    async def _process_audio(self, file):
        """Process audio/video file"""
        logger.info(f"Processing audio/video: {file.filename}")
        
        try:
            result = await self.audio_transcriber.transcribe(file)
            
            return {
                'type': 'audio',
                'text': result['text'],
                'metadata': {
                    'language': result['language'],
                    'duration': result['duration'],
                    'word_count': result['word_count'],
                    'segments': result.get('segments', []),
                    'file_size': file.size if hasattr(file, 'size') else 0
                }
            }
        except Exception as e:
            logger.error(f"Audio processing error: {e}")
            raise ValueError(f"Failed to process audio: {str(e)}")
    
    async def process_youtube(self, url):
        """Process YouTube video"""
        logger.info(f"Processing YouTube URL: {url}")
        
        try:
            # Extract video ID
            if "v=" in url:
                video_id = url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[1].split("?")[0]
            else:
                raise ValueError("Invalid YouTube URL")
            
            # Get transcript
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            
            # Combine transcript
            text = " ".join([entry["text"] for entry in transcript_list])
            
            # Calculate duration
            duration = 0
            if transcript_list:
                last_entry = transcript_list[-1]
                duration = last_entry["start"] + last_entry.get("duration", 0)
            
            return {
                'type': 'youtube',
                'text': text,
                'metadata': {
                    'video_id': video_id,
                    'duration': duration,
                    'word_count': len(text.split()),
                    'segments': [
                        {
                            'start': entry['start'],
                            'end': entry['start'] + entry.get('duration', 0),
                            'text': entry['text']
                        }
                        for entry in transcript_list
                    ]
                }
            }
        except Exception as e:
            logger.error(f"YouTube processing error: {e}")
            raise ValueError(f"Failed to process YouTube video: {str(e)}")
    
    def get_file_type(self, file):
        """Determine file type"""
        content_type = file.content_type.lower()
        
        if content_type == "application/pdf" or file.filename.lower().endswith('.pdf'):
            return 'pdf'
        elif content_type.startswith("audio/"):
            return 'audio'
        elif content_type.startswith("video/"):
            return 'video'
        else:
            return 'unknown'
