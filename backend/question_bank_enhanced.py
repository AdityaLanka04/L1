import os
import sys
import json
import logging
import tempfile
from datetime import datetime, timezone
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
            
            try:
                # Try primary extraction method
                logger.info("Attempting PyPDF2 extraction...")
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
                    logger.info(f"Successfully extracted {len(text)} characters from PDF")
                    return text.strip()
                else:
                    raise ValueError("No text extracted from PDF using primary method")
                    
            except Exception as primary_error:
                logger.warning(f"PyPDF2 extraction failed: {primary_error}, attempting fallback...")
                
                # Fallback: Try with pdfplumber if available, or return a default error
                try:
                    import pdfplumber
                    with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text()
                            if page_text:
                                text += page_text + "\n\n"
                    
                    if text.strip():
                        logger.info(f"Fallback extraction successful, got {len(text)} characters")
                        return text.strip()
                except ImportError:
                    logger.warning("pdfplumber not available for fallback")
                except Exception as fallback_error:
                    logger.warning(f"Fallback extraction also failed: {fallback_error}")
                
                # If both methods fail, raise a meaningful error
                raise ValueError("Unable to extract text from PDF with available methods")
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"PDF extraction error: {error_msg}", exc_info=True)
            # Return a 400 error with a user-friendly message
            raise HTTPException(
                status_code=400, 
                detail=f"Unable to extract text from PDF. The file may be corrupted, encrypted, or in an unsupported format. Error: {error_msg[:100]}"
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


class QuestionGeneratorAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
    
    async def generate_questions(
        self, 
        content: str, 
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str] = None
    ) -> List[Dict[str, Any]]:
        
        types_str = ", ".join(question_types)
        topics_str = ", ".join(topics) if topics else "all topics in the content"
        
        prompt = f"""Generate {question_count} high-quality, clear, and well-formed exam questions from this content.

Content:
{content[:10000]}

Requirements:
- Question types: {types_str}
- Difficulty distribution: {json.dumps(difficulty_distribution)}
- Focus topics: {topics_str}

IMPORTANT GUIDELINES:
1. Make questions CLEAR and SPECIFIC - avoid vague or ambiguous wording
2. Ensure questions are DIRECTLY answerable from the content provided
3. For short_answer questions, accept reasonable variations (synonyms, different phrasings)
4. For fill_blank questions, make the blank obvious and have ONE clear answer
5. For multiple_choice, ensure options are distinct and only ONE is clearly correct
6. Questions should test understanding, not trick the student
7. Use proper grammar and complete sentences
8. Avoid questions that start with "What is the..." unless necessary

For each question, provide:
{{
    "question_text": "Clear, specific question with proper grammar",
    "question_type": "multiple_choice|true_false|short_answer|fill_blank",
    "difficulty": "easy|medium|hard",
    "topic": "specific topic from content",
    "correct_answer": "precise answer (for short_answer, use the most common/simple form)",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "explanation": "Why this answer is correct and others are wrong",
    "points": 1
}}

Return ONLY a valid JSON array of questions, no additional text."""
        
        try:
            content = self.unified_ai.generate(prompt, max_tokens=4000, temperature=0.7)
            
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content)
                content = re.sub(r'\n?```$', '', content).strip()
            
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                questions = json.loads(json_match.group())
            else:
                questions = json.loads(content)
            
            logger.info(f"Generated {len(questions)} questions successfully")
            return questions
        except Exception as e:
            logger.error(f"Question generation error: {e}")
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
    "correct_answer": "answer if available",
    "options": ["A", "B", "C", "D"],
    "explanation": "explanation if available",
    "points": 1
}}

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
        "chat_slide_processor": ChatSlideProcessorAgent(unified_ai)
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
            
            # Generate questions from combined content
            questions = await agents["question_generator"].generate_questions(
                combined_content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics
            )
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions from the provided documents")
            
            # Create question set
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {len(documents)} PDF documents: {', '.join(document_names[:3])}{'...' if len(document_names) > 3 else ''}",
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
            
            return {
                "status": "success",
                "session_id": session_record.id,
                "score": score,
                "correct_count": correct_count,
                "total_questions": len(questions),
                "earned_points": earned_points,
                "total_points": total_points,
                "details": results,
                "adaptation": adaptation
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
    
    logger.info("Enhanced Question Bank API with sophisticated AI agents registered successfully")
