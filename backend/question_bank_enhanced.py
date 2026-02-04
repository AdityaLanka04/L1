import os
import sys
import json
import logging
import tempfile
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
import re

from fastapi import HTTPException, Depends, UploadFile, File, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
import PyPDF2
import io

from groq import Groq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _update_weak_areas(db: Session, user_id: int, results: List[Dict], models):
    """
    Update weak areas based on quiz results.
    Called after each quiz submission to track wrong answers and identify weak topics.
    """
    try:
        for result in results:
            topic = result.get("topic", "General")
            is_correct = result.get("is_correct", False)
            question_id = result.get("question_id")
            
            # Get or create weak area record for this topic
            weak_area = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == user_id,
                models.UserWeakArea.topic == topic
            ).first()
            
            if not weak_area:
                weak_area = models.UserWeakArea(
                    user_id=user_id,
                    topic=topic,
                    total_questions=0,
                    correct_count=0,
                    incorrect_count=0,
                    first_identified=datetime.now(timezone.utc)
                )
                db.add(weak_area)
                db.flush()
            
            # Update counts
            weak_area.total_questions += 1
            
            if is_correct:
                weak_area.correct_count += 1
                weak_area.consecutive_wrong = 0
            else:
                weak_area.incorrect_count += 1
                weak_area.consecutive_wrong += 1
                weak_area.last_wrong_streak = max(weak_area.last_wrong_streak, weak_area.consecutive_wrong)
                
                # Log the wrong answer
                wrong_log = models.WrongAnswerLog(
                    user_id=user_id,
                    question_id=question_id,
                    question_set_id=result.get("question_set_id"),
                    question_text=result.get("question_text", ""),
                    topic=topic,
                    difficulty=result.get("difficulty"),
                    correct_answer=result.get("correct_answer", ""),
                    user_answer=result.get("user_answer", ""),
                    answered_at=datetime.now(timezone.utc)
                )
                db.add(wrong_log)
            
            # Calculate accuracy
            if weak_area.total_questions > 0:
                weak_area.accuracy = (weak_area.correct_count / weak_area.total_questions) * 100
            
            # Calculate weakness score (0-100, higher = weaker)
            # Factors: accuracy (inverted), consecutive wrong, total wrong
            accuracy_factor = 100 - weak_area.accuracy
            streak_factor = min(weak_area.consecutive_wrong * 10, 30)  # Max 30 points from streak
            volume_factor = min(weak_area.incorrect_count * 2, 20)  # Max 20 points from volume
            
            weak_area.weakness_score = min(100, accuracy_factor * 0.5 + streak_factor + volume_factor)
            
            # Calculate priority (1-10)
            if weak_area.accuracy < 30:
                weak_area.priority = 10
            elif weak_area.accuracy < 50:
                weak_area.priority = 8
            elif weak_area.accuracy < 70:
                weak_area.priority = 6
            elif weak_area.accuracy < 85:
                weak_area.priority = 4
            else:
                weak_area.priority = 2
            
            # Boost priority for consecutive wrong answers
            if weak_area.consecutive_wrong >= 3:
                weak_area.priority = min(10, weak_area.priority + 2)
            
            # Update status
            if weak_area.accuracy >= 90 and weak_area.total_questions >= 5:
                weak_area.status = "mastered"
            elif weak_area.accuracy >= 70:
                weak_area.status = "improving"
            else:
                weak_area.status = "needs_practice"
            
            weak_area.last_updated = datetime.now(timezone.utc)
        
        db.commit()
        logger.info(f"Updated weak areas for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error updating weak areas: {e}")
        # Don't raise - this is a non-critical operation


def generate_question_set_pdf(question_set, questions, include_answers: bool = False, user_name: str = "Student"):
    """
    Generate a professionally formatted PDF for a question set with LaTeX support.
    Uses ReportLab for PDF generation with custom styling.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import io
    
    buffer = io.BytesIO()
    
    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )
    
    # Custom styles
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=6,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a1a2e'),
        fontName='Helvetica-Bold'
    )
    
    # Subtitle style
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#666666'),
        fontName='Helvetica'
    )
    
    # Section header style
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#2d3436'),
        fontName='Helvetica-Bold',
        borderPadding=(0, 0, 5, 0)
    )
    
    # Question number style
    question_num_style = ParagraphStyle(
        'QuestionNumber',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#d4a574'),
        spaceBefore=15,
        spaceAfter=5
    )
    
    # Question text style
    question_style = ParagraphStyle(
        'QuestionText',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=8,
        leading=14,
        alignment=TA_JUSTIFY
    )
    
    # Option style
    option_style = ParagraphStyle(
        'OptionText',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica',
        textColor=colors.HexColor('#333333'),
        leftIndent=20,
        spaceAfter=4,
        leading=13
    )
    
    # Difficulty badge style
    difficulty_style = ParagraphStyle(
        'DifficultyBadge',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica-Bold',
        textColor=colors.white,
        alignment=TA_CENTER
    )
    
    # Answer style
    answer_style = ParagraphStyle(
        'AnswerText',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Oblique',
        textColor=colors.HexColor('#27ae60'),
        leftIndent=20,
        spaceBefore=5,
        spaceAfter=10
    )
    
    # Explanation style
    explanation_style = ParagraphStyle(
        'ExplanationText',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Helvetica',
        textColor=colors.HexColor('#555555'),
        leftIndent=20,
        spaceAfter=15,
        leading=12,
        borderPadding=(5, 5, 5, 5)
    )
    
    # Build content
    story = []
    
    # Header section
    story.append(Paragraph("QUESTION SET", title_style))
    story.append(Paragraph(question_set.title, subtitle_style))
    
    # Metadata line
    created_date = question_set.created_at.strftime("%B %d, %Y") if question_set.created_at else "N/A"
    meta_text = f"Generated for: {user_name} | Total Questions: {len(questions)} | Created: {created_date}"
    story.append(Paragraph(meta_text, subtitle_style))
    
    # Horizontal line
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#d4a574'), spaceBefore=10, spaceAfter=20))
    
    # Instructions
    instructions_style = ParagraphStyle(
        'Instructions',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica',
        textColor=colors.HexColor('#555555'),
        spaceAfter=20,
        leading=14,
        borderPadding=(10, 10, 10, 10),
        backColor=colors.HexColor('#f8f9fa')
    )
    
    instructions = """
    <b>Instructions:</b><br/>
    • Read each question carefully before answering.<br/>
    • For multiple choice questions, select the best answer.<br/>
    • For short answer questions, provide a concise response.<br/>
    • Show your work for mathematical problems where applicable.
    """
    story.append(Paragraph(instructions, instructions_style))
    story.append(Spacer(1, 20))
    
    # Group questions by difficulty
    difficulty_order = {'easy': 1, 'medium': 2, 'hard': 3}
    difficulty_colors = {
        'easy': colors.HexColor('#27ae60'),
        'medium': colors.HexColor('#f39c12'),
        'hard': colors.HexColor('#e74c3c')
    }
    
    # Questions section
    for idx, question in enumerate(questions, 1):
        # Question header with number and difficulty
        difficulty = question.difficulty or 'medium'
        diff_color = difficulty_colors.get(difficulty.lower(), colors.HexColor('#666666'))
        
        # Question number and difficulty badge
        q_header = f"<b>Question {idx}</b>"
        if question.topic:
            q_header += f" <font color='#888888'>| {question.topic}</font>"
        
        story.append(Paragraph(q_header, question_num_style))
        
        # Difficulty indicator
        diff_text = f"<font color='{diff_color.hexval()}'>[{difficulty.upper()}]</font>"
        diff_para = ParagraphStyle(
            'DiffIndicator',
            parent=styles['Normal'],
            fontSize=9,
            fontName='Helvetica-Bold',
            spaceAfter=8
        )
        story.append(Paragraph(diff_text, diff_para))
        
        # Process question text for LaTeX
        q_text = process_latex_for_pdf(question.question_text)
        story.append(Paragraph(q_text, question_style))
        
        # Options for multiple choice
        if question.question_type == 'multiple_choice' and question.options:
            try:
                options = json.loads(question.options) if isinstance(question.options, str) else question.options
                if isinstance(options, list):
                    for i, opt in enumerate(options):
                        opt_letter = chr(65 + i)  # A, B, C, D...
                        opt_text = process_latex_for_pdf(opt)
                        story.append(Paragraph(f"<b>{opt_letter}.</b> {opt_text}", option_style))
            except:
                pass
        
        # True/False options
        elif question.question_type == 'true_false':
            story.append(Paragraph("<b>A.</b> True", option_style))
            story.append(Paragraph("<b>B.</b> False", option_style))
        
        # Short answer space
        elif question.question_type == 'short_answer':
            answer_box_style = ParagraphStyle(
                'AnswerBox',
                parent=styles['Normal'],
                fontSize=10,
                fontName='Helvetica',
                textColor=colors.HexColor('#888888'),
                leftIndent=20,
                spaceAfter=10,
                borderPadding=(10, 10, 10, 10)
            )
            story.append(Paragraph("<i>Answer:</i> _" + "_" * 60, answer_box_style))
        
        # Add answer if requested
        if include_answers and question.correct_answer:
            answer_text = process_latex_for_pdf(question.correct_answer)
            story.append(Paragraph(f"<b>Answer:</b> {answer_text}", answer_style))
            
            if question.explanation:
                exp_text = process_latex_for_pdf(question.explanation)
                story.append(Paragraph(f"<b>Explanation:</b> {exp_text}", explanation_style))
        
        story.append(Spacer(1, 10))
        
        # Add page break every 5 questions for readability
        if idx % 5 == 0 and idx < len(questions):
            story.append(PageBreak())
    
    # Answer key section (if answers included)
    if include_answers:
        story.append(PageBreak())
        story.append(Paragraph("ANSWER KEY", title_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#d4a574'), spaceBefore=10, spaceAfter=20))
        
        # Create answer key table
        answer_data = [["Q#", "Answer", "Difficulty", "Topic"]]
        for idx, q in enumerate(questions, 1):
            answer_data.append([
                str(idx),
                process_latex_for_pdf(q.correct_answer or "N/A")[:50],
                (q.difficulty or "medium").capitalize(),
                (q.topic or "General")[:30]
            ])
        
        answer_table = Table(answer_data, colWidths=[0.5*inch, 3*inch, 1*inch, 2*inch])
        answer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d4a574')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#333333')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
        ]))
        story.append(answer_table)
    
    # Footer
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica',
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#dddddd'), spaceBefore=20, spaceAfter=10))
    story.append(Paragraph(f"Generated by Cerbyl Learning Platform | {datetime.now().strftime('%Y-%m-%d %H:%M')}", footer_style))
    
    # Build PDF
    doc.build(story)
    
    buffer.seek(0)
    return buffer.getvalue()


def process_latex_for_pdf(text: str) -> str:
    """
    Process LaTeX expressions in text for PDF rendering.
    Converts common LaTeX patterns to readable text format.
    """
    if not text:
        return ""
    
    # Handle inline math $...$
    text = re.sub(r'\$([^$]+)\$', r'<i>\1</i>', text)
    
    # Handle display math $$...$$
    text = re.sub(r'\$\$([^$]+)\$\$', r'<br/><i>\1</i><br/>', text)
    
    # Handle common LaTeX commands
    latex_replacements = {
        r'\\frac\{([^}]+)\}\{([^}]+)\}': r'(\1)/(\2)',
        r'\\sqrt\{([^}]+)\}': r'√(\1)',
        r'\\sum': '∑',
        r'\\prod': '∏',
        r'\\int': '∫',
        r'\\infty': '∞',
        r'\\alpha': 'α',
        r'\\beta': 'β',
        r'\\gamma': 'γ',
        r'\\delta': 'δ',
        r'\\epsilon': 'ε',
        r'\\theta': 'θ',
        r'\\lambda': 'λ',
        r'\\mu': 'μ',
        r'\\pi': 'π',
        r'\\sigma': 'σ',
        r'\\omega': 'ω',
        r'\\times': '×',
        r'\\div': '÷',
        r'\\pm': '±',
        r'\\leq': '≤',
        r'\\geq': '≥',
        r'\\neq': '≠',
        r'\\approx': '≈',
        r'\\rightarrow': '→',
        r'\\leftarrow': '←',
        r'\\Rightarrow': '⇒',
        r'\\Leftarrow': '⇐',
        r'\\cdot': '·',
        r'\\ldots': '...',
        r'\\degree': '°',
        r'\^2': '²',
        r'\^3': '³',
        r'\^n': 'ⁿ',
        r'\\text\{([^}]+)\}': r'\1',
        r'\\mathbf\{([^}]+)\}': r'<b>\1</b>',
        r'\\textbf\{([^}]+)\}': r'<b>\1</b>',
        r'\\textit\{([^}]+)\}': r'<i>\1</i>',
        r'\\underline\{([^}]+)\}': r'<u>\1</u>',
    }
    
    for pattern, replacement in latex_replacements.items():
        text = re.sub(pattern, replacement, text)
    
    # Handle superscripts x^{n}
    text = re.sub(r'\^\{([^}]+)\}', r'<super>\1</super>', text)
    text = re.sub(r'\^(\d)', r'<super>\1</super>', text)
    
    # Handle subscripts x_{n}
    text = re.sub(r'_\{([^}]+)\}', r'<sub>\1</sub>', text)
    text = re.sub(r'_(\d)', r'<sub>\1</sub>', text)
    
    # Clean up remaining backslashes
    text = text.replace('\\\\', '<br/>')
    text = re.sub(r'\\([a-zA-Z]+)', r'\1', text)
    
    # Escape special XML characters that aren't already part of tags
    # Be careful not to escape our HTML tags
    text = text.replace('&', '&amp;')
    
    return text


class PDFUploadRequest(BaseModel):
    user_id: str


class QuestionGenerationRequest(BaseModel):
    user_id: str
    source_type: str
    source_id: Optional[int] = None
    content: Optional[str] = None
    question_count: int = 10
    difficulty_mix: Dict[str, int] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: List[str] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None
    title: Optional[str] = None


class CustomQuestionGenRequest(BaseModel):
    user_id: str
    content: str
    title: str
    question_count: int = 10
    difficulty_mix: Dict[str, int] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: List[str] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None


class AnswerSubmission(BaseModel):
    user_id: str
    question_set_id: int
    answers: Dict[str, str]
    time_taken_seconds: Optional[int] = None


class SimilarQuestionRequest(BaseModel):
    user_id: str
    question_id: int
    difficulty: Optional[str] = None


class MultiPDFGenerationRequest(BaseModel):
    """Request model for generating questions from multiple PDF sources"""
    user_id: str
    source_ids: List[int]  # List of document IDs
    question_count: int = 10
    difficulty_mix: Dict[str, int] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: List[str] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None
    title: Optional[str] = None
    custom_prompt: Optional[str] = None  # Custom instructions for question generation
    reference_document_id: Optional[int] = None  # ID of document to use as reference (e.g., sample questions)
    content_document_ids: Optional[List[int]] = None  # IDs of documents to generate questions FROM (e.g., textbook)


class DifficultyClassifierAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def classify_difficulty(self, question: str, context: str = "") -> Dict[str, Any]:
        prompt = f"""Analyze this question and classify its difficulty level as 'easy', 'medium', or 'hard'.

Question: {question}

Context: {context}

Consider these factors:
1. Cognitive complexity (recall vs analysis vs synthesis)
2. Number of concepts required
3. Depth of understanding needed
4. Problem-solving steps required

