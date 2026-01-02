"""
Question Bank Agent
LangGraph-based agent for intelligent question bank management,
organization, search, and performance tracking.
"""

import logging
import json
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from dataclasses import dataclass

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager

logger = logging.getLogger(__name__)


class QuestionBankAgentState(AgentState):
    """State for question bank agent"""
    action: str
    question_set_id: Optional[int]
    question_ids: List[int]
    search_query: str
    filters: Dict[str, Any]
    questions: List[Dict[str, Any]]
    performance_data: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    organization_plan: Dict[str, Any]
    response_data: Dict[str, Any]
    # Generation-specific fields
    source_type: str
    source_id: Optional[Any]
    sources: List[Dict[str, Any]]
    content: str
    title: str
    question_count: int
    difficulty_mix: Dict[str, int]


class QuestionBankAgent(BaseAgent):
    """
    Question Bank Agent for:
    - Organizing and categorizing questions
    - Intelligent search and filtering
    - Performance tracking per question
    - Difficulty assessment
    - Topic clustering
    - Recommendation for review
    """
    
    def __init__(
        self,
        ai_client: Any,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        
        super().__init__(
            agent_type=AgentType.QUESTION_BANK,
            ai_client=ai_client,
            checkpointer=checkpointer or MemorySaver()
        )
        
        self._build_graph()
        logger.info("Question Bank Agent initialized")
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(QuestionBankAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("generate_questions", self._generate_questions)
        graph.add_node("search_questions", self._search_questions)
        graph.add_node("organize_questions", self._organize_questions)
        graph.add_node("analyze_performance", self._analyze_performance)
        graph.add_node("get_recommendations", self._get_recommendations)
        graph.add_node("categorize_questions", self._categorize_questions)
        graph.add_node("assess_difficulty", self._assess_difficulty)
        
        # Finalization
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("format_response", self._format_response)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "generate": "generate_questions",
                "search": "search_questions",
                "organize": "organize_questions",
                "analyze": "analyze_performance",
                "recommend": "get_recommendations",
                "categorize": "categorize_questions",
                "assess": "assess_difficulty"
            }
        )
        
        # All actions lead to memory update
        for action_node in ["generate_questions", "search_questions", "organize_questions", "analyze_performance", 
                           "get_recommendations", "categorize_questions", "assess_difficulty"]:
            graph.add_edge(action_node, "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        logger.info("Question Bank Agent graph compiled")
    
    def _get_action_route(self, state: QuestionBankAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "search")
        action_map = {
            "generate": "generate",
            "search": "search",
            "organize": "organize",
            "analyze": "analyze",
            "recommend": "recommend",
            "categorize": "categorize",
            "assess": "assess"
        }
        return action_map.get(action, "search")
    
    async def _parse_request(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Parse the user request"""
        action = state.get("action")
        
        # Initialize response_data if not present
        if "response_data" not in state or state.get("response_data") is None:
            state["response_data"] = {}
        
        # If action is explicitly set, use it
        if action and action in ["generate", "search", "organize", "analyze", "recommend", "categorize", "assess"]:
            state["execution_path"] = [f"qb:parse:{action}"]
            return state
        
        # Otherwise, try to detect from user_input
        user_input = state.get("user_input", "").lower()
        
        # Detect action from natural language
        if any(word in user_input for word in ["search", "find", "look for", "filter"]):
            state["action"] = "search"
        elif any(word in user_input for word in ["organize", "sort", "arrange", "group"]):
            state["action"] = "organize"
        elif any(word in user_input for word in ["analyze", "performance", "stats", "results"]):
            state["action"] = "analyze"
        elif any(word in user_input for word in ["recommend", "suggest", "review"]):
            state["action"] = "recommend"
        elif any(word in user_input for word in ["categorize", "category", "topic", "classify"]):
            state["action"] = "categorize"
        elif any(word in user_input for word in ["difficulty", "assess", "level"]):
            state["action"] = "assess"
        else:
            # Default to the action if set, otherwise search
            state["action"] = state.get("action", "search")
        
        state["execution_path"] = ["qb:parse"]
        return state
    
    async def _load_context(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Load context from memory"""
        user_id = state.get("user_id")
        
        if self.memory_manager and user_id:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="question_bank",
                    query=state.get("search_query", "")
                )
                state["memory_context"] = context
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        state["execution_path"].append("qb:context")
        return state
    
    async def _route_action(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"qb:route:{state.get('action')}")
        # Ensure response_data is preserved
        if "response_data" not in state:
            state["response_data"] = {}
        return state
    
    async def _generate_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Generate questions from various sources"""
        source_type = state.get("source_type", "custom")
        question_count = state.get("question_count", 10)
        difficulty_mix = state.get("difficulty_mix", {"easy": 3, "medium": 5, "hard": 2})
        user_id = state.get("user_id")
        
        logger.info(f"🚀 Generating {question_count} questions from {source_type} for user {user_id}")
        logger.info(f"🚀 State keys at start of _generate_questions: {list(state.keys())}")
        logger.info(f"🚀 response_data at start: {state.get('response_data')}")
        
        # Build generation prompt based on source type
        if source_type == "pdf":
            source_id = state.get("source_id")
            logger.info(f"🚀 PDF generation: source_id={source_id}")
            
            # Fetch PDF content from database
            pdf_content = ""
            if source_id and self.db_session_factory:
                try:
                    from sqlalchemy import text
                    session = self.db_session_factory()
                    get_doc = text("SELECT content FROM uploaded_documents WHERE id = :id LIMIT 1")
                    result = session.execute(get_doc, {"id": source_id})
                    doc_content = result.scalar()
                    if doc_content:
                        pdf_content = doc_content
                        logger.info(f"✅ Fetched PDF content: {len(pdf_content)} chars")
                    else:
                        logger.warning(f"No PDF content found for document {source_id}")
                except Exception as e:
                    logger.error(f"Failed to fetch PDF content: {e}", exc_info=True)
            else:
                logger.warning(f"Cannot fetch PDF: source_id={source_id}, db_factory={self.db_session_factory is not None}")
            
            if not pdf_content:
                logger.error("PDF content is empty, falling back to generic prompt")
                pdf_content = "[PDF content could not be retrieved]"
            
            prompt = f"""Generate {question_count} multiple choice questions ONLY from this PDF content. Do not generate random questions. Base every question on the provided content:

PDF Content:
{pdf_content}

Difficulty distribution:
- Easy: {difficulty_mix.get('easy', 3)} questions
- Medium: {difficulty_mix.get('medium', 5)} questions  
- Hard: {difficulty_mix.get('hard', 2)} questions

Format each question as JSON with:
- question: the question text
- options: array of 4 answer choices
- correct_answer: the EXACT TEXT of the correct option (not an index)
- difficulty: Easy, Medium, or Hard
- topic: the topic of the question

Return ONLY a JSON array, nothing else."""
        
        elif source_type == "multiple":
            sources = state.get("sources", [])
            logger.info(f"🚀 Multiple sources generation: {sources}")
            
            # Fetch actual content from each source
            all_content = []
            if self.db_session_factory:
                from sqlalchemy import text
                session = self.db_session_factory()
                
                for source in sources:
                    source_type_item = source.get('type')
                    source_id = source.get('id')
                    source_title = source.get('title', 'Unknown')
                    
                    try:
                        if source_type_item == 'chat':
                            # Fetch chat session messages
                            get_chat = text("""
                                SELECT user_message, ai_response FROM chat_messages 
                                WHERE chat_session_id = :session_id 
                                ORDER BY timestamp
                            """)
                            result = session.execute(get_chat, {"session_id": source_id})
                            messages = result.fetchall()
                            if messages:
                                chat_content = "\n".join([
                                    f"User: {m[0]}\nAI: {m[1]}" 
                                    for m in messages if m[0] or m[1]
                                ])
                                all_content.append(f"=== Chat Session: {source_title} ===\n{chat_content}")
                                logger.info(f"✅ Fetched chat content: {len(chat_content)} chars from {len(messages)} messages")
                            else:
                                logger.warning(f"No messages found for chat session {source_id}")
                        
                        elif source_type_item == 'slide':
                            # Fetch slide content
                            get_slide = text("""
                                SELECT extracted_text FROM uploaded_slides 
                                WHERE id = :id LIMIT 1
                            """)
                            result = session.execute(get_slide, {"id": source_id})
                            row = result.fetchone()
                            if row and row[0]:
                                slide_content = row[0]
                                all_content.append(f"=== Slide: {source_title} ===\n{slide_content}")
                                logger.info(f"✅ Fetched slide content: {len(slide_content)} chars")
                            else:
                                logger.warning(f"No content found for slide {source_id}")
                    except Exception as e:
                        logger.error(f"Failed to fetch {source_type_item} {source_id}: {e}", exc_info=True)
            
            combined_content = "\n\n".join(all_content) if all_content else "[No content could be retrieved from sources]"
            logger.info(f"📝 Combined content from {len(all_content)} sources: {len(combined_content)} chars")
            
            prompt = f"""Generate {question_count} multiple choice questions ONLY from this content. Do not generate random questions. Base every question on the provided content:

{combined_content}

Difficulty distribution:
- Easy: {difficulty_mix.get('easy', 3)} questions
- Medium: {difficulty_mix.get('medium', 5)} questions
- Hard: {difficulty_mix.get('hard', 2)} questions

Format each question as JSON with:
- question: the question text
- options: array of 4 answer choices
- correct_answer: the EXACT TEXT of the correct option (not an index)
- difficulty: Easy, Medium, or Hard
- topic: the topic of the question

Return ONLY a JSON array, nothing else."""
        
        else:  # custom
            content = state.get("content", "")
            title = state.get("title", "Custom")
            logger.info(f"🚀 Custom content generation: title={title}, content_length={len(content) if content else 0}")
            logger.info(f"🚀 Content preview: {content[:200] if content else 'EMPTY'}...")
            
            if not content or not content.strip():
                logger.error("❌ Custom content is empty!")
                content = "[No content provided]"
            
            prompt = f"""Generate {question_count} multiple choice questions ONLY from this content. Do not generate random questions. Base every question on the provided content:

Title: {title}
Content: {content}

Difficulty distribution:
- Easy: {difficulty_mix.get('easy', 3)} questions
- Medium: {difficulty_mix.get('medium', 5)} questions
- Hard: {difficulty_mix.get('hard', 2)} questions

Format each question as JSON with:
- question: the question text
- options: array of 4 answer choices
- correct_answer: the EXACT TEXT of the correct option (not an index)
- difficulty: Easy, Medium, or Hard
- topic: the topic of the question

Return ONLY a JSON array, nothing else."""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
            logger.info(f"📝 AI Response length: {len(response)} chars")
            
            # Parse JSON response
            import json
            try:
                # Extract JSON from response
                json_start = response.find('[')
                json_end = response.rfind(']') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    questions = json.loads(json_str)
                    logger.info(f"✅ Parsed {len(questions)} questions from AI response")
                else:
                    logger.warning("No JSON array found in response")
                    questions = []
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {e}")
                questions = []
            
            # Save questions to database
            if questions and self.db_session_factory:
                try:
                    await self._save_questions_to_db(user_id, questions, source_type, state)
                except Exception as e:
                    logger.error(f"Failed to save questions to DB: {e}", exc_info=True)
            elif not questions:
                logger.warning("No questions generated")
            elif not self.db_session_factory:
                logger.warning("No database session factory available")
            
            # Store questions in response_data so they're returned to frontend
            state["response_data"] = {
                "action": "generate",
                "source_type": source_type,
                "questions": questions,
                "question_count": len(questions),
                "raw_response": response[:500]  # Truncate for logging
            }
            
            logger.info(f"✅ Set response_data with {len(questions)} questions")
            logger.info(f"✅ response_data after setting: {state.get('response_data')}")
            logger.info(f"✅ State keys after setting response_data: {list(state.keys())}")
        except Exception as e:
            logger.error(f"Generation failed: {e}", exc_info=True)
            state["response_data"] = {"action": "generate", "error": str(e), "questions": []}
        
        state["execution_path"].append("qb:generate")
        return state
    
    async def _save_questions_to_db(self, user_id: str, questions: List[Dict], source_type: str, state: QuestionBankAgentState):
        """Save generated questions to database"""
        try:
            if not self.db_session_factory:
                logger.warning("No database session factory available")
                return
            
            import json
            from sqlalchemy import text
            
            session = self.db_session_factory()
            
            # Convert user_id to integer if it's a string email
            try:
                numeric_user_id = int(user_id)
            except (ValueError, TypeError):
                # If user_id is an email, query the database to get the numeric ID
                get_user_id = text("SELECT id FROM users WHERE email = :email OR username = :email LIMIT 1")
                result = session.execute(get_user_id, {"email": user_id})
                numeric_user_id = result.scalar()
                
                if not numeric_user_id:
                    logger.error(f"Could not find user with ID/email: {user_id}")
                    return
            
            title = state.get("title") or f"Generated {source_type} Questions"
            logger.info(f"📝 Creating question set with title: {title}")
            
            # Insert question set
            insert_set = text("""
                INSERT INTO question_sets (user_id, title, description, source_type, total_questions, best_score, attempts, created_at, updated_at)
                VALUES (:user_id, :title, :description, :source_type, :total_questions, 0, 0, datetime('now'), datetime('now'))
            """)
            
            session.execute(insert_set, {
                "user_id": numeric_user_id,
                "title": title,
                "description": f"Generated from {source_type}",
                "source_type": source_type,
                "total_questions": len(questions)
            })
            
            session.commit()
            
            # Get the inserted set ID using last_insert_rowid() for SQLite
            get_set_id = text("SELECT last_insert_rowid()")
            result = session.execute(get_set_id)
            set_id = result.scalar()
            
            if not set_id:
                # Fallback to query by user_id and created_at
                get_set_id = text("""
                    SELECT id FROM question_sets 
                    WHERE user_id = :user_id 
                    ORDER BY created_at DESC LIMIT 1
                """)
                result = session.execute(get_set_id, {"user_id": numeric_user_id})
                set_id = result.scalar()
            
            if not set_id:
                logger.error("Failed to get inserted question set ID")
                return
            
            logger.info(f"Created question set {set_id} for user {numeric_user_id}")
            
            # Insert questions - without created_at since the table doesn't have it
            for idx, q in enumerate(questions):
                options_json = json.dumps(q.get("options", []))
                correct_answer = q.get("correct_answer", "")
                question_text = q.get("question", "")
                
                logger.info(f"📝 Saving question {idx+1}: text={question_text[:50]}..., options={options_json[:100]}...")
                
                insert_q = text("""
                    INSERT INTO questions (question_set_id, question_text, question_type, difficulty, topic, correct_answer, options, order_index)
                    VALUES (:set_id, :question_text, :question_type, :difficulty, :topic, :correct_answer, :options, :order_index)
                """)
                
                session.execute(insert_q, {
                    "set_id": set_id,
                    "question_text": question_text,
                    "question_type": "multiple_choice",
                    "difficulty": q.get("difficulty", "medium"),
                    "topic": q.get("topic", "General"),
                    "correct_answer": correct_answer,
                    "options": options_json,
                    "order_index": idx
                })
                
                if (idx + 1) % 5 == 0:
                    session.commit()
                    logger.info(f"Saved {idx + 1}/{len(questions)} questions")
            
            session.commit()
            
            # Verify questions were saved
            verify_q = text("SELECT COUNT(*) FROM questions WHERE question_set_id = :set_id")
            result = session.execute(verify_q, {"set_id": set_id})
            saved_count = result.scalar()
            logger.info(f"✅ Verified {saved_count} questions saved to set {set_id} for user {user_id}")
            
            if saved_count == 0:
                logger.error(f"❌ No questions were saved to set {set_id}!")
            
        except Exception as e:
            logger.error(f"❌ Database save error: {e}", exc_info=True)
            try:
                session.rollback()
            except:
                pass
    
    async def _search_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Search questions by query and filters"""
        search_query = state.get("search_query", "")
        filters = state.get("filters", {})
        
        # Build search prompt
        prompt = f"""Search and filter questions based on:
Query: {search_query}
Filters: {json.dumps(filters)}

Return relevant questions with:
- Relevance score (0-1)
- Match reason
- Suggested tags
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.5)
            state["response_data"] = {
                "action": "search",
                "query": search_query,
                "filters": filters,
                "search_results": response
            }
        except Exception as e:
            logger.error(f"Search failed: {e}")
            state["response_data"] = {"action": "search", "error": str(e)}
        
        state["execution_path"].append("qb:search")
        return state
    
    async def _organize_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Organize questions into logical groups"""
        questions = state.get("questions", [])
        
        prompt = f"""Organize these {len(questions)} questions into logical groups:

Questions: {json.dumps(questions[:5])}... (showing first 5)

Suggest:
1. Topic groupings
2. Difficulty progression
3. Learning sequence
4. Related concepts
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
            state["response_data"] = {
                "action": "organize",
                "total_questions": len(questions),
                "organization_plan": response
            }
        except Exception as e:
            logger.error(f"Organization failed: {e}")
            state["response_data"] = {"action": "organize", "error": str(e)}
        
        state["execution_path"].append("qb:organize")
        return state
    
    async def _analyze_performance(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Analyze performance on questions"""
        performance_data = state.get("performance_data", {})
        
        prompt = f"""Analyze question performance data:

Performance: {json.dumps(performance_data)}

Provide:
1. Accuracy by difficulty
2. Time efficiency
3. Common mistakes
4. Improvement areas
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=600, temperature=0.5)
            state["response_data"] = {
                "action": "analyze",
                "analysis": response
            }
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            state["response_data"] = {"action": "analyze", "error": str(e)}
        
        state["execution_path"].append("qb:analyze")
        return state
    
    async def _get_recommendations(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Get recommendations for question review"""
        performance_data = state.get("performance_data", {})
        
        prompt = f"""Based on performance data, recommend questions to review:

Performance: {json.dumps(performance_data)}

Suggest:
1. Questions to review (weak areas)
2. Practice questions (similar difficulty)
3. Challenge questions (next level)
4. Review schedule
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=700, temperature=0.7)
            state["response_data"] = {
                "action": "recommend",
                "recommendations": response
            }
        except Exception as e:
            logger.error(f"Recommendation failed: {e}")
            state["response_data"] = {"action": "recommend", "error": str(e)}
        
        state["execution_path"].append("qb:recommend")
        return state
    
    async def _categorize_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Categorize questions by topic and concept"""
        questions = state.get("questions", [])
        
        prompt = f"""Categorize these questions by topic and concept:

Questions: {json.dumps(questions[:10])}

Provide:
1. Topic categories
2. Concept relationships
3. Prerequisite knowledge
4. Learning path
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
            state["response_data"] = {
                "action": "categorize",
                "categories": response
            }
        except Exception as e:
            logger.error(f"Categorization failed: {e}")
            state["response_data"] = {"action": "categorize", "error": str(e)}
        
        state["execution_path"].append("qb:categorize")
        return state
    
    async def _assess_difficulty(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Assess and validate question difficulty levels"""
        questions = state.get("questions", [])
        
        prompt = f"""Assess the difficulty of these questions:

Questions: {json.dumps(questions[:10])}

For each question, provide:
1. Assessed difficulty (easy/medium/hard)
2. Reasoning
3. Cognitive level (Bloom's taxonomy)
4. Estimated time to solve
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=900, temperature=0.5)
            state["response_data"] = {
                "action": "assess",
                "difficulty_assessment": response
            }
        except Exception as e:
            logger.error(f"Assessment failed: {e}")
            state["response_data"] = {"action": "assess", "error": str(e)}
        
        state["execution_path"].append("qb:assess")
        return state
    
    async def _update_memory(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Update memory with question bank interaction"""
        user_id = state.get("user_id")
        action = state.get("action")
        response_data = state.get("response_data", {})
        
        logger.info(f"🔍 _update_memory: action={action}")
        logger.info(f"🔍 _update_memory: response_data={response_data}")
        logger.info(f"🔍 _update_memory: response_data type={type(response_data)}")
        logger.info(f"🔍 _update_memory: full state keys={list(state.keys())}")
        
        if self.memory_manager and user_id:
            try:
                # Store the interaction as a memory
                await self.memory_manager.store(
                    user_id=user_id,
                    memory_type="question_bank_action",  # Custom type
                    content=f"Question Bank {action}: {json.dumps(response_data)}",
                    metadata={
                        "action": action,
                        "response_data": response_data
                    },
                    source_agent="question_bank"
                )
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("qb:memory")
        return state
    
    async def _format_response(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Format the final response"""
        action = state.get("action", "search")
        response_data = state.get("response_data", {})
        
        logger.info(f"🔍 _format_response: action={action}, response_data keys={list(response_data.keys())}")
        logger.info(f"🔍 response_data content: {response_data}")
        
        if action == "generate":
            question_count = response_data.get('question_count', 0)
            state["final_response"] = f"Generated {question_count} questions successfully."
        elif action == "search":
            state["final_response"] = "Search completed. Found relevant questions."
        elif action == "organize":
            state["final_response"] = "Questions organized into logical groups."
        elif action == "analyze":
            state["final_response"] = "Performance analysis complete."
        elif action == "recommend":
            state["final_response"] = "Review recommendations generated."
        elif action == "categorize":
            state["final_response"] = "Questions categorized by topic."
        elif action == "assess":
            state["final_response"] = "Difficulty assessment complete."
        else:
            state["final_response"] = "Question bank action completed."
        
        state["response_metadata"] = {
            "action": action,
            "success": True,
            "response_data": response_data
        }
        
        logger.info(f"✅ _format_response: final response_metadata={state['response_metadata']}")
        
        state["execution_path"].append("qb:format")
        return state
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process and validate input"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute main logic"""
        return state


def create_question_bank_agent(
    ai_client,
    memory_manager=None,
    db_session_factory=None
) -> QuestionBankAgent:
    """Factory function to create question bank agent"""
    return QuestionBankAgent(
        ai_client=ai_client,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
