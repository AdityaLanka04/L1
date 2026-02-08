"""
Learning Progress Tracker Agent
Automatically tracks and maps study activities to learning path nodes using AI
"""
import os
import json
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LearningProgressTracker:
    """
    AI-powered agent that tracks learning activities and maps them to roadmap nodes
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_client = None
        
        # Initialize Gemini AI
        if GEMINI_AVAILABLE:
            api_key = os.getenv("GOOGLE_GENERATIVE_AI_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.ai_client = genai.GenerativeModel('gemini-1.5-flash')
                logger.info("✅ Learning Progress Tracker initialized WITH AI")
            else:
                logger.warning("⚠️ No Gemini API key found")
        else:
            logger.warning("⚠️ Gemini not available")
    
    async def analyze_content_and_map_to_nodes(
        self,
        user_id: int,
        content: str,
        content_type: str,  # 'note', 'flashcard', 'quiz', 'chat', 'slide'
        content_title: str = "",
        metadata: Dict = None
    ) -> List[Dict]:
        """
        Analyze content and map it to relevant learning path nodes
        
        Returns list of matched nodes with confidence scores
        """
        print(f"\n{'='*80}")
        print(f"🔍 ANALYZE_CONTENT_AND_MAP_TO_NODES")
        print(f"{'='*80}")
        print(f"📊 Parameters:")
        print(f"   - user_id: {user_id}")
        print(f"   - content_type: {content_type}")
        print(f"   - content_title: {content_title}")
        print(f"   - content_length: {len(content)}")
        
        try:
            # Get user's active learning paths - use models from database module
            print(f"\n📚 Step 1: Importing models...")
            import models
            print(f"✅ Models imported")
            
            # Get all active learning paths for user
            print(f"\n🔍 Step 2: Querying active learning paths for user {user_id}...")
            paths = self.db.query(models.LearningPath).filter(
                and_(
                    models.LearningPath.user_id == user_id,
                    models.LearningPath.status == 'active'
                )
            ).all()
            
            print(f"✅ Found {len(paths)} active learning paths")
            for path in paths:
                print(f"   - {path.title} (ID: {path.id})")
            
            if not paths:
                print(f"⚠️ No active learning paths for user {user_id}")
                print(f"{'='*80}\n")
                return []
            
            # Collect all nodes from active paths
            print(f"\n🔍 Step 3: Collecting nodes from active paths...")
            all_nodes = []
            for path in paths:
                nodes = self.db.query(models.LearningPathNode).filter(
                    models.LearningPathNode.path_id == path.id
                ).all()
                print(f"   - Path '{path.title}': {len(nodes)} nodes")
                all_nodes.extend([(node, path) for node in nodes])
            
            print(f"✅ Total nodes collected: {len(all_nodes)}")
            
            if not all_nodes:
                print(f"⚠️ No nodes found in active learning paths")
                print(f"{'='*80}\n")
                return []
            
            # Use AI to match content to nodes
            print(f"\n🤖 Step 4: Matching content to nodes using AI...")
            matched_nodes = await self._ai_match_content_to_nodes(
                content=content,
                content_type=content_type,
                content_title=content_title,
                nodes=all_nodes,
                metadata=metadata
            )
            
            print(f"✅ AI matching complete: {len(matched_nodes)} matches")
            print(f"{'='*80}\n")
            
            return matched_nodes
            
        except Exception as e:
            print(f"\n❌ ERROR IN ANALYZE_CONTENT_AND_MAP_TO_NODES")
            print(f"Error type: {type(e).__name__}")
            print(f"Error message: {str(e)}")
            import traceback
            print(f"Full traceback:")
            traceback.print_exc()
            print(f"{'='*80}\n")
            logger.error(f"Error analyzing content: {e}")
            return []
    
    async def _ai_match_content_to_nodes(
        self,
        content: str,
        content_type: str,
        content_title: str,
        nodes: List[Tuple],
        metadata: Dict = None
    ) -> List[Dict]:
        """
        Use AI to intelligently match content to learning path nodes
        """
        print(f"\n{'='*80}")
        print(f"🤖 AI_MATCH_CONTENT_TO_NODES")
        print(f"{'='*80}")
        print(f"📊 AI Client available: {self.ai_client is not None}")
        print(f"📊 Number of nodes to match: {len(nodes)}")
        
        if not self.ai_client:
            print(f"⚠️ No AI client available, falling back to keyword matching")
            # Fallback to keyword matching
            return self._keyword_match_nodes(content, content_title, nodes)
        
        try:
            # Prepare node information for AI
            print(f"\n📝 Preparing node information for AI...")
            node_info = []
            for idx, (node, path) in enumerate(nodes):
                node_data = {
                    "index": idx,
                    "path_title": path.title,
                    "node_title": node.title,
                    "description": node.description or "",
                    "tags": node.tags or [],
                    "keywords": node.keywords or [],
                    "objectives": node.objectives or []
                }
                node_info.append(node_data)
            
            print(f"✅ Prepared {len(node_info)} node descriptions")
            
            # Truncate content if too long
            content_preview = content[:2000] if len(content) > 2000 else content
            print(f"📄 Content preview length: {len(content_preview)} chars")
            
            # Create AI prompt
            prompt = f"""You are an intelligent learning progress tracker. Analyze the following study content and determine which learning path nodes it relates to.