Respond in JSON format:
{{
    "difficulty": "easy|medium|hard",
    "reasoning": "brief explanation",
    "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
    "estimated_time_seconds": 60
}}

Return ONLY valid JSON, no markdown formatting."""
        
        try:
            content = self.unified_ai.generate(prompt, max_tokens=500, temperature=0.3)
            logger.info(f"Raw classify_difficulty response: {content[:200]}")
            
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()
            
            # Try to extract JSON object - non-greedy match
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON: {json_str[:100]}")
                result = json.loads(json_str)
            else:
                # Fallback: try to parse entire content as JSON
                logger.info("No JSON match found, attempting to parse entire content")
                result = json.loads(content)
            
            logger.info(f"Difficulty classified: {result.get('difficulty', 'unknown')}")
            return result
        except json.JSONDecodeError as je:
            logger.error(f"JSON decode error in classify_difficulty: {je}, content was: {content[:500]}")
            return {
                "difficulty": "medium",
                "reasoning": "Classification failed, defaulting to medium",
                "cognitive_level": "understand",
                "estimated_time_seconds": 120
            }
        except Exception as e:
            logger.error(f"Difficulty classification error: {e}", exc_info=True)
            return {
                "difficulty": "medium",
                "reasoning": "Classification failed, defaulting to medium",
                "cognitive_level": "understand",
                "estimated_time_seconds": 120
            }


class PDFProcessorAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        try:
            text = ""
            pdf_bytes = io.BytesIO(pdf_content)
            
            # Method 1: Try PyMuPDF (fitz) first - handles more PDF types
            try:
                import fitz  # PyMuPDF
                logger.info("Attempting PyMuPDF (fitz) extraction...")
                
                doc = fitz.open(stream=pdf_content, filetype="pdf")
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    page_text = page.get_text()
                    if page_text:
                        text += page_text + "\n\n"
                doc.close()
                
                if text.strip():
                    logger.info(f"PyMuPDF extracted {len(text)} characters from PDF")
                    return text.strip()
                else:
                    logger.warning("PyMuPDF returned empty text, trying other methods...")
                    
            except ImportError:
                logger.warning("PyMuPDF not available, trying PyPDF2...")
            except Exception as fitz_error:
                logger.warning(f"PyMuPDF extraction failed: {fitz_error}")
            
            # Method 2: Try PyPDF2
            try:
                logger.info("Attempting PyPDF2 extraction...")
                pdf_bytes.seek(0)  # Reset stream position
                pdf_reader = PyPDF2.PdfReader(pdf_bytes)
                
                for page_num in range(len(pdf_reader.pages)):
                    try:
                        page = pdf_reader.pages[page_num]
                        extracted = page.extract_text()
                        if extracted:
                            text += extracted + "\n\n"
                    except Exception as page_error:
                        logger.warning(f"Failed to extract page {page_num}: {page_error}")
                        continue
                
                if text.strip():
                    logger.info(f"PyPDF2 extracted {len(text)} characters from PDF")
                    return text.strip()
                    
            except Exception as pypdf_error:
                logger.warning(f"PyPDF2 extraction failed: {pypdf_error}")
            
            # Method 3: Try pdfplumber as fallback
            try:
                import pdfplumber
                logger.info("Attempting pdfplumber extraction...")
                
                with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n\n"
                
                if text.strip():
                    logger.info(f"pdfplumber extracted {len(text)} characters")
                    return text.strip()
                    
            except ImportError:
                logger.warning("pdfplumber not available")
            except Exception as plumber_error:
                logger.warning(f"pdfplumber extraction failed: {plumber_error}")
            
            # If all methods fail but we have some text, return it
            if text.strip():
                return text.strip()
            
            # All methods failed
            raise ValueError(
                "Unable to extract text from PDF. This may be a scanned/image PDF. "
                "Try using a PDF with selectable text, or use OCR to convert the PDF first."
            )
                
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            logger.error(f"PDF extraction error: {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=400, 
                detail=f"Unable to extract text from PDF. The file may be scanned, encrypted, or corrupted. Error: {error_msg[:150]}"
            )
    
    async def analyze_document(self, text: str) -> Dict[str, Any]:
        prompt = f"""Analyze this document and extract key information:

{text[:8000]}

Provide a JSON response with:
{{
    "main_topics": ["topic1", "topic2", ...],
    "key_concepts": ["concept1", "concept2", ...],
    "document_type": "lecture_notes|assignment|exam|review|textbook|questions",
    "difficulty_level": "introductory|intermediate|advanced",
    "subject_area": "detected subject"
}}

Return ONLY valid JSON, no markdown formatting."""
        
        try:
            content = self.unified_ai.generate(prompt, max_tokens=800, temperature=0.3)
            logger.info(f"Raw analyze_document response: {content[:200]}")
            
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()
            
            # Try to extract JSON object - non-greedy match
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON: {json_str[:100]}")
                result = json.loads(json_str)
            else:
                # Fallback: try to parse entire content as JSON
                logger.info("No JSON match found, attempting to parse entire content")
                result = json.loads(content)
            
            logger.info(f"Document analysis successful: {result.get('document_type', 'unknown')}")
            return result
        except json.JSONDecodeError as je:
            logger.error(f"JSON decode error in document analysis: {je}, content was: {content[:500]}")
            return {
                "main_topics": ["General"],
                "key_concepts": [],
                "document_type": "unknown",
                "difficulty_level": "intermediate",
                "subject_area": "Unknown"
            }
        except Exception as e:
            logger.error(f"Document analysis error: {e}, returning default", exc_info=True)
            return {
                "main_topics": ["General"],
                "key_concepts": [],
                "document_type": "unknown",
                "difficulty_level": "intermediate",
                "subject_area": "Unknown"
            }


# ==================== AI ENHANCEMENT FEATURES ====================

class PromptEnhancerAgent:
    """Enhances user prompts to generate better questions"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def enhance_prompt(self, user_prompt: str, content_summary: str = "") -> Dict[str, Any]:
        """Take a simple user prompt and enhance it for better question generation"""
        prompt = f"""You are an expert at crafting prompts for educational question generation.

USER'S ORIGINAL PROMPT:
"{user_prompt}"

CONTENT SUMMARY (if available):
{content_summary[:2000] if content_summary else "Not provided"}

Enhance this prompt to generate better educational questions. Consider:
1. Clarity and specificity
2. Learning objectives
3. Question variety
4. Difficulty progression
5. Real-world application

Return JSON:
{{
    "enhanced_prompt": "The improved, detailed prompt",
    "suggested_question_types": ["multiple_choice", "short_answer", etc],
    "suggested_difficulty_distribution": {{"easy": 30, "medium": 50, "hard": 20}},
    "focus_areas": ["list of specific topics to focus on"],
    "learning_objectives": ["what students should learn"],
    "prompt_improvements": ["list of improvements made"]
}}

Return ONLY valid JSON."""

        try:
            content = self.unified_ai.generate(prompt, max_tokens=1000, temperature=0.7)
            
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content)
                content = re.sub(r'\n?```$', '', content).strip()
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(content)
        except Exception as e:
            logger.error(f"Prompt enhancement error: {e}")
            return {
                "enhanced_prompt": user_prompt,
                "suggested_question_types": ["multiple_choice", "short_answer"],
                "suggested_difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                "focus_areas": [],
                "learning_objectives": [],
                "prompt_improvements": []
            }


class TopicExtractorAgent:
    """Extracts and organizes topics from content"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def extract_topics(self, content: str) -> Dict[str, Any]:
        """Extract hierarchical topics from content"""
        prompt = f"""Analyze this educational content and extract a hierarchical topic structure.

CONTENT:
{content[:8000]}

Extract:
1. Main subject/course
2. Chapters/Units
3. Topics within each chapter
4. Key concepts within each topic
5. Estimated question potential per topic

