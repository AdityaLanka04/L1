"""
Comprehensive Slide Analysis System
Generates detailed, in-depth explanations for presentation slides with:
- Detailed explanations (multiple paragraphs)
- Key concepts and definitions
- Potential exam questions
- Related concepts and cross-slide connections
- Practical applications
- Common misconceptions
- Study tips
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import PyPDF2
from groq import Groq
from sqlalchemy.orm import Session
from datetime import datetime

logger = logging.getLogger(__name__)

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class ComprehensiveSlideAnalyzer:
    """Analyzes slides and generates comprehensive educational content"""
    
    def __init__(self, db: Session):
        self.db = db
        self.model = "llama-3.3-70b-versatile"
    
    def call_ai(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.4, retries: int = 2) -> str:
        """Call Groq AI with error handling and retries"""
        import time
        
        for attempt in range(retries):
            try:
                response = groq_client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"AI call error (attempt {attempt + 1}/{retries}): {e}")
                if attempt < retries - 1:
                    time.sleep(1)  # Wait before retry
                else:
                    return ""
        return ""
    
    def extract_slide_content(self, file_path: Path, file_type: str) -> List[Dict[str, Any]]:
        """Extract content from PDF or PowerPoint files"""
        slides_data = []
        
        if file_type == 'pdf':
            try:
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page_num, page in enumerate(pdf_reader.pages, 1):
                        text = page.extract_text() or ""
                        slides_data.append({
                            "slide_number": page_num,
                            "content": text.strip(),
                            "title": f"Page {page_num}"
                        })
            except Exception as e:
                logger.error(f"Error reading PDF: {e}")
                raise
                
        elif file_type in ['ppt', 'pptx']:
            try:
                from pptx import Presentation
                
                prs = Presentation(str(file_path))
                
                for slide_num, ppt_slide in enumerate(prs.slides, 1):
                    slide_text = []
                    slide_title = f"Slide {slide_num}"
                    
                    for shape in ppt_slide.shapes:
                        if hasattr(shape, "text") and shape.text:
                            if shape.is_placeholder and hasattr(shape, 'placeholder_format'):
                                if shape.placeholder_format.type == 1:
                                    slide_title = shape.text.strip()
                            slide_text.append(shape.text.strip())
                        
                        if shape.has_table:
                            table = shape.table
                            for row in table.rows:
                                row_text = [cell.text for cell in row.cells if cell.text]
                                if row_text:
                                    slide_text.append(" | ".join(row_text))
                    
                    slides_data.append({
                        "slide_number": slide_num,
                        "content": "\n".join(slide_text),
                        "title": slide_title
                    })
                    
            except ImportError:
                logger.error("python-pptx not installed")
                raise
            except Exception as e:
                logger.error(f"Error reading PowerPoint: {e}")
                raise
        
        return slides_data
    
    def generate_comprehensive_analysis(
        self, 
        slide_data: Dict[str, Any], 
        all_slides_context: List[Dict[str, Any]],
        slide_index: int
    ) -> Dict[str, Any]:
        """Generate comprehensive analysis for a single slide"""
        
        content = slide_data["content"]
        title = slide_data["title"]
        slide_number = slide_data["slide_number"]
        
        # Build context from surrounding slides
        context_slides = []
        for i in range(max(0, slide_index - 2), min(len(all_slides_context), slide_index + 3)):
            if i != slide_index:
                context_slides.append(f"Slide {all_slides_context[i]['slide_number']}: {all_slides_context[i]['title']}")
        
        context_text = "\n".join(context_slides) if context_slides else "No surrounding context available"
        
        # Check if slide has substantial content
        if not content or len(content.strip()) < 20:
            return {
                "slide_number": slide_number,
                "title": title,
                "detailed_explanation": "This slide appears to be a title slide or contains minimal text content. It may serve as a section divider or introduction to the following content.",
                "key_concepts": [],
                "definitions": {},
                "exam_questions": [],
                "related_concepts": [],
                "practical_applications": [],
                "common_misconceptions": [],
                "study_tips": ["Review the surrounding slides for context"],
                "cross_references": [],
                "difficulty_level": "introductory",
                "estimated_study_time": "2 minutes"
            }
        
        # Generate comprehensive analysis using AI
        prompt = f"""You are an expert educational content analyzer. Analyze this presentation slide in extreme detail and provide comprehensive educational content.

SLIDE INFORMATION:
Slide Number: {slide_number}
Title: {title}
Content:
{content[:3000]}

SURROUNDING CONTEXT:
{context_text}

