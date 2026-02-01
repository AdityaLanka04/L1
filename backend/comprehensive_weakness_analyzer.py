"""
COMPREHENSIVE WEAKNESS ANALYZER - PRODUCTION LEVEL WITH AI CLASSIFICATION
Analyzes user performance from REAL data sources with intelligent topic grouping.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import re
from collections import defaultdict

logger = logging.getLogger(__name__)


class TopicClassifier:
    """Production-level topic classifier with semantic understanding"""
    
    # Comprehensive topic taxonomy
    TOPIC_CATEGORIES = {
        # Mathematics
        'calculus': ['integral', 'derivative', 'differentiation', 'integration', 'limit', 'continuity'],
        'algebra': ['equation', 'polynomial', 'quadratic', 'linear', 'exponential', 'logarithm'],
        'geometry': ['triangle', 'circle', 'angle', 'area', 'volume', 'perimeter'],
        'trigonometry': ['sine', 'cosine', 'tangent', 'trig'],
        'statistics': ['mean', 'median', 'mode', 'variance', 'standard deviation', 'probability'],
        
        # Computer Science
        'algorithms': ['dijkstra', 'sorting', 'searching', 'dynamic programming', 'greedy', 'backtracking'],
        'data structures': ['array', 'linked list', 'tree', 'graph', 'stack', 'queue', 'heap'],
        'programming': ['loop', 'function', 'recursion', 'variable', 'class', 'object'],
        
        # Physics
        'mechanics': ['force', 'motion', 'velocity', 'acceleration', 'momentum', 'energy'],
        'electricity': ['current', 'voltage', 'resistance', 'circuit', 'capacitor'],
        'thermodynamics': ['heat', 'temperature', 'entropy', 'enthalpy'],
        
        # Chemistry
        'organic chemistry': ['hydrocarbon', 'alkane', 'alkene', 'benzene', 'functional group'],
        'inorganic chemistry': ['acid', 'base', 'salt', 'metal', 'ion'],
        'physical chemistry': ['reaction', 'equilibrium', 'kinetics', 'thermochemistry'],
    }
    
    @staticmethod
    def clean_topic(topic: str) -> str:
        """Clean and normalize topic string"""
        if not topic:
            return ""
        
        # Convert to lowercase
        cleaned = topic.lower().strip()
        
        # Remove common prefixes
        cleaned = re.sub(r'^(flashcards?:\s*|notes?:\s*|quiz:\s*|test:\s*)', '', cleaned)
        
        # Remove possessive forms
        cleaned = re.sub(r"'s\b", '', cleaned)
        
        # Remove trailing numbers and variables
        cleaned = re.sub(r'\s+\d+$', '', cleaned)
        cleaned = re.sub(r'\s+[a-z]\^?\d*$', '', cleaned)
        
        # Remove noise words
        noise_words = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with']
        words = cleaned.split()
        words = [w for w in words if w not in noise_words]
        cleaned = ' '.join(words)
        
        # Clean up spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned
    
    @staticmethod
    def extract_core_concept(topic: str) -> str:
        """Extract the core concept from a topic with better filtering"""
        cleaned = TopicClassifier.clean_topic(topic)
        
        if not cleaned:
            return None
        
        # Skip if too short (less than 4 characters)
        if len(cleaned) < 4:
            return None
        
        # Skip generic/noise terms (expanded list)
        generic_terms = [
            'flashcard', 'flashcards', 'question', 'questions', 'problem', 'problems', 
            'exercise', 'exercises', 'practice', 'test', 'quiz', 'hello', 'hi', 'hey',
            'thanks', 'thank', 'please', 'help', 'okay', 'yes', 'no', 'maybe',
            'what', 'when', 'where', 'which', 'who', 'how', 'why', 'can', 'could',
            'would', 'should', 'will', 'shall', 'may', 'might', 'must',
            'this', 'that', 'these', 'those', 'here', 'there', 'now', 'then',
            'good', 'bad', 'nice', 'great', 'awesome', 'cool', 'fine', 'okay',
            'something', 'anything', 'nothing', 'everything', 'someone', 'anyone',
            'understand', 'know', 'learn', 'study', 'review', 'explain'
        ]
        
        if cleaned.lower() in generic_terms:
            return None
        
        # Skip if it's just a greeting or common word
        common_words = ['hello', 'world', 'test', 'example', 'sample', 'demo']
        if cleaned.lower() in common_words:
            return None
        
        # Skip if it's all uppercase (likely an acronym or noise)
        if cleaned.isupper() and len(cleaned) < 6:
            return None
        
        # Extract main keyword (usually first significant word)
        words = cleaned.split()
        
        # Look for known concepts in the taxonomy
        for category, keywords in TopicClassifier.TOPIC_CATEGORIES.items():
            for keyword in keywords:
                if keyword in cleaned.lower():
                    return keyword
        
        # If no match, use the first significant word (length > 4)
        for word in words:
            if len(word) > 4 and word.lower() not in generic_terms:
                return word.lower()
        
        # Fallback: if first word is long enough and not generic
        if words and len(words[0]) >= 4 and words[0].lower() not in generic_terms:
            return words[0].lower()
        
        # If nothing passes, return None (don't classify)
        return None
    
    @staticmethod
    def classify_topic(topic: str) -> Tuple[str, str]:
        """
        Classify topic into (category, normalized_name)
        Returns: (category, display_name)
        """
        core_concept = TopicClassifier.extract_core_concept(topic)
        
        if not core_concept:
            return None, None
        
        # Find category
        category = 'general'
        for cat, keywords in TopicClassifier.TOPIC_CATEGORIES.items():
            if core_concept in keywords:
                category = cat
                break
        
        # Create display name (capitalize properly)
        display_name = core_concept.title()
        
        # Special cases for better display names
        display_mappings = {
            'dijkstra': 'Dijkstra\'s Algorithm',
            'integral': 'Integrals',
            'derivative': 'Derivatives',
            'equation': 'Equations',
            'quadratic': 'Quadratic Equations',
            'linear': 'Linear Equations',
            'polynomial': 'Polynomials',
            'logarithm': 'Logarithms',
            'trig': 'Trigonometry',
        }
        
        if core_concept in display_mappings:
            display_name = display_mappings[core_concept]
        
        return category, display_name
    
    @staticmethod
    def group_similar_topics(topics: List[str]) -> Dict[str, List[str]]:
        """Group similar topics together"""
        groups = defaultdict(list)
        
        for topic in topics:
            category, display_name = TopicClassifier.classify_topic(topic)
            if display_name:
                groups[display_name].append(topic)
        
        return dict(groups)


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
        """Analyze individual flashcard performance - ENHANCED with don't know tracking"""
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
                dont_know_count = 0
                last_review = None
                struggling_cards = []
                
                for card in cards:
                    times_reviewed = card.times_reviewed or 0
                    correct_count = card.correct_count or 0
                    
                    total_reviews += times_reviewed
                    total_correct += correct_count
                    
                    # Calculate don't know count (reviewed but not correct)
                    card_dont_know = times_reviewed - correct_count
                    dont_know_count += card_dont_know
                    
                    # Track cards marked for review (indicates difficulty)
                    if card.marked_for_review:
                        marked_count += 1
                        struggling_cards.append({
                            "question": card.question[:100],  # First 100 chars
                            "times_reviewed": times_reviewed,
                            "correct_count": correct_count,
                            "accuracy": (correct_count / times_reviewed * 100) if times_reviewed > 0 else 0
                        })
                    
                    # Also track cards with low accuracy (< 50%)
                    if times_reviewed >= 3:
                        accuracy = (correct_count / times_reviewed) if times_reviewed > 0 else 0
                        if accuracy < 0.5 and not card.marked_for_review:
                            struggling_cards.append({
                                "question": card.question[:100],
                                "times_reviewed": times_reviewed,
                                "correct_count": correct_count,
                                "accuracy": accuracy * 100
                            })
                    
                    if card.last_reviewed:
                        if not last_review or card.last_reviewed > last_review:
                            last_review = card.last_reviewed
                
                if total_reviews > 0:
                    accuracy = (total_correct / total_reviews * 100) if total_reviews > 0 else 0
                    
                    flashcard_data[topic] = {
                        "correct": total_correct,
                        "total": total_reviews,
                        "dont_know": dont_know_count,
                        "marked_for_review": marked_count,
                        "accuracy": accuracy,
                        "last_study": last_review,
                        "card_count": len(cards),
                        "struggling_cards": struggling_cards[:5],  # Top 5 struggling cards
                        "is_weak": (accuracy < 60) or (marked_count >= 3) or (dont_know_count >= 5)
                    }
                    logger.info(f"Flashcard set '{topic}': {total_correct}/{total_reviews} correct ({accuracy:.1f}%), {dont_know_count} don't know, {marked_count} marked, weak={flashcard_data[topic]['is_weak']}")
            
            logger.info(f"Analyzed {len(flashcard_data)} flashcard topics with data")
        except Exception as e:
            logger.error(f"Error analyzing flashcard reviews: {e}")
            import traceback
            traceback.print_exc()
        
        return flashcard_data
    
    def _analyze_chat_patterns(self) -> Dict[str, Dict]:
        """Analyze AI chat for repeated questions - IMPROVED with better topic extraction"""
        chat_data = {}
        
        try:
            # Get recent chat messages (last 30 days)
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            chat_messages = self.db.query(self.models.ChatMessage).join(
                self.models.ChatSession
            ).filter(
                self.models.ChatSession.user_id == self.user_id,
                self.models.ChatMessage.timestamp >= thirty_days_ago
            ).order_by(self.models.ChatMessage.timestamp.desc()).limit(500).all()
            
            logger.info(f"Analyzing {len(chat_messages)} chat messages from last 30 days")
            
            # Track topic mentions with better extraction
            topic_mentions = {}
            confusion_keywords = ['what', 'how', 'why', 'explain', 'help', 'understand', 
                                'confused', 'don\'t get', 'stuck', 'struggling', 'difficult',
                                'can you', 'could you', 'please explain', 'not sure', 'unclear']
            
            # Common academic topics to look for
            academic_topics = set()
            
            for msg in chat_messages:
                if not msg.user_message:
                    continue
                    
                user_msg = msg.user_message.lower()
                
                # Check for confusion indicators
                has_confusion = any(keyword in user_msg for keyword in confusion_keywords)
                
                # Extract potential topics (capitalized words, technical terms)
                words = user_msg.split()
                potential_topics = []
                
                for i, word in enumerate(words):
                    cleaned = ''.join(c for c in word if c.isalnum())
                    # Look for longer words (likely topics) or consecutive capitalized words
                    if len(cleaned) > 4 and cleaned.isalpha():
                        topic = cleaned.capitalize()
                        potential_topics.append(topic)
                    
                    # Check for multi-word topics (e.g., "machine learning")
                    if i < len(words) - 1:
                        two_word = f"{cleaned} {words[i+1]}".strip()
                        if len(two_word) > 8:
                            potential_topics.append(two_word.title())
                
                # Track all potential topics
                for topic in potential_topics:
                    if topic not in topic_mentions:
                        topic_mentions[topic] = {
                            "mentions": 0,
                            "confusion_count": 0,
                            "question_count": 0,
                            "last_mention": None,
                            "timestamps": []
                        }
                    
                    topic_mentions[topic]["mentions"] += 1
                    topic_mentions[topic]["timestamps"].append(msg.timestamp)
                    
                    if has_confusion:
                        topic_mentions[topic]["confusion_count"] += 1
                    
                    if '?' in user_msg:
                        topic_mentions[topic]["question_count"] += 1
                    
                    if msg.timestamp:
                        if not topic_mentions[topic]["last_mention"] or msg.timestamp > topic_mentions[topic]["last_mention"]:
                            topic_mentions[topic]["last_mention"] = msg.timestamp
            
            # Filter topics mentioned 3+ times (THRESHOLD: 3-4 times = doubtful)
            for topic, data in topic_mentions.items():
                if data["mentions"] >= 3:
                    # Calculate if questions are repeated (within short time spans)
                    timestamps = sorted(data["timestamps"])
                    repeated_within_week = 0
                    
                    for i in range(len(timestamps) - 1):
                        time_diff = (timestamps[i+1] - timestamps[i]).days
                        if time_diff <= 7:  # Within a week
                            repeated_within_week += 1
                    
                    # Mark as doubtful if 3+ mentions OR 2+ mentions with confusion
                    is_doubtful = (data["mentions"] >= 3) or (data["mentions"] >= 2 and data["confusion_count"] >= 2)
                    
                    if is_doubtful:
                        chat_data[topic] = {
                            "mentions": data["mentions"],
                            "confusion_count": data["confusion_count"],
                            "question_count": data["question_count"],
                            "repeated_within_week": repeated_within_week,
                            "type": "repeated_questions",
                            "last_mention": data["last_mention"],
                            "is_doubtful": True
                        }
                        logger.info(f"DOUBTFUL TOPIC: '{topic}' - {data['mentions']} mentions, {data['confusion_count']} confused, {repeated_within_week} repeated within week")
            
            logger.info(f"Found {len(chat_data)} doubtful topics from chat (3+ mentions or repeated confusion)")
        except Exception as e:
            logger.error(f"Error analyzing chat patterns: {e}")
            import traceback
            traceback.print_exc()
        
        return chat_data
    
    def _normalize_and_group_topics(
        self,
        weak_area_records: Dict,
        flashcard_data: Dict,
        chat_data: Dict
    ) -> Dict[str, Dict]:
        """Use AI-powered classifier to group topics intelligently"""
        
        # Collect all topics
        all_original_topics = list(set(
            list(weak_area_records.keys()) + 
            list(flashcard_data.keys()) + 
            list(chat_data.keys())
        ))
        
        logger.info(f"Classifying {len(all_original_topics)} original topics")
        
        # Group similar topics
        topic_groups = TopicClassifier.group_similar_topics(all_original_topics)
        
        logger.info(f"Grouped into {len(topic_groups)} unique topics")
        
        # Merge data for each group
        merged_data = {}
        
        for display_name, original_topics in topic_groups.items():
            if len(original_topics) > 1:
                logger.info(f"MERGED: '{display_name}' <- {original_topics}")
            
            # Initialize merged data structure
            merged_data[display_name] = {
                "weak_area": {"correct": 0, "total": 0, "incorrect": 0, "accuracy": 0},
                "flashcard": {
                    "correct": 0, "total": 0, "dont_know": 0, "marked_for_review": 0,
                    "is_weak": False, "struggling_cards": []
                },
                "chat": {
                    "mentions": 0, "confusion_count": 0, "is_doubtful": False,
                    "repeated_within_week": 0, "question_count": 0
                }
            }
            
            # Merge data from all original topics in this group
            for original_topic in original_topics:
                # Merge weak area data
                if original_topic in weak_area_records:
                    data = weak_area_records[original_topic]
                    merged = merged_data[display_name]["weak_area"]
                    merged["correct"] += data.get("correct", 0)
                    merged["total"] += data.get("total", 0)
                    merged["incorrect"] += data.get("incorrect", 0)
                
                # Merge flashcard data
                if original_topic in flashcard_data:
                    data = flashcard_data[original_topic]
                    merged = merged_data[display_name]["flashcard"]
                    merged["correct"] += data.get("correct", 0)
                    merged["total"] += data.get("total", 0)
                    merged["dont_know"] += data.get("dont_know", 0)
                    merged["marked_for_review"] += data.get("marked_for_review", 0)
                    merged["is_weak"] = merged["is_weak"] or data.get("is_weak", False)
                    
                    # Merge struggling cards (avoid duplicates)
                    existing_questions = {card.get("question", "")[:50] for card in merged["struggling_cards"]}
                    for card in data.get("struggling_cards", []):
                        card_preview = card.get("question", "")[:50]
                        if card_preview not in existing_questions:
                            merged["struggling_cards"].append(card)
                            existing_questions.add(card_preview)
                
                # Merge chat data
                if original_topic in chat_data:
                    data = chat_data[original_topic]
                    merged = merged_data[display_name]["chat"]
                    merged["mentions"] += data.get("mentions", 0)
                    merged["confusion_count"] += data.get("confusion_count", 0)
                    merged["is_doubtful"] = merged["is_doubtful"] or data.get("is_doubtful", False)
                    merged["repeated_within_week"] += data.get("repeated_within_week", 0)
                    merged["question_count"] += data.get("question_count", 0)
            
            # Calculate accuracy for merged weak area data
            merged_weak = merged_data[display_name]["weak_area"]
            if merged_weak["total"] > 0:
                merged_weak["accuracy"] = (merged_weak["correct"] / merged_weak["total"]) * 100
        
        return merged_data
    
    def _combine_and_score(
        self, 
        weak_area_records: Dict, 
        flashcard_data: Dict, 
        chat_data: Dict
    ) -> List[Dict]:
        """Combine all data and calculate severity scores - PRODUCTION LEVEL"""
        
        # Use AI-powered classifier to group topics
        grouped_topics = self._normalize_and_group_topics(
            weak_area_records, flashcard_data, chat_data
        )
        
        comprehensive_analysis = []
        
        logger.info(f"Scoring {len(grouped_topics)} grouped topics")
        
        for display_name, merged_data in grouped_topics.items():
            weak_record = merged_data["weak_area"]
            flash_info = merged_data["flashcard"]
            chat_info = merged_data["chat"]
            
            # Calculate totals
            total_attempts = weak_record["total"] + flash_info["total"]
            if total_attempts == 0 and chat_info["mentions"] == 0:
                # Skip topics with no data at all
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
            if flash_info["is_weak"] or flash_info["dont_know"] >= 1 or flash_info["marked_for_review"] >= 1:
                sources.append("flashcard")
            if chat_info["is_doubtful"] or chat_info["mentions"] >= 3:
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
            
            # BONUS: Boost severity for doubtful chat topics (repeated questions)
            if chat_info["is_doubtful"]:
                severity += 15
                if chat_info["repeated_within_week"] >= 2:
                    severity += 10  # Extra boost for questions repeated within same week
            
            # BONUS: Boost severity for struggling flashcards
            if flash_info["is_weak"]:
                severity += 10
            
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
                "topic": display_name,  # Use display name
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
                    "marked_for_review": flash_info.get("marked_for_review", 0),
                    "is_weak": flash_info.get("is_weak", False),
                    "struggling_cards": flash_info.get("struggling_cards", [])[:3]  # Top 3 struggling cards
                },
                "chat_analysis": {
                    "mentions": chat_info["mentions"],
                    "confusion_count": chat_info["confusion_count"],
                    "is_doubtful": chat_info.get("is_doubtful", False),
                    "repeated_within_week": chat_info.get("repeated_within_week", 0),
                    "question_count": chat_info.get("question_count", 0)
                },
                "total_attempts": total_attempts,
                "total_correct": total_correct,
                "total_wrong": total_wrong,
                "last_activity": most_recent
            })
        
        # Sort by severity
        comprehensive_analysis.sort(key=lambda x: x["severity_score"], reverse=True)
        
        logger.info(f"Generated {len(comprehensive_analysis)} comprehensive weakness records")
        logger.info(f"  - Critical: {len([a for a in comprehensive_analysis if a['category'] == 'critical'])}")
        logger.info(f"  - Needs Practice: {len([a for a in comprehensive_analysis if a['category'] == 'needs_practice'])}")
        logger.info(f"  - Improving: {len([a for a in comprehensive_analysis if a['category'] == 'improving'])}")
        logger.info(f"  - Doubtful (chat): {len([a for a in comprehensive_analysis if a['chat_analysis']['is_doubtful']])}")
        logger.info(f"  - Weak (flashcards): {len([a for a in comprehensive_analysis if a['flashcard_performance']['is_weak']])}")
        
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


