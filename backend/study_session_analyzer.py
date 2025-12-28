"""
Study Session Analyzer - AI-powered analysis of user's study sessions
Reads actual chat messages and uses AI to extract topics
"""
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any
from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)


class StudySessionAnalyzer:
    """Analyzes user study sessions using AI"""
    
    def __init__(self, db: Session, user_id: int, ai_client=None):
        self.db = db
        self.user_id = user_id
        self.ai_client = ai_client
    
    def get_last_session_data(self) -> Dict[str, Any]:
        """Get data from user's current session"""
        try:
            user = self.db.query(models.User).filter(models.User.id == self.user_id).first()
            if not user:
                return {"error": "User not found"}
            
            now = datetime.utcnow()
            
            # Get session start time from last_login
            if user.last_login:
                session_start = user.last_login
                if hasattr(session_start, 'tzinfo') and session_start.tzinfo:
                    session_start = session_start.replace(tzinfo=None)
            else:
                # No login recorded, use last 24 hours
                session_start = now - timedelta(hours=24)
            
            logger.info(f"=== SESSION ANALYSIS ===")
            logger.info(f"User ID: {self.user_id}")
            logger.info(f"Session start (last_login): {session_start}")
            logger.info(f"Current time: {now}")
            
            # Get actual chat messages from database since last login
            messages = self.db.query(models.ChatMessage).join(
                models.ChatSession
            ).filter(
                models.ChatSession.user_id == self.user_id,
                models.ChatMessage.timestamp >= session_start
            ).order_by(models.ChatMessage.timestamp.desc()).limit(50).all()
            
            logger.info(f"Found {len(messages)} messages since last login")
            
            # Extract user questions - THE ACTUAL QUESTIONS ASKED
            user_questions = []
            for msg in messages:
                if msg.user_message and len(msg.user_message.strip()) > 3:
                    q = msg.user_message.strip()
                    user_questions.append(q)
                    logger.info(f"User asked: {q[:80]}...")
            
            # If no messages in this session, return empty data
            if not user_questions:
                logger.info("No questions found in current session")
                return {
                    "session_start": session_start.isoformat(),
                    "session_end": now.isoformat(),
                    "chat_data": {
                        "total_messages": 0,
                        "topics_studied": [],
                        "math_problems": [],
                        "user_questions": []
                    },
                    "user_name": user.first_name or user.username
                }
            
            # Use AI to analyze the ACTUAL questions and extract topics
            topics = []
            problems = []
            
            if self.ai_client and user_questions:
                logger.info(f"Sending {len(user_questions)} questions to AI for analysis...")
                analysis = self._analyze_with_ai(user_questions)
                topics = analysis.get("topics", [])
                problems = analysis.get("problems", [])
                logger.info(f"AI extracted topics: {[t['name'] for t in topics]}")
                logger.info(f"AI extracted problems: {[p['expression'] for p in problems]}")
            else:
                logger.warning("No AI client available, skipping topic extraction")
            
            return {
                "session_start": session_start.isoformat(),
                "session_end": now.isoformat(),
                "chat_data": {
                    "total_messages": len(messages),
                    "topics_studied": topics,
                    "math_problems": problems,
                    "user_questions": user_questions[:15]  # Return more questions
                },
                "user_name": user.first_name or user.username
            }
            
        except Exception as e:
            logger.error(f"Error in get_last_session_data: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}
    
    def _analyze_with_ai(self, questions: List[str]) -> Dict[str, Any]:
        """Use AI to analyze questions and extract topics"""
        if not self.ai_client:
            logger.warning("No AI client - cannot analyze questions")
            return {"topics": [], "problems": []}
        
        # Format the ACTUAL questions for AI
        questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions[:25])])
        
        prompt = f"""Analyze these EXACT student questions and extract the topics they studied.

STUDENT'S ACTUAL QUESTIONS:
{questions_text}

Return a JSON object with topics and math/science expressions found:
{{
  "topics": [
    {{"name": "Topic Name", "count": number_of_questions_about_this}}
  ],
  "problems": ["math expression 1", "chemical formula 1", "equation 1"]
}}

RULES:
1. Extract topics ONLY from the questions above - do NOT invent topics
2. Use specific topic names from the questions (e.g., "Benzene", "Newton's Laws", "Integration")
3. For math: extract expressions like "integral of x^2", "x-4/(x-3)", "derivative of sin(x)"
4. For chemistry: extract formulas like "HCl + NaOH", "C6H6", "H2SO4"
5. For physics: extract concepts like "Newton's Laws", "momentum", "kinetic energy"
6. Count how many questions relate to each topic
7. Be accurate - only include what's actually in the questions

Return ONLY valid JSON."""

        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.1)
            response = response.strip()
            
            logger.info(f"AI response for topic extraction: {response[:300]}...")
            
            # Clean JSON from markdown code blocks
            if "```" in response:
                # Extract content between code blocks
                match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
                if match:
                    response = match.group(1).strip()
                else:
                    # Fallback: find JSON object
                    start = response.find("{")
                    end = response.rfind("}") + 1
                    if start >= 0 and end > start:
                        response = response[start:end]
            else:
                # Find JSON object directly
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    response = response[start:end]
            
            result = json.loads(response)
            
            # Parse topics
            topics = []
            for t in result.get("topics", []):
                if isinstance(t, dict) and t.get("name"):
                    name = t["name"].strip()
                    if name and len(name) > 1:
                        topics.append({
                            "name": name,
                            "count": int(t.get("count", 1))
                        })
            
            # Parse problems/expressions
            problems = []
            for p in result.get("problems", []):
                if isinstance(p, str) and p.strip():
                    expr = p.strip()
                    if len(expr) > 1:
                        problems.append({"expression": expr})
            
            logger.info(f"Extracted {len(topics)} topics and {len(problems)} problems")
            return {"topics": topics, "problems": problems}
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Response was: {response[:500]}")
            return {"topics": [], "problems": []}
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            import traceback
            traceback.print_exc()
            return {"topics": [], "problems": []}
    
    def generate_session_summary(self) -> Dict[str, Any]:
        """Generate session summary"""
        session_data = self.get_last_session_data()
        
        if "error" in session_data:
            return session_data
        
        chat_data = session_data.get("chat_data", {})
        
        return {
            "user_name": session_data.get("user_name", "Student"),
            "session_period": {
                "start": session_data.get("session_start"),
                "end": session_data.get("session_end")
            },
            "summary": {
                "chat_messages": chat_data.get("total_messages", 0),
            },
            "specific_topics": chat_data.get("topics_studied", []),
            "math_problems": chat_data.get("math_problems", []),
            "user_questions": chat_data.get("user_questions", [])
        }
    
    async def generate_ai_summary(self) -> str:
        """Generate AI summary of the session"""
        session_data = self.get_last_session_data()
        chat_data = session_data.get("chat_data", {})
        
        total = chat_data.get("total_messages", 0)
        topics = chat_data.get("topics_studied", [])
        questions = chat_data.get("user_questions", [])
        
        if total == 0:
            return "No study activity detected in this session. Start chatting with the AI tutor to see your insights here."
        
        if not self.ai_client:
            topic_names = [t["name"] for t in topics]
            return f"You studied {', '.join(topic_names[:3])} with {total} messages."
        
        # Use AI to generate summary based on ACTUAL questions
        questions_preview = "\n".join([f"- {q}" for q in questions[:8]])
        topic_names = [t["name"] for t in topics]
        
        prompt = f"""Write a 2-3 sentence summary of this study session. Use "you" and "your".

THE ACTUAL QUESTIONS THE STUDENT ASKED:
{questions_preview}

Topics identified: {', '.join(topic_names) if topic_names else 'Various topics'}
Total messages: {total}

Write a summary that mentions the SPECIFIC topics they studied (like benzene, Newton's laws, etc).
Be specific and accurate to what they actually asked about."""

        try:
            response = self.ai_client.generate(prompt, max_tokens=150, temperature=0.7)
            return response.strip()
        except:
            return f"You studied {', '.join(topic_names[:3])} with {total} messages."


def get_study_session_analyzer(db: Session, user_id: int, ai_client=None) -> StudySessionAnalyzer:
    return StudySessionAnalyzer(db, user_id, ai_client)