Provide a COMPREHENSIVE analysis in the following JSON format:
{{
    "detailed_explanation": "Write 3-5 detailed paragraphs explaining this slide's content thoroughly. Cover the main concepts, their significance, how they relate to each other, and why they matter. Be specific and educational.",
    
    "key_concepts": [
        "List 5-8 key concepts or ideas presented in this slide"
    ],
    
    "definitions": {{
        "term1": "Clear, detailed definition",
        "term2": "Clear, detailed definition"
    }},
    
    "exam_questions": [
        {{
            "question": "Detailed exam-style question",
            "type": "multiple-choice|short-answer|essay",
            "difficulty": "easy|medium|hard",
            "answer_hint": "Brief hint or key points for the answer"
        }}
    ],
    
    "related_concepts": [
        "Concept or topic that relates to this slide's content"
    ],
    
    "practical_applications": [
        "Real-world application or example of these concepts"
    ],
    
    "common_misconceptions": [
        "Common misunderstanding students might have about this topic"
    ],
    
    "study_tips": [
        "Specific tip for understanding or remembering this content"
    ],
    
    "cross_references": [
        "Reference to other slides or topics that connect to this content"
    ],
    
    "difficulty_level": "introductory|intermediate|advanced",
    
    "estimated_study_time": "X minutes - realistic time needed to understand this slide"
}}

IMPORTANT: 
- Make the detailed_explanation COMPREHENSIVE (at least 3 full paragraphs)
- Include at least 3-5 exam questions of varying difficulty
- Be specific and educational, not generic
- Focus on deep understanding, not surface-level summaries
- Return ONLY valid JSON, no additional text"""

        try:
            ai_response = self.call_ai(prompt, max_tokens=3000, temperature=0.4)
            
            # Clean and parse JSON from response
            import re
            
            # Try to find JSON in the response
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                json_str = json_match.group()
                
                # Clean up common JSON issues
                # Remove control characters
                json_str = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', json_str)
                # Fix escaped quotes
                json_str = json_str.replace('\\"', '"').replace('\\n', ' ')
                
                try:
                    analysis = json.loads(json_str)
                    analysis["slide_number"] = slide_number
                    analysis["title"] = title
                    
                    # Validate required fields
                    if "detailed_explanation" not in analysis:
                        logger.warning(f"Missing detailed_explanation for slide {slide_number}")
                        return self._get_fallback_analysis(slide_number, title, content)
                    
                    return analysis
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error after cleaning: {e}")
                    # Try one more time with a simpler prompt
                    return self._generate_simple_analysis(slide_number, title, content)
            else:
                logger.error("No JSON found in AI response")
                return self._generate_simple_analysis(slide_number, title, content)
                
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return self._get_fallback_analysis(slide_number, title, content)
    
    def _generate_simple_analysis(self, slide_number: int, title: str, content: str) -> Dict[str, Any]:
        """Generate simpler analysis with a more reliable prompt"""
        try:
            simple_prompt = f"""Analyze this slide and provide a detailed explanation (3-4 paragraphs), key concepts (5-7 items), and 3 exam questions.

Slide: {title}
Content: {content[:1500]}