STUDY CONTENT:
Type: {content_type}
Title: {content_title}
Content: {content_preview}

AVAILABLE LEARNING PATH NODES:
{json.dumps(node_info, indent=2)}

TASK:
1. Identify which nodes (by index) this content relates to
2. For each match, provide:
   - node_index: The index of the matched node
   - confidence: Score from 0-100 indicating match confidence
   - progress_contribution: Estimated progress contribution (0-100) based on content depth
   - reasoning: Brief explanation of why this content matches this node

IMPORTANT:
- Only match nodes where there's clear topical overlap
- Consider tags, keywords, objectives, and descriptions
- A single piece of content can match multiple nodes
- Be conservative with confidence scores
- Progress contribution should reflect how much this activity advances understanding of the node

Return ONLY a valid JSON array of matches (empty array if no matches):
[
  {{
    "node_index": 0,
    "confidence": 85,
    "progress_contribution": 15,
    "reasoning": "Content covers supervised learning basics which is core to this node"
  }}
]"""

            print(f"\n🚀 Sending request to Gemini AI...")
            print(f"📝 Prompt length: {len(prompt)} chars")
            
            # Get AI response
            response = self.ai_client.generate_content(prompt)
            response_text = response.text.strip()
            
            print(f"✅ Received AI response: {len(response_text)} chars")
            print(f"📄 Raw response preview: {response_text[:300]}...")
            
            # Extract JSON from response
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
                print(f"📝 Extracted JSON from markdown code block")
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
                print(f"📝 Extracted content from code block")
            
            print(f"\n🔍 Parsing JSON response...")
            matches = json.loads(response_text)
            print(f"✅ Parsed {len(matches)} matches from AI")
            
            # Build result with actual node data
            print(f"\n📊 Building result with node data...")
            results = []
            for match in matches:
                idx = match.get("node_index")
                if idx is not None and 0 <= idx < len(nodes):
                    node, path = nodes[idx]
                    result_item = {
                        "node_id": node.id,
                        "path_id": path.id,
                        "node_title": node.title,
                        "path_title": path.title,
                        "confidence": match.get("confidence", 50),
                        "progress_contribution": match.get("progress_contribution", 10),
                        "reasoning": match.get("reasoning", "")
                    }
                    results.append(result_item)
                    print(f"   ✅ Match {len(results)}: {node.title} (confidence: {result_item['confidence']}%)")
                else:
                    print(f"   ⚠️ Invalid node index: {idx}")
            
            print(f"\n✅ AI matching complete: {len(results)} valid matches")
            print(f"{'='*80}\n")
            
            logger.info(f"AI matched content to {len(results)} nodes")
            return results
            
        except Exception as e:
            print(f"\n❌ ERROR IN AI_MATCH_CONTENT_TO_NODES")
            print(f"Error type: {type(e).__name__}")
            print(f"Error message: {str(e)}")
            import traceback
            print(f"Full traceback:")
            traceback.print_exc()
            print(f"⚠️ Falling back to keyword matching")
            print(f"{'='*80}\n")
            logger.error(f"AI matching failed: {e}, falling back to keyword matching")
            return self._keyword_match_nodes(content, content_title, nodes)
    
    def _keyword_match_nodes(
        self,
        content: str,
        content_title: str,
        nodes: List[Tuple]
    ) -> List[Dict]:
        """
        Fallback keyword-based matching when AI is unavailable
        """
        results = []
        content_lower = (content + " " + content_title).lower()
        
        for node, path in nodes:
            score = 0
            matches = []
            
            # Check title
            if node.title.lower() in content_lower:
                score += 30
                matches.append("title")
            
            # Check keywords
            keywords = node.keywords or []
            for keyword in keywords:
                if isinstance(keyword, str) and keyword.lower() in content_lower:
                    score += 10
                    matches.append(f"keyword:{keyword}")
            
            # Check tags
            tags = node.tags or []
            for tag in tags:
                if isinstance(tag, str) and tag.lower() in content_lower:
                    score += 8
                    matches.append(f"tag:{tag}")
            
            # Check description
            if node.description:
                desc_words = set(node.description.lower().split())
                content_words = set(content_lower.split())
                overlap = len(desc_words & content_words)
                if overlap > 3:
                    score += min(overlap * 2, 20)
                    matches.append(f"description:{overlap}words")
            
            # If score is significant, add to results
            if score >= 15:
                results.append({
                    "node_id": node.id,
                    "path_id": path.id,
                    "node_title": node.title,
                    "path_title": path.title,
                    "confidence": min(score, 100),
                    "progress_contribution": min(score // 3, 25),
                    "reasoning": f"Keyword matches: {', '.join(matches[:3])}"
                })
        
        # Sort by confidence
        results.sort(key=lambda x: x["confidence"], reverse=True)
        return results[:5]  # Top 5 matches
    
    async def update_node_progress(
        self,
        user_id: int,
        node_id: str,
        path_id: str,
        progress_delta: int,
        activity_type: str,
        evidence: Dict = None
    ) -> Dict:
        """
        Update progress for a specific node
        """
        print(f"\n{'='*80}")
        print(f"💾 UPDATE_NODE_PROGRESS")
        print(f"{'='*80}")
        print(f"📊 Parameters:")
        print(f"   - user_id: {user_id}")
        print(f"   - node_id: {node_id}")
        print(f"   - path_id: {path_id}")
        print(f"   - progress_delta: {progress_delta}%")
        print(f"   - activity_type: {activity_type}")
        
        try:
            print(f"\n📦 Importing models...")
            import models
            print(f"✅ Models imported")
            
            # Get or create progress record
            print(f"\n🔍 Querying existing progress record...")
            progress = self.db.query(models.LearningNodeProgress).filter(
                and_(
                    models.LearningNodeProgress.node_id == node_id,
                    models.LearningNodeProgress.user_id == user_id
                )
            ).first()
            
            if not progress:
                print(f"📝 No existing progress found, creating new record...")
                # Create new progress record
                progress = models.LearningNodeProgress(
                    node_id=node_id,
                    user_id=user_id,
                    status='in_progress',
                    progress_pct=0,
                    xp_earned=0,
                    time_spent_minutes=0,
                    activities_completed=[]
                )
                self.db.add(progress)
                print(f"✅ New progress record created")
            else:
                print(f"✅ Found existing progress: {progress.progress_pct}% ({progress.status})")
            
            # Update progress
            old_progress = progress.progress_pct
            new_progress = min(old_progress + progress_delta, 100)
            progress.progress_pct = new_progress
            progress.last_accessed = datetime.now(timezone.utc)
            
            print(f"\n📊 Progress update:")
            print(f"   - Old: {old_progress}%")
            print(f"   - Delta: +{progress_delta}%")
            print(f"   - New: {new_progress}%")
            
            # Update status
            if progress.status == 'locked':
                print(f"🔓 Unlocking node (was locked)")
                progress.status = 'in_progress'
                progress.started_at = datetime.now(timezone.utc)
            
            if new_progress >= 100 and progress.status != 'completed':
                print(f"🎉 Node completed! Awarding XP...")
                progress.status = 'completed'
                progress.completed_at = datetime.now(timezone.utc)
                # Award XP
                progress.xp_earned = progress.xp_earned or 0 + 50
                print(f"   - XP earned: {progress.xp_earned}")
            
            # Track activity
            print(f"\n📝 Recording activity...")
            activities = progress.activities_completed or []
            activities.append({
                "type": activity_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "progress_delta": progress_delta,
                "evidence": evidence
            })
            progress.activities_completed = activities
            print(f"✅ Activity recorded (total activities: {len(activities)})")
            
            # Update evidence
            if evidence:
                print(f"📎 Updating evidence...")
                current_evidence = progress.evidence or {}
                current_evidence[activity_type] = current_evidence.get(activity_type, [])
                current_evidence[activity_type].append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": evidence
                })
                progress.evidence = current_evidence
                print(f"✅ Evidence updated")
            
            print(f"\n💾 Committing to database...")
            self.db.commit()
            print(f"✅ Database commit successful")
            
            result = {
                "success": True,
                "node_id": node_id,
                "old_progress": old_progress,
                "new_progress": new_progress,
                "status": progress.status,
                "xp_earned": progress.xp_earned
            }
            
            print(f"\n✅ UPDATE_NODE_PROGRESS COMPLETED")
            print(f"📊 Result: {result}")
            print(f"{'='*80}\n")
            
            logger.info(f"Updated node {node_id} progress: {old_progress}% -> {new_progress}%")
            
            return result
            
        except Exception as e:
            print(f"\n❌ ERROR IN UPDATE_NODE_PROGRESS")
            print(f"Error type: {type(e).__name__}")
            print(f"Error message: {str(e)}")
            import traceback
            print(f"Full traceback:")
            traceback.print_exc()
            print(f"{'='*80}\n")
            logger.error(f"Error updating node progress: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def calculate_progress_contribution(
        self,
        activity_type: str,
        content_length: int,
        quality_score: float = 0.7
    ) -> int:
        """
        Calculate how much progress an activity should contribute
        """
        # Base contributions by activity type
        base_contributions = {
            "note": 15,
            "flashcard": 10,
            "quiz": 20,
            "chat": 8,
            "slide": 12,
            "practice": 25,
            "project": 30
        }
        
        base = base_contributions.get(activity_type, 10)
        
        # Adjust for content length
        if content_length < 100:
            length_multiplier = 0.5
        elif content_length < 500:
            length_multiplier = 0.8
        elif content_length < 1500:
            length_multiplier = 1.0
        else:
            length_multiplier = 1.2
        
        # Apply quality score
        contribution = int(base * length_multiplier * quality_score)
        
        return min(contribution, 35)  # Cap at 35% per activity
    
    async def track_activity(
        self,
        user_id: int,
        activity_type: str,
        content: str,
        title: str = "",
        metadata: Dict = None
    ) -> Dict:
        """
        Main entry point: Track any learning activity and update relevant nodes
        """
        print(f"\n{'='*80}")
        print(f"🎯 TRACKER.TRACK_ACTIVITY CALLED")
        print(f"{'='*80}")
        print(f"📊 Parameters:")
        print(f"   - user_id: {user_id}")
        print(f"   - activity_type: {activity_type}")
        print(f"   - title: {title}")
        print(f"   - content_length: {len(content)}")
        print(f"   - metadata: {metadata}")
        
        try:
            # Analyze and match to nodes
            print(f"\n🔍 Step 1: Analyzing content and mapping to nodes...")
            matches = await self.analyze_content_and_map_to_nodes(
                user_id=user_id,
                content=content,
                content_type=activity_type,
                content_title=title,
                metadata=metadata
            )
            
            print(f"✅ Analysis complete: {len(matches)} matches found")
            
            if not matches:
                print(f"⚠️ No matching learning path nodes found")
                print(f"{'='*80}\n")
                return {
                    "success": True,
                    "matched_nodes": 0,
                    "message": "No matching learning path nodes found"
                }
            
            print(f"\n📋 Matched Nodes:")
            for i, match in enumerate(matches, 1):
                print(f"   {i}. {match['node_title']} ({match['path_title']})")
                print(f"      Confidence: {match['confidence']}%")
                print(f"      Contribution: {match['progress_contribution']}%")
                print(f"      Reasoning: {match['reasoning']}")
            
            # Calculate progress contribution
            print(f"\n📊 Step 2: Calculating progress contribution...")
            progress_delta = await self.calculate_progress_contribution(
                activity_type=activity_type,
                content_length=len(content),
                quality_score=0.8
            )
            print(f"✅ Base progress delta: {progress_delta}%")
            
            # Update progress for matched nodes
            print(f"\n💾 Step 3: Updating node progress...")
            updates = []
            for match in matches:
                # Only update if confidence is high enough (lowered threshold for better tracking)
                if match["confidence"] >= 20:  # Lowered from 30 to 20 to capture more matches
                    # Scale progress by confidence
                    scaled_progress = int(
                        match["progress_contribution"] * (match["confidence"] / 100)
                    )
                    
                    # Ensure minimum progress of 5% for any match
                    scaled_progress = max(scaled_progress, 5)
                    
                    print(f"\n   Updating node: {match['node_title']}")
                    print(f"   - Scaled progress: {scaled_progress}%")
                    
                    result = await self.update_node_progress(
                        user_id=user_id,
                        node_id=match["node_id"],
                        path_id=match["path_id"],
                        progress_delta=scaled_progress,
                        activity_type=activity_type,
                        evidence={
                            "title": title,
                            "content_preview": content[:200],
                            "confidence": match["confidence"],
                            "reasoning": match["reasoning"]
                        }
                    )
                    
                    print(f"   - Update result: {result}")
                    
                    if result.get("success"):
                        updates.append({
                            "node_title": match["node_title"],
                            "path_title": match["path_title"],
                            "progress_delta": scaled_progress,
                            "new_progress": result["new_progress"],
                            "status": result["status"]
                        })
                        print(f"   ✅ Successfully updated")
                    else:
                        print(f"   ❌ Update failed: {result.get('error')}")
                else:
                    print(f"\n   ⏭️ Skipping node {match['node_title']} (confidence {match['confidence']}% < 20%)")
            
            print(f"\n✅ TRACK_ACTIVITY COMPLETED")
            print(f"📊 Summary:")
            print(f"   - Matched nodes: {len(matches)}")
            print(f"   - Updated nodes: {len(updates)}")
            print(f"{'='*80}\n")
            
            return {
                "success": True,
                "matched_nodes": len(matches),
                "updated_nodes": len(updates),
                "updates": updates,
                "message": f"Updated progress for {len(updates)} learning path nodes"
            }
            
        except Exception as e:
            print(f"\n❌ ERROR IN TRACK_ACTIVITY")
            print(f"Error type: {type(e).__name__}")
            print(f"Error message: {str(e)}")
            import traceback
            print(f"Full traceback:")
            traceback.print_exc()
            print(f"{'='*80}\n")
            logger.error(f"Error tracking activity: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
_tracker_instance = None

def get_progress_tracker(db: Session) -> LearningProgressTracker:
    """Get or create progress tracker instance"""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = LearningProgressTracker(db)
    else:
        _tracker_instance.db = db
    return _tracker_instance
