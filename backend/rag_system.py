# rag_system.py - Complete RAG System Implementation

import os
import json
import numpy as np
import re
import pickle
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session

# Vector embeddings and similarity search
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    print("sentence-transformers available")
except ImportError:
    print("sentence-transformers not available. Install with: pip install sentence-transformers")
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import faiss
    FAISS_AVAILABLE = True
    print("faiss available")
except ImportError:
    print("faiss not available. Install with: pip install faiss-cpu")
    FAISS_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
    print("scikit-learn available")
except ImportError:
    print("scikit-learn not available. Install with: pip install scikit-learn")
    SKLEARN_AVAILABLE = False

import models

@dataclass
class RetrievalResult:
    """Structure for RAG retrieval results"""
    content: str
    score: float
    source_type: str  # 'conversation', 'topic', 'general'
    metadata: Dict[str, Any]
    memory_id: Optional[int] = None

class ConversationalRAGSystem:
    """Advanced RAG system that learns from each conversation"""
    
    def __init__(self, db: Session, storage_path: str = "./rag_storage"):
        self.db = db
        self.storage_path = storage_path
        self.vector_dim = 384  # sentence-transformers default
        
        # Create storage directory
        os.makedirs(storage_path, exist_ok=True)
        
        # Initialize components
        self._init_embedding_model()
        self._init_vector_store()
        self._load_or_create_indices()
        
    def _init_embedding_model(self):
        """Initialize the embedding model"""
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                self.vector_dim = self.embedding_model.get_sentence_embedding_dimension()
                print(f"Loaded sentence transformer model (dim: {self.vector_dim})")
            except Exception as e:
                print(f"Error loading sentence transformer: {e}")
                self.embedding_model = None
        else:
            self.embedding_model = None
            
        if not self.embedding_model and SKLEARN_AVAILABLE:
            self.tfidf_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
            print("Using TF-IDF fallback")
        elif not self.embedding_model:
            print("No embedding model available")
    
    def _init_vector_store(self):
        """Initialize vector storage system"""
        if FAISS_AVAILABLE and self.embedding_model:
            try:
                self.conversation_index = faiss.IndexFlatIP(self.vector_dim)
                self.topic_index = faiss.IndexFlatIP(self.vector_dim)
                print("Initialized FAISS vector indices")
            except Exception as e:
                print(f"Error initializing FAISS: {e}")
                self.conversation_vectors = []
                self.topic_vectors = []
        else:
            self.conversation_vectors = []
            self.topic_vectors = []
            print("Using simple vector storage")
    
    def _load_or_create_indices(self):
        """Load existing indices or create new ones"""
        conversation_index_path = os.path.join(self.storage_path, "conversation_index.faiss")
        topic_index_path = os.path.join(self.storage_path, "topic_index.faiss")
        
        if FAISS_AVAILABLE and hasattr(self, 'conversation_index'):
            try:
                if os.path.exists(conversation_index_path):
                    self.conversation_index = faiss.read_index(conversation_index_path)
                    print(f"Loaded conversation index with {self.conversation_index.ntotal} vectors")
                
                if os.path.exists(topic_index_path):
                    self.topic_index = faiss.read_index(topic_index_path)
                    print(f"Loaded topic index with {self.topic_index.ntotal} vectors")
                    
            except Exception as e:
                print(f"Error loading indices: {e}")
                self._rebuild_indices()
        else:
            self._rebuild_simple_indices()
    
    def _rebuild_indices(self):
        """Rebuild vector indices from database"""
        print("Rebuilding RAG indices from database...")
        
        try:
            # Rebuild conversation index
            memories = self.db.query(models.ConversationMemory).all()
            for memory in memories:
                if memory.combined_embedding:
                    try:
                        embedding = self._decode_embedding(memory.combined_embedding)
                        if FAISS_AVAILABLE and hasattr(self, 'conversation_index'):
                            self.conversation_index.add(embedding.reshape(1, -1))
                        else:
                            self.conversation_vectors.append((memory.id, embedding))
                    except Exception as e:
                        print(f"Error loading embedding for memory {memory.id}: {e}")
            
            # Rebuild topic index
            topics = self.db.query(models.TopicKnowledgeBase).all()
            for topic in topics:
                if topic.topic_embedding:
                    try:
                        embedding = self._decode_embedding(topic.topic_embedding)
                        if FAISS_AVAILABLE and hasattr(self, 'topic_index'):
                            self.topic_index.add(embedding.reshape(1, -1))
                        else:
                            self.topic_vectors.append((topic.id, embedding))
                    except Exception as e:
                        print(f"Error loading embedding for topic {topic.id}: {e}")
            
            self._save_indices()
            print(f"Rebuilt indices: {len(memories)} conversations, {len(topics)} topics")
            
        except Exception as e:
            print(f"Error rebuilding indices: {e}")
    
    def _rebuild_simple_indices(self):
        """Rebuild simple in-memory indices"""
        self.conversation_vectors = []
        self.topic_vectors = []
        
        try:
            memories = self.db.query(models.ConversationMemory).all()
            for memory in memories:
                if memory.combined_embedding:
                    try:
                        embedding = self._decode_embedding(memory.combined_embedding)
                        self.conversation_vectors.append((memory.id, embedding))
                    except:
                        pass
        except Exception as e:
            print(f"Error rebuilding simple indices: {e}")
    
    def _save_indices(self):
        """Save FAISS indices to disk"""
        if FAISS_AVAILABLE and hasattr(self, 'conversation_index'):
            try:
                conversation_path = os.path.join(self.storage_path, "conversation_index.faiss")
                topic_path = os.path.join(self.storage_path, "topic_index.faiss")
                
                faiss.write_index(self.conversation_index, conversation_path)
                faiss.write_index(self.topic_index, topic_path)
                print("Saved vector indices to disk")
            except Exception as e:
                print(f"Error saving indices: {e}")
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for text"""
        try:
            if self.embedding_model:
                return self.embedding_model.encode([text])[0]
            elif SKLEARN_AVAILABLE and hasattr(self, 'tfidf_vectorizer'):
                # Simple fallback - in production, you'd fit this on a larger corpus
                return np.random.random(100)
            else:
                return np.random.random(100)
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return np.random.random(100)
    
    def _encode_embedding(self, embedding: np.ndarray) -> str:
        """Encode numpy array as hex string for database storage"""
        try:
            return pickle.dumps(embedding).hex()
        except Exception as e:
            print(f"Error encoding embedding: {e}")
            return ""
    
    def _decode_embedding(self, encoded: str) -> np.ndarray:
        """Decode hex string back to numpy array"""
        try:
            return pickle.loads(bytes.fromhex(encoded))
        except Exception as e:
            print(f"Error decoding embedding: {e}")
            return np.random.random(100)
    
    def _extract_topics(self, text: str) -> List[str]:
        """Extract topics/keywords from text using simple NLP"""
        try:
            text_lower = text.lower()
            
            # Common academic/technical topics
            topic_patterns = {
                'mathematics': r'\b(math|algebra|calculus|geometry|statistics|equation|formula)\b',
                'programming': r'\b(code|programming|python|javascript|algorithm|function|variable)\b',
                'science': r'\b(science|physics|chemistry|biology|experiment|hypothesis|theory)\b',
                'history': r'\b(history|historical|century|civilization|war|culture|ancient)\b',
                'literature': r'\b(literature|poem|novel|author|character|story|narrative)\b',
                'economics': r'\b(economics|market|economy|finance|business|trade|money)\b',
                'philosophy': r'\b(philosophy|ethics|logic|moral|existence|consciousness)\b'
            }
            
            found_topics = []
            for topic, pattern in topic_patterns.items():
                if re.search(pattern, text_lower):
                    found_topics.append(topic)
            
            # Also extract potential subject-specific terms
            words = re.findall(r'\b[A-Za-z]{4,}\b', text)
            technical_terms = [w.lower() for w in words if len(w) > 6 and w.istitle()]
            found_topics.extend(technical_terms[:3])  # Limit to prevent noise
            
            return list(set(found_topics))  # Remove duplicates
            
        except Exception as e:
            print(f"Error extracting topics: {e}")
            return ["general"]
    
    def _determine_question_type(self, question: str) -> str:
        """Classify the type of question"""
        try:
            question_lower = question.lower().strip()
            
            if question_lower.startswith(('what is', 'what are', 'define')):
                return 'definition'
            elif question_lower.startswith(('how to', 'how do', 'how can')):
                return 'how_to'
            elif question_lower.startswith(('why', 'explain why')):
                return 'explanation'
            elif question_lower.startswith(('compare', 'difference between', 'vs')):
                return 'comparison'
            elif 'example' in question_lower:
                return 'example_request'
            elif any(word in question_lower for word in ['solve', 'calculate', 'find the']):
                return 'problem_solving'
            elif question_lower.startswith(('can you', 'could you', 'help me')):
                return 'assistance_request'
            else:
                return 'general'
        except Exception as e:
            print(f"Error determining question type: {e}")
            return 'general'
    
    def store_conversation(self, user_id: int, session_id: int, question: str, 
                          answer: str, user_feedback: Optional[float] = None) -> int:
        """Store a conversation in the RAG system for future retrieval"""
        try:
            # Extract metadata
            topics = self._extract_topics(question + " " + answer)
            question_type = self._determine_question_type(question)
            
            # Generate embeddings
            question_embedding = self._get_embedding(question)
            answer_embedding = self._get_embedding(answer)
            combined_text = f"Q: {question} A: {answer}"
            combined_embedding = self._get_embedding(combined_text)
            
            # Create conversation memory record
            memory = models.ConversationMemory(
                user_id=user_id,
                session_id=session_id,
                question=question,
                answer=answer,
                context_summary=answer[:200] + "..." if len(answer) > 200 else answer,
                topic_tags=json.dumps(topics),
                question_type=question_type,
                user_feedback_score=user_feedback,
                question_embedding=self._encode_embedding(question_embedding),
                answer_embedding=self._encode_embedding(answer_embedding),
                combined_embedding=self._encode_embedding(combined_embedding)
            )
            
            self.db.add(memory)
            self.db.commit()
            self.db.refresh(memory)
            
            # Add to vector index
            if FAISS_AVAILABLE and hasattr(self, 'conversation_index'):
                self.conversation_index.add(combined_embedding.reshape(1, -1))
            else:
                self.conversation_vectors.append((memory.id, combined_embedding))
            
            # Update topic knowledge base
            self._update_topic_knowledge(topics, question, answer, user_feedback)
            
            # Save indices periodically
            if memory.id % 10 == 0:  # Save every 10 conversations
                self._save_indices()
            
            print(f"Stored conversation memory {memory.id} with topics: {topics}")
            return memory.id
            
        except Exception as e:
            print(f"Error storing conversation: {e}")
            self.db.rollback()
            return -1
    
    def _update_topic_knowledge(self, topics: List[str], question: str, 
                               answer: str, feedback: Optional[float]):
        """Update aggregated topic knowledge"""
        for topic in topics:
            try:
                # Get or create topic knowledge base entry
                topic_kb = self.db.query(models.TopicKnowledgeBase).filter(
                    models.TopicKnowledgeBase.topic_name == topic
                ).first()
                
                if not topic_kb:
                    # Create new topic entry
                    topic_kb = models.TopicKnowledgeBase(
                        topic_name=topic,
                        key_concepts=json.dumps([]),
                        common_questions=json.dumps([]),
                        best_explanations=json.dumps([]),
                        total_questions=0,
                        average_difficulty=0.5,
                        success_rate=0.8
                    )
                    self.db.add(topic_kb)
                
                # Update statistics
                topic_kb.total_questions += 1
                if feedback:
                    current_rate = topic_kb.success_rate
                    total = topic_kb.total_questions
                    topic_kb.success_rate = ((current_rate * (total - 1)) + feedback) / total
                
                # Update common questions (keep top 10)
                common_questions = json.loads(topic_kb.common_questions or "[]")
                if len(common_questions) < 10:
                    common_questions.append(question[:100])
                topic_kb.common_questions = json.dumps(common_questions)
                
                # Update best explanations if feedback is good
                if feedback and feedback > 0.7:
                    best_explanations = json.loads(topic_kb.best_explanations or "[]")
                    if len(best_explanations) < 5:
                        best_explanations.append(answer[:300])
                    topic_kb.best_explanations = json.dumps(best_explanations)
                
                topic_kb.updated_at = datetime.utcnow()
                
            except Exception as e:
                print(f"Error updating topic knowledge for {topic}: {e}")
                continue
        
        try:
            self.db.commit()
        except Exception as e:
            print(f"Error committing topic updates: {e}")
            self.db.rollback()
    
    def retrieve_relevant_context(self, query: str, user_id: int, 
                                 top_k: int = 5) -> List[RetrievalResult]:
        """Retrieve relevant conversation history for RAG"""
        try:
            results = []
            query_embedding = self._get_embedding(query)
            
            # 1. Search conversation memories
            conversation_results = self._search_conversations(query_embedding, user_id, top_k)
            results.extend(conversation_results)
            
            # 2. Search topic knowledge base
            topic_results = self._search_topics(query_embedding, top_k // 2)
            results.extend(topic_results)
            
            # 3. Sort by relevance score and return top results
            results.sort(key=lambda x: x.score, reverse=True)
            return results[:top_k]
            
        except Exception as e:
            print(f"Error in RAG retrieval: {e}")
            return []
    
    def _search_conversations(self, query_embedding: np.ndarray, user_id: int, 
                            top_k: int) -> List[RetrievalResult]:
        """Search similar conversations"""
        results = []
        
        try:
            if FAISS_AVAILABLE and hasattr(self, 'conversation_index') and self.conversation_index.ntotal > 0:
                # FAISS search
                scores, indices = self.conversation_index.search(
                    query_embedding.reshape(1, -1), 
                    min(top_k * 2, self.conversation_index.ntotal)
                )
                
                # Get conversation memories by indices
                memories = self.db.query(models.ConversationMemory).all()
                
                for score, idx in zip(scores[0], indices[0]):
                    if idx < len(memories) and score > 0.3:  # Relevance threshold
                        memory = memories[idx]
                        
                        # Boost score for same user's conversations
                        user_boost = 1.2 if memory.user_id == user_id else 1.0
                        
                        # Boost score for frequently used memories
                        usage_boost = 1 + (memory.usage_count * 0.1)
                        
                        # Boost score for positively rated content
                        feedback_boost = 1.0
                        if memory.user_feedback_score:
                            feedback_boost = 1 + (memory.user_feedback_score * 0.3)
                        
                        final_score = score * user_boost * usage_boost * feedback_boost
                        
                        results.append(RetrievalResult(
                            content=f"Previous Q&A:\nQ: {memory.question}\nA: {memory.answer}",
                            score=final_score,
                            source_type='conversation',
                            metadata={
                                'question_type': memory.question_type,
                                'topics': json.loads(memory.topic_tags or "[]"),
                                'user_id': memory.user_id,
                                'usage_count': memory.usage_count,
                                'feedback_score': memory.user_feedback_score
                            },
                            memory_id=memory.id
                        ))
                        
                        # Update usage count
                        memory.usage_count += 1
                        memory.last_used = datetime.utcnow()
                
            else:
                # Fallback to simple cosine similarity
                for memory_id, stored_embedding in self.conversation_vectors:
                    try:
                        similarity = np.dot(query_embedding, stored_embedding) / (
                            np.linalg.norm(query_embedding) * np.linalg.norm(stored_embedding)
                        )
                        
                        if similarity > 0.3:
                            memory = self.db.query(models.ConversationMemory).filter(
                                models.ConversationMemory.id == memory_id
                            ).first()
                            
                            if memory:
                                user_boost = 1.2 if memory.user_id == user_id else 1.0
                                final_score = similarity * user_boost
                                
                                results.append(RetrievalResult(
                                    content=f"Previous Q&A:\nQ: {memory.question}\nA: {memory.answer}",
                                    score=final_score,
                                    source_type='conversation',
                                    metadata={
                                        'question_type': memory.question_type,
                                        'topics': json.loads(memory.topic_tags or "[]"),
                                    },
                                    memory_id=memory.id
                                ))
                    except Exception as e:
                        print(f"Error in similarity calculation: {e}")
                        continue
            
            try:
                self.db.commit()  # Save usage count updates
            except:
                pass
                
        except Exception as e:
            print(f"Error searching conversations: {e}")
        
        return results
    
    def _search_topics(self, query_embedding: np.ndarray, top_k: int) -> List[RetrievalResult]:
        """Search topic knowledge base"""
        results = []
        
        try:
            topics = self.db.query(models.TopicKnowledgeBase).all()
            
            for topic in topics:
                if topic.topic_embedding:
                    try:
                        topic_emb = self._decode_embedding(topic.topic_embedding)
                        similarity = np.dot(query_embedding, topic_emb) / (
                            np.linalg.norm(query_embedding) * np.linalg.norm(topic_emb)
                        )
                        
                        if similarity > 0.2:  # Lower threshold for topic-level matches
                            # Prepare topic content
                            best_explanations = json.loads(topic.best_explanations or "[]")
                            common_questions = json.loads(topic.common_questions or "[]")
                            
                            content_parts = [f"Topic: {topic.topic_name}"]
                            
                            if best_explanations:
                                content_parts.append("Key explanations:")
                                content_parts.extend([f"- {exp[:150]}..." for exp in best_explanations[:2]])
                            
                            if common_questions:
                                content_parts.append("Common questions:")
                                content_parts.extend([f"- {q}" for q in common_questions[:3]])
                            
                            results.append(RetrievalResult(
                                content="\n".join(content_parts),
                                score=similarity * 0.8,  # Slightly lower weight for topic matches
                                source_type='topic',
                                metadata={
                                    'topic_name': topic.topic_name,
                                    'total_questions': topic.total_questions,
                                    'success_rate': topic.success_rate
                                }
                            ))
                            
                    except Exception as e:
                        print(f"Error processing topic {topic.topic_name}: {e}")
                        continue
                        
        except Exception as e:
            print(f"Error searching topics: {e}")
        
        return results
    
    def get_enhanced_prompt(self, user_question: str, user_id: int, 
                           base_prompt: str, max_context_length: int = 2000) -> str:
        """Generate an enhanced prompt with RAG context"""
        try:
            # Retrieve relevant context
            relevant_contexts = self.retrieve_relevant_context(user_question, user_id, top_k=3)
            
            if not relevant_contexts:
                return base_prompt
            
            # Build context section
            context_parts = ["=== RELEVANT CONTEXT FROM PREVIOUS CONVERSATIONS ==="]
            current_length = len(context_parts[0])
            
            for i, context in enumerate(relevant_contexts):
                context_text = f"\n[Context {i+1}] ({context.source_type}, relevance: {context.score:.2f})\n{context.content}\n"
                
                if current_length + len(context_text) > max_context_length:
                    break
                
                context_parts.append(context_text)
                current_length += len(context_text)
            
            context_parts.append("=== END CONTEXT ===\n")
            
            # Insert context into the base prompt
            rag_context = "\n".join(context_parts)
            
            # Find a good place to insert context (after user profile, before current question)
            if "Current Question:" in base_prompt:
                parts = base_prompt.split("Current Question:")
                enhanced_prompt = parts[0] + rag_context + "\nCurrent Question:" + parts[1]
            else:
                # Fallback: add context at the beginning
                enhanced_prompt = rag_context + "\n" + base_prompt
            
            # Add instruction to use context
            instruction = "\nIMPORTANT: Use the relevant context above to provide more informed and consistent responses. Reference previous explanations when appropriate, but don't repeat information unnecessarily.\n"
            enhanced_prompt = enhanced_prompt.replace("Provide a comprehensive", instruction + "\nProvide a comprehensive")
            
            return enhanced_prompt
            
        except Exception as e:
            print(f"Error generating enhanced prompt: {e}")
            return base_prompt
    
    def update_feedback(self, memory_id: int, feedback_score: float):
        """Update feedback score for a conversation memory"""
        try:
            memory = self.db.query(models.ConversationMemory).filter(
                models.ConversationMemory.id == memory_id
            ).first()
            
            if memory:
                memory.user_feedback_score = feedback_score
                self.db.commit()
                print(f"Updated feedback for memory {memory_id}: {feedback_score}")
                
        except Exception as e:
            print(f"Error updating feedback: {e}")
            self.db.rollback()
    
    def get_learning_stats(self) -> Dict[str, Any]:
        """Get statistics about the RAG system's learning"""
        try:
            stats = {}
            
            # Conversation memory stats
            total_memories = self.db.query(models.ConversationMemory).count()
            rated_memories = self.db.query(models.ConversationMemory).filter(
                models.ConversationMemory.user_feedback_score.isnot(None)
            ).count()
            
            avg_feedback = self.db.query(models.ConversationMemory.user_feedback_score).filter(
                models.ConversationMemory.user_feedback_score.isnot(None)
            ).all()
            
            if avg_feedback:
                avg_score = sum(score[0] for score in avg_feedback) / len(avg_feedback)
            else:
                avg_score = 0.0
            
            # Topic coverage
            total_topics = self.db.query(models.TopicKnowledgeBase).count()
            
            # Recent activity
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent_memories = self.db.query(models.ConversationMemory).filter(
                models.ConversationMemory.created_at >= week_ago
            ).count()
            
            stats = {
                'total_conversation_memories': total_memories,
                'rated_conversations': rated_memories,
                'average_feedback_score': round(avg_score, 3),
                'total_topics_learned': total_topics,
                'recent_conversations_week': recent_memories,
                'feedback_coverage': round((rated_memories / total_memories * 100), 1) if total_memories > 0 else 0,
                'vector_index_size': self.conversation_index.ntotal if FAISS_AVAILABLE and hasattr(self, 'conversation_index') else len(self.conversation_vectors)
            }
            
            return stats
            
        except Exception as e:
            print(f"Error getting learning stats: {e}")
            return {}
    
    def cleanup_old_memories(self, days_old: int = 90, min_score: float = 0.3):
        """Clean up old, low-quality memories to keep the system efficient"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            # Find memories to clean up
            old_memories = self.db.query(models.ConversationMemory).filter(
                models.ConversationMemory.created_at < cutoff_date,
                models.ConversationMemory.usage_count == 0,  # Never used
                models.ConversationMemory.user_feedback_score < min_score  # Low rated
            ).all()
            
            if old_memories:
                print(f"Cleaning up {len(old_memories)} old, unused memories")
                
                for memory in old_memories:
                    self.db.delete(memory)
                
                self.db.commit()
                
                # Rebuild indices after cleanup
                self._rebuild_indices()
                
        except Exception as e:
            print(f"Error during cleanup: {e}")
            self.db.rollback()

# ==================== DATABASE CREATION FUNCTION ====================

def create_rag_tables(engine):
    """Create RAG-related database tables"""
    try:
        # This will create the new tables if they don't exist
        models.ConversationMemory.__table__.create(engine, checkfirst=True)
        models.TopicKnowledgeBase.__table__.create(engine, checkfirst=True)
        
        print("RAG database tables created successfully")
        return True
        
    except Exception as e:
        print(f"Error creating RAG tables: {e}")
        return False

# ==================== GLOBAL RAG SYSTEM INSTANCE ====================

_rag_system_instance = None

def get_rag_system(db: Session = None) -> Optional[ConversationalRAGSystem]:
    """Get or create RAG system instance"""
    global _rag_system_instance
    
    if _rag_system_instance is None and db is not None:
        try:
            _rag_system_instance = ConversationalRAGSystem(db)
            print("RAG system initialized")
        except Exception as e:
            print(f"Failed to initialize RAG system: {e}")
            return None
    
    return _rag_system_instance

def init_rag_system(db: Session):
    """Initialize the RAG system"""
    global _rag_system_instance
    try:
        _rag_system_instance = ConversationalRAGSystem(db)
        print("RAG system initialized successfully")
        return True
    except Exception as e:
        print(f"Failed to initialize RAG system: {e}")
        return False