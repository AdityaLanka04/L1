"""
AI-Powered Media Processing System
Uses free APIs for transcription and AI analysis
"""
import os
import json
import tempfile
import subprocess
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio

# YouTube
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
except ImportError:
    YouTubeTranscriptApi = None
    TranscriptsDisabled = Exception
    NoTranscriptFound = Exception

try:
    from pytube import YouTube
except ImportError:
    YouTube = None

import re

# Language detection
from langdetect import detect, LangDetectException
import pycountry

# AI
import google.generativeai as genai
from groq import Groq

# Audio processing
from pydub import AudioSegment
import base64

import logging

logger = logging.getLogger(__name__)

# Initialize AI clients
genai.configure(api_key=os.getenv("GOOGLE_GENERATIVE_AI_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class AIMediaProcessor:
    """AI-powered media processing with free APIs"""
    
    def __init__(self):
        # Use the correct Gemini model name
        self.gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.groq_client = groq_client
    
    async def process_youtube_video(self, url: str, options: Dict = None) -> Dict:
        """Extract and process YouTube video transcript"""
        try:
            logger.info(f"Processing YouTube URL: {url}")
            
            # Validate URL
            if not url or url.strip() == "":
                raise ValueError("YouTube URL is empty")
            
            # Extract video ID
            video_id = self._extract_video_id(url)
            if not video_id:
                raise ValueError(f"Invalid YouTube URL format: {url}")
            
            logger.info(f"Extracted video ID: {video_id}")
            
            # Get transcript using the correct API
            try:
                # Create API instance and fetch transcript
                api = YouTubeTranscriptApi()
                transcript_data = api.fetch(video_id)
                language = 'en'  # Default, will detect later
                
                logger.info(f"Successfully fetched transcript with {len(transcript_data)} segments")
                
            except Exception as e:
                logger.error(f"Transcript fetch error: {e}")
                raise ValueError(f"No transcript available for this video. Make sure the video has captions enabled. Error: {str(e)}")
            
            # Get video info (try pytube, but don't fail if it doesn't work)
            video_info = {
                "title": f"YouTube Video {video_id}",
                "author": "Unknown",
                "length": 0,
                "description": "",
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
            }
            
            if YouTube:
                try:
                    yt = YouTube(url)
                    video_info = {
                        "title": yt.title,
                        "author": yt.author,
                        "length": yt.length,
                        "description": yt.description or "",
                        "thumbnail": yt.thumbnail_url
                    }
                    logger.info(f"Fetched video metadata: {video_info['title']}")
                except Exception as e:
                    logger.warning(f"Could not fetch video metadata with pytube: {e}")
                    # Continue with basic info
            
            # Process transcript segments
            segments = []
            full_text = []
            
            for entry in transcript_data:
                # Handle both dict and object formats
                if hasattr(entry, 'text'):
                    text = entry.text
                    start = entry.start
                    duration = entry.duration
                else:
                    text = entry.get('text', '')
                    start = entry.get('start', 0)
                    duration = entry.get('duration', 0)
                
                segments.append({
                    "start": start,
                    "end": start + duration,
                    "text": text,
                    "duration": duration
                })
                full_text.append(text)
            
            full_transcript = " ".join(full_text)
            
            # Detect language if not English
            try:
                detected_lang = detect(full_transcript[:500])
                language = detected_lang
            except:
                pass
            
            # Calculate duration from segments if not available from video info
            duration = video_info.get("length", 0)
            if duration == 0 and segments:
                duration = int(segments[-1]["end"])
            
            return {
                "success": True,
                "video_info": video_info,
                "transcript": full_transcript,
                "segments": segments,
                "language": language,
                "duration": duration,
                "has_timestamps": True
            }
            
        except Exception as e:
            logger.error(f"YouTube processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def transcribe_audio_groq(self, audio_path: str) -> Dict:
        """Transcribe audio using Groq Whisper (FREE)"""
        try:
            # Groq Whisper is free and fast
            with open(audio_path, "rb") as audio_file:
                transcription = self.groq_client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    temperature=0.0
                )
            
            # Extract segments with timestamps
            segments = []
            if hasattr(transcription, 'segments'):
                for seg in transcription.segments:
                    segments.append({
                        "start": seg.get('start', 0),
                        "end": seg.get('end', 0),
                        "text": seg.get('text', ''),
                        "confidence": seg.get('confidence', 0.0)
                    })
            
            # Detect language
            language = transcription.language if hasattr(transcription, 'language') else 'en'
            
            return {
                "success": True,
                "transcript": transcription.text,
                "segments": segments,
                "language": language,
                "has_timestamps": len(segments) > 0
            }
            
        except Exception as e:
            logger.error(f"Groq transcription error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def analyze_transcript_ai(self, transcript: str, options: Dict = None) -> Dict:
        """AI analysis of transcript using Groq (FREE with high limits)"""
        try:
            options = options or {}
            subject = options.get('subject', 'general')
            difficulty = options.get('difficulty', 'intermediate')
            
            # Use more of the transcript for analysis (up to 30k chars)
            transcript_sample = transcript[:30000]
            
            prompt = f"""Analyze this transcript and provide a comprehensive analysis:

Transcript: {transcript_sample}

Provide a JSON response with:
1. key_concepts: Array of main concepts (max 20)
2. topics: Array of topics covered
3. difficulty_level: beginner/intermediate/advanced
4. estimated_study_time: minutes needed to study this
5. summary: Comprehensive 5-7 sentence summary covering all major points
6. action_items: Things to remember or do
7. questions: 10 study questions covering different sections
8. language: detected language code

Format as valid JSON."""

            # Use Groq with higher token limit
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an expert educational content analyzer. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            result_text = response.choices[0].message.content
            
            try:
                # Extract JSON if wrapped in markdown
                if "```json" in result_text:
                    result_text = result_text.split("```json")[1].split("```")[0]
                elif "```" in result_text:
                    result_text = result_text.split("```")[1].split("```")[0]
                
                analysis = json.loads(result_text.strip())
            except Exception as parse_error:
                logger.warning(f"JSON parse error: {parse_error}, creating fallback response")
                # Fallback: create structured response
                analysis = {
                    "key_concepts": self._extract_concepts(transcript),
                    "topics": [subject],
                    "difficulty_level": difficulty,
                    "estimated_study_time": max(10, len(transcript.split()) // 150),
                    "summary": result_text[:500] if result_text else "Content analysis",
                    "action_items": [],
                    "questions": [],
                    "language": "en"
                }
            
            return {
                "success": True,
                "analysis": analysis
            }
            
        except Exception as e:
            logger.error(f"AI analysis error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_notes_ai(self, transcript: str, analysis: Dict, style: str = "detailed", options: Dict = None) -> Dict:
        """Generate formatted notes using Groq with optimized prompts for detailed output"""
        try:
            options = options or {}
            difficulty = options.get('difficulty', 'intermediate')
            subject = options.get('subject', 'general')
            custom_instructions = options.get('custom_instructions', '')
            
            # Calculate word count
            word_count = len(transcript.split())
            logger.info(f"Transcript word count: {word_count}")
            
            # For very long transcripts, use chunking with Groq
            if word_count > 8000 and style == "detailed":
                logger.info("Using chunked processing for long transcript")
                return await self._generate_notes_chunked_groq(transcript, analysis, difficulty, subject, custom_instructions)
            
            # Single-pass generation with Groq
            prompt = f"""You are an expert professor creating comprehensive lecture notes for students.

LECTURE DETAILS:
- Subject: {subject}
- Difficulty: {difficulty}
- Transcript Length: {word_count} words
{f'- Special Instructions: {custom_instructions}' if custom_instructions else ''}

YOUR TASK:
Create EXTREMELY DETAILED study notes that cover EVERY important point from this lecture.
Your notes should be AT LEAST 2500-3500 words and include:

1. COMPREHENSIVE COVERAGE: Don't skip any major topics or concepts
2. DETAILED EXPLANATIONS: Explain each concept thoroughly (4-6 sentences per concept)
3. EXAMPLES & CONTEXT: Provide examples, analogies, and real-world applications
4. STRUCTURED FORMAT: Use clear sections and subsections
5. KEY TERMS: Highlight and define important terminology
6. CONNECTIONS: Show how concepts relate to each other

KEY CONCEPTS TO ELABORATE ON:
{json.dumps(analysis.get('key_concepts', []))}

COMPLETE LECTURE TRANSCRIPT:
{transcript}

FORMAT YOUR NOTES AS HTML:
- Use <h2> for main sections (e.g., "Introduction", "Core Concepts", "Applications")
- Use <h3> for major topics within sections
- Use <h4> for subtopics and specific concepts
- Use <strong> for key terms and important points
- Use <ul> or <ol> for lists
- Use <p> for explanatory paragraphs (write MULTIPLE paragraphs per concept)
- Use <blockquote> for important quotes or key takeaways
- Use <em> for emphasis

CRITICAL: Make these notes COMPREHENSIVE and DETAILED. Students should be able to study from these notes alone. Do NOT just summarize - EXPAND and EXPLAIN thoroughly.

Return ONLY the HTML content (no markdown code blocks, no ```html tags)."""

            # Use Groq with maximum output tokens
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an expert educational content writer who creates thorough, comprehensive study notes. You never summarize - you always expand and explain concepts in detail."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=8000  # Groq allows up to 8k tokens
            )
            
            html_content = response.choices[0].message.content
            
            
            # Clean up markdown if present
            if "```html" in html_content:
                html_content = html_content.split("```html")[1].split("```")[0]
            elif "```" in html_content:
                html_content = html_content.split("```")[1].split("```")[0]
            
            return {
                "success": True,
                "content": html_content.strip(),
                "style": style
            }
            
        except Exception as e:
            logger.error(f"Note generation error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _generate_notes_chunked_groq(self, transcript: str, analysis: Dict, difficulty: str, subject: str, custom_instructions: str) -> Dict:
        """Generate notes in chunks for very long transcripts using Groq, then combine"""
        try:
            # Split transcript into chunks (roughly 7k words each for Groq)
            words = transcript.split()
            chunk_size = 7000
            chunks = []
            
            for i in range(0, len(words), chunk_size):
                chunk = ' '.join(words[i:i + chunk_size])
                chunks.append(chunk)
            
            logger.info(f"Processing {len(chunks)} chunks with Groq")
            
            # Generate notes for each chunk
            all_notes = []
            for idx, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {idx + 1}/{len(chunks)}")
                
                prompt = f"""Create comprehensive study notes for PART {idx + 1} of {len(chunks)} of a lecture.

Subject: {subject}
Difficulty: {difficulty}
Key Concepts: {json.dumps(analysis.get('key_concepts', []))}

LECTURE CONTENT (Part {idx + 1}/{len(chunks)}):
{chunk}

Create DETAILED HTML notes for this section:
- Use <h3> for main topics
- Use <h4> for subtopics  
- Write thorough explanations (4-6 sentences per concept)
- Include examples and context
- Use <strong> for key terms
- Use <ul>/<ol> for lists
- Use <p> for detailed paragraphs

Make this comprehensive - students should understand the material from your notes alone.

Return ONLY HTML content (no markdown)."""

                response = self.groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "You are an expert educational content writer creating detailed study notes."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=8000
                )
                
                all_notes.append(response.choices[0].message.content)
            
            # Combine all chunks with section headers
            combined_html = f"""<div class="lecture-notes">
<h1>{subject} - Comprehensive Lecture Notes</h1>
<p><em>Generated from {len(words)}-word lecture transcript</em></p>
"""
            
            for idx, note_html in enumerate(all_notes):
                # Clean up markdown if present
                if "```html" in note_html:
                    note_html = note_html.split("```html")[1].split("```")[0]
                elif "```" in note_html:
                    note_html = note_html.split("```")[1].split("```")[0]
                
                combined_html += f"""
<section class="lecture-section">
<h2>Part {idx + 1} of {len(chunks)}</h2>
{note_html}
</section>
"""
            
            combined_html += "</div>"
            
            return {
                "success": True,
                "content": combined_html.strip(),
                "style": "detailed",
                "chunks_processed": len(chunks)
            }
            
        except Exception as e:
            logger.error(f"Chunked note generation error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_flashcards_ai(self, transcript: str, analysis: Dict, count: int = 10) -> Dict:
        """Generate flashcards from content using Groq"""
        try:
            prompt = f"""Generate {count} flashcards from this content.

Key Concepts: {json.dumps(analysis.get('key_concepts', []))}

Content: {transcript[:5000]}

Create flashcards as JSON array:
[
  {{"question": "...", "answer": "...", "difficulty": "easy/medium/hard"}},
  ...
]

Return ONLY valid JSON array."""

            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an expert at creating educational flashcards. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content
            
            # Extract JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            flashcards = json.loads(result_text.strip())
            
            return {
                "success": True,
                "flashcards": flashcards[:count]
            }
            
        except Exception as e:
            logger.error(f"Flashcard generation error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "flashcards": []
            }
    
    async def generate_quiz_ai(self, transcript: str, analysis: Dict, count: int = 10) -> Dict:
        """Generate quiz questions from content using Groq"""
        try:
            prompt = f"""Generate {count} multiple-choice quiz questions from this content.

Key Concepts: {json.dumps(analysis.get('key_concepts', []))}

Content: {transcript[:5000]}

Create questions as JSON array:
[
  {{
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_answer": 0,
    "explanation": "...",
    "difficulty": "easy/medium/hard"
  }},
  ...
]

Return ONLY valid JSON array."""

            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an expert at creating educational quiz questions. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=3000
            )
            
            result_text = response.choices[0].message.content
            
            # Extract JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            questions = json.loads(result_text.strip())
            
            return {
                "success": True,
                "questions": questions[:count]
            }
            
        except Exception as e:
            logger.error(f"Quiz generation error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "questions": []
            }
    
    async def extract_key_moments(self, segments: List[Dict], analysis: Dict) -> List[Dict]:
        """Identify key moments in the content"""
        try:
            key_concepts = analysis.get('key_concepts', [])
            key_moments = []
            
            for segment in segments:
                text = segment.get('text', '').lower()
                importance = 0
                
                # Check if segment contains key concepts
                for concept in key_concepts:
                    if concept.lower() in text:
                        importance += 1
                
                # Check for important phrases
                important_phrases = ['important', 'key point', 'remember', 'crucial', 'essential', 'main idea']
                for phrase in important_phrases:
                    if phrase in text:
                        importance += 2
                
                if importance > 0:
                    key_moments.append({
                        "timestamp": segment.get('start', 0),
                        "text": segment.get('text', ''),
                        "importance": importance
                    })
            
            # Sort by importance and return top moments
            key_moments.sort(key=lambda x: x['importance'], reverse=True)
            return key_moments[:10]
            
        except Exception as e:
            logger.error(f"Key moments extraction error: {str(e)}")
            return []
    
    def _extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
            r'youtube\.com\/embed\/([^&\n?#]+)',
            r'youtube\.com\/v\/([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def _extract_concepts(self, text: str, max_concepts: int = 10) -> List[str]:
        """Simple concept extraction fallback"""
        # This is a simple fallback - AI analysis is preferred
        words = text.split()
        # Get capitalized words (likely important terms)
        concepts = [w for w in words if w[0].isupper() and len(w) > 3]
        # Remove duplicates and limit
        concepts = list(set(concepts))[:max_concepts]
        return concepts
    
    async def convert_audio_format(self, input_path: str, output_format: str = "mp3") -> str:
        """Convert audio to compatible format"""
        try:
            audio = AudioSegment.from_file(input_path)
            output_path = input_path.rsplit('.', 1)[0] + f'.{output_format}'
            audio.export(output_path, format=output_format)
            return output_path
        except Exception as e:
            logger.error(f"Audio conversion error: {str(e)}")
            return input_path
    
    def estimate_processing_cost(self, duration_seconds: int, file_size_mb: float) -> Dict:
        """Estimate processing cost (all free APIs)"""
        return {
            "transcription_cost": 0.0,  # Groq Whisper is free
            "ai_analysis_cost": 0.0,  # Gemini free tier
            "total_cost": 0.0,
            "note": "Using free tier APIs"
        }
    
    def get_language_name(self, language_code: str) -> str:
        """Get full language name from code"""
        try:
            lang = pycountry.languages.get(alpha_2=language_code)
            return lang.name if lang else language_code
        except:
            return language_code


# Global instance
ai_media_processor = AIMediaProcessor()
