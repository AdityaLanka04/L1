"""
Audio Transcription Module
Transcribes audio/video files using Groq Whisper API
"""
from groq import Groq
import os
import logging
import tempfile

logger = logging.getLogger(__name__)


class AudioTranscriber:
    """Transcribe audio/video files using Groq Whisper API"""
    
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = "whisper-large-v3"
    
    async def transcribe(self, audio_file, language=None):
        """
        Transcribe audio file
        
        Args:
            audio_file: UploadFile object
            language: Optional language code (e.g., 'en', 'es')
            
        Returns:
            dict: {
                'text': str,
                'language': str,
                'duration': float,
                'segments': list
            }
        """
        try:
            audio_file.file.seek(0)
            file_content = audio_file.file.read()
            
            # Prepare transcription parameters
            params = {
                "file": (audio_file.filename, file_content),
                "model": self.model,
                "response_format": "verbose_json"
            }
            
            if language:
                params["language"] = language
            
            # Transcribe
            transcription = self.client.audio.transcriptions.create(**params)
            
            # Extract segments with timestamps
            segments = []
            if hasattr(transcription, 'segments') and transcription.segments:
                segments = [
                    {
                        'start': seg.start,
                        'end': seg.end,
                        'text': seg.text
                    }
                    for seg in transcription.segments
                ]
            
            return {
                'text': transcription.text,
                'language': transcription.language if hasattr(transcription, 'language') else 'unknown',
                'duration': transcription.duration if hasattr(transcription, 'duration') else 0,
                'segments': segments,
                'word_count': len(transcription.text.split())
            }
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise ValueError(f"Failed to transcribe audio: {str(e)}")
    
    def get_supported_formats(self):
        """Get list of supported audio formats"""
        return [
            'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 
            'wav', 'webm', 'flac', 'ogg'
        ]
    
    def is_supported_format(self, filename):
        """Check if file format is supported"""
        ext = filename.lower().split('.')[-1]
        return ext in self.get_supported_formats()


class LocalWhisperTranscriber:
    """
    Local Whisper transcription (fallback if Groq is unavailable)
    Requires: pip install openai-whisper
    """
    
    def __init__(self, model_size="base"):
        try:
            import whisper
            self.model = whisper.load_model(model_size)
            self.available = True
        except ImportError:
            logger.warning("openai-whisper not installed, local transcription unavailable")
            self.available = False
    
    async def transcribe(self, audio_file, language=None):
        """Transcribe audio locally"""
        if not self.available:
            raise ValueError("Local Whisper not available")
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            audio_file.file.seek(0)
            tmp.write(audio_file.file.read())
            tmp_path = tmp.name
        
        try:
            # Transcribe
            result = self.model.transcribe(tmp_path, language=language)
            
            return {
                'text': result["text"],
                'language': result.get("language", "unknown"),
                'duration': 0,  # Not available in local version
                'segments': result.get("segments", []),
                'word_count': len(result["text"].split())
            }
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
