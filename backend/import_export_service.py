"""
Comprehensive Import/Export Service
Handles all conversions between different content types
"""

import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from groq import Groq
import os

logger = logging.getLogger(__name__)

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class ImportExportService:
    """Service for handling all import/export operations"""
    
    def __init__(self, db: Session):
        self.db = db
        
    # ==================== NOTES CONVERSIONS ====================
    
    async def notes_to_flashcards(
        self, 
        note_ids: List[int], 
        user_id: int,
        card_count: int = 10,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """Convert notes to flashcards"""
        from models import Note, FlashcardSet, Flashcard
        
        try:
            # Get notes
            notes = self.db.query(Note).filter(
                Note.id.in_(note_ids),
                Note.user_id == user_id
            ).all()
            
            if not notes:
                return {"success": False, "error": "No notes found"}
            
            # Combine note content
            combined_content = "\n\n".join([
                f"# {note.title}\n{note.content}" for note in notes
            ])
            
            # Generate flashcards using AI
            prompt = f"""Generate {card_count} flashcards from these notes.
Difficulty: {difficulty}

Notes:
{combined_content[:4000]}

Return ONLY a JSON array of flashcards with this exact format:
[{{"question": "...", "answer": "..."}}]"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            flashcards_data = json.loads(content)
            
            # Create flashcard set
            set_title = f"Flashcards from {len(notes)} note(s)"
            flashcard_set = FlashcardSet(
                user_id=user_id,
                title=set_title,
                description=f"Generated from notes: {', '.join([n.title for n in notes[:3]])}"
            )
            self.db.add(flashcard_set)
            self.db.flush()
            
            # Create flashcards
            for card_data in flashcards_data:
                flashcard = Flashcard(
                    set_id=flashcard_set.id,
                    question=card_data["question"],
                    answer=card_data["answer"]
                )
                self.db.add(flashcard)
            
            self.db.commit()
            
            return {
                "success": True,
                "set_id": flashcard_set.id,
                "set_title": set_title,
                "card_count": len(flashcards_data),
                "flashcards": flashcards_data
            }
            
        except Exception as e:
            logger.error(f"Error converting notes to flashcards: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    async def notes_to_questions(
        self,
        note_ids: List[int],
        user_id: int,
        question_count: int = 10,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """Convert notes to practice questions"""
        from models import Note, QuestionSet, Question
        
        try:
            notes = self.db.query(Note).filter(
                Note.id.in_(note_ids),
                Note.user_id == user_id
            ).all()
            
            if not notes:
                return {"success": False, "error": "No notes found"}
            
            combined_content = "\n\n".join([
                f"# {note.title}\n{note.content}" for note in notes
            ])
            
            prompt = f"""Generate {question_count} multiple-choice questions from these notes.
Difficulty: {difficulty}

Notes:
{combined_content[:4000]}

Return ONLY a JSON array with this exact format:
[{{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "..."
}}]"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=3000
            )
            
            content = response.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions_data = json.loads(content)
            
            # Create question set
            set_title = f"Questions from {len(notes)} note(s)"
            question_set = QuestionSet(
                user_id=user_id,
                title=set_title,
                description=f"Generated from notes",
                source_type="notes",
                total_questions=len(questions_data)
            )
            self.db.add(question_set)
            self.db.flush()
            
            # Create questions
            for idx, q_data in enumerate(questions_data):
                question = Question(
                    set_id=question_set.id,
                    question_text=q_data["question"],
                    options=json.dumps(q_data["options"]),
                    correct_answer=q_data["correct_answer"],
                    explanation=q_data.get("explanation", ""),
                    difficulty=difficulty,
                    order_index=idx
                )
                self.db.add(question)
            
            self.db.commit()
            
            return {
                "success": True,
                "set_id": question_set.id,
                "set_title": set_title,
                "question_count": len(questions_data),
                "questions": questions_data
            }
            
        except Exception as e:
            logger.error(f"Error converting notes to questions: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    # ==================== FLASHCARDS CONVERSIONS ====================
    
    async def flashcards_to_notes(
        self,
        set_ids: List[int],
        user_id: int,
        format_style: str = "structured"
    ) -> Dict[str, Any]:
        """Convert flashcard sets to notes"""
        from models import FlashcardSet, Flashcard, Note
        
        try:
            flashcard_sets = self.db.query(FlashcardSet).filter(
                FlashcardSet.id.in_(set_ids),
                FlashcardSet.user_id == user_id
            ).all()
            
            if not flashcard_sets:
                return {"success": False, "error": "No flashcard sets found"}
            
            # Collect all flashcards
            all_cards = []
            for fset in flashcard_sets:
                cards = self.db.query(Flashcard).filter(
                    Flashcard.set_id == fset.id
                ).all()
                all_cards.extend([(fset.title, card) for card in cards])
            
            # Generate note content
            if format_style == "structured":
                content = self._format_flashcards_structured(all_cards)
            elif format_style == "qa":
                content = self._format_flashcards_qa(all_cards)
            else:
                content = self._format_flashcards_summary(all_cards)
            
            # Create note
            note_title = f"Study Guide from {len(flashcard_sets)} Flashcard Set(s)"
            note = Note(
                user_id=user_id,
                title=note_title,
                content=content
            )
            self.db.add(note)
            self.db.commit()
            
            return {
                "success": True,
                "note_id": note.id,
                "note_title": note_title,
                "card_count": len(all_cards)
            }
            
        except Exception as e:
            logger.error(f"Error converting flashcards to notes: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def _format_flashcards_structured(self, cards: List) -> str:
        """Format flashcards as structured notes"""
        content = "<h1>Study Guide from Flashcards</h1>\n\n"
        
        current_set = None
        for set_title, card in cards:
            if set_title != current_set:
                content += f"<h2>{set_title}</h2>\n\n"
                current_set = set_title
            
            content += f"<h3>{card.question}</h3>\n"
            content += f"<p>{card.answer}</p>\n\n"
        
        return content
    
    def _format_flashcards_qa(self, cards: List) -> str:
        """Format flashcards as Q&A"""
        content = "<h1>Q&A Study Guide</h1>\n\n"
        
        for idx, (set_title, card) in enumerate(cards, 1):
            content += f"<p><strong>Q{idx}:</strong> {card.question}</p>\n"
            content += f"<p><strong>A{idx}:</strong> {card.answer}</p>\n<br>\n"
        
        return content
    
    def _format_flashcards_summary(self, cards: List) -> str:
        """Format flashcards as summary"""
        content = "<h1>Study Summary</h1>\n\n<ul>\n"
        
        for set_title, card in cards:
            content += f"<li><strong>{card.question}</strong>: {card.answer}</li>\n"
        
        content += "</ul>"
        return content

    
    async def flashcards_to_questions(
        self,
        set_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Convert flashcards to quiz questions"""
        from models import FlashcardSet, Flashcard, QuestionSet, Question
        
        try:
            flashcard_sets = self.db.query(FlashcardSet).filter(
                FlashcardSet.id.in_(set_ids),
                FlashcardSet.user_id == user_id
            ).all()
            
            if not flashcard_sets:
                return {"success": False, "error": "No flashcard sets found"}
            
            # Collect flashcards
            all_cards = []
            for fset in flashcard_sets:
                cards = self.db.query(Flashcard).filter(
                    Flashcard.set_id == fset.id
                ).all()
                all_cards.extend(cards)
            
            # Generate questions from flashcards using AI
            cards_text = "\n".join([
                f"Q: {card.question}\nA: {card.answer}" 
                for card in all_cards[:20]  # Limit to avoid token limits
            ])
            
            prompt = f"""Convert these flashcards into multiple-choice questions.
For each flashcard, create a question with 4 options where one is correct.

Flashcards:
{cards_text}

Return ONLY a JSON array:
[{{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "..."
}}]"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=3000
            )
            
            content = response.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions_data = json.loads(content)
            
            # Create question set
            set_title = f"Quiz from {len(flashcard_sets)} Flashcard Set(s)"
            question_set = QuestionSet(
                user_id=user_id,
                title=set_title,
                description="Generated from flashcards",
                source_type="flashcards",
                total_questions=len(questions_data)
            )
            self.db.add(question_set)
            self.db.flush()
            
            # Create questions
            for idx, q_data in enumerate(questions_data):
                question = Question(
                    set_id=question_set.id,
                    question_text=q_data["question"],
                    options=json.dumps(q_data["options"]),
                    correct_answer=q_data["correct_answer"],
                    explanation=q_data.get("explanation", ""),
                    order_index=idx
                )
                self.db.add(question)
            
            self.db.commit()
            
            return {
                "success": True,
                "set_id": question_set.id,
                "set_title": set_title,
                "question_count": len(questions_data)
            }
            
        except Exception as e:
            logger.error(f"Error converting flashcards to questions: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    # ==================== QUESTIONS CONVERSIONS ====================
    
    async def questions_to_flashcards(
        self,
        set_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Convert question sets to flashcards"""
        from models import QuestionSet, Question, FlashcardSet, Flashcard
        
        try:
            question_sets = self.db.query(QuestionSet).filter(
                QuestionSet.id.in_(set_ids),
                QuestionSet.user_id == user_id
            ).all()
            
            if not question_sets:
                return {"success": False, "error": "No question sets found"}
            
            # Create flashcard set
            set_title = f"Flashcards from {len(question_sets)} Question Set(s)"
            flashcard_set = FlashcardSet(
                user_id=user_id,
                title=set_title,
                description="Generated from questions"
            )
            self.db.add(flashcard_set)
            self.db.flush()
            
            # Convert questions to flashcards
            card_count = 0
            for qset in question_sets:
                questions = self.db.query(Question).filter(
                    Question.set_id == qset.id
                ).all()
                
                for question in questions:
                    # Parse options to find correct answer
                    try:
                        options = json.loads(question.options)
                        correct_letter = question.correct_answer
                        correct_option = next(
                            (opt for opt in options if opt.startswith(correct_letter)),
                            options[0]
                        )
                        answer_text = correct_option.split(") ", 1)[1] if ") " in correct_option else correct_option
                        
                        if question.explanation:
                            answer_text += f"\n\nExplanation: {question.explanation}"
                        
                    except:
                        answer_text = f"Correct answer: {question.correct_answer}"
                    
                    flashcard = Flashcard(
                        set_id=flashcard_set.id,
                        question=question.question_text,
                        answer=answer_text
                    )
                    self.db.add(flashcard)
                    card_count += 1
            
            flashcard_set.card_count = card_count
            self.db.commit()
            
            return {
                "success": True,
                "set_id": flashcard_set.id,
                "set_title": set_title,
                "card_count": card_count
            }
            
        except Exception as e:
            logger.error(f"Error converting questions to flashcards: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    async def questions_to_notes(
        self,
        set_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Convert question sets to study guide notes"""
        from models import QuestionSet, Question, Note
        
        try:
            question_sets = self.db.query(QuestionSet).filter(
                QuestionSet.id.in_(set_ids),
                QuestionSet.user_id == user_id
            ).all()
            
            if not question_sets:
                return {"success": False, "error": "No question sets found"}
            
            # Build note content
            content = "<h1>Study Guide from Questions</h1>\n\n"
            
            for qset in question_sets:
                content += f"<h2>{qset.title}</h2>\n\n"
                
                questions = self.db.query(Question).filter(
                    Question.set_id == qset.id
                ).order_by(Question.order_index).all()
                
                for idx, question in enumerate(questions, 1):
                    content += f"<h3>Question {idx}</h3>\n"
                    content += f"<p><strong>{question.question_text}</strong></p>\n"
                    
                    try:
                        options = json.loads(question.options)
                        content += "<ul>\n"
                        for opt in options:
                            is_correct = opt.startswith(question.correct_answer)
                            if is_correct:
                                content += f"<li><strong>✓ {opt}</strong></li>\n"
                            else:
                                content += f"<li>{opt}</li>\n"
                        content += "</ul>\n"
                    except:
                        content += f"<p>Correct Answer: {question.correct_answer}</p>\n"
                    
                    if question.explanation:
                        content += f"<p><em>Explanation: {question.explanation}</em></p>\n"
                    
                    content += "<br>\n"
            
            # Create note
            note_title = f"Study Guide from {len(question_sets)} Question Set(s)"
            note = Note(
                user_id=user_id,
                title=note_title,
                content=content
            )
            self.db.add(note)
            self.db.commit()
            
            return {
                "success": True,
                "note_id": note.id,
                "note_title": note_title
            }
            
        except Exception as e:
            logger.error(f"Error converting questions to notes: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    # ==================== MEDIA CONVERSIONS ====================
    
    async def media_to_questions(
        self,
        media_ids: List[int],
        user_id: int,
        question_count: int = 10
    ) -> Dict[str, Any]:
        """Generate questions from media transcripts"""
        from models import MediaFile, QuestionSet, Question
        
        try:
            media_files = self.db.query(MediaFile).filter(
                MediaFile.id.in_(media_ids),
                MediaFile.user_id == user_id
            ).all()
            
            if not media_files:
                return {"success": False, "error": "No media files found"}
            
            # Combine transcripts
            combined_transcript = "\n\n".join([
                f"From {media.original_filename}:\n{media.transcript or ''}"
                for media in media_files if media.transcript
            ])
            
            if not combined_transcript.strip():
                return {"success": False, "error": "No transcripts available"}
            
            # Generate questions
            prompt = f"""Generate {question_count} multiple-choice questions from this transcript.

Transcript:
{combined_transcript[:4000]}

Return ONLY a JSON array:
[{{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "..."
}}]"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=3000
            )
            
            content = response.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions_data = json.loads(content)
            
            # Create question set
            set_title = f"Questions from {len(media_files)} Media File(s)"
            question_set = QuestionSet(
                user_id=user_id,
                title=set_title,
                description="Generated from media transcripts",
                source_type="media",
                total_questions=len(questions_data)
            )
            self.db.add(question_set)
            self.db.flush()
            
            # Create questions
            for idx, q_data in enumerate(questions_data):
                question = Question(
                    set_id=question_set.id,
                    question_text=q_data["question"],
                    options=json.dumps(q_data["options"]),
                    correct_answer=q_data["correct_answer"],
                    explanation=q_data.get("explanation", ""),
                    order_index=idx
                )
                self.db.add(question)
            
            self.db.commit()
            
            return {
                "success": True,
                "set_id": question_set.id,
                "set_title": set_title,
                "question_count": len(questions_data)
            }
            
        except Exception as e:
            logger.error(f"Error converting media to questions: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    # ==================== PLAYLIST CONVERSIONS ====================
    
    async def playlist_to_notes(
        self,
        playlist_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """Generate comprehensive study notes from playlist content using AI"""
        from models import LearningPlaylist, PlaylistItem, Note
        
        try:
            logger.info(f"Looking for playlist with ID: {playlist_id} (type: {type(playlist_id)})")
            
            playlist = self.db.query(LearningPlaylist).filter(
                LearningPlaylist.id == playlist_id
            ).first()
            
            if not playlist:
                return {"success": False, "error": "Playlist not found"}
            
            logger.info(f"Found playlist: {playlist.title} (ID: {playlist.id})")
            
            # Get playlist items
            items = self.db.query(PlaylistItem).filter(
                PlaylistItem.playlist_id == playlist_id
            ).order_by(PlaylistItem.order_index).all()
            
            logger.info(f"Query returned {len(items)} items for playlist_id={playlist_id}")
            
            # Debug: Check all items in the table
            all_items = self.db.query(PlaylistItem).all()
            logger.info(f"Total PlaylistItems in database: {len(all_items)}")
            for item in all_items[:5]:
                logger.info(f"  Item {item.id}: playlist_id={item.playlist_id}, title={item.title}")
            
            if not items:
                return {"success": False, "error": f"Playlist has no items (checked playlist_id={playlist_id})"}
            
            # Build detailed context from playlist items
            playlist_context = f"# {playlist.title}\n\n"
            if playlist.description:
                playlist_context += f"{playlist.description}\n\n"
            
            playlist_context += "## Learning Materials:\n\n"
            for idx, item in enumerate(items, 1):
                playlist_context += f"### {idx}. {item.title or 'Untitled'}\n"
                playlist_context += f"**Type:** {item.item_type}\n"
                if item.description:
                    playlist_context += f"**Description:** {item.description}\n"
                if item.notes:
                    playlist_context += f"**Notes:** {item.notes}\n"
                if item.url:
                    playlist_context += f"**Resource:** {item.url}\n"
                if item.duration_minutes:
                    playlist_context += f"**Duration:** {item.duration_minutes} minutes\n"
                playlist_context += "\n"
            
            # Generate comprehensive notes using AI
            prompt = f"""You are an expert educator. Create comprehensive, detailed study notes from this learning playlist.

{playlist_context[:4000]}

Write detailed educational content that:
- Explains each topic thoroughly with 3-4 paragraphs minimum per topic
- Includes key concepts, definitions, and explanations
- Provides context and real-world applications
- Uses clear structure with headings and subheadings
- Makes complex topics easy to understand

Output ONLY HTML content with these tags: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
Start with <h1>{playlist.title}</h1> then write comprehensive content for each topic.
Write at least 500 words of educational content."""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=6000
            )
            
            ai_content = response.choices[0].message.content.strip()
            
            # Clean up markdown code blocks
            if "```html" in ai_content:
                ai_content = ai_content.split("```html")[1].split("```")[0].strip()
            elif "```" in ai_content:
                parts = ai_content.split("```")
                if len(parts) >= 3:
                    ai_content = parts[1].strip()
            
            # Remove any remaining markdown artifacts
            if ai_content.startswith("html"):
                ai_content = ai_content[4:].strip()
            
            # Validate content
            if not ai_content or len(ai_content) < 100:
                raise Exception(f"AI generated insufficient content (length: {len(ai_content)})")
            
            # Ensure HTML structure
            if not ai_content.startswith("<"):
                ai_content = f"<div>{ai_content}</div>"
            
            # Create note
            note = Note(
                user_id=user_id,
                title=f"Study Notes: {playlist.title}",
                content=ai_content
            )
            self.db.add(note)
            self.db.commit()
            self.db.refresh(note)
            
            # Verify note was saved with content
            if not note.content or len(note.content) < 100:
                raise Exception("Note content was not saved properly")
            
            logger.info(f"Created note {note.id} with {len(note.content)} characters")
            
            return {
                "success": True,
                "note_id": note.id,
                "note_title": note.title,
                "items_count": len(items)
            }
            
        except Exception as e:
            logger.error(f"Error converting playlist to notes: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def playlist_to_flashcards(
        self,
        playlist_id: int,
        user_id: int,
        card_count: int = 15
    ) -> Dict[str, Any]:
        """Generate flashcards from playlist content"""
        from models import LearningPlaylist, PlaylistItem, FlashcardSet, Flashcard
        
        try:
            playlist = self.db.query(LearningPlaylist).filter(
                LearningPlaylist.id == playlist_id
            ).first()
            
            if not playlist:
                return {"success": False, "error": "Playlist not found"}
            
            items = self.db.query(PlaylistItem).filter(
                PlaylistItem.playlist_id == playlist_id
            ).all()
            
            # Combine content from playlist items
            combined_content = "\n\n".join([
                f"Title: {item.title or 'Untitled'}\n"
                f"Type: {item.item_type}\n"
                f"Description: {item.description or ''}\n"
                f"Notes: {item.notes or ''}\n"
                f"URL: {item.url or ''}"
                for item in items
            ])
            
            # Generate flashcards
            prompt = f"""Generate {card_count} flashcards from this playlist content.

Content:
{combined_content[:4000]}

Return ONLY a JSON array:
[{{"question": "...", "answer": "..."}}]"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            flashcards_data = json.loads(content)
            
            # Create flashcard set
            flashcard_set = FlashcardSet(
                user_id=user_id,
                title=f"Flashcards: {playlist.title}",
                description=f"From playlist: {playlist.title}"
            )
            self.db.add(flashcard_set)
            self.db.flush()
            
            for card_data in flashcards_data:
                flashcard = Flashcard(
                    set_id=flashcard_set.id,
                    question=card_data["question"],
                    answer=card_data["answer"]
                )
                self.db.add(flashcard)
            
            self.db.commit()
            
            return {
                "success": True,
                "set_id": flashcard_set.id,
                "set_title": flashcard_set.title,
                "card_count": len(flashcards_data)
            }
            
        except Exception as e:
            logger.error(f"Error converting playlist to flashcards: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}

    
    # ==================== BATCH OPERATIONS ====================
    
    async def merge_notes(
        self,
        note_ids: List[int],
        user_id: int,
        new_title: str = None
    ) -> Dict[str, Any]:
        """Merge multiple notes into one"""
        from models import Note
        
        try:
            notes = self.db.query(Note).filter(
                Note.id.in_(note_ids),
                Note.user_id == user_id
            ).all()
            
            if len(notes) < 2:
                return {"success": False, "error": "Need at least 2 notes to merge"}
            
            # Combine content
            merged_content = ""
            for note in notes:
                merged_content += f"<h2>{note.title}</h2>\n{note.content}\n<hr>\n"
            
            # Create merged note
            title = new_title or f"Merged: {', '.join([n.title[:20] for n in notes[:3]])}"
            merged_note = Note(
                user_id=user_id,
                title=title,
                content=merged_content
            )
            self.db.add(merged_note)
            self.db.commit()
            
            return {
                "success": True,
                "note_id": merged_note.id,
                "note_title": title,
                "merged_count": len(notes)
            }
            
        except Exception as e:
            logger.error(f"Error merging notes: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    # ==================== EXPORT OPERATIONS ====================
    
    def export_flashcards_to_csv(
        self,
        set_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Export flashcards to CSV format"""
        from models import FlashcardSet, Flashcard
        import csv
        import io
        
        try:
            flashcard_sets = self.db.query(FlashcardSet).filter(
                FlashcardSet.id.in_(set_ids),
                FlashcardSet.user_id == user_id
            ).all()
            
            if not flashcard_sets:
                return {"success": False, "error": "No flashcard sets found"}
            
            # Create CSV
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Set", "Question", "Answer"])
            
            for fset in flashcard_sets:
                cards = self.db.query(Flashcard).filter(
                    Flashcard.set_id == fset.id
                ).all()
                
                for card in cards:
                    writer.writerow([fset.title, card.question, card.answer])
            
            csv_content = output.getvalue()
            output.close()
            
            return {
                "success": True,
                "content": csv_content,
                "filename": f"flashcards_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
            
        except Exception as e:
            logger.error(f"Error exporting flashcards to CSV: {e}")
            return {"success": False, "error": str(e)}

    
    def export_questions_to_pdf(
        self,
        set_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Export questions to PDF-ready HTML"""
        from models import QuestionSet, Question
        
        try:
            question_sets = self.db.query(QuestionSet).filter(
                QuestionSet.id.in_(set_ids),
                QuestionSet.user_id == user_id
            ).all()
            
            if not question_sets:
                return {"success": False, "error": "No question sets found"}
            
            # Build HTML for PDF
            html_content = """
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
                    h2 { color: #34495e; margin-top: 30px; }
                    .question { margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db; }
                    .options { margin: 10px 0; }
                    .option { margin: 5px 0; padding: 5px; }
                    .correct { background: #d4edda; font-weight: bold; }
                    .explanation { margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 3px solid #ffc107; }
                </style>
            </head>
            <body>
                <h1>Question Bank Export</h1>
            """
            
            for qset in question_sets:
                html_content += f"<h2>{qset.title}</h2>"
                
                questions = self.db.query(Question).filter(
                    Question.set_id == qset.id
                ).order_by(Question.order_index).all()
                
                for idx, question in enumerate(questions, 1):
                    html_content += f'<div class="question">'
                    html_content += f'<strong>Question {idx}:</strong> {question.question_text}'
                    html_content += '<div class="options">'
                    
                    try:
                        options = json.loads(question.options)
                        for opt in options:
                            is_correct = opt.startswith(question.correct_answer)
                            css_class = "option correct" if is_correct else "option"
                            html_content += f'<div class="{css_class}">{opt}</div>'
                    except:
                        html_content += f'<div class="option correct">Correct: {question.correct_answer}</div>'
                    
                    html_content += '</div>'
                    
                    if question.explanation:
                        html_content += f'<div class="explanation"><strong>Explanation:</strong> {question.explanation}</div>'
                    
                    html_content += '</div>'
            
            html_content += "</body></html>"
            
            return {
                "success": True,
                "content": html_content,
                "filename": f"questions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            }
            
        except Exception as e:
            logger.error(f"Error exporting questions to PDF: {e}")
            return {"success": False, "error": str(e)}
    
    def export_notes_to_markdown(
        self,
        note_ids: List[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Export notes to Markdown format"""
        from models import Note
        import html2text
        
        try:
            notes = self.db.query(Note).filter(
                Note.id.in_(note_ids),
                Note.user_id == user_id
            ).all()
            
            if not notes:
                return {"success": False, "error": "No notes found"}
            
            # Convert HTML to Markdown
            h = html2text.HTML2Text()
            h.ignore_links = False
            
            markdown_content = ""
            for note in notes:
                markdown_content += f"# {note.title}\n\n"
                markdown_content += h.handle(note.content)
                markdown_content += "\n\n---\n\n"
            
            return {
                "success": True,
                "content": markdown_content,
                "filename": f"notes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            }
            
        except Exception as e:
            logger.error(f"Error exporting notes to markdown: {e}")
            return {"success": False, "error": str(e)}
