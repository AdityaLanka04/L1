"""
COMPREHENSIVE WEAKNESS ANALYZER - ACTUALLY WORKS
Analyzes user performance from REAL data sources:
1. UserWeakArea table (quiz performance)
2. Individual Flashcard reviews (times_reviewed, correct_count, marked_for_review)
3. AI chat patterns (repeated questions, confusion)

NO BULLSHIT - uses actual database data that exists.
"""

import logging
from typing import Dict, List, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

logger = logging.getLogger(__name__)


class ComprehensiveWeaknessAnalyzer:
    """Analyzes user weaknesses from ALL actual data sources"""
    
    def __init__(self, db: Session, user_id: int, models):
        self.db = db
        self.user_id = user_id
        self.models = models
    
    def analyze_all_sources(self) -> Dict[str, Any]:
        """Main analysis - combines REAL data from all sources"""
        try:
            logger.info(f"Starting comprehensive analysis for user {self.user_id}")
            
            # Get data from all REAL sources
            weak_area_records = self._get_weak_area_records()
            flashcard_data = self._analyze_flashcard_reviews()
            chat_data = self._analyze_chat_patterns()
            
            logger.info(f"Found {len(weak_area_records)} quiz weak areas, {len(flashcard_data)} flashcard topics, {len(chat_data)} chat topics")
            
            # Combine and score
            comprehensive_analysis = self._combine_and_score(
                weak_area_records, flashcard_data, chat_data
            )
            
            # Categorize
            categorized = self._categorize_by_severity(comprehensive_analysis)
            
            return {
                "status": "success",
                "summary": {
                    "total_topics_analyzed": len(comprehensive_analysis),
                    "critical_count": len(categorized["critical"]),
                    "needs_practice_count": len(categorized["needs_practice"]),
                    "improving_count": len(categorized["improving"]),
                    "strong_count": len(categorized["strong"])
                },
                "weak_areas": {
                    "critical": categorized["critical"],
                    "needs_practice": categorized["needs_practice"],
                    "improving": categorized["improving"]
                },
                "strengths": categorized["strong"][:10],
                "all_topics": comprehensive_analysis
            }
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {e}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "error": str(e),
                "weak_areas": {"critical": [], "needs_practice": [], "improving": []},
                "strengths": [],
                "all_topics": []
            }
    
    def _get_weak_area_records(self) -> Dict[str, Dict]:
        """Get UserWeakArea records from quizzes"""
        weak_area_data = {}
        
        try:
            weak_areas = self.db.query(self.models.UserWeakArea).filter(
                self.models.UserWeakArea.user_id == self.user_id
            ).all()
            
            for wa in weak_areas:
                topic = wa.topic
                weak_area_data[topic] = {
                    "correct": wa.correct_count,
                    "total": wa.total_questions,
                    "incorrect": wa.incorrect_count,
                    "accuracy": wa.accuracy,
                    "consecutive_wrong": wa.consecutive_wrong,
                    "status": wa.status,
                    "priority": wa.priority,
                    "weakness_score": wa.weakness_score,
                    "last_updated": wa.last_updated
                }
            
            logger.info(f"Loaded {len(weak_area_data)} quiz weak areas")
        except Exception as e:
            logger.error(f"Error getting weak area records: {e}")
        
        return weak_area_data
    
    def _analyze_flashcard_reviews(self) -> Dict[str, Dict]:
        """Analyze individual flashcard performance - ACTUALLY WORKS"""
        flashcard_data = {}
        
        try:
            # Get all flashcard sets for user
            flashcard_sets = self.db.query(self.models.FlashcardSet).filter(
                self.models.FlashcardSet.user_id == self.user_id
            ).all()
            
            logger.info(f"Found {len(flashcard_sets)} flashcard sets")
            
            for flashcard_set in flashcard_sets:
                topic = flashcard_set.title
                
                # Get all cards in this set
                cards = self.db.query(self.models.Flashcard).filter(
                    self.models.Flashcard.set_id == flashcard_set.id
                ).all()
                
                if not cards:
                    continue
                
                # Calculate performance from individual card reviews
                total_reviews = 0
                total_correct = 0
                marked_count = 0
                last_review = None
                
                for card in cards:
                    times_reviewed = card.times_reviewed or 0
                    correct_count = card.correct_count or 0
                    
                    total_reviews += times_reviewed
                    total_correct += correct_count
                    
                    if card.marked_for_review:
                        marked_count += 1
                    
                    if card.last_reviewed:
                        if not last_review or card.last_reviewed > last_review:
                            last_review = card.last_reviewed
                
                if total_reviews > 0:
                    flashcard_data[topic] = {
                        "correct": total_correct,
                        "total": total_reviews,
                        "dont_know": total_reviews - total_correct,
                        "marked_for_review": marked_count,
                        "last_study": last_review,
                        "card_count": len(cards)
                    }
                    logger.info(f"Flashcard set '{topic}': {total_correct}/{total_reviews} correct, {marked_count} marked")
            
            logger.info(f"Analyzed {len(flashcard_data)} flashcard topics with data")
        except Exception as e:
            logger.error(f"Error analyzing flashcard reviews: {e}")
            import traceback
            traceback.print_exc()
        
        return flashcard_data
    
    def _analyze_chat_patterns(self) -> Dict[str, Dict]:
        """Analyze AI chat for repeated questions"""
        chat_data = {}
        
        try:
            # Get recent chat messages
            chat_messages = self.db.query(self.models.ChatMessage).join(
                self.models.ChatSession
            ).filter(
                self.models.ChatSession.user_id == self.user_id
            ).order_by(self.models.ChatMessage.timestamp.desc()).limit(200).all()
            
            logger.info(f"Analyzing {len(chat_messages)} chat messages")
            
            # Track topic mentions
            topic_mentions = {}
            confusion_keywords = ['what', 'how', 'why', 'explain', 'help', 'understand', 
                                'confused', 'don\'t get', 'stuck', 'struggling', 'difficult']
            
            for msg in chat_messages:
                user_msg = msg.user_message.lower()
                
                # Check for confusion
                has_confusion = any(keyword in user_msg for keyword in confusion_keywords)
                
                if has_confusion:
                    # Extract topics (words > 5 chars)
                    words = user_msg.split()
                    for word in words:
                        cleaned = ''.join(c for c in word if c.isalnum())
                        if len(cleaned) > 5 and cleaned.isalpha():
                            topic = cleaned.capitalize()
                            if topic not in topic_mentions:
                                topic_mentions[topic] = {
                                    "mentions": 0,
                                    "confusion_count": 0,
                                    "last_mention": None
                                }
                            topic_mentions[topic]["mentions"] += 1
                            topic_mentions[topic]["confusion_count"] += 1
                            if msg.timestamp:
                                if not topic_mentions[topic]["last_mention"] or msg.timestamp > topic_mentions[topic]["last_mention"]:
                                    topic_mentions[topic]["last_mention"] = msg.timestamp
            
            # Filter topics mentioned 3+ times
            for topic, data in topic_mentions.items():
                if data["mentions"] >= 3:
                    chat_data[topic] = {
                        "mentions": data["mentions"],
                        "confusion_count": data["confusion_count"],
                        "type": "repeated_questions",
                        "last_mention": data["last_mention"]
                    }
            
            logger.info(f"Found {len(chat_data)} topics with repeated confusion")
        except Exception as e:
            logger.error(f"Error analyzing chat patterns: {e}")
        
        return chat_data
    
    def _combine_and_score(
        self, 
        weak_area_records: Dict, 
        flashcard_data: Dict, 
        chat_data: Dict
    ) -> List[Dict]:
        """Combine all data and calculate severity scores"""
        
        all_topics = set(list(weak_area_records.keys()) + list(flashcard_data.keys()) + list(chat_data.keys()))
        comprehensive_analysis = []
        
        logger.info(f"Combining data for {len(all_topics)} unique topics")
        
        for topic in all_topics:
            weak_record = weak_area_records.get(topic, {"correct": 0, "total": 0, "incorrect": 0, "accuracy": 0})
            flash_info = flashcard_data.get(topic, {"correct": 0, "total": 0, "dont_know": 0, "marked_for_review": 0})
            chat_info = chat_data.get(topic, {"mentions": 0, "confusion_count": 0})
            
            # Calculate totals
            total_attempts = weak_record["total"] + flash_info["total"]
            if total_attempts == 0:
                continue
            
            total_correct = weak_record["correct"] + flash_info["correct"]
            accuracy = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            # === SEVERITY SCORE (0-100) ===
            severity = 0
            
            # Factor 1: Low accuracy (40 points)
            if accuracy < 30:
                severity += 40
            elif accuracy < 50:
                severity += 30
            elif accuracy < 70:
                severity += 20
            elif accuracy < 85:
                severity += 10
            
            # Factor 2: Volume of mistakes (30 points)
            total_wrong = weak_record["incorrect"] + flash_info["dont_know"]
            if total_wrong >= 10:
                severity += 30
            elif total_wrong >= 5:
                severity += 20
            elif total_wrong >= 3:
                severity += 10
            
            # Factor 3: Multiple sources (20 points)
            sources = []
            if weak_record["total"] > 0:
                sources.append("quiz")
            if flash_info["dont_know"] >= 1 or flash_info["marked_for_review"] >= 1:
                sources.append("flashcard")
            if chat_info["mentions"] >= 3:
                sources.append("chat")
            
            severity += len(sources) * 7
            
            # Factor 4: Recency (10 points)
            most_recent = None
            for data in [weak_record, flash_info, chat_info]:
                date_field = data.get("last_updated") or data.get("last_study") or data.get("last_mention")
                if date_field:
                    if not most_recent or date_field > most_recent:
                        most_recent = date_field
            
            if most_recent:
                days_ago = (datetime.utcnow() - most_recent).days
                if days_ago <= 1:
                    severity += 10
                elif days_ago <= 3:
                    severity += 7
                elif days_ago <= 7:
                    severity += 5
                elif days_ago <= 14:
                    severity += 3
            
            severity = min(100, severity)
            
            # Categorize
            if severity >= 70:
                category = "critical"
            elif severity >= 50:
                category = "needs_practice"
            elif severity >= 30:
                category = "improving"
            else:
                category = "strong"
            
            comprehensive_analysis.append({
                "topic": topic,
                "accuracy": round(accuracy, 1),
                "severity_score": severity,
                "category": category,
                "sources": sources,
                "quiz_performance": {
                    "correct": weak_record["correct"],
                    "total": weak_record["total"],
                    "incorrect": weak_record["incorrect"]
                },
                "flashcard_performance": {
                    "correct": flash_info["correct"],
                    "total": flash_info["total"],
                    "dont_know_count": flash_info["dont_know"],
                    "marked_for_review": flash_info.get("marked_for_review", 0)
                },
                "chat_mentions": chat_info["mentions"],
                "total_attempts": total_attempts,
                "total_correct": total_correct,
                "total_wrong": total_wrong,
                "last_activity": most_recent
            })
        
        # Sort by severity
        comprehensive_analysis.sort(key=lambda x: x["severity_score"], reverse=True)
        
        logger.info(f"Generated {len(comprehensive_analysis)} comprehensive weakness records")
        
        return comprehensive_analysis
    
    def _categorize_by_severity(self, analysis: List[Dict]) -> Dict[str, List[Dict]]:
        """Separate into categories"""
        return {
            "critical": [a for a in analysis if a["category"] == "critical"],
            "needs_practice": [a for a in analysis if a["category"] == "needs_practice"],
            "improving": [a for a in analysis if a["category"] == "improving"],
            "strong": [a for a in analysis if a["category"] == "strong"]
        }


def get_comprehensive_weakness_analysis(db: Session, user_id: int, models) -> Dict[str, Any]:
    """Get comprehensive weakness analysis"""
    analyzer = ComprehensiveWeaknessAnalyzer(db, user_id, models)
    return analyzer.analyze_all_sources()
