"""
Learning Path Agent - Duolingo-style Learning Path Generation and Management
Generates structured learning journeys with progressive unlocking
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

import models

logger = logging.getLogger(__name__)

class LearningPathAgent:
    """Agent for generating and managing learning paths"""
    
    def __init__(self, ai_client=None):
        self.name = "LearningPathAgent"
        self.description = "Generates structured learning paths with progressive unlocking"
        self.version = "1.0.0"
        self.ai_client = ai_client
        logger.info(f"Initialized {self.name} v{self.version} with AI client: {ai_client is not None}")
    
    def process(self, user_input: str, context: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Process learning path requests"""
        action = context.get("action", "generate")
        user_id = context.get("user_id")
        
        if not user_id:
            return {"error": "user_id required"}
        
        if action == "generate":
            return self.generate_path(user_input, context, db)
        elif action == "get_paths":
            return self.get_user_paths(user_id, db)
        elif action == "get_path":
            path_id = context.get("path_id")
            return self.get_path_details(path_id, user_id, db)
        elif action == "start_node":
            return self.start_node(context.get("node_id"), user_id, db)
        elif action == "complete_node":
            return self.complete_node(context.get("node_id"), user_id, context, db)
        elif action == "evaluate_node":
            return self.evaluate_node_completion(context.get("node_id"), user_id, db)
        elif action == "generate_content":
            return self.generate_node_content(context, db)
        else:
            return {"error": f"Unknown action: {action}"}
    
    def generate_path(self, topic_prompt: str, context: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Generate a new learning path from a topic prompt"""
        user_id = context.get("user_id")
        difficulty = context.get("difficulty", "intermediate")
        length = context.get("length", "medium")  # short/medium/long
        goals = context.get("goals", [])
        
        logger.info(f"Generating learning path for topic: {topic_prompt}")
        
        # Determine number of nodes based on length
        node_count_map = {"short": 5, "medium": 8, "long": 12}
        target_nodes = node_count_map.get(length, 8)
        
        # Build AI prompt for path generation
        generation_prompt = self._build_generation_prompt(
            topic_prompt, difficulty, target_nodes, goals
        )
        
        try:
            # Call AI to generate path structure
            ai_response = self._call_ai(generation_prompt)
            path_data = self._parse_ai_response(ai_response)
            
            # Create database records
            path = self._create_path_in_db(user_id, topic_prompt, path_data, difficulty, db)
            
            return {
                "success": True,
                "path_id": path.id,
                "path": self._serialize_path(path, db),
                "message": f"Created learning path with {len(path.nodes)} nodes"
            }
        
        except Exception as e:
            logger.error(f"Error generating path: {e}")
            return {"error": str(e)}
    
    def _build_generation_prompt(self, topic: str, difficulty: str, node_count: int, goals: List[str]) -> str:
        """Build prompt for AI path generation"""
        goals_text = "\n".join([f"- {g}" for g in goals]) if goals else "General mastery of the topic"
        
        return f"""Generate a structured learning path for the SPECIFIC topic: "{topic}"

CRITICAL: This learning path MUST be specifically about "{topic}" and nothing else.

Difficulty Level: {difficulty}
Target Nodes: {node_count}
Learning Goals:
{goals_text}

Create a progressive learning journey similar to Duolingo's structure for learning {topic}. Each node should build on previous knowledge about {topic}.

Return ONLY valid JSON in this exact format:
{{
  "title": "Path title (max 100 chars)",
  "description": "Brief description of what learner will achieve",
  "estimated_hours": 10.5,
  "nodes": [
    {{
      "order_index": 0,
      "title": "Node title",
      "description": "What this node covers",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "estimated_minutes": 45,
      "activities": [
        {{"type": "notes", "description": "Read about X"}},
        {{"type": "flashcards", "count": 10, "description": "Review key terms"}},
        {{"type": "quiz", "question_count": 5, "description": "Test understanding"}},
        {{"type": "chat", "prompt": "Discuss Y with AI"}}
      ],
      "unlock_rule": {{
        "type": "sequential",
        "min_xp": 50,
        "required_activities": ["quiz"]
      }},
      "reward": {{
        "xp": 50,
        "badge": null
      }}
    }}
  ]
}}

Requirements:
- First node should be unlocked by default (no prerequisites)
- Each subsequent node requires previous node completion
- Activities should progress from passive (notes) to active (quiz)
- XP rewards should increase with difficulty
- Include 3-6 objectives per node
- Estimated time should be realistic (20-60 minutes per node)
"""
    
    def _parse_ai_response(self, ai_response: str) -> Dict[str, Any]:
        """Parse and validate AI response"""
        try:
            # Extract JSON from response
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}') + 1
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = ai_response[json_start:json_end]
            data = json.loads(json_str)
            
            # Validate structure
            required_fields = ["title", "description", "nodes"]
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            if not isinstance(data["nodes"], list) or len(data["nodes"]) == 0:
                raise ValueError("Nodes must be a non-empty list")
            
            # Validate each node
            for i, node in enumerate(data["nodes"]):
                node_required = ["title", "description", "objectives", "activities"]
                for field in node_required:
                    if field not in node:
                        raise ValueError(f"Node {i} missing field: {field}")
                
                # Set defaults
                node.setdefault("order_index", i)
                node.setdefault("estimated_minutes", 30)
                node.setdefault("unlock_rule", {"type": "sequential"})
                node.setdefault("reward", {"xp": 50})
            
            return data
        
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            raise ValueError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Validation error: {e}")
            raise
    
    def _create_path_in_db(self, user_id: int, topic_prompt: str, path_data: Dict, difficulty: str, db: Session):
        """Create learning path and nodes in database"""
        # Create main path
        path = models.LearningPath(
            user_id=user_id,
            title=path_data["title"],
            topic_prompt=topic_prompt,
            description=path_data.get("description", ""),
            difficulty=difficulty,
            status="active",
            total_nodes=len(path_data["nodes"]),
            completed_nodes=0,
            estimated_hours=path_data.get("estimated_hours", sum(n.get("estimated_minutes", 30) for n in path_data["nodes"]) / 60.0)
        )
        db.add(path)
        db.flush()
        
        # Create nodes
        for node_data in path_data["nodes"]:
            node = models.LearningPathNode(
                path_id=path.id,
                order_index=node_data["order_index"],
                title=node_data["title"],
                description=node_data.get("description", ""),
                objectives=node_data.get("objectives", []),
                estimated_minutes=node_data.get("estimated_minutes", 30),
                content_plan=node_data.get("activities", []),
                unlock_rule=node_data.get("unlock_rule", {}),
                reward=node_data.get("reward", {"xp": 50})
            )
            db.add(node)
        
        db.flush()
        
        # Create progress tracker
        progress = models.LearningPathProgress(
            path_id=path.id,
            user_id=user_id,
            current_node_index=0,
            total_xp_earned=0,
            completion_percentage=0.0
        )
        db.add(progress)
        
        # Create node progress records (first node unlocked, rest locked)
        for i, node in enumerate(path.nodes):
            node_progress = models.LearningNodeProgress(
                node_id=node.id,
                user_id=user_id,
                status="unlocked" if i == 0 else "locked",
                progress_pct=0,
                xp_earned=0,
                evidence={}
            )
            db.add(node_progress)
        
        db.commit()
        db.refresh(path)
        
        return path
    
    def get_user_paths(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Get all learning paths for a user (excluding archived)"""
        paths = db.query(models.LearningPath).filter(
            models.LearningPath.user_id == user_id,
            models.LearningPath.status != "archived"
        ).order_by(models.LearningPath.created_at.desc()).all()
        
        return {
            "paths": [self._serialize_path(p, db) for p in paths]
        }
    
    def get_path_details(self, path_id: str, user_id: int, db: Session) -> Dict[str, Any]:
        """Get detailed information about a specific path"""
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            return {"error": "Path not found"}
        
        # Update last accessed
        path.last_accessed = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "path": self._serialize_path(path, db, include_nodes=True)
        }
    
    def start_node(self, node_id: str, user_id: int, db: Session) -> Dict[str, Any]:
        """Mark a node as started"""
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            return {"error": "Node progress not found"}
        
        if node_progress.status == "locked":
            return {"error": "Node is locked"}
        
        if node_progress.status == "unlocked":
            node_progress.status = "in_progress"
            node_progress.started_at = datetime.now(timezone.utc)
            db.commit()
        
        return {"success": True, "status": node_progress.status}
    
    def complete_node(self, node_id: str, user_id: int, context: Dict, db: Session) -> Dict[str, Any]:
        """Complete a node and unlock next node"""
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            return {"error": "Node progress not found"}
        
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id
        ).first()
        
        if not node:
            return {"error": "Node not found"}
        
        # Check if already completed
        if node_progress.status == "completed":
            return {"success": True, "message": "Node already completed"}
        
        # Mark as completed
        node_progress.status = "completed"
        node_progress.completed_at = datetime.now(timezone.utc)
        node_progress.progress_pct = 100
        
        # Award XP
        reward_xp = node.reward.get("xp", 50) if node.reward else 50
        node_progress.xp_earned = reward_xp
        
        # Update path progress
        path_progress = db.query(models.LearningPathProgress).filter(
            models.LearningPathProgress.path_id == node.path_id,
            models.LearningPathProgress.user_id == user_id
        ).first()
        
        if path_progress:
            path_progress.total_xp_earned += reward_xp
            path_progress.current_node_index = node.order_index + 1
            
            # Update path completed nodes count
            path = db.query(models.LearningPath).filter(
                models.LearningPath.id == node.path_id
            ).first()
            
            if path:
                path.completed_nodes += 1
                path_progress.completion_percentage = (path.completed_nodes / path.total_nodes) * 100
                
                # Check if path is complete
                if path.completed_nodes >= path.total_nodes:
                    path.status = "completed"
        
        # Unlock next node
        next_node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.path_id == node.path_id,
            models.LearningPathNode.order_index == node.order_index + 1
        ).first()
        
        if next_node:
            next_progress = db.query(models.LearningNodeProgress).filter(
                models.LearningNodeProgress.node_id == next_node.id,
                models.LearningNodeProgress.user_id == user_id
            ).first()
            
            if next_progress and next_progress.status == "locked":
                next_progress.status = "unlocked"
        
        db.commit()
        
        # Award gamification points
        try:
            from gamification_system import award_points
            award_points(db, user_id, "learning_path_node", {"xp": reward_xp, "node_id": node_id})
        except Exception as e:
            logger.warning(f"Could not award gamification points: {e}")
        
        return {
            "success": True,
            "xp_earned": reward_xp,
            "next_node_unlocked": next_node is not None,
            "path_completed": path.status == "completed" if path else False
        }
    
    def evaluate_node_completion(self, node_id: str, user_id: int, db: Session) -> Dict[str, Any]:
        """Evaluate if a node's completion requirements are met"""
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id
        ).first()
        
        if not node:
            return {"error": "Node not found"}
        
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            return {"error": "Node progress not found"}
        
        # Check unlock rules
        unlock_rule = node.unlock_rule or {}
        requirements_met = True
        missing_requirements = []
        
        # Check minimum XP
        min_xp = unlock_rule.get("min_xp", 0)
        if node_progress.xp_earned < min_xp:
            requirements_met = False
            missing_requirements.append(f"Need {min_xp - node_progress.xp_earned} more XP")
        
        # Check required activities
        required_activities = unlock_rule.get("required_activities", [])
        evidence = node_progress.evidence or {}
        for activity in required_activities:
            if activity not in evidence or not evidence[activity].get("completed"):
                requirements_met = False
                missing_requirements.append(f"Complete {activity} activity")
        
        # Calculate progress percentage
        total_activities = len(node.content_plan) if node.content_plan else 1
        completed_activities = sum(1 for a in (node.content_plan or []) if evidence.get(a.get("type"), {}).get("completed"))
        progress_pct = int((completed_activities / total_activities) * 100) if total_activities > 0 else 0
        
        node_progress.progress_pct = progress_pct
        db.commit()
        
        return {
            "can_complete": requirements_met,
            "progress_pct": progress_pct,
            "missing_requirements": missing_requirements,
            "completed_activities": completed_activities,
            "total_activities": total_activities
        }
    
    def _serialize_path(self, path, db: Session, include_nodes: bool = False) -> Dict[str, Any]:
        """Serialize path to JSON"""
        progress = db.query(models.LearningPathProgress).filter(
            models.LearningPathProgress.path_id == path.id
        ).first()
        
        result = {
            "id": path.id,
            "title": path.title,
            "description": path.description,
            "topic_prompt": path.topic_prompt,
            "difficulty": path.difficulty,
            "status": path.status,
            "total_nodes": path.total_nodes,
            "completed_nodes": path.completed_nodes,
            "estimated_hours": path.estimated_hours,
            "progress": {
                "current_node_index": progress.current_node_index if progress else 0,
                "total_xp_earned": progress.total_xp_earned if progress else 0,
                "completion_percentage": progress.completion_percentage if progress else 0.0
            },
            "created_at": path.created_at.isoformat() if path.created_at else None,
            "last_accessed": path.last_accessed.isoformat() if path.last_accessed else None
        }
        
        if include_nodes:
            nodes_data = []
            for node in sorted(path.nodes, key=lambda n: n.order_index):
                node_progress = db.query(models.LearningNodeProgress).filter(
                    models.LearningNodeProgress.node_id == node.id
                ).first()
                
                nodes_data.append({
                    "id": node.id,
                    "order_index": node.order_index,
                    "title": node.title,
                    "description": node.description,
                    "objectives": node.objectives,
                    "estimated_minutes": node.estimated_minutes,
                    "content_plan": node.content_plan,
                    "unlock_rule": node.unlock_rule,
                    "reward": node.reward,
                    "progress": {
                        "status": node_progress.status if node_progress else "locked",
                        "progress_pct": node_progress.progress_pct if node_progress else 0,
                        "xp_earned": node_progress.xp_earned if node_progress else 0,
                        "started_at": node_progress.started_at.isoformat() if node_progress and node_progress.started_at else None,
                        "completed_at": node_progress.completed_at.isoformat() if node_progress and node_progress.completed_at else None
                    }
                })
            
            result["nodes"] = nodes_data
        
        return result
    
    def _call_ai(self, prompt: str) -> str:
        """Call AI service to generate content"""
        try:
            # Use the AI client if available
            if self.ai_client:
                logger.info("Using provided AI client")
                response = self.ai_client.generate(prompt)
                return response
            
            # Try to get from main module
            import sys
            if 'main' in sys.modules:
                main_module = sys.modules['main']
                if hasattr(main_module, 'unified_ai'):
                    logger.info("Using unified_ai from main module")
                    response = main_module.unified_ai.generate(prompt)
                    return response
            
            # Fallback
            logger.warning("No AI client available, using fallback")
            return self._get_fallback_response()
        
        except Exception as e:
            logger.error(f"AI call failed: {e}")
            return self._get_fallback_response()
    
    def _get_fallback_response(self) -> str:
        """Fallback response if AI fails - creates a basic but useful path"""
        return json.dumps({
            "title": "Learning Path",
            "description": "A structured learning journey to master your topic",
            "estimated_hours": 4.0,
            "nodes": [
                {
                    "order_index": 0,
                    "title": "Getting Started",
                    "description": "Introduction to the fundamentals and core concepts",
                    "objectives": [
                        "Understand the basic terminology and concepts",
                        "Learn the foundational principles",
                        "Set clear learning goals"
                    ],
                    "estimated_minutes": 30,
                    "activities": [
                        {"type": "notes", "description": "Read introductory materials"},
                        {"type": "flashcards", "count": 8, "description": "Review key terms"},
                        {"type": "quiz", "question_count": 5, "description": "Test your understanding"}
                    ],
                    "unlock_rule": {"type": "sequential"},
                    "reward": {"xp": 50}
                },
                {
                    "order_index": 1,
                    "title": "Core Concepts",
                    "description": "Deep dive into the main topics and principles",
                    "objectives": [
                        "Master the core concepts",
                        "Apply knowledge to practical examples",
                        "Build confidence with the material"
                    ],
                    "estimated_minutes": 45,
                    "activities": [
                        {"type": "notes", "description": "Study core concepts in detail"},
                        {"type": "flashcards", "count": 12, "description": "Practice key concepts"},
                        {"type": "quiz", "question_count": 8, "description": "Test comprehension"},
                        {"type": "chat", "prompt": "Discuss what you've learned"}
                    ],
                    "unlock_rule": {"type": "sequential", "min_xp": 50},
                    "reward": {"xp": 75}
                },
                {
                    "order_index": 2,
                    "title": "Practice & Application",
                    "description": "Apply your knowledge through hands-on practice",
                    "objectives": [
                        "Apply concepts to real scenarios",
                        "Solve practice problems",
                        "Develop practical skills"
                    ],
                    "estimated_minutes": 60,
                    "activities": [
                        {"type": "notes", "description": "Review application strategies"},
                        {"type": "flashcards", "count": 15, "description": "Practice problem-solving"},
                        {"type": "quiz", "question_count": 10, "description": "Challenge yourself"}
                    ],
                    "unlock_rule": {"type": "sequential", "min_xp": 75},
                    "reward": {"xp": 100}
                },
                {
                    "order_index": 3,
                    "title": "Advanced Topics",
                    "description": "Explore advanced concepts and techniques",
                    "objectives": [
                        "Master advanced techniques",
                        "Understand complex relationships",
                        "Prepare for expert-level knowledge"
                    ],
                    "estimated_minutes": 45,
                    "activities": [
                        {"type": "notes", "description": "Study advanced materials"},
                        {"type": "flashcards", "count": 12, "description": "Review advanced concepts"},
                        {"type": "quiz", "question_count": 10, "description": "Test advanced knowledge"},
                        {"type": "chat", "prompt": "Discuss advanced applications"}
                    ],
                    "unlock_rule": {"type": "sequential", "min_xp": 100},
                    "reward": {"xp": 125}
                },
                {
                    "order_index": 4,
                    "title": "Mastery & Review",
                    "description": "Consolidate your knowledge and achieve mastery",
                    "objectives": [
                        "Review all key concepts",
                        "Demonstrate comprehensive understanding",
                        "Achieve mastery of the topic"
                    ],
                    "estimated_minutes": 40,
                    "activities": [
                        {"type": "notes", "description": "Comprehensive review"},
                        {"type": "flashcards", "count": 20, "description": "Master all concepts"},
                        {"type": "quiz", "question_count": 15, "description": "Final assessment"}
                    ],
                    "unlock_rule": {"type": "sequential", "min_xp": 125},
                    "reward": {"xp": 150}
                }
            ]
        })
    
    def generate_node_content(self, context: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Generate content for a specific node activity"""
        activity_type = context.get("activity_type")
        node_title = context.get("node_title")
        node_description = context.get("node_description")
        objectives = context.get("objectives", [])
        path_topic = context.get("path_topic")
        difficulty = context.get("difficulty", "intermediate")
        count = context.get("count")
        
        logger.info(f"Generating {activity_type} content for node: {node_title}")
        
        if activity_type == "notes":
            return self._generate_notes(node_title, node_description, objectives, path_topic, difficulty)
        elif activity_type == "flashcards":
            return self._generate_flashcards(node_title, objectives, path_topic, difficulty, count or 10)
        elif activity_type == "quiz":
            return self._generate_quiz(node_title, objectives, path_topic, difficulty, count or 5)
        elif activity_type == "chat":
            return self._generate_chat_prompt(node_title, objectives, path_topic)
        else:
            return {"error": f"Unknown activity type: {activity_type}"}
    
    def _generate_notes(self, title: str, description: str, objectives: List[str], topic: str, difficulty: str) -> Dict[str, Any]:
        """Generate study notes for a node"""
        objectives_text = "\n".join([f"- {obj}" for obj in objectives])
        
        prompt = f"""Generate comprehensive study notes for learning about: {title}

Topic Context: {topic}
Description: {description}
Difficulty Level: {difficulty}

Learning Objectives:
{objectives_text}

Create detailed, well-structured notes that:
1. Explain key concepts clearly
2. Include examples and analogies
3. Break down complex ideas
4. Highlight important points
5. Are appropriate for {difficulty} level learners

Format the notes in markdown with clear sections and bullet points.
Return ONLY the markdown content, no JSON."""
        
        try:
            notes_content = self._call_ai(prompt)
            return {
                "success": True,
                "content_type": "notes",
                "content": notes_content,
                "title": title
            }
        except Exception as e:
            logger.error(f"Error generating notes: {e}")
            return {"error": str(e)}
    
    def _generate_flashcards(self, title: str, objectives: List[str], topic: str, difficulty: str, count: int) -> Dict[str, Any]:
        """Generate flashcards for a node"""
        objectives_text = "\n".join([f"- {obj}" for obj in objectives])
        
        prompt = f"""Generate {count} flashcards for learning: {title}

Topic Context: {topic}
Difficulty Level: {difficulty}

Learning Objectives:
{objectives_text}

Create flashcards that:
1. Cover key concepts and terminology
2. Are clear and concise
3. Test understanding, not just memorization
4. Progress from basic to advanced
5. Are appropriate for {difficulty} level

Return ONLY valid JSON in this format:
{{
  "flashcards": [
    {{
      "question": "Front of card (question or term)",
      "answer": "Back of card (answer or definition)",
      "difficulty": "easy|medium|hard"
    }}
  ]
}}"""
        
        try:
            response = self._call_ai(prompt)
            # Parse JSON response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > 0:
                data = json.loads(response[json_start:json_end])
                return {
                    "success": True,
                    "content_type": "flashcards",
                    "flashcards": data.get("flashcards", []),
                    "count": len(data.get("flashcards", []))
                }
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            logger.error(f"Error generating flashcards: {e}")
            return {"error": str(e)}
    
    def _generate_quiz(self, title: str, objectives: List[str], topic: str, difficulty: str, count: int) -> Dict[str, Any]:
        """Generate quiz questions for a node"""
        objectives_text = "\n".join([f"- {obj}" for obj in objectives])
        
        prompt = f"""Generate {count} multiple-choice quiz questions for: {title}

Topic Context: {topic}
Difficulty Level: {difficulty}

Learning Objectives:
{objectives_text}

Create quiz questions that:
1. Test understanding of key concepts
2. Have 4 answer options each
3. Include one correct answer
4. Have plausible distractors
5. Are appropriate for {difficulty} level

Return ONLY valid JSON in this format:
{{
  "questions": [
    {{
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Why this answer is correct"
    }}
  ]
}}"""
        
        try:
            response = self._call_ai(prompt)
            # Parse JSON response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > 0:
                data = json.loads(response[json_start:json_end])
                return {
                    "success": True,
                    "content_type": "quiz",
                    "questions": data.get("questions", []),
                    "count": len(data.get("questions", []))
                }
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            return {"error": str(e)}
    
    def _generate_chat_prompt(self, title: str, objectives: List[str], topic: str) -> Dict[str, Any]:
        """Generate a chat discussion prompt for a node"""
        objectives_text = "\n".join([f"- {obj}" for obj in objectives])
        
        prompt = f"""Generate an engaging discussion prompt for: {title}

Topic Context: {topic}

Learning Objectives:
{objectives_text}

Create a thought-provoking prompt that:
1. Encourages reflection on the learned material
2. Connects concepts to real-world applications
3. Promotes deeper understanding
4. Is open-ended and discussion-worthy

Return ONLY the prompt text, no JSON."""
        
        try:
            chat_prompt = self._call_ai(prompt)
            return {
                "success": True,
                "content_type": "chat",
                "prompt": chat_prompt,
                "title": f"Discuss: {title}"
            }
        except Exception as e:
            logger.error(f"Error generating chat prompt: {e}")
            return {"error": str(e)}
