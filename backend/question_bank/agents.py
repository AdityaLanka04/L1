import io
import json
import logging
import re
from typing import Any, Dict, List, Optional

import PyPDF2
from fastapi import HTTPException

from .utils import _filter_analysis_by_topics

logger = logging.getLogger(__name__)


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

            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()

            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON: {json_str[:100]}")
                result = json.loads(json_str)
            else:
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
                import pymupdf4llm
                logger.info("Attempting PyMuPDF4LLM extraction...")

                try:
                    import pymupdf.layout
                    logger.info("PyMuPDF layout mode enabled for extraction")
                except Exception:
                    pass

                import fitz
                doc = fitz.open(stream=pdf_content, filetype="pdf")
                try:
                    llm_text = pymupdf4llm.to_text(doc)
                finally:
                    doc.close()

                if llm_text and llm_text.strip():
                    logger.info(f"PyMuPDF4LLM extracted {len(llm_text)} characters from PDF")
                    return llm_text.strip()
                else:
                    logger.warning("PyMuPDF4LLM returned empty text, trying other methods...")

            except ImportError:
                logger.info("PyMuPDF4LLM not available, trying PyMuPDF...")
            except Exception as llm_error:
                logger.warning(f"PyMuPDF4LLM extraction failed: {llm_error}")

            try:
                import fitz
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

            try:
                logger.info("Attempting PyPDF2 extraction...")
                pdf_bytes.seek(0)
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

            if text.strip():
                return text.strip()

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

            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()

            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON: {json_str[:100]}")
                result = json.loads(json_str)
            else:
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


class PromptEnhancerAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def enhance_prompt(self, user_prompt: str, content_summary: str = "") -> Dict[str, Any]:
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
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def extract_topics(self, content: str) -> Dict[str, Any]:
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
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def score_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
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
        scored = []
        for q in questions:
            score_result = await self.score_question(q)
            q['quality_score'] = score_result.get('overall_score', 7)
            q['quality_feedback'] = score_result.get('improvements', [])
            scored.append(q)
        return scored


class BloomTaxonomyAgent:
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
        for q in questions:
            await self.tag_question(q)
        return questions


class DuplicateDetectorAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def find_duplicates(self, new_question: str, existing_questions: List[str]) -> Dict[str, Any]:
        if not existing_questions:
            return {"is_duplicate": False, "similar_questions": []}

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
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def analyze_weaknesses(self, performance_data: List[Dict]) -> Dict[str, Any]:
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


class RelatedQuestionAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    def build_prompt(self, weak_topics: List[str], strong_topics: List[str]) -> str:
        weak_list = ", ".join(weak_topics) if weak_topics else "None"
        strong_list = ", ".join(strong_topics) if strong_topics else "None"

        if not weak_topics and not strong_topics:
            return (
                "Generate questions that are closely related to the document's most important concepts. "
                "Prioritize core ideas, definitions, and applications supported by the content."
            )

        guidance = [
            "- Aim for roughly 60-70% of questions to target weak topics when available.",
            "- Include a smaller set of challenge questions on strong topics (applied or higher-difficulty).",
            "- Use remaining questions to cover other key concepts from the document.",
            "- Only use topics supported by the document; if a listed topic is missing, choose the closest related concept."
        ]

        return (
            "Personalize question generation based on student performance.\n\n"
            f"STUDENT WEAK TOPICS (prioritize): {weak_list}\n"
            f"STUDENT STRONG TOPICS (challenge lightly): {strong_list}\n\n"
            "GUIDELINES:\n"
            + "\n".join(guidance)
            + "\n\nWhen focusing on weak topics, address common misconceptions and provide clear explanations."
        )