def generate_topic_suggestions(db: Session, user_id: int, topic: str, models, ai_client) -> Dict[str, Any]:
    """Generate personalized suggestions and tips for a weak topic"""
    try:
        analyzer = ComprehensiveWeaknessAnalyzer(db, user_id, models)
        
        # Get the topic's analysis
        analysis = analyzer.analyze_all_sources()
        topic_data = None
        
        for item in analysis.get("all_topics", []):
            if item["topic"].lower() == topic.lower():
                topic_data = item
                break
        
        if not topic_data:
            return {
                "status": "error",
                "message": f"Topic '{topic}' not found in analysis"
            }
        
        # Build context for AI
        context = f"""Topic: {topic}
Accuracy: {topic_data['accuracy']}%
Total Attempts: {topic_data['total_attempts']}
Total Wrong: {topic_data['total_wrong']}
Sources: {', '.join(topic_data['sources'])}

Quiz Performance: {topic_data['quiz_performance']['incorrect']} wrong out of {topic_data['quiz_performance']['total']}
Flashcard Performance: {topic_data['flashcard_performance']['dont_know_count']} don't know, {topic_data['flashcard_performance']['marked_for_review']} marked for review
Chat Analysis: {topic_data['chat_analysis']['mentions']} mentions, {topic_data['chat_analysis']['confusion_count']} confused questions
"""
        
        # Generate suggestions using AI
        prompt = f"""You are an expert tutor analyzing a student's weak area. Based on the data below, provide personalized study suggestions.

{context}

Provide 3-5 actionable suggestions to help the student improve in this topic. Format as JSON:
{{
    "suggestions": [
        {{"title": "Suggestion title", "description": "Detailed explanation", "priority": "high|medium|low"}},
        ...
    ],
    "study_tips": [
        "Tip 1",
        "Tip 2",
        ...
    ],
    "recommended_resources": [
        "Resource 1",
        "Resource 2"
    ]
}}

Return ONLY valid JSON."""
        
        response = ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
        
        # Parse JSON response
        import re
        import json
        
        # Remove markdown code blocks if present
        if response.startswith('```'):
            response = re.sub(r'^```(?:json)?\n?', '', response, flags=re.DOTALL)
            response = re.sub(r'\n?```$', '', response, flags=re.DOTALL)
            response = response.strip()
        
        suggestions_data = json.loads(response)
        
        return {
            "status": "success",
            "topic": topic,
            "topic_data": topic_data,
            "suggestions": suggestions_data.get("suggestions", []),
            "study_tips": suggestions_data.get("study_tips", []),
            "recommended_resources": suggestions_data.get("recommended_resources", [])
        }
        
    except Exception as e:
        logger.error(f"Error generating topic suggestions: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e)
        }