Return JSON:
{{
    "subject": "Main subject name",
    "chapters": [
        {{
            "name": "Chapter/Unit name",
            "topics": [
                {{
                    "name": "Topic name",
                    "key_concepts": ["concept1", "concept2"],
                    "question_potential": "high|medium|low",
                    "suggested_question_count": 5
                }}
            ]
        }}
    ],
    "total_topics": 10,
    "recommended_total_questions": 50
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=2000, temperature=0.5)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except Exception as e:
            logger.error(f"Topic extraction error: {e}")
            return {"subject": "Unknown", "chapters": [], "total_topics": 0}


class QuestionQualityAgent:
    """Scores and improves question quality"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def score_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """Score a question on multiple quality dimensions"""
        prompt = f"""Evaluate this question's quality on multiple dimensions.

QUESTION:
{json.dumps(question, indent=2)}

Score each dimension from 1-10 and provide specific feedback:

1. CLARITY: Is the question clear and unambiguous?
2. DIFFICULTY_ACCURACY: Does the stated difficulty match actual difficulty?
3. ANSWER_QUALITY: Is the correct answer accurate? Are distractors plausible?
4. EXPLANATION_QUALITY: Is the explanation helpful and educational?
5. RELEVANCE: Is this question educationally valuable?
6. GRAMMAR: Is the grammar and spelling correct?

Return JSON:
{{
    "overall_score": 8.5,
    "scores": {{
        "clarity": {{"score": 9, "feedback": "Clear and specific"}},
        "difficulty_accuracy": {{"score": 8, "feedback": "Matches stated difficulty"}},
        "answer_quality": {{"score": 7, "feedback": "Good but distractor B is too obvious"}},
        "explanation_quality": {{"score": 8, "feedback": "Helpful explanation"}},
        "relevance": {{"score": 9, "feedback": "Tests important concept"}},
        "grammar": {{"score": 10, "feedback": "No errors"}}
    }},
    "improvements": ["List of specific improvements"],
    "improved_question": {{...improved version if score < 7...}}
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=1500, temperature=0.3)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except Exception as e:
            logger.error(f"Question quality scoring error: {e}")
            return {"overall_score": 7, "scores": {}, "improvements": []}
    
    async def batch_score_questions(self, questions: List[Dict]) -> List[Dict]:
        """Score multiple questions and return with scores"""
        scored = []
        for q in questions:
            score_result = await self.score_question(q)
            q['quality_score'] = score_result.get('overall_score', 7)
            q['quality_feedback'] = score_result.get('improvements', [])
            scored.append(q)
        return scored


class BloomTaxonomyAgent:
    """Tags questions with Bloom's Taxonomy levels"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    BLOOM_LEVELS = {
        "remember": {"verbs": ["define", "list", "recall", "identify", "name"], "description": "Recall facts and basic concepts"},
        "understand": {"verbs": ["explain", "describe", "summarize", "interpret"], "description": "Explain ideas or concepts"},
        "apply": {"verbs": ["use", "solve", "demonstrate", "calculate"], "description": "Use information in new situations"},
        "analyze": {"verbs": ["compare", "contrast", "examine", "differentiate"], "description": "Draw connections among ideas"},
        "evaluate": {"verbs": ["judge", "critique", "justify", "assess"], "description": "Justify a decision or course of action"},
        "create": {"verbs": ["design", "construct", "develop", "formulate"], "description": "Produce new or original work"}
    }
    
    async def tag_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """Tag a question with Bloom's taxonomy level"""
        prompt = f"""Classify this question according to Bloom's Taxonomy.

QUESTION:
{question.get('question_text', '')}

BLOOM'S TAXONOMY LEVELS (lowest to highest):
1. REMEMBER - Recall facts (define, list, recall, identify)
2. UNDERSTAND - Explain ideas (explain, describe, summarize)
3. APPLY - Use in new situations (use, solve, demonstrate)
4. ANALYZE - Draw connections (compare, contrast, examine)
5. EVALUATE - Justify decisions (judge, critique, assess)
6. CREATE - Produce original work (design, construct, develop)

Return JSON:
{{
    "bloom_level": "remember|understand|apply|analyze|evaluate|create",
    "confidence": 0.95,
    "reasoning": "Why this level was chosen",
    "cognitive_verbs_detected": ["list of verbs found"],
    "suggested_level_up_version": "A harder version of this question at the next Bloom level"
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=800, temperature=0.3)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                question['bloom_level'] = result.get('bloom_level', 'understand')
                question['bloom_confidence'] = result.get('confidence', 0.5)
                return result
            return {"bloom_level": "understand", "confidence": 0.5}
        except Exception as e:
            logger.error(f"Bloom taxonomy tagging error: {e}")
            return {"bloom_level": "understand", "confidence": 0.5}
    
    async def batch_tag_questions(self, questions: List[Dict]) -> List[Dict]:
        """Tag multiple questions with Bloom's levels"""
        for q in questions:
            await self.tag_question(q)
        return questions


class DuplicateDetectorAgent:
    """Detects semantically similar questions"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def find_duplicates(self, new_question: str, existing_questions: List[str]) -> Dict[str, Any]:
        """Check if a question is too similar to existing ones"""
        if not existing_questions:
            return {"is_duplicate": False, "similar_questions": []}
        
        # Limit to most recent 50 questions for efficiency
        recent_questions = existing_questions[-50:]
        
        prompt = f"""Check if this NEW question is too similar to any EXISTING questions.

NEW QUESTION:
"{new_question}"

EXISTING QUESTIONS:
{json.dumps(recent_questions, indent=2)}

A question is a "duplicate" if:
1. It tests the exact same concept in the same way
2. Only minor wording changes
3. Same answer would be correct

Return JSON:
{{
    "is_duplicate": true/false,
    "similarity_score": 0.0-1.0,
    "most_similar_question": "The most similar existing question or null",
    "similarity_reason": "Why they are similar",
    "suggestion": "How to make the new question more unique"
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=600, temperature=0.2)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except Exception as e:
            logger.error(f"Duplicate detection error: {e}")
            return {"is_duplicate": False, "similarity_score": 0}


class AdaptiveGeneratorAgent:
    """Generates questions based on user's weak areas"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def analyze_weaknesses(self, performance_data: List[Dict]) -> Dict[str, Any]:
        """Analyze user performance to identify weak areas"""
        prompt = f"""Analyze this student's question performance data to identify weak areas.

PERFORMANCE DATA:
{json.dumps(performance_data[:30], indent=2)}

Identify:
1. Topics with lowest accuracy
2. Question types they struggle with
3. Difficulty levels they fail most
4. Patterns in wrong answers
5. Recommended focus areas

Return JSON:
{{
    "weak_topics": [{{"topic": "name", "accuracy": 0.4, "attempts": 10}}],
    "weak_question_types": ["short_answer"],
    "struggling_difficulty": "hard",
    "error_patterns": ["Confuses X with Y", "Calculation errors"],
    "recommendations": {{
        "focus_topics": ["topic1", "topic2"],
        "suggested_difficulty": "medium",
        "suggested_question_types": ["multiple_choice"],
        "study_tips": ["Review chapter 3", "Practice calculations"]
    }},
    "confidence_score": 0.85
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=1000, temperature=0.4)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except Exception as e:
            logger.error(f"Weakness analysis error: {e}")
            return {"weak_topics": [], "recommendations": {}}
    
    async def generate_adaptive_prompt(self, weakness_analysis: Dict, content: str) -> str:
        """Generate a custom prompt targeting weak areas"""
        weak_topics = weakness_analysis.get('weak_topics', [])
        recommendations = weakness_analysis.get('recommendations', {})
        
        focus_topics = [t['topic'] for t in weak_topics[:3]]
        
        prompt = f"""Generate questions that specifically target these weak areas:

WEAK TOPICS: {', '.join(focus_topics)}
RECOMMENDED DIFFICULTY: {recommendations.get('suggested_difficulty', 'medium')}
ERROR PATTERNS TO ADDRESS: {weakness_analysis.get('error_patterns', [])}

Focus on:
1. Questions that test understanding of commonly confused concepts
2. Step-by-step problems to build confidence
3. Varied question formats to reinforce learning
4. Clear explanations that address common misconceptions

Generate questions from this content that specifically help with these weak areas."""
        
        return prompt


class ExplanationEnhancerAgent:
    """Enhances question explanations with detailed steps"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def enhance_explanation(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a detailed, step-by-step explanation"""
        prompt = f"""Create a comprehensive, educational explanation for this question.

QUESTION: {question.get('question_text', '')}
CORRECT ANSWER: {question.get('correct_answer', '')}
CURRENT EXPLANATION: {question.get('explanation', 'None provided')}

Create an enhanced explanation that includes:
1. WHY the correct answer is correct (conceptual understanding)
2. Step-by-step reasoning process
3. Common mistakes and why they're wrong
4. Related concepts to review
5. A memory tip or mnemonic if applicable

Return JSON:
{{
    "enhanced_explanation": "Detailed explanation with steps",
    "key_concept": "The main concept being tested",
    "step_by_step": ["Step 1: ...", "Step 2: ..."],
    "common_mistakes": [{{"mistake": "...", "why_wrong": "..."}}],
    "related_concepts": ["concept1", "concept2"],
    "memory_tip": "A helpful way to remember this",
    "difficulty_justification": "Why this question is easy/medium/hard"
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=1200, temperature=0.6)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                question['enhanced_explanation'] = result.get('enhanced_explanation', question.get('explanation', ''))
                question['step_by_step'] = result.get('step_by_step', [])
                question['common_mistakes'] = result.get('common_mistakes', [])
                question['memory_tip'] = result.get('memory_tip', '')
                return result
            return {}
        except Exception as e:
            logger.error(f"Explanation enhancement error: {e}")
            return {}


class QuestionPreviewAgent:
    """Handles question preview and editing before saving"""
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def regenerate_single_question(
        self, 
        original_question: Dict, 
        feedback: str,
        content: str
    ) -> Dict[str, Any]:
        """Regenerate a single question based on user feedback"""
        prompt = f"""Regenerate this question based on user feedback.

ORIGINAL QUESTION:
{json.dumps(original_question, indent=2)}

USER FEEDBACK:
"{feedback}"

AVAILABLE CONTENT:
{content[:3000]}

Generate an improved question that addresses the feedback while:
1. Maintaining the same topic/concept
2. Keeping similar difficulty unless feedback says otherwise
3. Improving based on the specific feedback

Return JSON with the same structure as the original question:
{{
    "question_text": "...",
    "question_type": "...",
    "difficulty": "...",
    "topic": "...",
    "correct_answer": "...",
    "options": [...],
    "explanation": "...",
    "points": 1
}}

Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(prompt, max_tokens=800, temperature=0.7)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except Exception as e:
            logger.error(f"Question regeneration error: {e}")
            return original_question


# ==================== END AI ENHANCEMENT FEATURES ====================


class QuestionGeneratorAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def generate_questions(
        self, 
        content: str, 
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str] = None,
        custom_prompt: str = None,
        reference_content: str = None
    ) -> List[Dict[str, Any]]:
        """
        Generate questions from content. For large content, uses chunking strategy
        to process entire PDFs and generate questions from all parts.
        """
        
        types_str = ", ".join(question_types)
        topics_str = ", ".join(topics) if topics else "all topics in the content"
        
        # Truncate reference content if needed (style guide doesn't need to be huge)
        max_ref_chars = 5000
        if reference_content and len(reference_content) > max_ref_chars:
            reference_content = reference_content[:max_ref_chars]
        
        # Check if content is large enough to need chunking
        chunk_size = 12000  # Characters per chunk
        
        if len(content) > chunk_size:
            # Use chunking strategy for large content
            logger.info(f"Large content detected ({len(content)} chars). Using chunking strategy.")
            return await self._generate_questions_chunked(
                content, question_count, question_types, difficulty_distribution,
                topics, custom_prompt, reference_content, chunk_size
            )
        
        # For smaller content, use single-pass generation
        return await self._generate_questions_single(
            content, question_count, question_types, difficulty_distribution,
            topics, custom_prompt, reference_content
        )
    
    async def _generate_questions_chunked(
        self,
        content: str,
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str],
        custom_prompt: str,
        reference_content: str,
        chunk_size: int
    ) -> List[Dict[str, Any]]:
        """Generate questions from large content by processing in chunks"""
        
        # Split content into chunks, preferring document boundaries
        chunks = self._split_content_into_chunks(content, chunk_size)
        logger.info(f"Split content into {len(chunks)} chunks")
        
        # Calculate questions per chunk (distribute evenly, with remainder to last chunk)
        base_questions_per_chunk = question_count // len(chunks)
        remainder = question_count % len(chunks)
        
        all_questions = []
        seen_questions = set()  # Track to avoid duplicates
        
        for i, chunk in enumerate(chunks):
            # Last chunk gets the remainder
            chunk_question_count = base_questions_per_chunk + (remainder if i == len(chunks) - 1 else 0)
            
            if chunk_question_count == 0:
                continue
            
            logger.info(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars, {chunk_question_count} questions)")
            
            # Generate questions for this chunk
            chunk_questions = await self._generate_questions_single(
                chunk, chunk_question_count, question_types, difficulty_distribution,
                topics, custom_prompt, reference_content
            )
            
            # Add unique questions
            for q in chunk_questions:
                q_text = q.get('question_text', '').strip().lower()
                if q_text and q_text not in seen_questions:
                    seen_questions.add(q_text)
                    all_questions.append(q)
        
        logger.info(f"Generated {len(all_questions)} total questions from {len(chunks)} chunks")
        
        # If we didn't get enough questions, try to generate more from a summary
        if len(all_questions) < question_count * 0.7:  # Less than 70% of requested
            logger.warning(f"Only got {len(all_questions)} questions, attempting supplementary generation")
            additional_needed = question_count - len(all_questions)
            
            # Create a summary of all content for additional questions
            summary_content = self._create_content_summary(content, 8000)
            additional_questions = await self._generate_questions_single(
                summary_content, additional_needed, question_types, difficulty_distribution,
                topics, custom_prompt, reference_content
            )
            
            for q in additional_questions:
                q_text = q.get('question_text', '').strip().lower()
                if q_text and q_text not in seen_questions:
                    seen_questions.add(q_text)
                    all_questions.append(q)
        
        return all_questions[:question_count]  # Return exactly the requested count
    
    def _split_content_into_chunks(self, content: str, chunk_size: int) -> List[str]:
        """Split content into chunks, preferring document boundaries"""
        
        # First, try to split by document markers
        doc_marker = "=== "
        if doc_marker in content:
            sections = content.split(doc_marker)
            chunks = []
            current_chunk = ""
            
            for section in sections:
                if not section.strip():
                    continue
                    
                section_with_marker = doc_marker + section
                
                # If adding this section would exceed chunk size
                if len(current_chunk) + len(section_with_marker) > chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk)
                    
                    # If single section is larger than chunk size, split it
                    if len(section_with_marker) > chunk_size:
                        section_chunks = self._split_text_by_paragraphs(section_with_marker, chunk_size)
                        chunks.extend(section_chunks)
                        current_chunk = ""
                    else:
                        current_chunk = section_with_marker
                else:
                    current_chunk += section_with_marker
            
            if current_chunk:
                chunks.append(current_chunk)
            
            return chunks if chunks else [content]
        
        # No document markers, split by paragraphs
        return self._split_text_by_paragraphs(content, chunk_size)
    
    def _split_text_by_paragraphs(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks at paragraph boundaries"""
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = para
            else:
                current_chunk = current_chunk + "\n\n" + para if current_chunk else para
        
        if current_chunk:
            chunks.append(current_chunk)
        
        # If still no chunks or chunks are too large, force split
        if not chunks:
            chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
        
        return chunks
    
    def _create_content_summary(self, content: str, max_chars: int) -> str:
        """Create a summary by taking key parts from each document section"""
        doc_marker = "=== "
        if doc_marker in content:
            sections = content.split(doc_marker)
            chars_per_section = max_chars // max(len(sections), 1)
            
            summary_parts = []
            for section in sections:
                if section.strip():
                    # Take beginning and end of each section
                    if len(section) > chars_per_section:
                        half = chars_per_section // 2
                        summary_parts.append(doc_marker + section[:half] + "\n...\n" + section[-half:])
                    else:
                        summary_parts.append(doc_marker + section)
            
            return "\n".join(summary_parts)
        
        # No sections, just truncate
        return content[:max_chars]
    
    async def _generate_questions_single(
        self,
        content: str,
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str],
        custom_prompt: str,
        reference_content: str
    ) -> List[Dict[str, Any]]:
        """
        AGENTIC QUESTION GENERATION PIPELINE
        
        This uses a multi-step agentic approach:
        1. ANALYZE: Extract key concepts, facts, and relationships from content
        2. PLAN: Create a question blueprint with specific targets per difficulty
        3. GENERATE: Create questions following the blueprint
        4. VALIDATE: Check quality and relevance of each question
        5. REFINE: Fix any issues found during validation
        """
        
        types_str = ", ".join(question_types)
        topics_str = ", ".join(topics) if topics else "all major topics from the content"
        
        # Calculate exact counts per difficulty
        total_diff = sum(difficulty_distribution.values())
        if total_diff > 0 and question_count >= 3:
            # Only use distribution if we have enough questions
            easy_count = max(1, round(question_count * difficulty_distribution.get('easy', 30) / total_diff))
            medium_count = max(1, round(question_count * difficulty_distribution.get('medium', 50) / total_diff))
            hard_count = max(0, question_count - easy_count - medium_count)
        elif question_count == 2:
            # For 2 questions, do 1 easy and 1 medium
            easy_count = 1
            medium_count = 1
            hard_count = 0
        elif question_count == 1:
            # For 1 question, pick based on highest distribution weight
            if difficulty_distribution.get('hard', 20) >= difficulty_distribution.get('medium', 50):
                easy_count, medium_count, hard_count = 0, 0, 1
            elif difficulty_distribution.get('easy', 30) >= difficulty_distribution.get('medium', 50):
                easy_count, medium_count, hard_count = 1, 0, 0
            else:
                easy_count, medium_count, hard_count = 0, 1, 0
        else:
            easy_count = question_count // 3
            medium_count = question_count // 3
            hard_count = question_count - easy_count - medium_count
        
        logger.info(f"Agentic generation: {easy_count} easy, {medium_count} medium, {hard_count} hard")
        
        # STEP 1: ANALYZE - Extract testable content
        analysis = await self._agent_analyze_content(content)
        
        # STEP 2: PLAN - Create question blueprint
        blueprint = await self._agent_create_blueprint(
            analysis, easy_count, medium_count, hard_count, 
            question_types, topics, custom_prompt, reference_content
        )
        
        # STEP 3: GENERATE - Create questions from blueprint
        questions = await self._agent_generate_from_blueprint(
            content, blueprint, question_types, custom_prompt, reference_content
        )
        
        # STEP 4: VALIDATE & REFINE
        questions = await self._agent_validate_questions(questions, content, question_count)
        
        return questions
    
    async def _agent_analyze_content(self, content: str) -> Dict[str, Any]:
        """AGENT STEP 1: Analyze content to extract testable elements"""
        
        analysis_prompt = f"""You are a content analysis expert. Analyze this educational content and extract ALL testable elements.

CONTENT:
{content[:8000]}

TASK: Extract and categorize every piece of information that could be tested. Be thorough and specific.

Return a JSON object with this structure:
{{
    "main_topic": "The primary subject of this content",
    "subtopics": ["List of specific subtopics covered"],
    "key_facts": [
        {{"fact": "A specific, testable fact", "source_quote": "Brief quote from content", "complexity": "simple|moderate|complex"}}
    ],
    "definitions": [
        {{"term": "Term name", "definition": "What it means", "source_quote": "Quote"}}
    ],
    "relationships": [
        {{"concept1": "First concept", "relationship": "how they relate", "concept2": "Second concept", "complexity": "simple|moderate|complex"}}
    ],
    "processes": [
        {{"name": "Process name", "steps": ["step1", "step2"], "complexity": "simple|moderate|complex"}}
    ],
    "comparisons": [
        {{"items": ["item1", "item2"], "differences": ["diff1"], "similarities": ["sim1"]}}
    ],
    "cause_effects": [
        {{"cause": "What causes it", "effect": "What happens", "complexity": "simple|moderate|complex"}}
    ],
    "numerical_data": [
        {{"value": "The number/statistic", "context": "What it represents", "source_quote": "Quote"}}
    ]
}}

Extract AT LEAST 15-20 testable elements total. Be specific - use exact names, dates, numbers from the content.
Return ONLY valid JSON."""

        try:
            response = self.unified_ai.generate(analysis_prompt, max_tokens=3000, temperature=0.3)
            
            # Parse the analysis
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            try:
                analysis = json.loads(response)
                logger.info(f"Content analysis extracted: {len(analysis.get('key_facts', []))} facts, {len(analysis.get('definitions', []))} definitions")
                return analysis
            except:
                # Return basic structure if parsing fails
                return {
                    "main_topic": "Content Analysis",
                    "subtopics": [],
                    "key_facts": [],
                    "definitions": [],
                    "relationships": [],
                    "processes": [],
                    "comparisons": [],
                    "cause_effects": [],
                    "numerical_data": []
                }
        except Exception as e:
            logger.error(f"Content analysis failed: {e}")
            return {"main_topic": "Unknown", "subtopics": [], "key_facts": []}
    
    async def _agent_create_blueprint(
        self, analysis: Dict, easy_count: int, medium_count: int, hard_count: int,
        question_types: List[str], topics: List[str], custom_prompt: str, reference_content: str
    ) -> List[Dict]:
        """AGENT STEP 2: Create a detailed blueprint for each question"""
        
        # Build question targets based on analysis
        blueprint = []
        
        # EASY questions: Direct facts, definitions, simple recall
        easy_sources = []
        for fact in analysis.get('key_facts', []):
            if fact.get('complexity') == 'simple':
                easy_sources.append({"type": "fact", "data": fact})
        for defn in analysis.get('definitions', []):
            easy_sources.append({"type": "definition", "data": defn})
        for num in analysis.get('numerical_data', []):
            easy_sources.append({"type": "numerical", "data": num})
        
        # MEDIUM questions: Relationships, cause-effect, moderate complexity
        medium_sources = []
        for fact in analysis.get('key_facts', []):
            if fact.get('complexity') == 'moderate':
                medium_sources.append({"type": "fact", "data": fact})
        for rel in analysis.get('relationships', []):
            if rel.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "relationship", "data": rel})
        for ce in analysis.get('cause_effects', []):
            if ce.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "cause_effect", "data": ce})
        for proc in analysis.get('processes', []):
            if proc.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "process", "data": proc})
        
        # HARD questions: Complex relationships, comparisons, analysis
        hard_sources = []
        for fact in analysis.get('key_facts', []):
            if fact.get('complexity') == 'complex':
                hard_sources.append({"type": "fact", "data": fact})
        for rel in analysis.get('relationships', []):
            if rel.get('complexity') == 'complex':
                hard_sources.append({"type": "relationship", "data": rel})
        for comp in analysis.get('comparisons', []):
            hard_sources.append({"type": "comparison", "data": comp})
        for ce in analysis.get('cause_effects', []):
            if ce.get('complexity') == 'complex':
                hard_sources.append({"type": "cause_effect", "data": ce})
        for proc in analysis.get('processes', []):
            if proc.get('complexity') == 'complex':
                hard_sources.append({"type": "process", "data": proc})
        
        # Create blueprint entries
        import random
        
        # Assign easy questions
        for i in range(easy_count):
            if easy_sources:
                source = easy_sources[i % len(easy_sources)]
            else:
                source = {"type": "general", "data": {"fact": "basic concept"}}
            
            blueprint.append({
                "difficulty": "easy",
                "question_type": question_types[i % len(question_types)] if question_types else "multiple_choice",
                "source": source,
                "bloom_level": "remember",
                "instruction": "Ask for direct recall of a specific fact or definition"
            })
        
        # Assign medium questions
        for i in range(medium_count):
            if medium_sources:
                source = medium_sources[i % len(medium_sources)]
            else:
                source = {"type": "general", "data": {"relationship": "concept connection"}}
            
            blueprint.append({
                "difficulty": "medium",
                "question_type": question_types[i % len(question_types)] if question_types else "multiple_choice",
                "source": source,
                "bloom_level": "understand/apply",
                "instruction": "Ask about relationships, causes, effects, or application of concepts"
            })
        
        # Assign hard questions
        for i in range(hard_count):
            if hard_sources:
                source = hard_sources[i % len(hard_sources)]
            else:
                source = {"type": "general", "data": {"analysis": "complex reasoning"}}
            
            blueprint.append({
                "difficulty": "hard",
                "question_type": question_types[i % len(question_types)] if question_types else "multiple_choice",
                "source": source,
                "bloom_level": "analyze/evaluate",
                "instruction": "Ask for analysis, comparison, evaluation, or synthesis of multiple concepts"
            })
        
        logger.info(f"Blueprint created: {len(blueprint)} question targets")
        return blueprint
    
    async def _agent_generate_from_blueprint(
        self, content: str, blueprint: List[Dict], 
        question_types: List[str], custom_prompt: str, reference_content: str
    ) -> List[Dict]:
        """AGENT STEP 3: Generate questions following the blueprint"""
        
        # Build detailed generation prompt with blueprint
        blueprint_text = ""
        for i, bp in enumerate(blueprint, 1):
            source_info = bp.get('source', {})
            source_data = source_info.get('data', {})
            
            if source_info.get('type') == 'fact':
                target = f"Fact: {source_data.get('fact', 'N/A')}"
            elif source_info.get('type') == 'definition':
                target = f"Definition: {source_data.get('term', 'N/A')} - {source_data.get('definition', 'N/A')}"
            elif source_info.get('type') == 'relationship':
                target = f"Relationship: {source_data.get('concept1', '')} {source_data.get('relationship', '')} {source_data.get('concept2', '')}"
            elif source_info.get('type') == 'cause_effect':
                target = f"Cause-Effect: {source_data.get('cause', '')} → {source_data.get('effect', '')}"
            elif source_info.get('type') == 'process':
                target = f"Process: {source_data.get('name', '')} with steps"
            elif source_info.get('type') == 'comparison':
                target = f"Comparison: {', '.join(source_data.get('items', []))}"
            elif source_info.get('type') == 'numerical':
                target = f"Data: {source_data.get('value', '')} - {source_data.get('context', '')}"
            else:
                target = "General concept from content"
            
            blueprint_text += f"""
Question {i}:
- Difficulty: {bp['difficulty'].upper()}
- Type: {bp['question_type']}
- Bloom's Level: {bp['bloom_level']}
- Target: {target}
- Instruction: {bp['instruction']}
"""
        
        # Custom instructions section
        custom_section = ""
        if custom_prompt:
            custom_section = f"\nUSER'S CUSTOM INSTRUCTIONS:\n{custom_prompt}\n"
        
        reference_section = ""
        if reference_content:
            reference_section = f"\nREFERENCE QUESTIONS (match this style):\n{reference_content[:2000]}\n"
        
        generation_prompt = f"""You are an expert exam question writer. Generate questions following the EXACT blueprint below.

SOURCE CONTENT (all questions MUST be answerable from this):
{content[:10000]}
{custom_section}{reference_section}
QUESTION BLUEPRINT (follow EXACTLY):
{blueprint_text}

DIFFICULTY CALIBRATION (CRITICAL - follow precisely):

EASY (Bloom's: Remember):
- Tests: Direct recall of facts, definitions, names, dates, simple concepts
- Question style: "What is...", "Which of the following...", "True or False:..."
- Answer: Explicitly stated in content, single concept
- Distractors: Obviously different from correct answer
- Example: "What year did X happen?" or "The definition of Y is..."

MEDIUM (Bloom's: Understand/Apply):
- Tests: Comprehension, explanation, application to familiar situations
- Question style: "Why does...", "How does X relate to Y...", "What would happen if..."
- Answer: Requires connecting 2 concepts or understanding relationships
- Distractors: Related concepts that could be confused
- Example: "Why is X important for Y?" or "Which best explains the relationship between..."

HARD (Bloom's: Analyze/Evaluate/Create):
- Tests: Analysis, comparison, evaluation, synthesis, novel application
- Question style: "Compare and contrast...", "Evaluate...", "What conclusion can be drawn..."
- Answer: Requires analyzing multiple concepts, making judgments, or applying to new scenarios
- Distractors: Partially correct or require deeper analysis to eliminate
- Example: "Which statement best analyzes the impact of..." or "Based on X and Y, what can be concluded about..."

QUESTION FORMAT REQUIREMENTS:

For multiple_choice:
- 4 distinct options with FULL ANSWER TEXT
- Correct answer must be unambiguous
- Distractors must be plausible but clearly wrong when you know the content
- Avoid "all of the above" or "none of the above"
- NEVER use just letter labels like "A", "B", "C", "D" - always include the full answer text

For true_false:
- Statement must be definitively true or false based on content
- Avoid double negatives or tricky wording
- Include the specific fact being tested

For short_answer:
- Answer should be 1-5 words
- Only ONE correct answer possible
- Question must be specific enough to have single answer

For fill_blank:
- Blank should test a key term or concept
- Context must make the answer clear
- Only ONE word/phrase fits correctly

OUTPUT FORMAT - Return a JSON array with EXACTLY {len(blueprint)} questions:
[
  {{
    "question_text": "Clear, specific question",
    "question_type": "multiple_choice",
    "difficulty": "easy",
    "topic": "Specific topic from content",
    "correct_answer": "The exact correct answer text",
    "options": ["The correct answer text", "A plausible but wrong answer", "Another plausible wrong answer", "A third plausible wrong answer"],
    "explanation": "Detailed explanation: This is correct because [quote/reference content]. The second option is wrong because... The third option is wrong because...",
    "points": 1,
    "bloom_level": "remember",
    "content_reference": "Quote or specific reference from source content"
  }}
]

CRITICAL RULES:
1. Each question MUST match its blueprint difficulty EXACTLY
2. Each question MUST be answerable from the source content
3. Each question MUST test a DIFFERENT concept
4. Explanations MUST reference the source content
5. OPTIONS MUST CONTAIN FULL ANSWER TEXT - NEVER use just "A", "B", "C", "D" as option values
5. Return ONLY valid JSON array, no other text"""

        try:
            response = self.unified_ai.generate(generation_prompt, max_tokens=6000, temperature=0.4)
            
            # Clean response
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            questions = self._parse_questions_json(response)
            
            if questions:
                logger.info(f"Generated {len(questions)} questions from blueprint")
                return questions
            else:
                logger.error("Failed to parse questions from blueprint generation")
                return []
                
        except Exception as e:
            logger.error(f"Blueprint generation failed: {e}")
            return []
    
    async def _agent_validate_questions(
        self, questions: List[Dict], content: str, target_count: int
    ) -> List[Dict]:
        """AGENT STEP 4: Validate and refine questions"""
        
        if not questions:
            return []
        
        validated = []
        
        for q in questions:
            # Basic validation
            if not q.get('question_text'):
                continue
            
            # Ensure required fields
            q.setdefault('question_type', 'multiple_choice')
            q.setdefault('difficulty', 'medium')
            q.setdefault('topic', 'General')
            q.setdefault('correct_answer', '')
            q.setdefault('options', [])
            q.setdefault('explanation', '')
            q.setdefault('points', 1)
            
            # Validate difficulty
            if q['difficulty'] not in ['easy', 'medium', 'hard']:
                q['difficulty'] = 'medium'
            
            # Ensure options is a list
            if not isinstance(q['options'], list):
                q['options'] = []
            
            # Fix options that are just letter labels (A, B, C, D)
            letter_only_options = {'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'}
            if q['options']:
                fixed_options = []
                has_letter_only = any(opt.strip() in letter_only_options for opt in q['options'])
                if has_letter_only:
                    # Options are just letters - this is a generation error
                    # Try to use correct_answer as the first option if it's meaningful
                    if q['correct_answer'] and q['correct_answer'].strip() not in letter_only_options:
                        fixed_options = [q['correct_answer']]
                        for i in range(3):
                            fixed_options.append(f"Alternative answer {i + 1}")
                        q['options'] = fixed_options
                        logger.warning(f"Fixed letter-only options for question: {q['question_text'][:50]}...")
            
            # For multiple choice, ensure correct answer is in options
            if q['question_type'] == 'multiple_choice':
                if q['options'] and q['correct_answer'] not in q['options']:
                    # Try to find correct answer in options (case-insensitive)
                    found = False
                    for i, opt in enumerate(q['options']):
                        if opt.lower().strip() == q['correct_answer'].lower().strip():
                            q['correct_answer'] = opt
                            found = True
                            break
                    if not found:
                        q['options'][0] = q['correct_answer']
                
                # Ensure 4 options
                while len(q['options']) < 4:
                    q['options'].append(f"Option {len(q['options']) + 1}")
            
            # For true/false, ensure proper options
            if q['question_type'] == 'true_false':
                q['options'] = ['True', 'False']
                if q['correct_answer'].lower() not in ['true', 'false']:
                    q['correct_answer'] = 'True'
                else:
                    q['correct_answer'] = q['correct_answer'].capitalize()
            
            validated.append(q)
        
        # Ensure we have the right count
        validated = validated[:target_count]
        
        logger.info(f"Validated {len(validated)} questions")
        return validated
    
    # Keep the old method signature for backward compatibility but use new pipeline
    async def _generate_questions_single_legacy(
        self,
        content: str,
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str],
        custom_prompt: str,
        reference_content: str
    ) -> List[Dict[str, Any]]:
        """Legacy single-prompt generation (fallback)"""
        
        types_str = ", ".join(question_types)
        topics_str = ", ".join(topics) if topics else "topics directly from the content"
        
        total_diff = sum(difficulty_distribution.values())
        if total_diff > 0 and question_count >= 3:
            easy_count = max(1, round(question_count * difficulty_distribution.get('easy', 30) / total_diff))
            medium_count = max(1, round(question_count * difficulty_distribution.get('medium', 50) / total_diff))
            hard_count = question_count - easy_count - medium_count
        elif question_count == 2:
            easy_count, medium_count, hard_count = 1, 1, 0
        elif question_count == 1:
            easy_count, medium_count, hard_count = 0, 1, 0
        else:
            easy_count = question_count // 3
            medium_count = question_count // 3
            hard_count = question_count - easy_count - medium_count

        prompt = f"""You are an expert educational assessment designer.

SOURCE CONTENT:
{content}

Generate exactly {question_count} questions: {easy_count} EASY, {medium_count} MEDIUM, {hard_count} HARD
Question types: {types_str}
Topics: {topics_str}

DIFFICULTY GUIDE:
- EASY: Direct recall, single fact, explicitly stated in content
- MEDIUM: Understanding, connecting 2 concepts, explaining why
- HARD: Analysis, comparison, evaluation, applying to new scenarios

Return JSON array:
[{{"question_text": "...", "question_type": "multiple_choice", "difficulty": "easy", "topic": "...", "correct_answer": "Full text of correct answer", "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"], "explanation": "...", "points": 1}}]

CRITICAL: Each option MUST contain the FULL ANSWER TEXT, not just letter labels like "A", "B", "C", "D". The correct_answer must exactly match one of the options.

Return ONLY valid JSON."""
        
        try:
            response_content = self.unified_ai.generate(prompt, max_tokens=4500, temperature=0.5)
            
            if response_content.startswith('```'):
                response_content = re.sub(r'^```(?:json)?\n?', '', response_content)
                response_content = re.sub(r'\n?```$', '', response_content).strip()
            
            # Try to extract and parse JSON
            questions = self._parse_questions_json(response_content)
            
            if questions:
                # Post-process to ensure quality
                questions = self._post_process_questions(questions, question_count, difficulty_distribution)
                logger.info(f"Generated {len(questions)} questions successfully")
                return questions
            else:
                logger.error("Failed to parse questions from AI response")
                return []
        except Exception as e:
            logger.error(f"Question generation error: {e}")
            return []
    
    def _parse_questions_json(self, content: str) -> List[Dict[str, Any]]:
        """Robust JSON parsing with multiple fallback strategies"""
        
        # Strategy 1: Direct parse
        try:
            return json.loads(content)
        except:
            pass
        
        # Strategy 2: Extract JSON array
        try:
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        # Strategy 3: Fix common JSON issues
        try:
            fixed = content
            # Remove trailing commas before ] or }
            fixed = re.sub(r',(\s*[\]\}])', r'\1', fixed)
            # Fix unescaped quotes in strings (common AI mistake)
            fixed = re.sub(r'(?<!\\)"(?=[^"]*"[^"]*":)', r'\\"', fixed)
            # Remove control characters
            fixed = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', fixed)
            
            json_match = re.search(r'\[.*\]', fixed, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        # Strategy 4: Parse individual question objects
        try:
            questions = []
            # Find all JSON objects that look like questions
            pattern = r'\{[^{}]*"question_text"[^{}]*\}'
            matches = re.findall(pattern, content, re.DOTALL)
            
            for match in matches:
                try:
                    # Clean up the match
                    cleaned = re.sub(r',(\s*\})', r'\1', match)
                    q = json.loads(cleaned)
                    if 'question_text' in q:
                        questions.append(q)
                except:
                    continue
            
            if questions:
                logger.info(f"Recovered {len(questions)} questions using fallback parsing")
                return questions
        except:
            pass
        
        # Strategy 5: More aggressive extraction
        try:
            questions = []
            # Split by question boundaries
            parts = re.split(r'\},\s*\{', content)
            
            for i, part in enumerate(parts):
                try:
                    # Add back braces
                    if not part.strip().startswith('{'):
                        part = '{' + part
                    if not part.strip().endswith('}'):
                        part = part + '}'
                    
                    # Clean
                    part = re.sub(r',(\s*\})', r'\1', part)
                    part = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', part)
                    
                    q = json.loads(part)
                    if 'question_text' in q:
                        questions.append(q)
                except:
                    continue
            
            if questions:
                logger.info(f"Recovered {len(questions)} questions using aggressive parsing")
                return questions
        except:
            pass
        
        logger.error(f"All JSON parsing strategies failed. Content preview: {content[:500]}")
        return []
    
    async def generate_similar_question(
        self, 
        original_question: Dict[str, Any],
        difficulty: str = None
    ) -> Dict[str, Any]:
        
        difficulty = difficulty or original_question.get("difficulty", "medium")
        
        prompt = f"""Generate a similar question based on this original question.

Original Question:
{json.dumps(original_question, indent=2)}

Requirements:
- Same topic and concept
- Same question type
- Difficulty level: {difficulty}
- Different specific details/numbers/examples
- Similar cognitive level
- Maintain high quality

Return a JSON object with the same structure as the original."""
        
        try:
            content = self.unified_ai.generate(prompt, max_tokens=800, temperature=0.8)
            
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content)
                content = re.sub(r'\n?```$', '', content).strip()
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                similar_question = json.loads(json_match.group())
            else:
                similar_question = json.loads(content)
            
            logger.info("Similar question generated successfully")
            return similar_question
        except Exception as e:
            logger.error(f"Similar question generation error: {e}")
            return original_question
    
    async def extract_questions_from_pdf(self, pdf_text: str) -> List[Dict[str, Any]]:
        prompt = f"""Extract and parse existing questions from this document.

Document Content:
{pdf_text[:10000]}

Parse any existing questions and return them in this format:
{{
    "question_text": "the question",
    "question_type": "multiple_choice|true_false|short_answer|fill_blank",
    "difficulty": "easy|medium|hard",
    "topic": "topic",
    "correct_answer": "Full text of the correct answer",
    "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"],
    "explanation": "explanation if available",
    "points": 1
}}

CRITICAL: Each option MUST contain the FULL ANSWER TEXT from the document, not just letter labels like "A", "B", "C", "D".

Return a JSON array of questions. If no questions found, return empty array []."""
        
        try:
            content = self.unified_ai.generate(prompt, max_tokens=4000, temperature=0.3)
            logger.info(f"Raw extract_questions response: {content[:200]}")
            
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()
            
            # Try to extract JSON array - looking for [ ... ]
            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON array: {json_str[:100]}")
                questions = json.loads(json_str)
            else:
                # Fallback: try to parse entire content as JSON
                logger.info("No JSON array found, attempting to parse entire content")
                questions = json.loads(content)
            
            if not isinstance(questions, list):
                logger.warning(f"Parsed content is not a list, got {type(questions)}, converting to empty list")
                questions = []
            
            logger.info(f"Extracted {len(questions)} questions from PDF")
            return questions
        except json.JSONDecodeError as je:
            logger.error(f"JSON decode error in extract_questions: {je}, content was: {content[:500]}")
            return []
        except Exception as e:
            logger.error(f"Question extraction error: {e}", exc_info=True)
            return []


class AdaptiveDifficultyAgent:
    def __init__(self):
        pass
    
    def analyze_performance(self, session_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not session_history:
            return {
                "recommended_difficulty": "medium",
                "reason": "No previous performance data",
                "suggested_distribution": {"easy": 3, "medium": 5, "hard": 2}
            }
        
        recent_scores = [s.get("score", 0) for s in session_history[:5]]
        avg_score = sum(recent_scores) / len(recent_scores) if recent_scores else 50
        
        difficulty_stats = {"easy": [], "medium": [], "hard": []}
        for session in session_history[:5]:
            results = session.get("results", [])
            for result in results:
                diff = result.get("difficulty", "medium")
                is_correct = result.get("is_correct", False)
                if diff in difficulty_stats:
                    difficulty_stats[diff].append(is_correct)
        
        accuracy_by_difficulty = {}
        for diff, results in difficulty_stats.items():
            if results:
                accuracy_by_difficulty[diff] = sum(results) / len(results)
            else:
                accuracy_by_difficulty[diff] = 0.5
        
        if avg_score >= 85:
            recommendation = "hard"
            distribution = {"easy": 1, "medium": 4, "hard": 5}
            reason = "Excellent performance! Ready for more challenging questions."
        elif avg_score >= 70:
            recommendation = "medium"
            distribution = {"easy": 2, "medium": 6, "hard": 2}
            reason = "Solid understanding. Maintain current difficulty with gradual progression."
        else:
            recommendation = "easy"
            distribution = {"easy": 5, "medium": 4, "hard": 1}
            reason = "Building foundation. Focus on easier questions to strengthen understanding."
        
        return {
            "recommended_difficulty": recommendation,
            "reason": reason,
            "suggested_distribution": distribution,
            "accuracy_by_difficulty": accuracy_by_difficulty,
            "recent_average": round(avg_score, 1)
        }


class MLPredictorAgent:
    def __init__(self):
        pass
    
    def recommend_next_topics(self, user_profile: Dict[str, Any], available_topics: List[str]) -> List[str]:
        weak_areas = user_profile.get("weak_areas", [])
        strong_areas = user_profile.get("strong_areas", [])
        recent_topics = user_profile.get("recent_topics", [])
        
        recommendations = []
        
        for topic in weak_areas:
            if topic in available_topics and topic not in recommendations:
                recommendations.append(topic)
        
        for topic in available_topics:
            if topic not in weak_areas and topic not in strong_areas and topic not in recent_topics:
                if len(recommendations) < 5:
                    recommendations.append(topic)
        
        return recommendations[:5]


class ChatSlideProcessorAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def extract_content_from_chat(self, chat_messages: List[Dict[str, str]]) -> str:
        combined_text = ""
        for msg in chat_messages:
            combined_text += f"User: {msg.get('user_message', '')}\n"
            combined_text += f"AI: {msg.get('ai_response', '')}\n\n"
        return combined_text
    
    async def extract_content_from_slides(self, slide_content: str) -> str:
        return slide_content


def register_question_bank_api(app, unified_ai, get_db_func):
    
    agents = {
        "pdf_processor": PDFProcessorAgent(unified_ai),
        "question_generator": QuestionGeneratorAgent(unified_ai),
        "difficulty_classifier": DifficultyClassifierAgent(unified_ai),
        "adaptive_difficulty": AdaptiveDifficultyAgent(),
        "ml_predictor": MLPredictorAgent(),
        "chat_slide_processor": ChatSlideProcessorAgent(unified_ai),
        # AI Enhancement Agents
        "prompt_enhancer": PromptEnhancerAgent(unified_ai),
        "topic_extractor": TopicExtractorAgent(unified_ai),
        "quality_scorer": QuestionQualityAgent(unified_ai),
        "bloom_tagger": BloomTaxonomyAgent(unified_ai),
        "duplicate_detector": DuplicateDetectorAgent(unified_ai),
        "adaptive_generator": AdaptiveGeneratorAgent(unified_ai),
        "explanation_enhancer": ExplanationEnhancerAgent(unified_ai),
        "question_preview": QuestionPreviewAgent(unified_ai)
    }
    
    @app.post("/api/qb/upload_pdf")
    async def upload_pdf(
        file: UploadFile = File(...),
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            logger.info(f"Starting PDF upload for user: {user_id}, file: {file.filename}")
            
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="File must be a PDF")
            
            # Debug: Check if user exists
            all_users = db.query(models.User).all()
            logger.info(f"Total users in DB: {len(all_users)}")
            for u in all_users:
                logger.info(f"  User: id={u.id}, username={u.username}, email={u.email}")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                logger.error(f"User not found: {user_id}")
                logger.error(f"Tried to find user with username OR email matching: '{user_id}'")
                raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
            
            logger.info(f"Reading PDF file: {file.filename}")
            pdf_content = await file.read()
            
            if not pdf_content:
                raise HTTPException(status_code=400, detail="PDF file is empty")
            
            logger.info(f"Extracting text from PDF...")
            text = await agents["pdf_processor"].extract_text_from_pdf(pdf_content)
            
            if not text or len(text.strip()) == 0:
                raise HTTPException(status_code=400, detail="No text could be extracted from PDF")
            
            logger.info(f"Analyzing document content...")
            analysis = await agents["pdf_processor"].analyze_document(text)
            
            logger.info(f"Creating document record in database...")
            document = models.UploadedDocument(
                user_id=user.id,
                filename=file.filename,
                document_type=analysis.get("document_type", "unknown"),
                content=text,
                document_metadata=json.dumps(analysis)
            )
            
            db.add(document)
            db.commit()
            db.refresh(document)
            
            logger.info(f"PDF uploaded successfully: document_id={document.id}")
            return {
                "status": "success",
                "document_id": document.id,
                "filename": file.filename,
                "analysis": analysis
            }
            
        except HTTPException as http_e:
            logger.error(f"HTTP Error uploading PDF: {http_e.detail}")
            try:
                db.rollback()
            except:
                pass
            raise http_e
        except Exception as e:
            logger.error(f"Unexpected error uploading PDF: {e}", exc_info=True)
            try:
                db.rollback()
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Error uploading PDF: {str(e)}")
    
    @app.get("/api/qb/get_uploaded_documents")
    async def get_uploaded_documents(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.user_id == user.id
            ).order_by(models.UploadedDocument.created_at.desc()).all()
            
            return {
                "documents": [
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "document_type": doc.document_type,
                        "created_at": doc.created_at.isoformat(),
                        "analysis": json.loads(doc.document_metadata) if doc.document_metadata else {}
                    }
                    for doc in documents
                ]
            }
            
        except Exception as e:
            logger.error(f"Error fetching documents: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.delete("/api/qb/delete_document/{doc_id}")
    async def delete_document(
        doc_id: int,
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        """Delete an uploaded PDF document"""
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            document = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.id == doc_id,
                models.UploadedDocument.user_id == user.id
            ).first()
            
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            
            db.delete(document)
            db.commit()
            
            logger.info(f"Document {doc_id} deleted successfully for user {user_id}")
            return {"status": "success", "message": "Document deleted successfully"}
            
        except HTTPException as http_e:
            raise http_e
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_from_pdf")
    async def generate_from_pdf(
        request: QuestionGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if request.source_id:
                document = db.query(models.UploadedDocument).filter(
                    models.UploadedDocument.id == request.source_id,
                    models.UploadedDocument.user_id == user.id
                ).first()
                
                if not document:
                    raise HTTPException(status_code=404, detail="Document not found")
                
                content = document.content
                metadata = json.loads(document.document_metadata) if document.document_metadata else {}
                title = request.title or f"Questions from {document.filename}"
                
                if metadata.get("document_type") == "questions":
                    existing_questions = await agents["question_generator"].extract_questions_from_pdf(content)
                    
                    if existing_questions:
                        similar_questions = []
                        for orig_q in existing_questions[:request.question_count]:
                            similar = await agents["question_generator"].generate_similar_question(
                                orig_q,
                                difficulty=None
                            )
                            similar_questions.append(similar)
                        questions = similar_questions
                    else:
                        questions = await agents["question_generator"].generate_questions(
                            content,
                            request.question_count,
                            request.question_types,
                            request.difficulty_mix,
                            request.topics
                        )
                else:
                    questions = await agents["question_generator"].generate_questions(
                        content,
                        request.question_count,
                        request.question_types,
                        request.difficulty_mix,
                        request.topics
                    )
                
                source_type = "pdf"
            elif request.content:
                content = request.content
                title = request.title or "Custom Question Set"
                questions = await agents["question_generator"].generate_questions(
                    content,
                    request.question_count,
                    request.question_types,
                    request.difficulty_mix,
                    request.topics
                )
                source_type = "custom"
            else:
                raise HTTPException(status_code=400, detail="Must provide either source_id or content")
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions")
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {source_type}",
                source_type=source_type,
                source_id=request.source_id,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
            
        except Exception as e:
            logger.error(f"Error generating questions from PDF: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_from_multiple_pdfs")
    async def generate_from_multiple_pdfs(
        request: MultiPDFGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        """Generate questions from multiple PDF documents"""
        try:
            import models
            
            logger.info(f"Generating questions from {len(request.source_ids)} PDFs for user {request.user_id}")
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if not request.source_ids or len(request.source_ids) == 0:
                raise HTTPException(status_code=400, detail="At least one PDF source is required")
            
            # Fetch all selected documents
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.id.in_(request.source_ids),
                models.UploadedDocument.user_id == user.id
            ).all()
            
            if len(documents) == 0:
                raise HTTPException(status_code=404, detail="No documents found")
            
            if len(documents) != len(request.source_ids):
                logger.warning(f"Some documents not found. Requested: {len(request.source_ids)}, Found: {len(documents)}")
            
            # Combine content from all PDFs
            combined_content_parts = []
            document_names = []
            
            for doc in documents:
                document_names.append(doc.filename)
                combined_content_parts.append(f"=== Document: {doc.filename} ===\n{doc.content}")
            
            combined_content = "\n\n".join(combined_content_parts)
            logger.info(f"Combined content from {len(documents)} documents: {len(combined_content)} chars")
            
            # Generate title from document names
            if request.title:
                title = request.title
            elif len(document_names) == 1:
                title = f"Questions from {document_names[0]}"
            elif len(document_names) <= 3:
                title = f"Questions from {', '.join(document_names)}"
            else:
                title = f"Questions from {len(document_names)} documents"
            
            # Handle reference document (sample questions) vs content documents
            reference_content = None
            main_content = combined_content
            
            # If user specified which documents are reference vs content
            if request.reference_document_id and request.content_document_ids:
                # Separate reference document from content documents
                reference_doc = next((d for d in documents if d.id == request.reference_document_id), None)
                content_docs = [d for d in documents if d.id in request.content_document_ids]
                
                if reference_doc:
                    reference_content = f"=== Reference: {reference_doc.filename} ===\n{reference_doc.content}"
                    logger.info(f"Using {reference_doc.filename} as reference/sample questions")
                
                if content_docs:
                    main_content = "\n\n".join([
                        f"=== Content: {d.filename} ===\n{d.content}" for d in content_docs
                    ])
                    logger.info(f"Using {len(content_docs)} documents as main content")
            
            # Log custom prompt if provided
            if request.custom_prompt:
                logger.info(f"Custom prompt provided: {request.custom_prompt[:100]}...")
            
            # Generate questions from combined content with custom prompt support
            questions = await agents["question_generator"].generate_questions(
                main_content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics,
                custom_prompt=request.custom_prompt,
                reference_content=reference_content
            )
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions from the provided documents")
            
            # Create description based on what was used
            description_parts = [f"Generated from {len(documents)} PDF documents"]
            if request.custom_prompt:
                description_parts.append("with custom instructions")
            if reference_content:
                description_parts.append("using reference style")
            description = f"{'. '.join(description_parts)}: {', '.join(document_names[:3])}{'...' if len(document_names) > 3 else ''}"
            
            # Create question set
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=description,
                source_type="multi_pdf",
                source_id=None,  # Multiple sources, so no single ID
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            # Add questions
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            logger.info(f"Successfully generated {len(questions)} questions from {len(documents)} PDFs")
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title,
                "source_documents": document_names
            }
            
        except HTTPException as http_e:
            raise http_e
        except Exception as e:
            logger.error(f"Error generating questions from multiple PDFs: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/smart_generate")
    async def smart_generate_questions(
        request: MultiPDFGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        """
        Smart question generation with custom prompts and reference documents.
        
        Use cases:
        1. "Generate questions like these sample questions from my textbook"
        2. "Create easy questions focusing on chapter 3 topics"
        3. "Make questions similar to last year's exam from this study material"
        
        Parameters:
        - source_ids: All document IDs to use
        - reference_document_id: Document to use as style/format reference (e.g., sample questions)
        - content_document_ids: Documents to generate questions FROM (e.g., textbook)
        - custom_prompt: Custom instructions (e.g., "focus on practical applications")
        """
        try:
            import models
            
            logger.info(f"Smart generation for user {request.user_id} with {len(request.source_ids)} sources")
            if request.custom_prompt:
                logger.info(f"Custom prompt: {request.custom_prompt[:100]}...")
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Fetch all documents
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.id.in_(request.source_ids),
                models.UploadedDocument.user_id == user.id
            ).all()
            
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")
            
            doc_map = {d.id: d for d in documents}
            document_names = [d.filename for d in documents]
            
            # Separate reference and content documents
            reference_content = None
            main_content_parts = []
            
            if request.reference_document_id and request.reference_document_id in doc_map:
                ref_doc = doc_map[request.reference_document_id]
                reference_content = f"=== REFERENCE DOCUMENT: {ref_doc.filename} ===\n{ref_doc.content}"
                logger.info(f"Reference document: {ref_doc.filename}")
            
            # Get content documents
            content_ids = request.content_document_ids or [
                d.id for d in documents if d.id != request.reference_document_id
            ]
            
            for doc_id in content_ids:
                if doc_id in doc_map:
                    doc = doc_map[doc_id]
                    main_content_parts.append(f"=== CONTENT: {doc.filename} ===\n{doc.content}")
            
            if not main_content_parts:
                # If no content docs specified, use all non-reference docs
                for doc in documents:
                    if doc.id != request.reference_document_id:
                        main_content_parts.append(f"=== CONTENT: {doc.filename} ===\n{doc.content}")
            
            main_content = "\n\n".join(main_content_parts)
            
            if not main_content.strip():
                raise HTTPException(status_code=400, detail="No content to generate questions from")
            
            logger.info(f"Main content: {len(main_content)} chars from {len(main_content_parts)} docs")
            
            # Generate title
            title = request.title or f"Smart Questions from {len(documents)} documents"
            
            # Generate questions with all the context
            questions = await agents["question_generator"].generate_questions(
                main_content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics,
                custom_prompt=request.custom_prompt,
                reference_content=reference_content
            )
            
            if not questions:
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to generate questions. The AI response could not be parsed. Please try again with a simpler prompt or fewer documents."
                )
            
            # Build description
            desc_parts = []
            if request.custom_prompt:
                desc_parts.append(f"Custom: {request.custom_prompt[:50]}...")
            if reference_content:
                desc_parts.append("Style matched to reference")
            desc_parts.append(f"Sources: {', '.join(document_names[:3])}")
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=" | ".join(desc_parts),
                source_type="smart_multi_pdf",
                source_id=None,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            logger.info(f"Smart generation complete: {len(questions)} questions")
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title,
                "source_documents": document_names,
                "used_reference": reference_content is not None,
                "used_custom_prompt": request.custom_prompt is not None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Smart generation error: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_from_chat_slides")
    async def generate_from_chat_slides(
        request: QuestionGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            content_parts = []
            title_parts = []
            
            if request.source_type == "chat":
                chat = db.query(models.ChatSession).filter(
                    models.ChatSession.id == request.source_id,
                    models.ChatSession.user_id == user.id
                ).first()
                
                if not chat:
                    raise HTTPException(status_code=404, detail="Chat session not found")
                
                messages = db.query(models.ChatMessage).filter(
                    models.ChatMessage.chat_session_id == chat.id
                ).order_by(models.ChatMessage.timestamp.asc()).all()
                
                chat_content = await agents["chat_slide_processor"].extract_content_from_chat([
                    {"user_message": m.user_message, "ai_response": m.ai_response}
                    for m in messages
                ])
                content_parts.append(chat_content)
                title_parts.append(chat.title)
                
            elif request.source_type == "slide":
                slide = db.query(models.UploadedSlide).filter(
                    models.UploadedSlide.id == request.source_id,
                    models.UploadedSlide.user_id == user.id
                ).first()
                
                if not slide:
                    raise HTTPException(status_code=404, detail="Slide not found")
                
                content_parts.append(slide.content)
                title_parts.append(slide.title)
            
            combined_content = "\n\n".join(content_parts)
            title = request.title or f"Questions from {', '.join(title_parts)}"
            
            questions = await agents["question_generator"].generate_questions(
                combined_content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics
            )
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions")
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {request.source_type}",
                source_type=request.source_type,
                source_id=request.source_id,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/qb/get_question_sets")
    async def get_question_sets(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_sets = db.query(models.QuestionSet).filter(
                models.QuestionSet.user_id == user.id
            ).order_by(models.QuestionSet.created_at.desc()).all()
            
            return {
                "question_sets": [
                    {
                        "id": qs.id,
                        "title": qs.title,
                        "description": qs.description,
                        "source_type": qs.source_type,
                        "total_questions": qs.total_questions,
                        "best_score": qs.best_score,
                        "attempts": qs.attempts,
                        "created_at": qs.created_at.isoformat(),
                        "updated_at": qs.updated_at.isoformat()
                    }
                    for qs in question_sets
                ]
            }
            
        except Exception as e:
            logger.error(f"Error fetching question sets: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/qb/get_question_set/{set_id}")
    async def get_question_set_detail(
        set_id: int,
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            logger.info(f"📚 get_question_set_detail called: set_id={set_id}, user_id={user_id}")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            logger.info(f"📚 Found user: {user.id}")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == set_id,
                models.QuestionSet.user_id == user.id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            logger.info(f"📚 Found question set: {question_set.id}, title={question_set.title}")
            
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == set_id
            ).order_by(models.Question.order_index).all()
            
            logger.info(f"📚 Found {len(questions)} questions for set {set_id}")
            
            # Also check with raw SQL to debug
            from sqlalchemy import text
            raw_count = db.execute(text("SELECT COUNT(*) FROM questions WHERE question_set_id = :set_id"), {"set_id": set_id}).scalar()
            logger.info(f"📚 Raw SQL count: {raw_count} questions for set {set_id}")
            
            result = {
                "id": question_set.id,
                "title": question_set.title,
                "description": question_set.description,
                "source_type": question_set.source_type,
                "total_questions": question_set.total_questions,
                "best_score": question_set.best_score,
                "attempts": question_set.attempts,
                "created_at": question_set.created_at.isoformat(),
                "questions": [
                    {
                        "id": q.id,
                        "question_text": q.question_text,
                        "question_type": q.question_type,
                        "difficulty": q.difficulty,
                        "topic": q.topic,
                        "correct_answer": q.correct_answer,
                        "options": json.loads(q.options) if q.options else [],
                        "explanation": q.explanation,
                        "points": q.points
                    }
                    for q in questions
                ]
            }
            
            logger.info(f"📚 Returning question set {set_id} with {len(questions)} questions")
            if questions:
                logger.info(f"📚 First question options raw: {questions[0].options}")
                
            return result
            
        except Exception as e:
            logger.error(f"Error fetching question set: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.delete("/api/qb/delete_question_set/{set_id}")
    async def delete_question_set(
        set_id: int,
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == set_id,
                models.QuestionSet.user_id == user.id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            db.delete(question_set)
            db.commit()
            
            return {"status": "success", "message": "Question set deleted"}
            
        except Exception as e:
            logger.error(f"Error deleting question set: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/submit_answers")
    async def submit_answers(
        request: AnswerSubmission,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == request.question_set_id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == request.question_set_id
            ).all()
            
            results = []
            correct_count = 0
            total_points = 0
            earned_points = 0
            
            for question in questions:
                user_answer = request.answers.get(str(question.id), "")
                correct_answer = str(question.correct_answer).strip().lower()
                user_answer_normalized = str(user_answer).strip().lower()
                
                # Improved answer validation with fuzzy matching
                if question.question_type in ['short_answer', 'fill_blank']:
                    # Remove extra spaces, punctuation, and check similarity
                    import re
                    correct_clean = re.sub(r'[^\w\s]', '', correct_answer).strip()
                    user_clean = re.sub(r'[^\w\s]', '', user_answer_normalized).strip()
                    
                    # Check exact match first
                    is_correct = user_clean == correct_clean
                    
                    # If not exact, check if answer contains the key terms
                    if not is_correct and correct_clean:
                        correct_words = set(correct_clean.split())
                        user_words = set(user_clean.split())
                        # Accept if user answer contains at least 80% of correct words
                        if correct_words and len(correct_words & user_words) / len(correct_words) >= 0.8:
                            is_correct = True
                else:
                    # For MCQ and True/False, use exact matching
                    is_correct = user_answer_normalized == correct_answer
                
                if is_correct:
                    correct_count += 1
                    earned_points += question.points
                
                total_points += question.points
                
                results.append({
                    "question_id": question.id,
                    "question_set_id": request.question_set_id,
                    "question_text": question.question_text,
                    "user_answer": user_answer,
                    "correct_answer": question.correct_answer,
                    "is_correct": is_correct,
                    "difficulty": question.difficulty,
                    "topic": question.topic,
                    "explanation": question.explanation,
                    "points": question.points
                })
            
            score = int((earned_points / total_points) * 100) if total_points > 0 else 0
            
            # ADAPTIVE LEARNING: Process each answer with adaptive engine
            from adaptive_learning_integration import get_adaptive_integration
            adaptive_integration = get_adaptive_integration()
            
            for i, question in enumerate(questions):
                user_answer = request.answers.get(str(question.id))
                if user_answer:
                    is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()
                    response_time = request.time_taken_seconds / len(questions) if request.time_taken_seconds else 30
                    
                    # Process with adaptive engine
                    adaptive_integration.process_question_bank_answer(
                        db, user.id, question.id, is_correct, response_time
                    )
            
            session_record = models.QuestionSession(
                user_id=user.id,
                question_set_id=request.question_set_id,
                score=score,
                total_questions=len(questions),
                correct_count=correct_count,
                results=json.dumps(results),
                time_taken_seconds=request.time_taken_seconds,
                completed_at=datetime.now(timezone.utc)
            )
            
            db.add(session_record)
            
            if score > question_set.best_score:
                question_set.best_score = score
            question_set.attempts += 1
            question_set.updated_at = datetime.now(timezone.utc)
            
            db.commit()
            db.refresh(session_record)
            
            user_history = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).limit(10).all()
            
            history_data = []
            for session in user_history:
                history_data.append({
                    "score": session.score,
                    "results": json.loads(session.results) if session.results else []
                })
            
            adaptation = agents["adaptive_difficulty"].analyze_performance(history_data)
            
            # ADAPTIVE LEARNING: Get real-time recommendations
            adaptive_recommendations = adaptive_integration.get_session_recommendations(user.id)
            
            # Track weak areas from wrong answers
            await _update_weak_areas(db, user.id, results, models)
            
            return {
                "status": "success",
                "session_id": session_record.id,
                "score": score,
                "correct_count": correct_count,
                "total_questions": len(questions),
                "earned_points": earned_points,
                "total_points": total_points,
                "details": results,
                "adaptation": adaptation,
                # ADAPTIVE LEARNING: Include adaptive feedback
                "adaptive_feedback": {
                    "cognitive_load": adaptive_recommendations.get('cognitive_load'),
                    "recommendations": adaptive_recommendations.get('recommendations', []),
                    "performance_trend": adaptive_recommendations.get('performance_trend')
                } if adaptive_recommendations and 'error' not in adaptive_recommendations else None
            }
            
        except Exception as e:
            logger.error(f"Error submitting answers: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_similar_question")
    async def generate_similar_question(
        request: SimilarQuestionRequest,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            logger.info(f"Generating similar question for user: {request.user_id}, question_id: {request.question_id}")
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            original_question = db.query(models.Question).filter(
                models.Question.id == request.question_id
            ).first()
            
            if not original_question:
                raise HTTPException(status_code=404, detail="Question not found")
            
            original_data = {
                "question_text": original_question.question_text,
                "question_type": original_question.question_type,
                "difficulty": original_question.difficulty,
                "topic": original_question.topic,
                "correct_answer": original_question.correct_answer,
                "options": json.loads(original_question.options) if original_question.options else [],
                "explanation": original_question.explanation
            }
            
            logger.info(f"Calling question generator to create similar question...")
            similar_question = await agents["question_generator"].generate_similar_question(
                original_question=original_data,
                difficulty=request.difficulty
            )
            
            new_question = models.Question(
                question_set_id=original_question.question_set_id,
                question_text=similar_question.get("question_text"),
                question_type=similar_question.get("question_type"),
                difficulty=similar_question.get("difficulty"),
                topic=similar_question.get("topic"),
                correct_answer=similar_question.get("correct_answer"),
                options=json.dumps(similar_question.get("options", [])),
                explanation=similar_question.get("explanation"),
                points=similar_question.get("points", 1),
                order_index=999
            )
            
            db.add(new_question)
            db.commit()
            db.refresh(new_question)
            
            logger.info(f"Similar question generated successfully: question_id={new_question.id}")
            return {
                "status": "success",
                "question": {
                    "id": new_question.id,
                    "question_text": new_question.question_text,
                    "question_type": new_question.question_type,
                    "difficulty": new_question.difficulty,
                    "topic": new_question.topic,
                    "options": json.loads(new_question.options) if new_question.options else [],
                    "explanation": new_question.explanation
                }
            }
            
        except HTTPException as http_e:
            logger.error(f"HTTP Error generating similar question: {http_e.detail}")
            try:
                db.rollback()
            except:
                pass
            raise http_e
        except Exception as e:
            logger.error(f"Unexpected error generating similar question: {e}", exc_info=True)
            try:
                db.rollback()
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Error generating similar question: {str(e)}")
    
    @app.get("/api/qb/get_analytics")
    async def get_analytics(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            sessions = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).all()
            
            total_sessions = len(sessions)
            total_questions_answered = sum(s.total_questions for s in sessions)
            avg_score = sum(s.score for s in sessions) / total_sessions if total_sessions > 0 else 0
            
            topic_stats = {}
            difficulty_stats = {"easy": {"total": 0, "correct": 0}, "medium": {"total": 0, "correct": 0}, "hard": {"total": 0, "correct": 0}}
            
            for session in sessions:
                results = json.loads(session.results) if session.results else []
                for result in results:
                    topic = result.get("topic", "Unknown")
                    difficulty = result.get("difficulty", "medium")
                    is_correct = result.get("is_correct", False)
                    
                    if topic not in topic_stats:
                        topic_stats[topic] = {"total": 0, "correct": 0}
                    topic_stats[topic]["total"] += 1
                    if is_correct:
                        topic_stats[topic]["correct"] += 1
                    
                    if difficulty in difficulty_stats:
                        difficulty_stats[difficulty]["total"] += 1
                        if is_correct:
                            difficulty_stats[difficulty]["correct"] += 1
            
            topic_performance = []
            for topic, stats in topic_stats.items():
                accuracy = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
                topic_performance.append({
                    "topic": topic,
                    "accuracy": round(accuracy, 1),
                    "total_questions": stats["total"],
                    "correct_answers": stats["correct"]
                })
            
            topic_performance.sort(key=lambda x: x["accuracy"])
            
            difficulty_performance = []
            for difficulty, stats in difficulty_stats.items():
                accuracy = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
                difficulty_performance.append({
                    "difficulty": difficulty,
                    "accuracy": round(accuracy, 1),
                    "total_questions": stats["total"],
                    "correct_answers": stats["correct"]
                })
            
            recent_scores = [s.score for s in sessions[:10]]
            
            user_history = [
                {
                    "score": s.score,
                    "results": json.loads(s.results) if s.results else []
                }
                for s in sessions[:10]
            ]
            
            adaptation = agents["adaptive_difficulty"].analyze_performance(user_history)
            
            return {
                "total_sessions": total_sessions,
                "total_questions_answered": total_questions_answered,
                "average_score": round(avg_score, 1),
                "recent_scores": recent_scores,
                "topic_performance": topic_performance,
                "difficulty_performance": difficulty_performance,
                "weak_topics": [t for t in topic_performance if t["accuracy"] < 60][:5],
                "strong_topics": [t for t in sorted(topic_performance, key=lambda x: -x["accuracy"]) if t["accuracy"] >= 80][:5],
                "adaptive_recommendation": adaptation
            }
            
        except Exception as e:
            logger.error(f"Error fetching analytics: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/qb/export_question_set_pdf/{set_id}")
    async def export_question_set_pdf(
        set_id: int,
        user_id: str = Query(...),
        include_answers: bool = Query(False),
        db: Session = Depends(get_db_func)
    ):
        """
        Export a question set as a professionally formatted PDF with LaTeX support.
        
        Features:
        - Professional academic formatting
        - LaTeX math rendering
        - Difficulty indicators
        - Topic categorization
        - Optional answer key
        - Page numbers and headers
        """
        from fastapi.responses import StreamingResponse
        import io
        
        try:
            import models
            
            # Get user
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get question set
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == set_id,
                models.QuestionSet.user_id == user.id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            # Get questions
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == set_id
            ).order_by(models.Question.order_index).all()
            
            if not questions:
                raise HTTPException(status_code=404, detail="No questions found in this set")
            
            # Generate PDF
            pdf_buffer = generate_question_set_pdf(
                question_set=question_set,
                questions=questions,
                include_answers=include_answers,
                user_name=user.first_name or user.username
            )
            
            # Create filename
            safe_title = "".join(c for c in question_set.title if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_title = safe_title.replace(' ', '_')[:50]
            filename = f"Question_Set_{safe_title}.pdf"
            
            return StreamingResponse(
                io.BytesIO(pdf_buffer),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Type": "application/pdf"
                }
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error exporting question set PDF: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ==================== AI ENHANCEMENT ENDPOINTS ====================
    
    @app.post("/api/qb/enhance_prompt")
    async def enhance_prompt(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Enhance a user's prompt for better question generation"""
        try:
            user_prompt = payload.get("prompt", "")
            content_summary = payload.get("content_summary", "")
            
            if not user_prompt:
                raise HTTPException(status_code=400, detail="Prompt is required")
            
            result = await agents["prompt_enhancer"].enhance_prompt(user_prompt, content_summary)
            
            return {
                "status": "success",
                "original_prompt": user_prompt,
                "enhanced": result
            }
        except Exception as e:
            logger.error(f"Prompt enhancement error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/extract_topics")
    async def extract_topics(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Extract topics from document content"""
        try:
            import models
            
            user_id = payload.get("user_id")
            document_id = payload.get("document_id")
            content = payload.get("content", "")
            
            # If document_id provided, get content from document
            if document_id and user_id:
                user = db.query(models.User).filter(
                    (models.User.username == user_id) | (models.User.email == user_id)
                ).first()
                
                if user:
                    doc = db.query(models.UploadedDocument).filter(
                        models.UploadedDocument.id == document_id,
                        models.UploadedDocument.user_id == user.id
                    ).first()
                    
                    if doc:
                        content = doc.content
            
            if not content:
                raise HTTPException(status_code=400, detail="Content or document_id is required")
            
            result = await agents["topic_extractor"].extract_topics(content)
            
            return {
                "status": "success",
                "topics": result
            }
        except Exception as e:
            logger.error(f"Topic extraction error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/score_questions")
    async def score_questions(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Score question quality"""
        try:
            questions = payload.get("questions", [])
            
            if not questions:
                raise HTTPException(status_code=400, detail="Questions are required")
            
            scored_questions = await agents["quality_scorer"].batch_score_questions(questions)
            
            # Calculate average score
            avg_score = sum(q.get('quality_score', 7) for q in scored_questions) / len(scored_questions)
            
            return {
                "status": "success",
                "questions": scored_questions,
                "average_score": round(avg_score, 2),
                "total_scored": len(scored_questions)
            }
        except Exception as e:
            logger.error(f"Question scoring error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/tag_bloom_taxonomy")
    async def tag_bloom_taxonomy(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Tag questions with Bloom's Taxonomy levels"""
        try:
            questions = payload.get("questions", [])
            
            if not questions:
                raise HTTPException(status_code=400, detail="Questions are required")
            
            tagged_questions = await agents["bloom_tagger"].batch_tag_questions(questions)
            
            # Count by level
            level_counts = {}
            for q in tagged_questions:
                level = q.get('bloom_level', 'understand')
                level_counts[level] = level_counts.get(level, 0) + 1
            
            return {
                "status": "success",
                "questions": tagged_questions,
                "level_distribution": level_counts,
                "bloom_levels": BloomTaxonomyAgent.BLOOM_LEVELS
            }
        except Exception as e:
            logger.error(f"Bloom taxonomy tagging error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/check_duplicates")
    async def check_duplicates(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Check if a question is a duplicate of existing questions"""
        try:
            import models
            
            user_id = payload.get("user_id")
            new_question = payload.get("question", "")
            question_set_id = payload.get("question_set_id")
            
            if not new_question:
                raise HTTPException(status_code=400, detail="Question is required")
            
            # Get existing questions
            existing_questions = []
            
            if user_id:
                user = db.query(models.User).filter(
                    (models.User.username == user_id) | (models.User.email == user_id)
                ).first()
                
                if user:
                    query = db.query(models.Question).join(models.QuestionSet).filter(
                        models.QuestionSet.user_id == user.id
                    )
                    
                    if question_set_id:
                        query = query.filter(models.QuestionSet.id == question_set_id)
                    
                    questions = query.order_by(models.Question.id.desc()).limit(100).all()
                    existing_questions = [q.question_text for q in questions]
            
            result = await agents["duplicate_detector"].find_duplicates(new_question, existing_questions)
            
            return {
                "status": "success",
                "result": result
            }
        except Exception as e:
            logger.error(f"Duplicate check error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/analyze_weaknesses")
    async def analyze_weaknesses(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Analyze user's weak areas based on performance"""
        try:
            import models
            
            user_id = payload.get("user_id")
            
            if not user_id:
                raise HTTPException(status_code=400, detail="user_id is required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get user's answer history from solo quizzes
            quizzes = db.query(models.SoloQuiz).filter(
                models.SoloQuiz.user_id == user.id,
                models.SoloQuiz.completed == True
            ).order_by(models.SoloQuiz.completed_at.desc()).limit(20).all()
            
            performance_data = []
            for quiz in quizzes:
                questions = db.query(models.SoloQuizQuestion).filter(
                    models.SoloQuizQuestion.quiz_id == quiz.id
                ).all()
                
                for question in questions:
                    # Skip if no user answer recorded
                    if question.user_answer is None:
                        continue
                    
                    performance_data.append({
                        "topic": quiz.topic or "General",
                        "difficulty": quiz.difficulty or "medium",
                            "question_type": question.question_type,
                            "is_correct": answer.is_correct,
                            "time_taken": answer.time_taken_seconds
                        })
            
            if not performance_data:
                return {
                    "status": "success",
                    "message": "No performance data available yet",
                    "analysis": None
                }
            
            analysis = await agents["adaptive_generator"].analyze_weaknesses(performance_data)
            
            return {
                "status": "success",
                "analysis": analysis,
                "data_points": len(performance_data)
            }
        except Exception as e:
            logger.error(f"Weakness analysis error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_adaptive")
    async def generate_adaptive_questions(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Generate questions targeting user's weak areas"""
        try:
            import models
            
            user_id = payload.get("user_id")
            document_ids = payload.get("document_ids", [])
            question_count = payload.get("question_count", 10)
            
            if not user_id:
                raise HTTPException(status_code=400, detail="user_id is required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get weakness analysis from solo quizzes
            quizzes = db.query(models.SoloQuiz).filter(
                models.SoloQuiz.user_id == user.id,
                models.SoloQuiz.completed == True
            ).order_by(models.SoloQuiz.completed_at.desc()).limit(20).all()
            
            performance_data = []
            for quiz in quizzes:
                questions = db.query(models.SoloQuizQuestion).filter(
                    models.SoloQuizQuestion.quiz_id == quiz.id
                ).all()
                
                for question in questions:
                    # Skip if no user answer recorded
                    if question.user_answer is None:
                        continue
                    
                    performance_data.append({
                        'topic': quiz.topic or 'General',
                        'difficulty': quiz.difficulty or 'medium',
                        'correct': question.is_correct,
                        'question_text': question.question_text
                    })
            
            weakness_analysis = await agents["adaptive_generator"].analyze_weaknesses(performance_data) if performance_data else {}
            
            # Get content from documents
            content_parts = []
            if document_ids:
                documents = db.query(models.UploadedDocument).filter(
                    models.UploadedDocument.id.in_(document_ids),
                    models.UploadedDocument.user_id == user.id
                ).all()
                
                for doc in documents:
                    content_parts.append(f"=== {doc.filename} ===\n{doc.content}")
            
            content = "\n\n".join(content_parts)
            
            if not content:
                raise HTTPException(status_code=400, detail="No content available for question generation")
            
            # Generate adaptive prompt
            adaptive_prompt = await agents["adaptive_generator"].generate_adaptive_prompt(weakness_analysis, content)
            
            # Generate questions with adaptive prompt
            questions = await agents["question_generator"].generate_questions(
                content,
                question_count,
                weakness_analysis.get('recommendations', {}).get('suggested_question_types', ['multiple_choice', 'short_answer']),
                {"easy": 20, "medium": 50, "hard": 30},
                weakness_analysis.get('recommendations', {}).get('focus_topics'),
                custom_prompt=adaptive_prompt
            )
            
            return {
                "status": "success",
                "questions": questions,
                "weakness_analysis": weakness_analysis,
                "adaptive_prompt_used": adaptive_prompt
            }
        except Exception as e:
            logger.error(f"Adaptive generation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/enhance_explanations")
    async def enhance_explanations(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Enhance question explanations with detailed steps"""
        try:
            questions = payload.get("questions", [])
            
            if not questions:
                raise HTTPException(status_code=400, detail="Questions are required")
            
            enhanced_questions = []
            for q in questions:
                await agents["explanation_enhancer"].enhance_explanation(q)
                enhanced_questions.append(q)
            
            return {
                "status": "success",
                "questions": enhanced_questions
            }
        except Exception as e:
            logger.error(f"Explanation enhancement error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/regenerate_question")
    async def regenerate_question(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Regenerate a single question based on feedback"""
        try:
            import models
            
            user_id = payload.get("user_id")
            original_question = payload.get("question", {})
            feedback = payload.get("feedback", "Make it better")
            document_id = payload.get("document_id")
            
            if not original_question:
                raise HTTPException(status_code=400, detail="Question is required")
            
            # Get content if document_id provided
            content = ""
            if document_id and user_id:
                user = db.query(models.User).filter(
                    (models.User.username == user_id) | (models.User.email == user_id)
                ).first()
                
                if user:
                    doc = db.query(models.UploadedDocument).filter(
                        models.UploadedDocument.id == document_id,
                        models.UploadedDocument.user_id == user.id
                    ).first()
                    
                    if doc:
                        content = doc.content
            
            new_question = await agents["question_preview"].regenerate_single_question(
                original_question, feedback, content
            )
            
            return {
                "status": "success",
                "original": original_question,
                "regenerated": new_question,
                "feedback_applied": feedback
            }
        except Exception as e:
            logger.error(f"Question regeneration error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/preview_generate")
    async def preview_generate_questions(
        request: MultiPDFGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        """Generate questions for preview (not saved to database)"""
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get documents
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.id.in_(request.source_ids),
                models.UploadedDocument.user_id == user.id
            ).all()
            
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")
            
            # Combine content
            content_parts = []
            for doc in documents:
                content_parts.append(f"=== {doc.filename} ===\n{doc.content}")
            
            content = "\n\n".join(content_parts)
            
            # Enhance prompt if provided
            enhanced_prompt = request.custom_prompt
            if request.custom_prompt:
                enhancement = await agents["prompt_enhancer"].enhance_prompt(
                    request.custom_prompt, 
                    content[:2000]
                )
                enhanced_prompt = enhancement.get('enhanced_prompt', request.custom_prompt)
            
            # Generate questions
            questions = await agents["question_generator"].generate_questions(
                content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics,
                custom_prompt=enhanced_prompt
            )
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions")
            
            # Score quality
            scored_questions = await agents["quality_scorer"].batch_score_questions(questions)
            
            # Tag with Bloom's taxonomy
            tagged_questions = await agents["bloom_tagger"].batch_tag_questions(scored_questions)
            
            # Check for duplicates
            existing_questions = []
            user_questions = db.query(models.Question).join(models.QuestionSet).filter(
                models.QuestionSet.user_id == user.id
            ).order_by(models.Question.id.desc()).limit(100).all()
            existing_questions = [q.question_text for q in user_questions]
            
            for q in tagged_questions:
                dup_check = await agents["duplicate_detector"].find_duplicates(
                    q.get('question_text', ''), 
                    existing_questions
                )
                q['is_potential_duplicate'] = dup_check.get('is_duplicate', False)
                q['duplicate_similarity'] = dup_check.get('similarity_score', 0)
            
            # Calculate stats
            avg_quality = sum(q.get('quality_score', 7) for q in tagged_questions) / len(tagged_questions)
            bloom_dist = {}
            for q in tagged_questions:
                level = q.get('bloom_level', 'understand')
                bloom_dist[level] = bloom_dist.get(level, 0) + 1
            
            return {
                "status": "success",
                "questions": tagged_questions,
                "stats": {
                    "total": len(tagged_questions),
                    "average_quality_score": round(avg_quality, 2),
                    "bloom_distribution": bloom_dist,
                    "potential_duplicates": sum(1 for q in tagged_questions if q.get('is_potential_duplicate'))
                },
                "enhanced_prompt": enhanced_prompt if enhanced_prompt != request.custom_prompt else None,
                "source_documents": [d.filename for d in documents]
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Preview generation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/save_previewed_questions")
    async def save_previewed_questions(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Save previewed questions (after user review/edit)"""
        try:
            import models
            
            user_id = payload.get("user_id")
            questions = payload.get("questions", [])
            title = payload.get("title", "Question Set")
            description = payload.get("description", "")
            source_type = payload.get("source_type", "preview")
            
            if not user_id or not questions:
                raise HTTPException(status_code=400, detail="user_id and questions are required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Create question set
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=description,
                source_type=source_type,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            # Add questions
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("enhanced_explanation", q.get("explanation", "")),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Save previewed questions error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/save_question_set")
    async def save_question_set(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Save question set from learning path or other sources"""
        try:
            import models
            
            user_id = payload.get("user_id")
            questions = payload.get("questions", [])
            title = payload.get("title", "Question Set")
            source = payload.get("source", "manual")
            
            if not user_id or not questions:
                raise HTTPException(status_code=400, detail="user_id and questions are required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Create question set
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {source}",
                source_type=source,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            # Add questions - handle both formats (learning path and standard)
            for idx, q in enumerate(questions):
                # Learning path format uses 'question' and 'options' array
                question_text = q.get("question") or q.get("question_text")
                options = q.get("options", [])
                correct_answer = q.get("correct_answer", 0)
                explanation = q.get("explanation", "")
                
                # Convert options array to the format expected by the database
                if isinstance(options, list) and len(options) > 0:
                    # If correct_answer is an index, get the actual answer text
                    if isinstance(correct_answer, int) and correct_answer < len(options):
                        correct_answer_text = options[correct_answer]
                    else:
                        correct_answer_text = str(correct_answer)
                else:
                    correct_answer_text = str(correct_answer)
                
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=question_text,
                    question_type="multiple_choice",
                    difficulty=q.get("difficulty", "medium"),
                    topic=q.get("topic", title),
                    correct_answer=correct_answer_text,
                    options=json.dumps(options),
                    explanation=explanation,
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Save question set error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/batch_delete")
    async def batch_delete_question_sets(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Delete multiple question sets at once"""
        try:
            import models
            
            user_id = payload.get("user_id")
            set_ids = payload.get("set_ids", [])
            
            if not user_id or not set_ids:
                raise HTTPException(status_code=400, detail="user_id and set_ids are required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            deleted_count = 0
            for set_id in set_ids:
                question_set = db.query(models.QuestionSet).filter(
                    models.QuestionSet.id == set_id,
                    models.QuestionSet.user_id == user.id
                ).first()
                
                if question_set:
                    # Delete questions first
                    db.query(models.Question).filter(
                        models.Question.question_set_id == set_id
                    ).delete()
                    
                    # Delete the set
                    db.delete(question_set)
                    deleted_count += 1
            
            db.commit()
            
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "requested_count": len(set_ids)
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Batch delete error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/merge_sets")
    async def merge_question_sets(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Merge multiple question sets into one"""
        try:
            import models
            
            user_id = payload.get("user_id")
            set_ids = payload.get("set_ids", [])
            new_title = payload.get("title", "Merged Question Set")
            delete_originals = payload.get("delete_originals", False)
            
            if not user_id or len(set_ids) < 2:
                raise HTTPException(status_code=400, detail="user_id and at least 2 set_ids are required")
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get all questions from the sets
            all_questions = []
            source_titles = []
            
            for set_id in set_ids:
                question_set = db.query(models.QuestionSet).filter(
                    models.QuestionSet.id == set_id,
                    models.QuestionSet.user_id == user.id
                ).first()
                
                if question_set:
                    source_titles.append(question_set.title)
                    questions = db.query(models.Question).filter(
                        models.Question.question_set_id == set_id
                    ).all()
                    
                    for q in questions:
                        all_questions.append({
                            "question_text": q.question_text,
                            "question_type": q.question_type,
                            "difficulty": q.difficulty,
                            "topic": q.topic,
                            "correct_answer": q.correct_answer,
                            "options": json.loads(q.options) if q.options else [],
                            "explanation": q.explanation,
                            "points": q.points
                        })
            
            if not all_questions:
                raise HTTPException(status_code=400, detail="No questions found in the selected sets")
            
            # Create new merged set
            merged_set = models.QuestionSet(
                user_id=user.id,
                title=new_title,
                description=f"Merged from: {', '.join(source_titles)}",
                source_type="merged",
                total_questions=len(all_questions)
            )
            
            db.add(merged_set)
            db.flush()
            
            # Add questions to merged set
            for idx, q in enumerate(all_questions):
                question = models.Question(
                    question_set_id=merged_set.id,
                    question_text=q["question_text"],
                    question_type=q["question_type"],
                    difficulty=q["difficulty"],
                    topic=q["topic"],
                    correct_answer=q["correct_answer"],
                    options=json.dumps(q["options"]),
                    explanation=q["explanation"],
                    points=q["points"],
                    order_index=idx
                )
                db.add(question)
            
            # Delete originals if requested
            if delete_originals:
                for set_id in set_ids:
                    db.query(models.Question).filter(
                        models.Question.question_set_id == set_id
                    ).delete()
                    db.query(models.QuestionSet).filter(
                        models.QuestionSet.id == set_id
                    ).delete()
            
            db.commit()
            db.refresh(merged_set)
            
            return {
                "status": "success",
                "merged_set_id": merged_set.id,
                "total_questions": len(all_questions),
                "source_sets": source_titles,
                "originals_deleted": delete_originals
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Merge sets error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    # ==================== WEAK AREAS TRACKING ENDPOINTS ====================
    
    @app.get("/api/qb/weak_areas")
    async def get_weak_areas(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        """Get user's weak areas sorted by priority"""
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            weak_areas = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == user.id,
                models.UserWeakArea.status != "mastered"
            ).order_by(
                models.UserWeakArea.priority.desc(),
                models.UserWeakArea.weakness_score.desc()
            ).all()
            
            return {
                "status": "success",
                "weak_areas": [
                    {
                        "id": wa.id,
                        "topic": wa.topic,
                        "subtopic": wa.subtopic,
                        "total_questions": wa.total_questions,
                        "correct_count": wa.correct_count,
                        "incorrect_count": wa.incorrect_count,
                        "accuracy": round(wa.accuracy, 1),
                        "weakness_score": round(wa.weakness_score, 1),
                        "consecutive_wrong": wa.consecutive_wrong,
                        "status": wa.status,
                        "priority": wa.priority,
                        "practice_sessions": wa.practice_sessions,
                        "improvement_rate": round(wa.improvement_rate, 2),
                        "last_practiced": wa.last_practiced.isoformat() if wa.last_practiced else None,
                        "first_identified": wa.first_identified.isoformat() if wa.first_identified else None
                    }
                    for wa in weak_areas
                ],
                "total_weak_areas": len(weak_areas),
                "critical_count": len([wa for wa in weak_areas if wa.priority >= 8]),
                "needs_practice_count": len([wa for wa in weak_areas if wa.status == "needs_practice"])
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get weak areas error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/qb/wrong_answers")
    async def get_wrong_answers(
        user_id: str = Query(...),
        topic: Optional[str] = Query(None),
        limit: int = Query(50),
        db: Session = Depends(get_db_func)
    ):
        """Get user's wrong answer history for review"""
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            query = db.query(models.WrongAnswerLog).filter(
                models.WrongAnswerLog.user_id == user.id
            )
            
            if topic:
                query = query.filter(models.WrongAnswerLog.topic == topic)
            
            wrong_answers = query.order_by(
                models.WrongAnswerLog.answered_at.desc()
            ).limit(limit).all()
            
            return {
                "status": "success",
                "wrong_answers": [
                    {
                        "id": wa.id,
                        "question_id": wa.question_id,
                        "question_text": wa.question_text,
                        "topic": wa.topic,
                        "difficulty": wa.difficulty,
                        "correct_answer": wa.correct_answer,
                        "user_answer": wa.user_answer,
                        "mistake_type": wa.mistake_type,
                        "reviewed": wa.reviewed,
                        "understood_after_review": wa.understood_after_review,
                        "answered_at": wa.answered_at.isoformat() if wa.answered_at else None
                    }
                    for wa in wrong_answers
                ],
                "total": len(wrong_answers)
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get wrong answers error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/mark_reviewed")
    async def mark_wrong_answer_reviewed(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Mark a wrong answer as reviewed"""
        try:
            import models
            
            wrong_answer_id = payload.get("wrong_answer_id")
            understood = payload.get("understood", True)
            
            wrong_answer = db.query(models.WrongAnswerLog).filter(
                models.WrongAnswerLog.id == wrong_answer_id
            ).first()
            
            if not wrong_answer:
                raise HTTPException(status_code=404, detail="Wrong answer not found")
            
            wrong_answer.reviewed = True
            wrong_answer.reviewed_at = datetime.now(timezone.utc)
            wrong_answer.understood_after_review = understood
            
            db.commit()
            
            return {"status": "success", "message": "Marked as reviewed"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Mark reviewed error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/generate_practice")
    async def generate_practice_questions(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Generate practice questions focused on weak areas"""
        try:
            import models
            
            user_id = payload.get("user_id")
            topic = payload.get("topic")  # Optional: specific topic to practice
            question_count = payload.get("question_count", 10)
            include_review = payload.get("include_review", True)  # Include previously wrong questions
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get weak areas
            weak_area_query = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == user.id,
                models.UserWeakArea.status != "mastered"
            )
            
            if topic:
                weak_area_query = weak_area_query.filter(models.UserWeakArea.topic == topic)
            
            weak_areas = weak_area_query.order_by(
                models.UserWeakArea.priority.desc()
            ).limit(5).all()
            
            if not weak_areas:
                return {
                    "status": "success",
                    "message": "No weak areas found! Great job!",
                    "questions": [],
                    "practice_set_id": None
                }
            
            # Collect topics to focus on
            focus_topics = [wa.topic for wa in weak_areas]
            
            # Get previously wrong questions for review
            review_questions = []
            if include_review:
                wrong_logs = db.query(models.WrongAnswerLog).filter(
                    models.WrongAnswerLog.user_id == user.id,
                    models.WrongAnswerLog.topic.in_(focus_topics),
                    models.WrongAnswerLog.reviewed == False
                ).order_by(
                    models.WrongAnswerLog.answered_at.desc()
                ).limit(question_count // 2).all()
                
                for wl in wrong_logs:
                    question = db.query(models.Question).filter(
                        models.Question.id == wl.question_id
                    ).first()
                    if question:
                        review_questions.append({
                            "question_text": question.question_text,
                            "question_type": question.question_type,
                            "difficulty": question.difficulty,
                            "topic": question.topic,
                            "correct_answer": question.correct_answer,
                            "options": json.loads(question.options) if question.options else [],
                            "explanation": question.explanation,
                            "points": question.points,
                            "is_review": True,
                            "original_wrong_answer": wl.user_answer
                        })
            
            # Generate new questions for remaining count
            new_question_count = question_count - len(review_questions)
            new_questions = []
            
            if new_question_count > 0:
                # Get content from documents related to weak topics
                docs = db.query(models.UploadedDocument).filter(
                    models.UploadedDocument.user_id == user.id
                ).limit(3).all()
                
                if docs:
                    content = "\n\n".join([d.content for d in docs if d.content])[:15000]
                    
                    # Generate questions focused on weak areas
                    generated = await agents["question_generator"].generate_questions(
                        content,
                        new_question_count,
                        ["multiple_choice"],
                        {"easy": 40, "medium": 40, "hard": 20},
                        focus_topics,
                        custom_prompt=f"Focus specifically on these weak areas that need practice: {', '.join(focus_topics)}. Create questions that test understanding of these concepts."
                    )
                    
                    for q in generated:
                        q["is_review"] = False
                        new_questions.append(q)
            
            all_questions = review_questions + new_questions
            
            if not all_questions:
                return {
                    "status": "success",
                    "message": "Could not generate practice questions. Try uploading more content.",
                    "questions": [],
                    "practice_set_id": None
                }
            
            # Create a practice question set
            practice_set = models.QuestionSet(
                user_id=user.id,
                title=f"Practice: {', '.join(focus_topics[:3])}",
                description=f"Targeted practice for weak areas. {len(review_questions)} review + {len(new_questions)} new questions.",
                source_type="practice",
                total_questions=len(all_questions)
            )
            
            db.add(practice_set)
            db.flush()
            
            # Add questions
            for idx, q in enumerate(all_questions):
                question = models.Question(
                    question_set_id=practice_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type", "multiple_choice"),
                    difficulty=q.get("difficulty", "medium"),
                    topic=q.get("topic", focus_topics[0] if focus_topics else "General"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation", ""),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            # Update weak area practice count
            for wa in weak_areas:
                wa.practice_sessions += 1
                wa.last_practiced = datetime.now(timezone.utc)
            
            db.commit()
            db.refresh(practice_set)
            
            return {
                "status": "success",
                "practice_set_id": practice_set.id,
                "total_questions": len(all_questions),
                "review_questions": len(review_questions),
                "new_questions": len(new_questions),
                "focus_topics": focus_topics,
                "questions": all_questions
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Generate practice error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/qb/practice_recommendations")
    async def get_practice_recommendations(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        """Get AI-powered practice recommendations based on performance"""
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get weak areas
            weak_areas = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == user.id,
                models.UserWeakArea.status != "mastered"
            ).order_by(models.UserWeakArea.priority.desc()).limit(10).all()
            
            # Get recent performance
            recent_sessions = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).limit(10).all()
            
            recommendations = []
            
            # Critical weak areas (priority >= 8)
            critical = [wa for wa in weak_areas if wa.priority >= 8]
            if critical:
                recommendations.append({
                    "type": "critical",
                    "title": "Critical Areas Need Attention",
                    "description": f"You have {len(critical)} topics with very low accuracy that need immediate practice.",
                    "topics": [wa.topic for wa in critical],
                    "action": "generate_practice",
                    "priority": 10
                })
            
            # Topics with declining performance
            declining = [wa for wa in weak_areas if wa.improvement_rate < -0.1]
            if declining:
                recommendations.append({
                    "type": "declining",
                    "title": "Performance Declining",
                    "description": f"Your performance in {len(declining)} topics is getting worse. Review these concepts.",
                    "topics": [wa.topic for wa in declining],
                    "action": "review_wrong_answers",
                    "priority": 8
                })
            
            # Topics not practiced recently
            from datetime import timedelta
            stale_threshold = datetime.now(timezone.utc) - timedelta(days=7)
            stale = [wa for wa in weak_areas if wa.last_practiced and wa.last_practiced < stale_threshold]
            if stale:
                recommendations.append({
                    "type": "stale",
                    "title": "Time to Review",
                    "description": f"{len(stale)} weak topics haven't been practiced in over a week.",
                    "topics": [wa.topic for wa in stale],
                    "action": "generate_practice",
                    "priority": 6
                })
            
            # Unreviewed wrong answers
            unreviewed_count = db.query(models.WrongAnswerLog).filter(
                models.WrongAnswerLog.user_id == user.id,
                models.WrongAnswerLog.reviewed == False
            ).count()
            
            if unreviewed_count > 5:
                recommendations.append({
                    "type": "review",
                    "title": "Review Your Mistakes",
                    "description": f"You have {unreviewed_count} wrong answers that haven't been reviewed yet.",
                    "action": "review_wrong_answers",
                    "priority": 7
                })
            
            # Overall stats
            total_questions_answered = sum(s.total_questions for s in recent_sessions) if recent_sessions else 0
            avg_score = sum(s.score for s in recent_sessions) / len(recent_sessions) if recent_sessions else 0
            
            return {
                "status": "success",
                "recommendations": sorted(recommendations, key=lambda x: x["priority"], reverse=True),
                "summary": {
                    "total_weak_areas": len(weak_areas),
                    "critical_count": len(critical),
                    "recent_sessions": len(recent_sessions),
                    "total_questions_answered": total_questions_answered,
                    "average_score": round(avg_score, 1),
                    "unreviewed_mistakes": unreviewed_count
                }
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get recommendations error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/qb/reset_weak_area")
    async def reset_weak_area(
        payload: dict = Body(...),
        db: Session = Depends(get_db_func)
    ):
        """Reset a weak area (mark as mastered or delete)"""
        try:
            import models
            
            weak_area_id = payload.get("weak_area_id")
            action = payload.get("action", "mastered")  # mastered or delete
            
            weak_area = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.id == weak_area_id
            ).first()
            
            if not weak_area:
                raise HTTPException(status_code=404, detail="Weak area not found")
            
            if action == "delete":
                db.delete(weak_area)
            else:
                weak_area.status = "mastered"
                weak_area.priority = 0
            
            db.commit()
            
            return {"status": "success", "message": f"Weak area {action}"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Reset weak area error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("Enhanced Question Bank API with sophisticated AI agents registered successfully")
