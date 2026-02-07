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
            # Call AI to generate path structure with higher token limit for complete response
            ai_response = self._call_ai(generation_prompt, max_tokens=8000)
            
            logger.info(f"Received AI response of {len(ai_response)} characters")
            
            try:
                path_data = self._parse_ai_response(ai_response)
                logger.info(f"Successfully parsed path with {len(path_data.get('nodes', []))} nodes")
                
                # CRITICAL CHECK: Verify we got ALL requested nodes
                if len(path_data.get('nodes', [])) < target_nodes:
                    raise ValueError(f"Only got {len(path_data.get('nodes', []))} nodes, expected {target_nodes}. Retrying with explicit template.")
                
            except ValueError as parse_error:
                logger.warning(f"Failed to parse AI response (attempt 1): {parse_error}")
                logger.warning(f"AI response preview: {ai_response[:500]}...")
                
                # Try with a simpler prompt that's more likely to produce valid JSON
                logger.info("Retrying with simplified prompt...")
                simple_prompt = self._build_simple_generation_prompt(topic_prompt, difficulty, target_nodes)
                
                try:
                    ai_response = self._call_ai(simple_prompt, max_tokens=8000)
                    logger.info(f"Received simplified AI response of {len(ai_response)} characters")
                    path_data = self._parse_ai_response(ai_response)
                    logger.info(f"Successfully parsed simplified path with {len(path_data.get('nodes', []))} nodes")
                    
                    # CRITICAL CHECK: Verify we got ALL requested nodes
                    if len(path_data.get('nodes', [])) < target_nodes:
                        raise ValueError(f"Even simplified prompt only got {len(path_data.get('nodes', []))} nodes, expected {target_nodes}")
                    
                except Exception as parse_error2:
                    logger.warning(f"Failed to parse AI response (attempt 2): {parse_error2}")
                    logger.info("Using fallback template...")
                    # Use fallback if both attempts fail - but generate correct number of nodes
                    fallback_response = self._get_fallback_response(topic_prompt, target_nodes)
                    try:
                        path_data = self._parse_ai_response(fallback_response)
                    except Exception as fallback_error:
                        logger.error(f"Even fallback failed: {fallback_error}")
                        # Last resort - use a minimal hardcoded structure
                        path_data = json.loads(fallback_response)
            
            # Create database records
            path = self._create_path_in_db(user_id, topic_prompt, path_data, difficulty, db)
            
            return {
                "success": True,
                "path_id": path.id,
                "path": self._serialize_path(path, db, user_id),
                "message": f"Created learning path with {len(path.nodes)} nodes"
            }
        
        except Exception as e:
            logger.error(f"Error generating path: {e}")
            return {"error": str(e)}
    
    def _build_generation_prompt(self, topic: str, difficulty: str, node_count: int, goals: List[str]) -> str:
        """Build prompt for AI path generation with enhanced content structure"""
        goals_text = "\n".join([f"- {g}" for g in goals]) if goals else "General mastery of the topic"
        
        return f"""You are an expert teacher creating a comprehensive learning path for "{topic}".

STUDENT LEVEL: {difficulty}
NUMBER OF MODULES: {node_count}
LEARNING GOALS: {goals_text}

YOUR TASK: Design a complete curriculum with {node_count} modules that takes a student from beginner to proficient in {topic}.

PEDAGOGICAL REQUIREMENTS:
1. Start with fundamentals and prerequisites
2. Build concepts progressively - each module should build on previous ones
3. Cover the ESSENTIAL topics a student MUST know to master {topic}
4. Order topics logically (e.g., for Machine Learning: math foundations → supervised learning → unsupervised learning → neural networks → deep learning)
5. Include practical applications and real-world examples
6. End with advanced topics and mastery

THINK LIKE A TEACHER:
- What are the core concepts a student needs to understand {topic}?
- What order makes the most sense pedagogically?
- What prerequisites are needed for each concept?
- What real-world applications will motivate the student?

Return ONLY valid JSON with this structure:

{{
  "title": "Master {topic}",
  "description": "Comprehensive {difficulty}-level learning path for {topic}",
  "estimated_hours": {node_count * 0.5},
  "nodes": [
    {{
      "order_index": 0,
      "title": "[Specific topic name - e.g., 'Linear Algebra Fundamentals' for ML]",
      "description": "2-3 sentences explaining what this module covers and why it matters",
      
      "introduction": "2-3 sentences explaining WHY this topic is important and how it fits into the bigger picture of {topic}",
      
      "core_sections": [
        {{
          "title": "Specific Concept 1",
          "content": "Detailed explanation of this concept",
          "example": "Concrete example demonstrating the concept",
          "visual_description": "Description of a helpful diagram or visualization"
        }},
        {{
          "title": "Specific Concept 2",
          "content": "Next concept building on the previous",
          "example": "Another practical example"
        }}
      ],
      
      "summary": [
        "Key takeaway 1",
        "Key takeaway 2",
        "Key takeaway 3"
      ],
      
      "real_world_applications": [
        "Specific real-world application 1",
        "Specific real-world application 2",
        "Specific real-world application 3"
      ],
      
      "objectives": [
        "Specific measurable learning objective 1",
        "Specific measurable learning objective 2",
        "Specific measurable learning objective 3"
      ],
      
      "prerequisites": ["Specific prerequisite concepts"],
      
      "primary_resources": [
        {{"type": "article", "title": "Specific article title", "url": "https://en.wikipedia.org/wiki/Specific_Topic", "description": "What you'll learn"}},
        {{"type": "video", "title": "Specific video title", "url": "https://www.youtube.com/watch?v=VIDEO_ID", "description": "Video explanation"}},
        {{"type": "interactive", "title": "Specific tutorial", "url": "https://www.khanacademy.org/topic", "description": "Hands-on practice"}}
      ],
      
      "estimated_minutes": 45,
      "activities": [
        {{"type": "notes", "description": "Study the material"}},
        {{"type": "flashcards", "count": 10, "description": "Review key concepts"}},
        {{"type": "quiz", "question_count": 8, "description": "Test understanding"}}
      ],
      "unlock_rule": {{"type": "sequential"}},
      "reward": {{"xp": 50}}
    }}
    ... REPEAT FOR ALL {node_count} MODULES WITH PROPER TOPIC PROGRESSION ...
  ]
}}

CRITICAL REQUIREMENTS:
1. CREATE EXACTLY {node_count} MODULES - one for each major topic in {topic}
2. Each module title should be a SPECIFIC TOPIC (not generic like "Introduction" or "Advanced Concepts")
3. Order modules in LOGICAL TEACHING SEQUENCE
4. Make each module focus on ONE specific concept or skill
5. Ensure progressive difficulty - start simple, end advanced
6. Use REAL, SPECIFIC resource URLs when possible
7. Return COMPLETE JSON with ALL {node_count} modules

EXAMPLE TOPIC PROGRESSION FOR MACHINE LEARNING (8 modules):
1. "Mathematical Foundations: Linear Algebra and Calculus"
2. "Statistics and Probability for ML"
3. "Supervised Learning: Regression"
4. "Supervised Learning: Classification"
5. "Unsupervised Learning: Clustering"
6. "Neural Networks Fundamentals"
7. "Deep Learning and CNNs"
8. "Model Evaluation and Deployment"

NOW CREATE A SIMILAR PEDAGOGICALLY SOUND PROGRESSION FOR "{topic}" WITH {node_count} MODULES."""
    
    def _build_simple_generation_prompt(self, topic: str, difficulty: str, node_count: int) -> str:
        """Build a simpler prompt focused on proper topic progression"""
        
        return f"""You are an expert teacher creating a {node_count}-module learning path for "{topic}" at {difficulty} level.

CRITICAL: Think like a teacher. What are the {node_count} most important topics a student needs to learn {topic} in the RIGHT ORDER?

EXAMPLE - If topic is "Machine Learning" with 8 modules:
1. Mathematical Foundations (Linear Algebra, Calculus)
2. Statistics and Probability
3. Supervised Learning: Regression
4. Supervised Learning: Classification  
5. Unsupervised Learning: Clustering
6. Neural Networks Fundamentals
7. Deep Learning and CNNs
8. Model Evaluation and Deployment

EXAMPLE - If topic is "Spanish" with 8 modules:
1. Spanish Alphabet and Pronunciation
2. Basic Grammar: Nouns and Articles
3. Present Tense Verb Conjugation
4. Essential Vocabulary: Daily Life
5. Past Tenses: Preterite and Imperfect
6. Future and Conditional Tenses
7. Subjunctive Mood
8. Advanced Conversation and Idioms

NOW CREATE {node_count} SPECIFIC TOPICS FOR "{topic}" IN LOGICAL TEACHING ORDER.

Return ONLY this JSON structure with ALL {node_count} modules:

{{
  "title": "Master {topic}",
  "description": "Complete {difficulty}-level learning path for {topic}",
  "estimated_hours": {node_count * 0.5},
  "nodes": [
    {{
      "order_index": 0,
      "title": "[SPECIFIC TOPIC 1 - not generic, actual topic name]",
      "description": "What this specific topic covers and why it's important",
      "objectives": [
        "Specific learning objective 1 for this topic",
        "Specific learning objective 2 for this topic",
        "Specific learning objective 3 for this topic"
      ],
      "prerequisites": [],
      "resources": [
        {{"type": "article", "title": "Article about [TOPIC 1]", "url": "https://en.wikipedia.org/wiki/[Specific_Topic]", "description": "Comprehensive guide"}},
        {{"type": "video", "title": "Video tutorial on [TOPIC 1]", "url": "https://www.youtube.com/watch?v=EXAMPLE", "description": "Visual explanation"}},
        {{"type": "interactive", "title": "Practice [TOPIC 1]", "url": "https://www.khanacademy.org/[topic]", "description": "Hands-on practice"}}
      ],
      "estimated_minutes": 30,
      "activities": [
        {{"type": "notes", "description": "Study [TOPIC 1] fundamentals"}},
        {{"type": "flashcards", "count": 8, "description": "Review [TOPIC 1] concepts"}},
        {{"type": "quiz", "question_count": 5, "description": "Test [TOPIC 1] knowledge"}}
      ],
      "unlock_rule": {{"type": "sequential"}},
      "reward": {{"xp": 50}}
    }},
    {{
      "order_index": 1,
      "title": "[SPECIFIC TOPIC 2 - builds on topic 1]",
      "description": "What this specific topic covers and how it builds on previous",
      "objectives": [
        "Specific learning objective 1 for this topic",
        "Specific learning objective 2 for this topic",
        "Specific learning objective 3 for this topic"
      ],
      "prerequisites": ["[TOPIC 1]"],
      "resources": [
        {{"type": "article", "title": "Article about [TOPIC 2]", "url": "https://en.wikipedia.org/wiki/[Specific_Topic]", "description": "Detailed guide"}},
        {{"type": "video", "title": "Video tutorial on [TOPIC 2]", "url": "https://www.youtube.com/watch?v=EXAMPLE", "description": "Video lesson"}},
        {{"type": "interactive", "title": "Practice [TOPIC 2]", "url": "https://www.khanacademy.org/[topic]", "description": "Interactive exercises"}}
      ],
      "estimated_minutes": 35,
      "activities": [
        {{"type": "notes", "description": "Study [TOPIC 2] in depth"}},
        {{"type": "flashcards", "count": 9, "description": "Review [TOPIC 2] concepts"}},
        {{"type": "quiz", "question_count": 6, "description": "Test [TOPIC 2] understanding"}}
      ],
      "unlock_rule": {{"type": "sequential"}},
      "reward": {{"xp": 75}}
    }}
    ... CONTINUE FOR ALL {node_count} MODULES WITH PROPER TOPIC PROGRESSION ...
  ]
}}

MANDATORY REQUIREMENTS:
1. CREATE EXACTLY {node_count} MODULES - NO MORE, NO LESS
2. Each module title must be a SPECIFIC TOPIC from {topic} curriculum (not generic)
3. Order topics in LOGICAL TEACHING SEQUENCE (prerequisites first, advanced topics last)
4. Each topic should be DIFFERENT and cover a distinct concept
5. Make descriptions and objectives SPECIFIC to each topic
6. Use real URLs when possible (Wikipedia, YouTube, Khan Academy)
7. Progressive XP: 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325

VERIFY BEFORE RESPONDING:
✓ Count modules: Must be exactly {node_count}
✓ Each title is a SPECIFIC topic (not "Introduction" or "Advanced Concepts")
✓ Topics are in LOGICAL TEACHING ORDER
✓ Each module has unique, specific content"""
    
    def _parse_ai_response(self, ai_response: str) -> Dict[str, Any]:
        """Parse and validate AI response"""
        try:
            # Extract JSON from response - try multiple strategies
            json_str = None
            
            # Strategy 1: Find JSON between code blocks
            if "```json" in ai_response:
                start = ai_response.find("```json") + 7
                end = ai_response.find("```", start)
                if end > start:
                    json_str = ai_response[start:end].strip()
            
            # Strategy 2: Find JSON between curly braces
            if not json_str:
                json_start = ai_response.find('{')
                json_end = ai_response.rfind('}') + 1
                if json_start != -1 and json_end > 0:
                    json_str = ai_response[json_start:json_end]
            
            if not json_str:
                raise ValueError("No JSON found in response")
            
            # Fix double braces that might come from f-string escaping in prompts
            # The AI might return {{ instead of { if it's copying our template
            # Only fix if we have consistent double braces (not just one or two)
            double_open = json_str.count('{{')
            double_close = json_str.count('}}')
            single_open = json_str.count('{') - (double_open * 2)
            single_close = json_str.count('}') - (double_close * 2)
            
            # If we have mostly double braces, convert them to single
            if double_open > single_open and double_close > single_close:
                logger.info(f"Converting double braces to single (found {double_open} double opens, {single_open} single opens)")
                json_str = json_str.replace('{{', '{').replace('}}', '}')
            
            # Try to parse as-is first
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.warning(f"Initial JSON parse failed at line {e.lineno}, col {e.colno}: {e.msg}")
                
                # If that fails, try fixing common issues
                json_str = self._fix_json_issues(json_str)
                try:
                    data = json.loads(json_str)
                    logger.info("JSON successfully repaired with standard fixes")
                except json.JSONDecodeError as e2:
                    logger.warning(f"Standard repair failed at line {e2.lineno}, col {e2.colno}: {e2.msg}")
                    
                    # Last resort: try aggressive repair
                    json_str = self._aggressive_json_repair(json_str)
                    try:
                        data = json.loads(json_str)
                        logger.info("JSON successfully repaired with aggressive fixes")
                    except json.JSONDecodeError as e3:
                        # Log the problematic section
                        error_pos = e3.pos if hasattr(e3, 'pos') else 0
                        context_start = max(0, error_pos - 100)
                        context_end = min(len(json_str), error_pos + 100)
                        logger.error(f"JSON repair failed. Context around error:\n{json_str[context_start:context_end]}")
                        raise
            
            # Validate structure
            required_fields = ["title", "description", "nodes"]
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            if not isinstance(data["nodes"], list) or len(data["nodes"]) == 0:
                raise ValueError("Nodes must be a non-empty list")
            
            # Validate and fix each node
            for i, node in enumerate(data["nodes"]):
                node_required = ["title", "description", "objectives"]
                for field in node_required:
                    if field not in node:
                        logger.warning(f"Node {i} missing required field: {field}, adding default")
                        if field == "title":
                            node["title"] = f"Learning Module {i+1}"
                        elif field == "description":
                            node["description"] = "Learn key concepts"
                        elif field == "objectives":
                            node["objectives"] = ["Master the fundamentals", "Apply knowledge", "Build understanding"]
                
                # Set defaults for optional fields
                node.setdefault("order_index", i)
                node.setdefault("estimated_minutes", 30)
                node.setdefault("prerequisites", [])
                node.setdefault("resources", [])
                node.setdefault("unlock_rule", {"type": "sequential"})
                node.setdefault("reward", {"xp": 50 + (i * 25)})
                
                # Ensure activities exist and are valid
                if "activities" not in node or not isinstance(node["activities"], list) or len(node["activities"]) == 0:
                    logger.warning(f"Node {i} missing or invalid activities, adding defaults")
                    node["activities"] = [
                        {"type": "notes", "description": "Study the material"},
                        {"type": "flashcards", "count": 8, "description": "Review key concepts"},
                        {"type": "quiz", "question_count": 5, "description": "Test your knowledge"}
                    ]
            
            logger.info(f"Successfully validated {len(data['nodes'])} nodes")
            return data
        
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Problematic JSON (first 500 chars): {json_str[:500] if json_str else 'None'}...")
            logger.error(f"Problematic JSON (last 500 chars): ...{json_str[-500:] if json_str and len(json_str) > 500 else ''}")
            raise ValueError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Validation error: {e}")
            raise
    
    def _aggressive_json_repair(self, json_str: str) -> str:
        """More aggressive JSON repair for badly malformed JSON"""
        import re
        
        # First, try to remove any incomplete trailing content
        # Look for patterns like incomplete URLs or strings
        
        # Find the last complete structure
        # Strategy: Find the last properly closed array or object
        
        # Remove any trailing incomplete content after the last complete structure
        # Look for patterns like: "url": "https://en.wikipedia.org/...
        json_str = re.sub(r',\s*"[^"]*":\s*"[^"]*\.\.\.$', '', json_str)
        json_str = re.sub(r',\s*"[^"]*":\s*"[^"]*$', '', json_str)
        
        # Fix the specific pattern we're seeing: }}}]] or }]]
        # This happens when AI adds extra closing braces
        # Pattern: ]}}] should be ]}]
        json_str = re.sub(r'\]\}\}+\]', ']}]', json_str)
        # Pattern: }}}] should be }}]
        json_str = re.sub(r'\}\}\}+\]', '}}]', json_str)
        # Pattern: ]}} should be ]}
        json_str = re.sub(r'\]\}\}+', ']}', json_str)
        # Pattern: }}}]] or }}}]
        json_str = re.sub(r'\}\}+\]\]', '}}]', json_str)
        json_str = re.sub(r'\}\}+\]', '}]', json_str)
        # Original patterns
        json_str = re.sub(r'\}{2,}\]', '}]', json_str)  # }}}] -> }]
        json_str = re.sub(r'\}\]{2,}', '}]', json_str)  # }]]] -> }]
        
        # If we have an incomplete string at the end, close it
        if json_str.count('"') % 2 != 0:
            # Odd number of quotes - add closing quote
            json_str += '"'
        
        # Find positions of all braces and brackets - but do it more carefully
        # We need to track nesting properly
        stack = []
        positions_to_remove = []
        
        in_string = False
        escape_next = False
        
        for i, char in enumerate(json_str):
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"':
                in_string = not in_string
                continue
            
            if in_string:
                continue
            
            if char == '{':
                stack.append(('{', i))
            elif char == '[':
                stack.append(('[', i))
            elif char == '}':
                if stack and stack[-1][0] == '{':
                    stack.pop()
                else:
                    # Extra closing brace - mark for removal
                    positions_to_remove.append(i)
            elif char == ']':
                if stack and stack[-1][0] == '[':
                    stack.pop()
                else:
                    # Extra closing bracket - mark for removal
                    positions_to_remove.append(i)
        
        # Remove extra closing braces/brackets from end to start
        if positions_to_remove:
            logger.info(f"Removing {len(positions_to_remove)} extra closing braces/brackets")
            for pos in reversed(positions_to_remove):
                json_str = json_str[:pos] + json_str[pos + 1:]
        
        # If we still have unclosed structures, close them
        if stack:
            logger.info(f"Closing {len(stack)} unclosed structures")
            for opener, _ in reversed(stack):
                if opener == '{':
                    json_str += '}'
                elif opener == '[':
                    json_str += ']'
        
        # Now apply standard fixes
        json_str = self._fix_json_issues(json_str)
        
        return json_str
    
    def _fix_json_issues(self, json_str: str) -> str:
        """Attempt to fix common JSON formatting issues"""
        import re
        
        # Remove any BOM or special characters at start
        json_str = json_str.lstrip('\ufeff\ufffe')
        
        # Replace smart quotes with regular quotes
        json_str = json_str.replace('"', '"').replace('"', '"')
        json_str = json_str.replace(''', "'").replace(''', "'")
        
        # FIRST: Fix the most common pattern we're seeing - extra braces before final bracket
        # This must happen BEFORE any other fixes
        # Pattern: }}}] at the very end
        if json_str.rstrip().endswith('}}}]'):
            json_str = json_str.rstrip()[:-4] + '}]'
        elif json_str.rstrip().endswith('}}}}]'):
            json_str = json_str.rstrip()[:-5] + '}]'
        elif json_str.rstrip().endswith('}}}}}]'):
            json_str = json_str.rstrip()[:-6] + '}]'
        
        # Fix ALL instances of }}}] pattern anywhere in the string (not just at end)
        json_str = re.sub(r'\}\}\}\}\}\]', '}}]', json_str)
        json_str = re.sub(r'\}\}\}\}\]', '}}]', json_str)
        json_str = re.sub(r'\}\}\}\]', '}}]', json_str)
        json_str = re.sub(r'\]\}\}\]', ']}]', json_str)
        
        # Fix missing commas between objects in arrays
        # Pattern: }{ should be },{
        json_str = re.sub(r'\}\s*\{', '},{', json_str)
        
        # Fix missing commas between array elements
        # Pattern: "] [" should be "], ["
        json_str = re.sub(r'\]\s*\[', '],[', json_str)
        
        # Fix missing commas after closing braces/brackets before new keys
        # Pattern: } "key" should be }, "key"
        json_str = re.sub(r'\}(\s*)"(\w+)"(\s*):', r'},\1"\2"\3:', json_str)
        json_str = re.sub(r'\](\s*)"(\w+)"(\s*):', r'],\1"\2"\3:', json_str)
        
        # Fix missing commas between string values and keys
        # Pattern: "value" "key": should be "value", "key":
        json_str = re.sub(r'"(\s+)"(\w+)"(\s*):', r'",\1"\2"\3:', json_str)
        
        # Remove trailing commas before closing brackets/braces (do this multiple times)
        for _ in range(3):
            json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Fix extra closing braces/brackets patterns (more comprehensive)
        # Pattern: ]}}] should be ]}]
        json_str = re.sub(r'\]\}\}\}+\]', ']}]', json_str)  # ]}}}}] -> ]}]
        json_str = re.sub(r'\]\}\}+\]', ']}]', json_str)    # ]}}] -> ]}]
        # Pattern: }}}] should be }}]
        json_str = re.sub(r'\}\}\}\}+\]', '}}]', json_str)  # }}}}] -> }}]
        json_str = re.sub(r'\}\}\}+\]', '}}]', json_str)    # }}}] -> }}]
        # Pattern: }}} should be }}
        json_str = re.sub(r'\}{3,}', '}}', json_str)  # }}} -> }}
        # Pattern: ]]] should be ]]
        json_str = re.sub(r'\]{3,}', ']]', json_str)  # ]]] -> ]]
        # Pattern: }]] should be }]
        json_str = re.sub(r'\}\]\]', '}]', json_str)
        
        # Fix incomplete strings at the end (missing closing quote)
        if json_str.count('"') % 2 != 0:
            # Find the last quote and check if it's opening or closing
            last_quote_pos = json_str.rfind('"')
            if last_quote_pos > 0:
                # Check if there's a colon before it (likely a key)
                before_quote = json_str[:last_quote_pos].rstrip()
                if before_quote.endswith(':') or before_quote.endswith(','):
                    # It's an opening quote for a value, close it
                    json_str += '"'
        
        # Try to fix truncated JSON by ensuring it ends properly
        # Count opening and closing braces
        open_braces = json_str.count('{')
        close_braces = json_str.count('}')
        open_brackets = json_str.count('[')
        close_brackets = json_str.count(']')
        
        # If we have TOO MANY closing braces/brackets, remove extras from the end
        if close_braces > open_braces:
            # Remove extra closing braces from the end
            extra = close_braces - open_braces
            logger.info(f"Removing {extra} extra closing braces")
            for _ in range(extra):
                last_brace = json_str.rfind('}')
                if last_brace > 0:
                    json_str = json_str[:last_brace] + json_str[last_brace + 1:]
        
        if close_brackets > open_brackets:
            # Remove extra closing brackets from the end
            extra = close_brackets - open_brackets
            logger.info(f"Removing {extra} extra closing brackets")
            for _ in range(extra):
                last_bracket = json_str.rfind(']')
                if last_bracket > 0:
                    json_str = json_str[:last_bracket] + json_str[last_bracket + 1:]
        
        # Recount after removal
        open_braces = json_str.count('{')
        close_braces = json_str.count('}')
        open_brackets = json_str.count('[')
        close_brackets = json_str.count(']')
        
        # If JSON appears truncated, try to close it
        if open_braces > close_braces:
            # Add missing closing braces
            missing = open_braces - close_braces
            logger.info(f"Adding {missing} missing closing braces")
            json_str += '}' * missing
        
        if open_brackets > close_brackets:
            # Add missing closing brackets
            missing = open_brackets - close_brackets
            logger.info(f"Adding {missing} missing closing brackets")
            json_str += ']' * missing
        
        # Final cleanup: remove any trailing commas we might have created
        for _ in range(3):
            json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        return json_str
    
    def _create_path_in_db(self, user_id: int, topic_prompt: str, path_data: Dict, difficulty: str, db: Session):
        """Create learning path and nodes in database with enhanced content"""
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
        
        # Create nodes with enhanced content
        for node_data in path_data["nodes"]:
            node = models.LearningPathNode(
                path_id=path.id,
                order_index=node_data["order_index"],
                title=node_data["title"],
                description=node_data.get("description", ""),
                
                # Enhanced metadata
                tags=node_data.get("tags", []),
                keywords=node_data.get("keywords", []),
                bloom_level=node_data.get("bloom_level", "understand"),
                cognitive_load=node_data.get("cognitive_load", "medium"),
                industry_relevance=node_data.get("industry_relevance", []),
                
                # Multi-layer content
                introduction=node_data.get("introduction", ""),
                core_sections=node_data.get("core_sections", []),
                summary=node_data.get("summary", []),
                connection_map=node_data.get("connection_map", {}),
                real_world_applications=node_data.get("real_world_applications", []),
                
                # Progressive disclosure (will be generated on-demand)
                beginner_content=node_data.get("beginner_content"),
                intermediate_content=node_data.get("intermediate_content"),
                advanced_content=node_data.get("advanced_content"),
                
                # Content formats
                video_resources=node_data.get("video_resources", []),
                interactive_diagrams=node_data.get("interactive_diagrams", []),
                audio_narration=node_data.get("audio_narration", []),
                infographics=node_data.get("infographics", []),
                code_playgrounds=node_data.get("code_playgrounds", []),
                
                # Learning content
                objectives=node_data.get("objectives", []),
                learning_outcomes=node_data.get("learning_outcomes", []),
                prerequisites=node_data.get("prerequisites", []),
                prerequisite_nodes=node_data.get("prerequisite_nodes", []),
                
                # Enhanced resources
                resources=node_data.get("resources", []),
                primary_resources=node_data.get("primary_resources", []),
                supplementary_resources=node_data.get("supplementary_resources", []),
                practice_resources=node_data.get("practice_resources", []),
                
                estimated_minutes=node_data.get("estimated_minutes", 30),
                content_plan=node_data.get("activities", []),
                
                # Interactive activities
                concept_mapping=node_data.get("concept_mapping", {}),
                scenarios=node_data.get("scenarios", []),
                hands_on_projects=node_data.get("hands_on_projects", []),
                
                # Prerequisite validation
                prerequisite_quiz=node_data.get("prerequisite_quiz", []),
                
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
        
        # Create node progress records (ALL nodes unlocked for flexible learning)
        for i, node in enumerate(path.nodes):
            node_progress = models.LearningNodeProgress(
                node_id=node.id,
                user_id=user_id,
                status="unlocked",  # All nodes unlocked by default
                progress_pct=0,
                xp_earned=0,
                difficulty_view="intermediate",
                evidence={},
                time_spent_minutes=0,
                quiz_attempts=[],
                concept_mastery={},
                struggle_points=[],
                resources_completed=[],
                resource_ratings={},
                activities_completed=[]
            )
            db.add(node_progress)
        
        db.commit()
        db.refresh(path)
        
        return path
    
        return path
    
    def get_user_paths(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Get all learning paths for a user (excluding archived)"""
        paths = db.query(models.LearningPath).filter(
            models.LearningPath.user_id == user_id,
            models.LearningPath.status != "archived"
        ).order_by(models.LearningPath.created_at.desc()).all()
        
        return {
            "paths": [self._serialize_path(p, db, user_id) for p in paths]
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
            "path": self._serialize_path(path, db, user_id, include_nodes=True)
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
    
    def _serialize_path(self, path, db: Session, user_id: int, include_nodes: bool = False) -> Dict[str, Any]:
        """Serialize path to JSON with enhanced content"""
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
                    models.LearningNodeProgress.node_id == node.id,
                    models.LearningNodeProgress.user_id == user_id
                ).first()
                
                nodes_data.append({
                    "id": node.id,
                    "order_index": node.order_index,
                    "title": node.title,
                    "description": node.description,
                    
                    # Enhanced metadata
                    "tags": node.tags or [],
                    "keywords": node.keywords or [],
                    "bloom_level": node.bloom_level,
                    "cognitive_load": node.cognitive_load,
                    "industry_relevance": node.industry_relevance or [],
                    
                    # Multi-layer content
                    "introduction": node.introduction,
                    "core_sections": node.core_sections or [],
                    "summary": node.summary or [],
                    "connection_map": node.connection_map or {},
                    "real_world_applications": node.real_world_applications or [],
                    
                    # Progressive disclosure
                    "beginner_content": node.beginner_content,
                    "intermediate_content": node.intermediate_content,
                    "advanced_content": node.advanced_content,
                    
                    # Content formats
                    "video_resources": node.video_resources or [],
                    "interactive_diagrams": node.interactive_diagrams or [],
                    "audio_narration": node.audio_narration or [],
                    "infographics": node.infographics or [],
                    "code_playgrounds": node.code_playgrounds or [],
                    
                    # Learning content
                    "objectives": node.objectives,
                    "learning_outcomes": node.learning_outcomes or [],
                    "prerequisites": node.prerequisites,
                    "prerequisite_nodes": node.prerequisite_nodes or [],
                    
                    # Enhanced resources
                    "resources": node.resources,
                    "primary_resources": node.primary_resources or [],
                    "supplementary_resources": node.supplementary_resources or [],
                    "practice_resources": node.practice_resources or [],
                    
                    "estimated_minutes": node.estimated_minutes,
                    "content_plan": node.content_plan,
                    
                    # Interactive activities
                    "concept_mapping": node.concept_mapping or {},
                    "scenarios": node.scenarios or [],
                    "hands_on_projects": node.hands_on_projects or [],
                    
                    # Prerequisite validation
                    "prerequisite_quiz": node.prerequisite_quiz or [],
                    
                    "unlock_rule": node.unlock_rule,
                    "reward": node.reward,
                    
                    "progress": {
                        "status": node_progress.status if node_progress else "locked",
                        "progress_pct": node_progress.progress_pct if node_progress else 0,
                        "xp_earned": node_progress.xp_earned if node_progress else 0,
                        "difficulty_view": node_progress.difficulty_view if node_progress else "intermediate",
                        "time_spent_minutes": node_progress.time_spent_minutes if node_progress else 0,
                        "quiz_attempts": node_progress.quiz_attempts if node_progress else [],
                        "concept_mastery": node_progress.concept_mastery if node_progress else {},
                        "struggle_points": node_progress.struggle_points if node_progress else [],
                        "resources_completed": node_progress.resources_completed if node_progress else [],
                        "resource_ratings": node_progress.resource_ratings if node_progress else {},
                        "activities_completed": node_progress.activities_completed if node_progress else [],
                        "started_at": node_progress.started_at.isoformat() if node_progress and node_progress.started_at else None,
                        "completed_at": node_progress.completed_at.isoformat() if node_progress and node_progress.completed_at else None,
                        "last_accessed": node_progress.last_accessed.isoformat() if node_progress and node_progress.last_accessed else None
                    }
                })
            
            result["nodes"] = nodes_data
        
        return result
    
    def _call_ai(self, prompt: str, max_tokens: int = 8000) -> str:
        """Call AI service to generate content"""
        try:
            # Use the AI client if available
            if self.ai_client:
                logger.info(f"Using provided AI client with max_tokens={max_tokens}")
                # Check if the AI client supports max_tokens parameter
                try:
                    response = self.ai_client.generate(prompt, max_tokens=max_tokens)
                except TypeError:
                    # Fallback if max_tokens not supported
                    response = self.ai_client.generate(prompt)
                
                logger.info(f"AI response length: {len(response)} characters")
                return response
            
            # Try to get from main module
            import sys
            if 'main' in sys.modules:
                main_module = sys.modules['main']
                if hasattr(main_module, 'unified_ai'):
                    logger.info("Using unified_ai from main module")
                    try:
                        response = main_module.unified_ai.generate(prompt, max_tokens=max_tokens)
                    except TypeError:
                        response = main_module.unified_ai.generate(prompt)
                    logger.info(f"AI response length: {len(response)} characters")
                    return response
            
            # No AI client available - raise error so caller can handle fallback
            raise Exception("No AI client available")
        
        except Exception as e:
            logger.error(f"AI call failed: {e}")
            raise  # Re-raise so caller can handle with appropriate fallback
    
    def _get_fallback_response(self, topic: str = "the topic", node_count: int = 8) -> str:
        """Fallback response if AI fails - creates a basic but useful path with the correct number of nodes"""
        logger.info(f"Generating fallback path with {node_count} nodes for: {topic}")
        
        # Generate node titles
        titles = [
            f"Getting Started with {topic}",
            f"Core Concepts of {topic}",
            f"Intermediate {topic}",
            f"Advanced {topic}",
            f"Practical {topic}",
            f"Real-World {topic}",
            f"Best Practices in {topic}",
            f"Common Pitfalls in {topic}",
            f"Optimizing {topic}",
            f"Testing {topic}",
            f"Advanced Patterns in {topic}",
            f"Mastering {topic}"
        ]
        
        nodes = []
        for i in range(node_count):
            title = titles[i] if i < len(titles) else f"Module {i+1}: {topic}"
            xp = 50 + (i * 25)
            
            nodes.append({
                "order_index": i,
                "title": title,
                "description": f"Learn key concepts and skills for {title.lower()}",
                "objectives": [
                    "Understand the core concepts",
                    "Apply knowledge to practical examples",
                    "Build confidence with the material"
                ],
                "prerequisites": ["Previous module"] if i > 0 else [],
                "resources": [
                    {"type": "article", "title": f"{title}", "url": f"https://en.wikipedia.org/wiki/{topic.replace(' ', '_')}", "description": "Comprehensive overview"},
                    {"type": "video", "title": f"{title} Tutorial", "url": "https://www.youtube.com", "description": "Video explanation"},
                    {"type": "interactive", "title": f"{title} Practice", "url": "https://www.khanacademy.org", "description": "Hands-on practice"}
                ],
                "estimated_minutes": 30 + (i * 5),
                "activities": [
                    {"type": "notes", "description": "Study the material"},
                    {"type": "flashcards", "count": 8 + i, "description": "Review key concepts"},
                    {"type": "quiz", "question_count": 5 + i, "description": "Test your understanding"}
                ],
                "unlock_rule": {"type": "sequential"},
                "reward": {"xp": xp}
            })
        
        return json.dumps({
            "title": f"Learning Path: {topic}",
            "description": f"A structured learning journey to master {topic}",
            "estimated_hours": node_count * 0.5,
            "nodes": nodes
        })
    
    def _search_resources_for_topic(self, topic: str, context: str = "") -> List[Dict[str, Any]]:
        """Search the web for relevant learning resources"""
        try:
            import requests
            from urllib.parse import quote
            
            # Use DuckDuckGo Instant Answer API (no API key needed)
            search_query = f"{topic} {context} tutorial guide learn" if context else f"{topic} tutorial guide learn"
            logger.info(f"Searching web for: {search_query}")
            
            resources = []
            
            # Try DuckDuckGo search
            try:
                ddg_url = f"https://api.duckduckgo.com/?q={quote(search_query)}&format=json&no_html=1"
                response = requests.get(ddg_url, timeout=5)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Get related topics
                    related = data.get('RelatedTopics', [])
                    for item in related[:5]:
                        if isinstance(item, dict) and 'FirstURL' in item:
                            url = item['FirstURL']
                            text = item.get('Text', '')
                            
                            # Determine resource type
                            resource_type = "article"
                            if 'youtube.com' in url or 'youtu.be' in url:
                                resource_type = "video"
                            elif any(edu in url for edu in ['khanacademy', 'coursera', 'udemy', 'edx']):
                                resource_type = "interactive"
                            elif any(doc in url for doc in ['docs.', 'documentation']):
                                resource_type = "documentation"
                            
                            resources.append({
                                "type": resource_type,
                                "title": text[:100] if text else f"{topic} Resource",
                                "url": url,
                                "description": text[:200] if text else f"Learn about {topic}",
                                "estimated_minutes": 20 if resource_type == "video" else 15,
                                "difficulty": "intermediate",
                                "format": resource_type
                            })
            except Exception as e:
                logger.warning(f"DuckDuckGo search failed: {e}")
            
            # If we got resources, return them
            if resources:
                logger.info(f"Found {len(resources)} resources from web search")
                return resources
            
            # Fallback: construct high-quality URLs manually
            logger.info("Using curated resource URLs")
            topic_encoded = quote(topic.replace(' ', '_'))
            topic_search = quote(topic)
            
            curated_resources = [
                {
                    "type": "article",
                    "title": f"{topic} - Wikipedia",
                    "url": f"https://en.wikipedia.org/wiki/{topic_encoded}",
                    "description": f"Comprehensive encyclopedia article about {topic}",
                    "estimated_minutes": 15,
                    "difficulty": "intermediate",
                    "format": "article"
                },
                {
                    "type": "video",
                    "title": f"{topic} Tutorial",
                    "url": f"https://www.youtube.com/results?search_query={topic_search}+tutorial",
                    "description": f"Video tutorials and explanations about {topic}",
                    "estimated_minutes": 20,
                    "difficulty": "beginner",
                    "format": "video"
                },
                {
                    "type": "interactive",
                    "title": f"Learn {topic}",
                    "url": f"https://www.khanacademy.org/search?page_search_query={topic_search}",
                    "description": f"Interactive lessons and practice for {topic}",
                    "estimated_minutes": 30,
                    "difficulty": "intermediate",
                    "format": "interactive"
                }
            ]
            
            # Add context-specific resources
            if context:
                if "introduction" in context.lower() or "basics" in context.lower():
                    curated_resources.append({
                        "type": "article",
                        "title": f"{topic} for Beginners",
                        "url": f"https://www.google.com/search?q={topic_search}+for+beginners+tutorial",
                        "description": f"Beginner-friendly introduction to {topic}",
                        "estimated_minutes": 15,
                        "difficulty": "beginner",
                        "format": "article"
                    })
                elif "practice" in context.lower() or "examples" in context.lower():
                    curated_resources.append({
                        "type": "interactive",
                        "title": f"{topic} Practice Problems",
                        "url": f"https://www.google.com/search?q={topic_search}+practice+problems+exercises",
                        "description": f"Practice exercises and problems for {topic}",
                        "estimated_minutes": 30,
                        "difficulty": "intermediate",
                        "format": "interactive"
                    })
                elif "advanced" in context.lower():
                    curated_resources.append({
                        "type": "article",
                        "title": f"Advanced {topic}",
                        "url": f"https://www.google.com/search?q={topic_search}+advanced+tutorial",
                        "description": f"Advanced concepts and techniques in {topic}",
                        "estimated_minutes": 25,
                        "difficulty": "advanced",
                        "format": "article"
                    })
            
            return curated_resources[:5]  # Return top 5
            
        except Exception as e:
            logger.error(f"Error searching for resources: {e}")
            # Last resort fallback
            return [{
                "type": "article",
                "title": f"{topic} - Wikipedia",
                "url": f"https://en.wikipedia.org/wiki/{topic.replace(' ', '_')}",
                "description": f"Learn about {topic}",
                "estimated_minutes": 15,
                "difficulty": "intermediate",
                "format": "article"
            }]
    
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
        
        prompt = f"""Generate comprehensive study notes SPECIFICALLY for: "{title}"

IMPORTANT: Notes must focus ONLY on "{title}", NOT the entire topic of "{topic}".

Node Description: {description}

Node-Specific Learning Objectives:
{objectives_text}

Difficulty Level: {difficulty}

Create detailed, well-structured notes that:
1. Explain key concepts of "{title}" clearly and specifically
2. Include examples and analogies relevant to this specific topic
3. Break down complex ideas within this node's scope
4. Highlight important points for "{title}"
5. Are appropriate for {difficulty} level learners
6. Stay focused on this node's content - do NOT cover other aspects of {topic}

Example: If the node is "Spanish Verb Conjugation" within "Spanish Grammar",
notes should cover conjugation rules, patterns, tenses, and examples ONLY.
Do NOT include information about nouns, adjectives, or other grammar topics.

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
        
        prompt = f"""Generate {count} flashcards SPECIFICALLY for the topic: "{title}"

IMPORTANT: Flashcards must ONLY cover the specific content of "{title}", NOT the broader topic of "{topic}".

Node-Specific Learning Objectives:
{objectives_text}

Difficulty Level: {difficulty}

Create flashcards that:
1. Cover key concepts and terminology from "{title}" ONLY
2. Are clear, concise, and focused on this specific node
3. Test understanding, not just memorization
4. Progress from basic to advanced within this topic
5. Are appropriate for {difficulty} level learners
6. Do NOT include content from other aspects of {topic} not covered in this node

Example: If the node is "Spanish Verb Conjugation" within a "Spanish Grammar" path,
flashcards should focus on verb conjugation rules, patterns, and examples ONLY.

CRITICAL: Return ONLY valid JSON with NO extra text before or after. Start with {{ and end with }}.

Format:
{{
  "flashcards": [
    {{
      "question": "Front of card (question or term about {title})",
      "answer": "Back of card (answer or definition specific to {title})",
      "difficulty": "easy|medium|hard"
    }}
  ]
}}"""
        
        try:
            response = self._call_ai(prompt)
            logger.info(f"Raw flashcard response (first 200 chars): {response[:200]}")
            
            # Try multiple extraction strategies
            json_str = None
            
            # Strategy 1: Look for JSON code block
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                if end > start:
                    json_str = response[start:end].strip()
                    logger.info("Extracted JSON from code block")
            
            # Strategy 2: Look for JSON between braces
            if not json_str:
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start != -1 and json_end > 0:
                    json_str = response[json_start:json_end]
                    logger.info(f"Extracted JSON from braces")
            
            if not json_str:
                logger.error(f"No JSON found in flashcard response")
                raise ValueError("No JSON found in response")
            
            # Fix double braces if present (from f-string template copying)
            double_open = json_str.count('{{')
            double_close = json_str.count('}}')
            single_open = json_str.count('{') - (double_open * 2)
            single_close = json_str.count('}') - (double_close * 2)
            
            if double_open > single_open and double_close > single_close:
                logger.info(f"Converting double braces in flashcard response")
                json_str = json_str.replace('{{', '{').replace('}}', '}')
            
            try:
                data = json.loads(json_str)
                logger.info(f"Successfully parsed flashcard JSON")
            except json.JSONDecodeError as e:
                logger.warning(f"Flashcard JSON parse failed, attempting repair: {e}")
                # Try to repair the JSON
                json_str = self._fix_json_issues(json_str)
                try:
                    data = json.loads(json_str)
                    logger.info(f"Successfully repaired flashcard JSON")
                except json.JSONDecodeError as e2:
                    logger.error(f"Flashcard JSON repair failed: {e2}")
                    return self._get_fallback_flashcards(title, count)
            
            # Validate structure
            if "flashcards" not in data or not isinstance(data["flashcards"], list):
                logger.error(f"Invalid flashcard structure")
                return self._get_fallback_flashcards(title, count)
            
            return {
                "success": True,
                "content_type": "flashcards",
                "flashcards": data.get("flashcards", []),
                "count": len(data.get("flashcards", []))
            }
            
        except Exception as e:
            logger.error(f"Error generating flashcards: {e}")
            return self._get_fallback_flashcards(title, count)
    
    def _generate_quiz(self, title: str, objectives: List[str], topic: str, difficulty: str, count: int) -> Dict[str, Any]:
        """Generate quiz questions for a node"""
        objectives_text = "\n".join([f"- {obj}" for obj in objectives])
        
        prompt = f"""Generate {count} multiple-choice quiz questions SPECIFICALLY for the topic: "{title}"

IMPORTANT: Questions must ONLY cover the specific content of "{title}", NOT the broader topic of "{topic}".

Node-Specific Learning Objectives:
{objectives_text}

Difficulty Level: {difficulty}

Create quiz questions that:
1. Test understanding of the SPECIFIC concepts in "{title}" ONLY
2. Focus on the learning objectives listed above
3. Have 4 answer options each (one correct, three plausible distractors)
4. Include clear explanations for the correct answer
5. Are appropriate for {difficulty} level learners
6. Do NOT include questions about other aspects of {topic} not covered in this specific node

Example: If the node is "Spanish Verb Conjugation" within a "Spanish Grammar" path, 
questions should be about verb conjugation ONLY, not about nouns, adjectives, or other grammar topics.

CRITICAL: Return ONLY valid JSON with NO extra text before or after. Start with {{ and end with }}.

Format:
{{
  "questions": [
    {{
      "question": "Question text about {title}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Why this answer is correct and how it relates to {title}"
    }}
  ]
}}"""
        
        try:
            response = self._call_ai(prompt)
            logger.info(f"Raw AI response (first 200 chars): {response[:200]}")
            
            # Try multiple extraction strategies
            json_str = None
            
            # Strategy 1: Look for JSON code block
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                if end > start:
                    json_str = response[start:end].strip()
                    logger.info("Extracted JSON from code block")
            
            # Strategy 2: Look for JSON between braces
            if not json_str:
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start != -1 and json_end > 0:
                    json_str = response[json_start:json_end]
                    logger.info(f"Extracted JSON from braces (start={json_start}, end={json_end})")
            
            if not json_str:
                logger.error(f"No JSON found in response: {response[:500]}")
                raise ValueError("No JSON found in response")
            
            # Log the extracted JSON for debugging
            logger.info(f"Extracted JSON (first 200 chars): {json_str[:200]}")
            
            # Fix double braces if present (from f-string template copying)
            double_open = json_str.count('{{')
            double_close = json_str.count('}}')
            single_open = json_str.count('{') - (double_open * 2)
            single_close = json_str.count('}') - (double_close * 2)
            
            if double_open > single_open and double_close > single_close:
                logger.info(f"Converting double braces in quiz response")
                json_str = json_str.replace('{{', '{').replace('}}', '}')
            
            # Try to parse
            try:
                data = json.loads(json_str)
                logger.info(f"Successfully parsed JSON with {len(data.get('questions', []))} questions")
            except json.JSONDecodeError as e:
                logger.warning(f"Quiz JSON parse failed at line {e.lineno}, col {e.colno}: {e.msg}")
                logger.warning(f"Problematic section: {json_str[max(0, e.pos-50):min(len(json_str), e.pos+50)]}")
                
                # Try to repair the JSON
                logger.info("Attempting JSON repair...")
                json_str = self._fix_json_issues(json_str)
                
                try:
                    data = json.loads(json_str)
                    logger.info(f"Successfully repaired and parsed JSON")
                except json.JSONDecodeError as e2:
                    logger.error(f"JSON repair failed: {e2}")
                    logger.error(f"Failed JSON (first 500 chars): {json_str[:500]}")
                    
                    # Last resort: return a fallback quiz
                    logger.warning("Using fallback quiz questions")
                    return self._get_fallback_quiz(title, count)
            
            # Validate the structure
            if "questions" not in data or not isinstance(data["questions"], list):
                logger.error(f"Invalid quiz structure: {data}")
                return self._get_fallback_quiz(title, count)
            
            return {
                "success": True,
                "content_type": "quiz",
                "questions": data.get("questions", []),
                "count": len(data.get("questions", []))
            }
            
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            return self._get_fallback_quiz(title, count)
    
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
    
    def _get_fallback_quiz(self, title: str, count: int) -> Dict[str, Any]:
        """Generate a fallback quiz when AI fails"""
        logger.info(f"Generating fallback quiz for: {title}")
        
        questions = []
        for i in range(min(count, 5)):  # Generate up to 5 fallback questions
            questions.append({
                "question": f"What is a key concept related to {title}?",
                "options": [
                    f"Core principle {i+1} of {title}",
                    f"Alternative concept {i+1}",
                    f"Related but different topic {i+1}",
                    f"Unrelated concept {i+1}"
                ],
                "correct_answer": 0,
                "explanation": f"This question tests your understanding of the fundamental concepts in {title}."
            })
        
        return {
            "success": True,
            "content_type": "quiz",
            "questions": questions,
            "count": len(questions),
            "fallback": True
        }
    
    def _get_fallback_flashcards(self, title: str, count: int) -> Dict[str, Any]:
        """Generate fallback flashcards when AI fails"""
        logger.info(f"Generating fallback flashcards for: {title}")
        
        flashcards = []
        for i in range(min(count, 8)):  # Generate up to 8 fallback flashcards
            flashcards.append({
                "question": f"Key concept {i+1} in {title}",
                "answer": f"This is an important concept related to {title}. Review your learning materials for specific details.",
                "difficulty": "medium"
            })
        
        return {
            "success": True,
            "content_type": "flashcards",
            "flashcards": flashcards,
            "count": len(flashcards),
            "fallback": True
        }