def find_similar_questions(db: Session, user_id: int, topic: str, models) -> Dict[str, Any]:
    """Find similar questions from question bank for practice"""
    try:
        # Find questions related to this topic
        from sqlalchemy import or_
        
        # Search in UserWeakArea to get related questions
        weak_area = db.query(models.UserWeakArea).filter(
            models.UserWeakArea.user_id == user_id,
            models.UserWeakArea.topic == topic
        ).first()
        
        # Get wrong answer logs for this topic
        wrong_logs = db.query(models.WrongAnswerLog).filter(
            models.WrongAnswerLog.user_id == user_id,
            models.WrongAnswerLog.topic == topic
        ).order_by(models.WrongAnswerLog.answered_at.desc()).limit(10).all()
        
        similar_questions = []
        
        for log in wrong_logs:
            similar_questions.append({
                "question_id": log.question_id,
                "question_text": log.question_text,
                "difficulty": log.difficulty,
                "correct_answer": log.correct_answer,
                "user_answer": log.user_answer,
                "answered_at": log.answered_at.isoformat() if log.answered_at else None
            })
        
        # Also find questions from the same question sets
        if wrong_logs:
            question_set_ids = list(set([log.question_set_id for log in wrong_logs if log.question_set_id]))
            
            # Get more questions from these sets
            additional_questions = db.query(models.Question).filter(
                models.Question.question_set_id.in_(question_set_ids),
                models.Question.topic == topic
            ).limit(5).all()
            
            for q in additional_questions:
                # Check if not already in similar_questions
                if not any(sq["question_id"] == q.id for sq in similar_questions):
                    similar_questions.append({
                        "question_id": q.id,
                        "question_text": q.question_text,
                        "difficulty": q.difficulty,
                        "correct_answer": q.correct_answer,
                        "question_type": q.question_type,
                        "is_new": True  # Mark as new practice question
                    })
        
        return {
            "status": "success",
            "topic": topic,
            "similar_questions": similar_questions,
            "total_found": len(similar_questions),
            "weak_area_stats": {
                "total_questions": weak_area.total_questions if weak_area else 0,
                "accuracy": weak_area.accuracy if weak_area else 0,
                "incorrect_count": weak_area.incorrect_count if weak_area else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error finding similar questions: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e),
            "similar_questions": []
        }