class ExplanationEnhancerAgent:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def enhance_explanation(self, question: Dict[str, Any]) -> Dict[str, Any]:
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
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai

    async def regenerate_single_question(
        self,
        original_question: Dict,
        feedback: str,
        content: str
    ) -> Dict[str, Any]:
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

        max_ref_chars = 5000
        if reference_content and len(reference_content) > max_ref_chars:
            reference_content = reference_content[:max_ref_chars]

        chunk_size = 12000

        if len(content) > chunk_size:
            logger.info(f"Large content detected ({len(content)} chars). Using chunking strategy.")
            return await self._generate_questions_chunked(
                content, question_count, question_types, difficulty_distribution,
                topics, custom_prompt, reference_content, chunk_size
            )

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

        chunks = self._split_content_into_chunks(content, chunk_size)
        logger.info(f"Split content into {len(chunks)} chunks")

        base_questions_per_chunk = question_count // len(chunks)
        remainder = question_count % len(chunks)

        all_questions = []
        seen_questions = set()

        for i, chunk in enumerate(chunks):
            chunk_question_count = base_questions_per_chunk + (remainder if i == len(chunks) - 1 else 0)

            if chunk_question_count == 0:
                continue

            logger.info(f"Processing chunk {i + 1}/{len(chunks)} ({len(chunk)} chars, {chunk_question_count} questions)")

            chunk_questions = await self._generate_questions_single(
                chunk, chunk_question_count, question_types, difficulty_distribution,
                topics, custom_prompt, reference_content
            )

            for q in chunk_questions:
                q_text = q.get('question_text', '').strip().lower()
                if q_text and q_text not in seen_questions:
                    seen_questions.add(q_text)
                    all_questions.append(q)

        logger.info(f"Generated {len(all_questions)} total questions from {len(chunks)} chunks")

        if len(all_questions) < question_count * 0.7:
            logger.warning(f"Only got {len(all_questions)} questions, attempting supplementary generation")
            additional_needed = question_count - len(all_questions)

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

        return all_questions[:question_count]

    def _split_content_into_chunks(self, content: str, chunk_size: int) -> List[str]:

        doc_marker = "=== "
        if doc_marker in content:
            sections = content.split(doc_marker)
            chunks = []
            current_chunk = ""

            for section in sections:
                if not section.strip():
                    continue

                section_with_marker = doc_marker + section

                if len(current_chunk) + len(section_with_marker) > chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk)

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

        return self._split_text_by_paragraphs(content, chunk_size)

    def _split_text_by_paragraphs(self, text: str, chunk_size: int) -> List[str]:
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

        if not chunks:
            chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

        return chunks

    def _create_content_summary(self, content: str, max_chars: int) -> str:
        doc_marker = "=== "
        if doc_marker in content:
            sections = content.split(doc_marker)
            chars_per_section = max_chars // max(len(sections), 1)

            summary_parts = []
            for section in sections:
                if section.strip():
                    if len(section) > chars_per_section:
                        half = chars_per_section // 2
                        summary_parts.append(doc_marker + section[:half] + "\n...\n" + section[-half:])
                    else:
                        summary_parts.append(doc_marker + section)

            return "\n".join(summary_parts)

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

        total_diff = sum(difficulty_distribution.values())
        if total_diff > 0 and question_count >= 3:
            easy_count = max(1, round(question_count * difficulty_distribution.get('easy', 30) / total_diff))
            medium_count = max(1, round(question_count * difficulty_distribution.get('medium', 50) / total_diff))
            hard_count = max(0, question_count - easy_count - medium_count)
        elif question_count == 2:
            easy_count = 1
            medium_count = 1
            hard_count = 0
        elif question_count == 1:
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

        analysis = await self._agent_analyze_content(content)

        blueprint = await self._agent_create_blueprint(
            analysis, easy_count, medium_count, hard_count,
            question_types, topics, custom_prompt, reference_content
        )

        questions = await self._agent_generate_from_blueprint(
            content, blueprint, question_types, custom_prompt, reference_content, topics
        )

        questions = await self._agent_validate_questions(questions, content, question_count)

        return questions

    async def _agent_analyze_content(self, content: str) -> Dict[str, Any]:

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

            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()

            try:
                analysis = json.loads(response)
                logger.info(f"Content analysis extracted: {len(analysis.get('key_facts', []))} facts, {len(analysis.get('definitions', []))} definitions")
                return analysis
            except:
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

        analysis_for_topics = analysis
        if topics:
            filtered = _filter_analysis_by_topics(analysis, topics)
            has_items = any(
                len(filtered.get(k, []) or []) > 0
                for k in ["key_facts", "definitions", "relationships", "processes", "comparisons", "cause_effects", "numerical_data"]
            )
            if has_items:
                analysis_for_topics = filtered
                logger.info("Blueprint topic filter applied")
            else:
                logger.info("Blueprint topic filter produced no matches; using full analysis")

        blueprint = []

        easy_sources = []
        for fact in analysis_for_topics.get('key_facts', []):
            if fact.get('complexity') == 'simple':
                easy_sources.append({"type": "fact", "data": fact})
        for defn in analysis_for_topics.get('definitions', []):
            easy_sources.append({"type": "definition", "data": defn})
        for num in analysis_for_topics.get('numerical_data', []):
            easy_sources.append({"type": "numerical", "data": num})

        medium_sources = []
        for fact in analysis_for_topics.get('key_facts', []):
            if fact.get('complexity') == 'moderate':
                medium_sources.append({"type": "fact", "data": fact})
        for rel in analysis_for_topics.get('relationships', []):
            if rel.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "relationship", "data": rel})
        for ce in analysis_for_topics.get('cause_effects', []):
            if ce.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "cause_effect", "data": ce})
        for proc in analysis_for_topics.get('processes', []):
            if proc.get('complexity') in ['simple', 'moderate']:
                medium_sources.append({"type": "process", "data": proc})

        hard_sources = []
        for fact in analysis_for_topics.get('key_facts', []):
            if fact.get('complexity') == 'complex':
                hard_sources.append({"type": "fact", "data": fact})
        for rel in analysis_for_topics.get('relationships', []):
            if rel.get('complexity') == 'complex':
                hard_sources.append({"type": "relationship", "data": rel})
        for comp in analysis_for_topics.get('comparisons', []):
            hard_sources.append({"type": "comparison", "data": comp})
        for ce in analysis_for_topics.get('cause_effects', []):
            if ce.get('complexity') == 'complex':
                hard_sources.append({"type": "cause_effect", "data": ce})
        for proc in analysis_for_topics.get('processes', []):
            if proc.get('complexity') == 'complex':
                hard_sources.append({"type": "process", "data": proc})

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
        question_types: List[str], custom_prompt: str, reference_content: str,
        topics: List[str]
    ) -> List[Dict]:

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

        custom_section = ""
        if custom_prompt:
            custom_section = f"\nUSER'S CUSTOM INSTRUCTIONS:\n{custom_prompt}\n"

        reference_section = ""
        if reference_content:
            reference_section = f"\nREFERENCE QUESTIONS (match this style):\n{reference_content[:2000]}\n"

        topics_section = ""
        if topics:
            topics_section = (
                "\nFOCUS TOPICS (prioritize): "
                + ", ".join(topics)
                + "\n- Each question's 'topic' field MUST be one of these topics if provided.\n"
            )

        generation_prompt = f"""You are an expert exam question writer. Generate questions following the EXACT blueprint below.

SOURCE CONTENT (all questions MUST be answerable from this):
{content[:10000]}
{custom_section}{reference_section}{topics_section}
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

        if not questions:
            return []

        validated = []

        for q in questions:
            if not q.get('question_text'):
                continue

            q.setdefault('question_type', 'multiple_choice')
            q.setdefault('difficulty', 'medium')
            q.setdefault('topic', 'General')
            q.setdefault('correct_answer', '')
            q.setdefault('options', [])
            q.setdefault('explanation', '')
            q.setdefault('points', 1)

            if q['difficulty'] not in ['easy', 'medium', 'hard']:
                q['difficulty'] = 'medium'

            if not isinstance(q['options'], list):
                q['options'] = []

            letter_only_options = {'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'}
            if q['options']:
                fixed_options = []
                has_letter_only = any(opt.strip() in letter_only_options for opt in q['options'])
                if has_letter_only:
                    if q['correct_answer'] and q['correct_answer'].strip() not in letter_only_options:
                        fixed_options = [q['correct_answer']]
                        for i in range(3):
                            fixed_options.append(f"Alternative answer {i + 1}")
                        q['options'] = fixed_options
                        logger.warning(f"Fixed letter-only options for question: {q['question_text'][:50]}...")

            if q['question_type'] == 'multiple_choice':
                if q['options'] and q['correct_answer'] not in q['options']:
                    found = False
                    for i, opt in enumerate(q['options']):
                        if opt.lower().strip() == q['correct_answer'].lower().strip():
                            q['correct_answer'] = opt
                            found = True
                            break
                    if not found:
                        q['options'][0] = q['correct_answer']

                while len(q['options']) < 4:
                    q['options'].append(f"Option {len(q['options']) + 1}")

            if q['question_type'] == 'true_false':
                q['options'] = ['True', 'False']
                if q['correct_answer'].lower() not in ['true', 'false']:
                    q['correct_answer'] = 'True'
                else:
                    q['correct_answer'] = q['correct_answer'].capitalize()

            validated.append(q)

        validated = validated[:target_count]

        logger.info(f"Validated {len(validated)} questions")
        return validated

    def _parse_questions_json(self, content: str) -> List[Dict[str, Any]]:

        try:
            return json.loads(content)
        except:
            pass

        try:
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        try:
            fixed = content
            fixed = re.sub(r',(\s*[\]\}])', r'\1', fixed)
            fixed = re.sub(r'(?<!\\)"(?=[^"]*"[^"]*":)', r'\\"', fixed)
            fixed = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', fixed)

            json_match = re.search(r'\[.*\]', fixed, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        try:
            questions = []
            pattern = r'\{[^{}]*"question_text"[^{}]*\}'
            matches = re.findall(pattern, content, re.DOTALL)

            for match in matches:
                try:
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

        try:
            questions = []
            parts = re.split(r'\},\s*\{', content)

            for i, part in enumerate(parts):
                try:
                    if not part.strip().startswith('{'):
                        part = '{' + part
                    if not part.strip().endswith('}'):
                        part = part + '}'

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

            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\n?', '', content, flags=re.DOTALL)
                content = re.sub(r'\n?```$', '', content, flags=re.DOTALL)
                content = content.strip()

            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                json_str = json_match.group()
                logger.info(f"Extracted JSON array: {json_str[:100]}")
                questions = json.loads(json_str)
            else:
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