Return ONLY this JSON structure with no extra text:
{{"detailed_explanation": "3-4 paragraph explanation", "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"], "exam_questions": [{{"question": "Q1", "type": "short-answer", "difficulty": "medium", "answer_hint": "hint"}}], "difficulty_level": "intermediate", "estimated_study_time": "5 minutes"}}"""

            response = self.call_ai(simple_prompt, max_tokens=1500, temperature=0.3)
            
            # Extract and clean JSON
            import re
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response)
            if json_match:
                json_str = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', json_match.group())
                analysis = json.loads(json_str)
                
                # Fill in missing fields with defaults
                return {
                    "slide_number": slide_number,
                    "title": title,
                    "detailed_explanation": analysis.get("detailed_explanation", f"This slide covers {title}."),
                    "key_concepts": analysis.get("key_concepts", []),
                    "definitions": {},
                    "exam_questions": analysis.get("exam_questions", []),
                    "related_concepts": [],
                    "practical_applications": [],
                    "common_misconceptions": [],
                    "study_tips": ["Review the slide content carefully"],
                    "cross_references": [],
                    "difficulty_level": analysis.get("difficulty_level", "intermediate"),
                    "estimated_study_time": analysis.get("estimated_study_time", "5 minutes")
                }
        except:
            pass
        
        return self._get_fallback_analysis(slide_number, title, content)
    
    def _get_fallback_analysis(self, slide_number: int, title: str, content: str) -> Dict[str, Any]:
        """Provide fallback analysis if AI fails"""
        # Extract some basic info from content
        words = content.split()[:100]
        content_preview = ' '.join(words)
        
        return {
            "slide_number": slide_number,
            "title": title,
            "detailed_explanation": f"This slide presents information about {title}.\n\nThe content covers important concepts that are relevant to understanding the broader topic. Students should review this material carefully and consider how it relates to other slides in the presentation.\n\nKey information from this slide should be noted and reviewed as part of your study plan. Consider creating flashcards or summary notes to help retain the information presented here.",
            "key_concepts": ["Review slide content for key concepts", f"Main topic: {title}"],
            "definitions": {},
            "exam_questions": [
                {
                    "question": f"What are the main points covered in {title}?",
                    "type": "short-answer",
                    "difficulty": "medium",
                    "answer_hint": "Review the slide content carefully"
                },
                {
                    "question": f"Explain the significance of the concepts presented in {title}.",
                    "type": "essay",
                    "difficulty": "medium",
                    "answer_hint": "Consider how this relates to the overall presentation"
                }
            ],
            "related_concepts": [],
            "practical_applications": ["Apply the concepts from this slide to real-world scenarios"],
            "common_misconceptions": [],
            "study_tips": ["Read the slide content multiple times", "Take notes on key points", "Create a summary in your own words"],
            "cross_references": [],
            "difficulty_level": "intermediate",
            "estimated_study_time": "5 minutes"
        }
    
    def analyze_presentation(
        self, 
        slide_id: int, 
        file_path: Path, 
        file_type: str,
        force_reanalyze: bool = False
    ) -> Dict[str, Any]:
        """
        Analyze entire presentation and return comprehensive analysis
        Checks for existing analysis first unless force_reanalyze is True
        """
        from models import SlideAnalysis
        
        # Check if analysis already exists
        if not force_reanalyze:
            existing_analysis = self.db.query(SlideAnalysis).filter(
                SlideAnalysis.slide_id == slide_id
            ).first()
            
            if existing_analysis and existing_analysis.analysis_data:
                logger.info(f"Returning cached analysis for slide_id {slide_id}")
                return json.loads(existing_analysis.analysis_data)
        
        # Extract slide content
        logger.info(f"Extracting content from {file_path}")
        slides_data = self.extract_slide_content(file_path, file_type)
        
        # Generate comprehensive analysis for each slide
        analyzed_slides = []
        total_slides = len(slides_data)
        
        logger.info(f"Analyzing {total_slides} slides comprehensively...")
        
        for idx, slide_data in enumerate(slides_data):
            logger.info(f"Analyzing slide {idx + 1}/{total_slides}")
            analysis = self.generate_comprehensive_analysis(
                slide_data, 
                slides_data, 
                idx
            )
            analyzed_slides.append(analysis)
        
        # Create presentation summary
        presentation_summary = self._generate_presentation_summary(analyzed_slides)
        
        result = {
            "slide_id": slide_id,
            "total_slides": total_slides,
            "analyzed_at": datetime.utcnow().isoformat(),
            "presentation_summary": presentation_summary,
            "slides": analyzed_slides
        }
        
        # Store analysis in database
        self._store_analysis(slide_id, result)
        
        return result
    
    def _generate_presentation_summary(self, analyzed_slides: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate overall presentation summary"""
        
        all_concepts = []
        all_questions = []
        difficulty_counts = {"introductory": 0, "intermediate": 0, "advanced": 0}
        total_study_time = 0
        
        for slide in analyzed_slides:
            all_concepts.extend(slide.get("key_concepts", []))
            all_questions.extend(slide.get("exam_questions", []))
            difficulty = slide.get("difficulty_level", "intermediate")
            difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1
            
            # Parse study time
            time_str = slide.get("estimated_study_time", "5 minutes")
            try:
                minutes = int(''.join(filter(str.isdigit, time_str)))
                total_study_time += minutes
            except:
                total_study_time += 5
        
        return {
            "total_concepts": len(set(all_concepts)),
            "total_exam_questions": len(all_questions),
            "difficulty_distribution": difficulty_counts,
            "estimated_total_study_time": f"{total_study_time} minutes",
            "recommended_review_sessions": max(1, total_study_time // 30)
        }
    
    def _store_analysis(self, slide_id: int, analysis_data: Dict[str, Any]):
        """Store analysis in database"""
        from models import SlideAnalysis
        
        try:
            # Check if analysis exists
            existing = self.db.query(SlideAnalysis).filter(
                SlideAnalysis.slide_id == slide_id
            ).first()
            
            if existing:
                existing.analysis_data = json.dumps(analysis_data)
                existing.analyzed_at = datetime.utcnow()
            else:
                new_analysis = SlideAnalysis(
                    slide_id=slide_id,
                    analysis_data=json.dumps(analysis_data),
                    analyzed_at=datetime.utcnow()
                )
                self.db.add(new_analysis)
            
            self.db.commit()
            logger.info(f"Stored analysis for slide_id {slide_id}")
            
        except Exception as e:
            logger.error(f"Error storing analysis: {e}")
            self.db.rollback()


def get_or_create_analysis(
    slide_id: int,
    file_path: Path,
    file_type: str,
    db: Session,
    force_reanalyze: bool = False
) -> Dict[str, Any]:
    """
    Main function to get or create comprehensive slide analysis
    """
    analyzer = ComprehensiveSlideAnalyzer(db)
    return analyzer.analyze_presentation(slide_id, file_path, file_type, force_reanalyze)