def format_weakness_analysis_for_chat(db: Session, user_id: int, models) -> str:
    """
    Format weakness analysis as a clean, aesthetic markdown response for AI chat.
    Returns formatted text with proper LaTeX support and comprehensive statistics.
    """
    try:
        analysis = get_comprehensive_weakness_analysis(db, user_id, models)
        
        if analysis["status"] == "error":
            return "I couldn't analyze your weaknesses right now. Please try again later."
        
        # Build formatted response
        response_parts = []
        
        # Header - clean, no bold
        response_parts.append("Performance Analysis Report")
        response_parts.append("")
        
        # Summary Statistics
        summary = analysis.get("summary", {})
        total = summary.get("total_topics_analyzed", 0)
        critical = summary.get("critical_count", 0)
        needs_practice = summary.get("needs_practice_count", 0)
        improving = summary.get("improving_count", 0)
        
        if total == 0:
            return "Great news! I haven't detected any weak areas yet. Keep up the excellent work!"
        
        response_parts.append(f"I've analyzed {total} topics from your quizzes, flashcards, and our conversations.")
        response_parts.append("")
        
        # Overview Statistics Table - clean formatting
        response_parts.append("OVERVIEW STATISTICS")
        response_parts.append("")
        response_parts.append("| Category | Count | Percentage |")
        response_parts.append("|----------|-------|------------|")
        response_parts.append(f"| Critical Areas | {critical} | {(critical/total*100):.1f}% |")
        response_parts.append(f"| Needs Practice | {needs_practice} | {(needs_practice/total*100):.1f}% |")
        response_parts.append(f"| Improving | {improving} | {(improving/total*100):.1f}% |")
        
        # Calculate overall accuracy
        weak_areas = analysis.get("weak_areas", {})
        all_topics = (weak_areas.get("critical", []) + 
                     weak_areas.get("needs_practice", []) + 
                     weak_areas.get("improving", []))
        
        if all_topics:
            total_attempts = sum(t.get("total_attempts", 0) for t in all_topics)
            total_correct = sum(t.get("total_correct", 0) for t in all_topics)
            overall_accuracy = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            response_parts.append(f"| Overall Accuracy | {total_attempts} attempts | {overall_accuracy:.1f}% |")
        
        response_parts.append("")
        
        # Critical Areas - clean section headers
        critical_topics = weak_areas.get("critical", [])
        
        if critical_topics:
            response_parts.append(f"CRITICAL AREAS ({len(critical_topics)})")
            response_parts.append("These require immediate attention")
            response_parts.append("")
            
            for i, topic in enumerate(critical_topics[:5], 1):  # Top 5
                accuracy = topic.get("accuracy", 0)
                sources = ", ".join(topic.get("sources", []))
                total_wrong = topic.get("total_wrong", 0)
                total_attempts = topic.get("total_attempts", 0)
                
                response_parts.append(f"{i}. {topic['topic']}")
                response_parts.append(f"   • Accuracy: {accuracy}%")
                response_parts.append(f"   • Performance: {total_attempts - total_wrong}/{total_attempts} correct")
                response_parts.append(f"   • Sources: {sources}")
                
                # Add specific insights
                chat_analysis = topic.get("chat_analysis", {})
                if chat_analysis.get("is_doubtful"):
                    mentions = chat_analysis["mentions"]
                    response_parts.append(f"   • Asked about {mentions} times in conversations")
                
                flashcard_perf = topic.get("flashcard_performance", {})
                if flashcard_perf.get("is_weak"):
                    dont_know = flashcard_perf["dont_know_count"]
                    marked = flashcard_perf.get("marked_for_review", 0)
                    response_parts.append(f"   • Flashcards: {dont_know} 'don't know', {marked} marked for review")
                
                quiz_perf = topic.get("quiz_performance", {})
                if quiz_perf.get("total", 0) > 0:
                    quiz_wrong = quiz_perf.get("incorrect", 0)
                    quiz_total = quiz_perf["total"]
                    response_parts.append(f"   • Quiz: {quiz_wrong}/{quiz_total} incorrect")
                
                response_parts.append("")
        
        # Needs Practice - cleaner formatting
        needs_practice_topics = weak_areas.get("needs_practice", [])
        
        if needs_practice_topics:
            response_parts.append(f"NEEDS PRACTICE ({len(needs_practice_topics)})")
            response_parts.append("Work on these to improve")
            response_parts.append("")
            
            for i, topic in enumerate(needs_practice_topics[:5], 1):  # Top 5
                accuracy = topic.get("accuracy", 0)
                total_attempts = topic.get("total_attempts", 0)
                total_correct = topic.get("total_correct", 0)
                
                response_parts.append(f"{i}. {topic['topic']} - {accuracy}% ({total_correct}/{total_attempts} correct)")
            
            response_parts.append("")
        
        # Improving Areas
        improving_topics = weak_areas.get("improving", [])
        
        if improving_topics:
            response_parts.append(f"IMPROVING ({len(improving_topics)})")
            response_parts.append("You're making progress here")
            response_parts.append("")
            
            for i, topic in enumerate(improving_topics[:3], 1):  # Top 3
                accuracy = topic.get("accuracy", 0)
                total_attempts = topic.get("total_attempts", 0)
                response_parts.append(f"{i}. {topic['topic']} - {accuracy}% ({total_attempts} attempts)")
            
            response_parts.append("")
        
        # Strengths
        strengths = analysis.get("strengths", [])
        if strengths:
            response_parts.append(f"YOUR STRENGTHS ({len(strengths)})")
            response_parts.append("Topics you've mastered")
            response_parts.append("")
            
            for i, topic in enumerate(strengths[:5], 1):  # Top 5
                accuracy = topic.get("accuracy", 0)
                total_attempts = topic.get("total_attempts", 0)
                response_parts.append(f"{i}. {topic['topic']} - {accuracy}% ({total_attempts} attempts)")
            
            response_parts.append("")
        
        # Recommendations - cleaner list
        response_parts.append("RECOMMENDATIONS")
        response_parts.append("")
        
        if critical_topics:
            top_critical = critical_topics[0]["topic"]
            response_parts.append(f"1. Prioritize {top_critical} - This is your highest priority area")
            response_parts.append(f"2. Practice with flashcards - Create or review flashcard sets for weak topics")
            response_parts.append(f"3. Take targeted quizzes - Focus on your critical areas to build confidence")
            response_parts.append(f"4. Ask specific questions - Don't hesitate to ask me about concepts you're struggling with")
        else:
            response_parts.append("1. Continue regular practice - Maintain your current study routine")
            response_parts.append("2. Review periodically - Revisit topics to prevent knowledge decay")
            response_parts.append("3. Challenge yourself - Try more difficult problems to deepen understanding")
        
        # Add link to weaknesses page - cleaner
        response_parts.append("")
        response_parts.append("[View Detailed Weakness Analysis →](/weaknesses)")
        response_parts.append("")
        response_parts.append("Want to dive deeper into any topic? Just ask me!")
        
        return "\n".join(response_parts)
        
    except Exception as e:
        logger.error(f"Error formatting weakness analysis: {e}")
        import traceback
        traceback.print_exc()
        return "I encountered an error while analyzing your weaknesses. Please try again."
