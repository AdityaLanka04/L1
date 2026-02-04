"""
Advanced RAG System
Implements hybrid search, re-ranking, GraphRAG, and Agentic RAG.

Features:
1. Hybrid Search - Combines semantic (vector) + keyword (BM25) search
2. Re-ranking - Cross-encoder models for improved relevance scoring
3. GraphRAG - Knowledge graph-enhanced retrieval
4. Agentic RAG - Agents autonomously decide retrieval strategy
5. Query Enhancement - Query rewriting, expansion, and decomposition
6. Contextual Compression - Intelligent context pruning
7. Parent-Child Retrieval - Hierarchical document retrieval
8. Metadata Filtering - Advanced filtering and routing
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, Tuple, Literal
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)


class SearchMode(str, Enum):
    """Search modes for hybrid search"""
    SEMANTIC = "semantic"       # Vector similarity only
    KEYWORD = "keyword"         # BM25/keyword only
    HYBRID = "hybrid"           # Combined semantic + keyword
    GRAPH = "graph"             # Knowledge graph traversal
    AGENTIC = "agentic"         # Agent-decided strategy


class QueryType(str, Enum):
    """Types of queries for different handling"""
    FACTUAL = "factual"         # Simple fact lookup
    CONCEPTUAL = "conceptual"   # Understanding concepts
    PROCEDURAL = "procedural"   # How-to questions
    COMPARATIVE = "comparative" # Comparing things
    ANALYTICAL = "analytical"   # Deep analysis
    MULTI_HOP = "multi_hop"     # Requires multiple retrievals


@dataclass
class RAGResult:
    """Result from RAG retrieval"""
    id: str
    content: str
    score: float
    source: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Re-ranking info
    original_score: float = 0.0
    rerank_score: float = 0.0
    
    # Graph info
    graph_context: List[str] = field(default_factory=list)
    related_concepts: List[str] = field(default_factory=list)
    
    # Parent-child info
    parent_id: Optional[str] = None
    child_ids: List[str] = field(default_factory=list)
    chunk_index: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "score": self.score,
            "source": self.source,
            "metadata": self.metadata,
            "graph_context": self.graph_context,
            "related_concepts": self.related_concepts,
            "parent_id": self.parent_id,
            "chunk_index": self.chunk_index
        }


# ==================== Query Enhancement ====================

class QueryEnhancer:
    """
    Enhances queries through rewriting, expansion, and decomposition.
    Improves retrieval quality by making queries more effective.
    """
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
        
        # Common query patterns
        self.expansion_terms = {
            "ml": ["machine learning", "ML", "artificial intelligence"],
            "ai": ["artificial intelligence", "AI", "machine learning"],
            "db": ["database", "DB", "data storage"],
            "api": ["API", "application programming interface", "web service"],
        }
    
    async def enhance_query(
        self,
        query: str,
        query_type: QueryType = None,
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Enhance query with multiple techniques.
        
        Returns:
            Dict with original, rewritten, expanded, and sub-queries
        """
        user_context = user_context or {}
        
        # Detect query type if not provided
        if not query_type:
            query_type = self._detect_query_type(query)
        
        # Generate enhancements
        rewritten = await self._rewrite_query(query, query_type)
        expanded = self._expand_query(query, user_context)
        sub_queries = await self._decompose_query(query, query_type)
        
        return {
            "original": query,
            "rewritten": rewritten,
            "expanded": expanded,
            "sub_queries": sub_queries,
            "query_type": query_type.value,
            "all_queries": [query, rewritten] + expanded + sub_queries
        }
    
    def _detect_query_type(self, query: str) -> QueryType:
        """Detect the type of query"""
        query_lower = query.lower()
        
        # Multi-hop indicators
        if any(word in query_lower for word in ["and then", "after that", "followed by", "relationship between"]):
            return QueryType.MULTI_HOP
        
        # Comparative indicators
        if any(word in query_lower for word in ["compare", "difference", "versus", "vs", "better than"]):
            return QueryType.COMPARATIVE
        
        # Procedural indicators
        if any(word in query_lower for word in ["how to", "steps to", "process of", "way to"]):
            return QueryType.PROCEDURAL
        
        # Analytical indicators
        if any(word in query_lower for word in ["why", "analyze", "evaluate", "assess", "impact of"]):
            return QueryType.ANALYTICAL
        
        # Conceptual indicators
        if any(word in query_lower for word in ["what is", "explain", "concept of", "meaning of"]):
            return QueryType.CONCEPTUAL
        
        # Default to factual
        return QueryType.FACTUAL
    
    async def _rewrite_query(self, query: str, query_type: QueryType) -> str:
        """Rewrite query for better retrieval"""
        if not self.ai_client:
            return query
        
        prompt = f"""Rewrite this search query to be more effective for document retrieval.

Original query: {query}
Query type: {query_type.value}

Rules:
- Make it more specific and clear
- Add relevant technical terms
- Remove ambiguity
- Keep it concise (max 20 words)
- Focus on key concepts

Return ONLY the rewritten query, nothing else."""

        try:
            rewritten = self.ai_client.generate(prompt, max_tokens=100, temperature=0.3)
            return rewritten.strip().strip('"').strip("'")
        except Exception as e:
            logger.error(f"Query rewriting failed: {e}")
            return query
    
    def _expand_query(
        self,
        query: str,
        user_context: Dict[str, Any]
    ) -> List[str]:
        """Expand query with synonyms and related terms"""
        expanded = []
        query_lower = query.lower()
        
        # Add acronym expansions
        for acronym, expansions in self.expansion_terms.items():
            if acronym in query_lower:
                for expansion in expansions:
                    if expansion.lower() not in query_lower:
                        expanded_query = query_lower.replace(acronym, expansion)
                        expanded.append(expanded_query)
        
        # Add user's weak areas if relevant
        weak_areas = user_context.get("weak_topics", [])
        for weak in weak_areas[:3]:
            if weak.lower() in query_lower:
                expanded.append(f"{query} {weak} fundamentals")
        
        # Add domain-specific terms
        topics = user_context.get("topics_of_interest", [])
        if topics:
            main_topic = topics[0]
            if main_topic.lower() not in query_lower:
                expanded.append(f"{query} in {main_topic}")
        
        return expanded[:3]  # Limit to 3 expansions
    
    async def _decompose_query(
        self,
        query: str,
        query_type: QueryType
    ) -> List[str]:
        """Decompose complex queries into sub-queries"""
        # Only decompose multi-hop and analytical queries
        if query_type not in [QueryType.MULTI_HOP, QueryType.ANALYTICAL, QueryType.COMPARATIVE]:
            return []
        
        if not self.ai_client:
            return []
        
        prompt = f"""Break down this complex query into 2-3 simpler sub-queries.

Query: {query}
Type: {query_type.value}

Return ONLY a JSON array of sub-queries:
["sub-query 1", "sub-query 2", "sub-query 3"]"""

        try:
            response = self.ai_client.generate(prompt, max_tokens=200, temperature=0.3)
            
            # Parse JSON
            json_match = re.search(r'\[.*?\]', response, re.DOTALL)
            if json_match:
                sub_queries = json.loads(json_match.group())
                return sub_queries[:3]
        except Exception as e:
            logger.error(f"Query decomposition failed: {e}")
        
        return []


# ==================== Contextual Compression ====================

class ContextualCompressor:
    """
    Compresses retrieved context to reduce tokens while preserving relevance.
    Uses extractive and abstractive compression techniques.
    """
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def compress_results(
        self,
        results: List[RAGResult],
        query: str,
        max_length: int = 2000,
        compression_ratio: float = 0.5
    ) -> List[RAGResult]:
        """
        Compress results to fit within token budget.
        
        Args:
            results: Retrieved results
            query: Original query
            max_length: Maximum total character length
            compression_ratio: Target compression (0.5 = 50% reduction)
        
        Returns:
            Compressed results
        """
        if not results:
            return results
        
        # Calculate current length
        current_length = sum(len(r.content) for r in results)
        
        if current_length <= max_length:
            return results
        
        # Apply compression
        compressed = []
        for result in results:
            compressed_content = self._compress_single(
                result.content,
                query,
                compression_ratio
            )
            
            compressed_result = RAGResult(
                id=result.id,
                content=compressed_content,
                score=result.score,
                source=result.source,
                metadata={**result.metadata, "compressed": True},
                original_score=result.original_score,
                rerank_score=result.rerank_score,
                graph_context=result.graph_context,
                related_concepts=result.related_concepts
            )
            compressed.append(compressed_result)
        
        # Trim if still too long
        total_length = 0
        final_results = []
        for result in compressed:
            if total_length + len(result.content) > max_length:
                break
            final_results.append(result)
            total_length += len(result.content)
        
        logger.info(f"Compressed {len(results)} results from {current_length} to {total_length} chars")
        return final_results
    
    def _compress_single(
        self,
        content: str,
        query: str,
        compression_ratio: float
    ) -> str:
        """Compress a single piece of content"""
        # Extractive compression: keep query-relevant sentences
        sentences = self._split_sentences(content)
        
        if len(sentences) <= 2:
            return content
        
        # Score sentences by relevance
        scored_sentences = []
        query_words = set(query.lower().split())
        
        for sent in sentences:
            sent_words = set(sent.lower().split())
            overlap = len(query_words & sent_words)
            score = overlap / max(len(query_words), 1)
            scored_sentences.append((sent, score))
        
        # Sort by score and keep top sentences
        scored_sentences.sort(key=lambda x: x[1], reverse=True)
        target_count = max(2, int(len(sentences) * compression_ratio))
        
        # Keep sentences in original order
        kept_sentences = [s for s, _ in scored_sentences[:target_count]]
        kept_indices = [sentences.index(s) for s in kept_sentences]
        kept_indices.sort()
        
        compressed = " ".join([sentences[i] for i in kept_indices])
        return compressed
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    async def compress_with_ai(
        self,
        content: str,
        query: str,
        max_tokens: int = 500
    ) -> str:
        """Use AI for abstractive compression"""
        if not self.ai_client:
            return content[:max_tokens * 4]  # Rough char estimate
        
        prompt = f"""Compress this content to focus on information relevant to the query.

Query: {query}

Content:
{content[:3000]}

Rules:
- Keep ONLY information relevant to the query
- Remove redundant or tangential information
- Preserve key facts and details
- Maximum {max_tokens} tokens
- Maintain coherence

Compressed version:"""

        try:
            compressed = self.ai_client.generate(
                prompt,
                max_tokens=max_tokens,
                temperature=0.3
            )
            return compressed.strip()
        except Exception as e:
            logger.error(f"AI compression failed: {e}")
            return self._compress_single(content, query, 0.5)


# ==================== Parent-Child Retrieval ====================

class ParentChildRetriever:
    """
    Implements parent-child document retrieval.
    Retrieves small chunks but returns larger parent context.
    """
    
    def __init__(self, vector_store=None, embedding_model=None):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        
        # Storage for parent-child relationships
        self.parent_store: Dict[str, str] = {}  # child_id -> parent_content
        self.child_store: Dict[str, List[str]] = {}  # parent_id -> [child_ids]
    
    def index_with_hierarchy(
        self,
        documents: List[Dict[str, Any]],
        chunk_size: int = 200,
        parent_chunk_size: int = 1000
    ):
        """
        Index documents with parent-child hierarchy.
        
        Args:
            documents: List of documents to index
            chunk_size: Size of child chunks (for retrieval)
            parent_chunk_size: Size of parent chunks (for context)
        """
        for doc in documents:
            content = doc.get("content", "")
            doc_id = doc.get("id", hashlib.sha256(content.encode()).hexdigest()[:16])
            
            # Create parent chunks
            parent_chunks = self._chunk_text(content, parent_chunk_size)
            
            for parent_idx, parent_chunk in enumerate(parent_chunks):
                parent_id = f"{doc_id}_parent_{parent_idx}"
                
                # Create child chunks from parent
                child_chunks = self._chunk_text(parent_chunk, chunk_size)
                child_ids = []
                
                for child_idx, child_chunk in enumerate(child_chunks):
                    child_id = f"{parent_id}_child_{child_idx}"
                    child_ids.append(child_id)
                    
                    # Store relationship
                    self.parent_store[child_id] = parent_chunk
                    
                    # Index child chunk for retrieval
                    if self.vector_store and self.embedding_model:
                        try:
                            embedding = self.embedding_model.encode(child_chunk)
                            # Convert to list if numpy array, otherwise use as-is
                            if hasattr(embedding, 'tolist'):
                                embedding = embedding.tolist()
                            elif not isinstance(embedding, list):
                                embedding = list(embedding)
                            
                            self.vector_store.add(
                                ids=[child_id],
                                embeddings=[embedding],
                                documents=[child_chunk],
                                metadatas=[{
                                    **doc.get("metadata", {}),
                                    "parent_id": parent_id,
                                    "chunk_index": child_idx,
                                    "is_child": True
                                }]
                            )
                        except Exception as e:
                            logger.error(f"Failed to index child chunk: {e}")
                
                # Store children for parent
                self.child_store[parent_id] = child_ids
        
        logger.info(f"Indexed {len(documents)} documents with parent-child hierarchy")
    
    async def retrieve_with_parents(
        self,
        query: str,
        top_k: int = 5
    ) -> List[RAGResult]:
        """
        Retrieve child chunks but return parent context.
        """
        if not self.vector_store:
            return []
        
        try:
            # Query for child chunks
            result = self.vector_store.query(
                query_texts=[query],
                n_results=top_k * 2,  # Get more children
                where={"is_child": True}
            )
            
            if not result or not result.get("documents"):
                return []
            
            # Get unique parents
            seen_parents = set()
            results = []
            
            docs = result["documents"][0]
            ids = result.get("ids", [[]])[0]
            distances = result.get("distances", [[]])[0]
            metadatas = result.get("metadatas", [[]])[0]
            
            for i, child_id in enumerate(ids):
                if child_id not in self.parent_store:
                    continue
                
                parent_content = self.parent_store[child_id]
                parent_id = metadatas[i].get("parent_id", "")
                
                # Skip if we already have this parent
                if parent_id in seen_parents:
                    continue
                
                seen_parents.add(parent_id)
                
                # Create result with parent content
                score = 1.0 / (1.0 + distances[i]) if i < len(distances) else 0.5
                
                results.append(RAGResult(
                    id=parent_id,
                    content=parent_content,
                    score=score,
                    source="parent_child",
                    metadata={
                        **metadatas[i],
                        "child_match": docs[i][:100],  # Show what matched
                        "retrieval_method": "parent_child"
                    },
                    parent_id=None,
                    child_ids=self.child_store.get(parent_id, []),
                    chunk_index=metadatas[i].get("chunk_index", 0)
                ))
                
                if len(results) >= top_k:
                    break
            
            return results
            
        except Exception as e:
            logger.error(f"Parent-child retrieval failed: {e}")
            return []
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """Chunk text into pieces of approximately chunk_size characters"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        sentences = re.split(r'[.!?]+', text)
        
        current_chunk = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks


# ==================== Metadata Filtering ====================

class MetadataFilter:
    """
    Advanced metadata filtering and routing for retrieval.
    """
    
    def __init__(self):
        self.filter_rules: Dict[str, Any] = {}
    
    def build_filter(
        self,
        user_context: Dict[str, Any] = None,
        query_type: QueryType = None,
        content_types: List[str] = None,
        difficulty_level: str = None,
        topics: List[str] = None,
        date_range: Tuple[datetime, datetime] = None
    ) -> Dict[str, Any]:
        """
        Build metadata filter based on context.
        
        Returns:
            Filter dict compatible with vector store
        """
        filters = {}
        
        # Content type filtering
        if content_types:
            filters["type"] = {"$in": content_types}
        
        # Difficulty filtering
        if difficulty_level:
            filters["difficulty"] = difficulty_level
        elif user_context:
            user_level = user_context.get("difficulty_level", "intermediate")
            filters["difficulty"] = {"$in": [user_level, self._get_adjacent_level(user_level)]}
        
        # Topic filtering
        if topics:
            filters["topic"] = {"$in": topics}
        elif user_context:
            user_topics = user_context.get("topics_of_interest", [])
            if user_topics:
                filters["topic"] = {"$in": user_topics[:5]}
        
        # Date range filtering
        if date_range:
            start, end = date_range
            filters["created_at"] = {
                "$gte": start.isoformat(),
                "$lte": end.isoformat()
            }
        
        # Query type specific filtering
        if query_type == QueryType.PROCEDURAL:
            filters["content_format"] = {"$in": ["tutorial", "guide", "how-to"]}
        elif query_type == QueryType.CONCEPTUAL:
            filters["content_format"] = {"$in": ["explanation", "definition", "concept"]}
        
        return filters if filters else None
    
    def _get_adjacent_level(self, level: str) -> str:
        """Get adjacent difficulty level for broader search"""
        levels = ["beginner", "easy", "intermediate", "medium", "advanced", "hard", "expert"]
        try:
            idx = levels.index(level.lower())
            if idx < len(levels) - 1:
                return levels[idx + 1]
        except ValueError:
            pass
        return "intermediate"
    
    def route_by_metadata(
        self,
        query: str,
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Route query to appropriate content sources based on metadata.
        
        Returns:
            Routing decision with filters and priorities
        """
        routing = {
            "primary_sources": [],
            "secondary_sources": [],
            "filters": {},
            "boost_fields": []
        }
        
        query_lower = query.lower()
        
        # Determine primary sources
        if any(word in query_lower for word in ["note", "my notes", "i wrote"]):
            routing["primary_sources"].append("notes")
            routing["boost_fields"].append("user_created")
        
        if any(word in query_lower for word in ["flashcard", "card", "memorize"]):
            routing["primary_sources"].append("flashcards")
        
        if any(word in query_lower for word in ["quiz", "test", "question"]):
            routing["primary_sources"].append("quizzes")
        
        if any(word in query_lower for word in ["slide", "presentation", "lecture"]):
            routing["primary_sources"].append("slides")
        
        # If no specific source, use all
        if not routing["primary_sources"]:
            routing["primary_sources"] = ["notes", "flashcards", "quizzes", "slides"]
        
        # Build filters
        routing["filters"] = self.build_filter(user_context=user_context)
        
        # Boost recent content
        routing["boost_fields"].append("recency")
        
        # Boost content user struggled with
        if user_context and user_context.get("weak_topics"):
            routing["boost_fields"].append("weak_topic_match")
        
        return routing


# ==================== Original Classes Continue ====================



class BM25:
    """Simple BM25 implementation for keyword search"""
    
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_freqs: Dict[str, int] = defaultdict(int)
        self.doc_lengths: List[int] = []
        self.avg_doc_length: float = 0.0
        self.corpus_size: int = 0
        self.documents: List[Dict[str, Any]] = []
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization"""
        return re.findall(r'\w+', text.lower())
    
    def index(self, documents: List[Dict[str, Any]], content_field: str = "content"):
        """Index documents for BM25 search"""
        self.documents = documents
        self.corpus_size = len(documents)
        
        for doc in documents:
            content = doc.get(content_field, "")
            tokens = self._tokenize(content)
            self.doc_lengths.append(len(tokens))
            
            # Count document frequencies
            unique_tokens = set(tokens)
            for token in unique_tokens:
                self.doc_freqs[token] += 1
        
        self.avg_doc_length = sum(self.doc_lengths) / max(self.corpus_size, 1)
    
    def search(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        """Search documents using BM25"""
        query_tokens = self._tokenize(query)
        scores = []
        
        for idx, doc in enumerate(self.documents):
            content = doc.get("content", "")
            doc_tokens = self._tokenize(content)
            doc_length = self.doc_lengths[idx] if idx < len(self.doc_lengths) else len(doc_tokens)
            
            score = 0.0
            for token in query_tokens:
                if token not in self.doc_freqs:
                    continue
                
                # Term frequency in document
                tf = doc_tokens.count(token)
                
                # IDF
                df = self.doc_freqs[token]
                idf = max(0, (self.corpus_size - df + 0.5) / (df + 0.5))
                
                # BM25 score
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_length / max(self.avg_doc_length, 1))
                score += idf * (numerator / max(denominator, 0.001))
            
            if score > 0:
                scores.append((idx, score))
        
        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]


class HybridSearchEngine:
    """
    Hybrid Search Engine combining semantic and keyword search.
    
    Combines:
    - Semantic search using vector embeddings (ChromaDB)
    - Keyword search using BM25
    - Configurable weighting between the two
    """
    
    def __init__(
        self,
        vector_store=None,
        embedding_model=None,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3
    ):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        self.semantic_weight = semantic_weight
        self.keyword_weight = keyword_weight
        self.bm25 = BM25()
        self._indexed_docs: List[Dict[str, Any]] = []
    
    def index_documents(self, documents: List[Dict[str, Any]]):
        """Index documents for both semantic and keyword search"""
        self._indexed_docs = documents
        self.bm25.index(documents)
        
        # Index in vector store if available
        if self.vector_store and self.embedding_model:
            try:
                for doc in documents:
                    content = doc.get("content", "")
                    doc_id = doc.get("id", hashlib.sha256(content.encode()).hexdigest()[:16])
                    
                    # Generate embedding
                    embedding = self.embedding_model.encode(content)
                    
                    # Convert to list if numpy array, otherwise use as-is
                    if hasattr(embedding, 'tolist'):
                        embedding = embedding.tolist()
                    elif not isinstance(embedding, list):
                        embedding = list(embedding)
                    
                    # Add to vector store
                    self.vector_store.add(
                        ids=[doc_id],
                        embeddings=[embedding],
                        documents=[content],
                        metadatas=[doc.get("metadata", {})]
                    )
            except Exception as e:
                logger.error(f"Failed to index in vector store: {e}")
    
    async def search(
        self,
        query: str,
        top_k: int = 10,
        mode: SearchMode = SearchMode.HYBRID,
        filters: Dict[str, Any] = None
    ) -> List[RAGResult]:
        """
        Perform hybrid search combining semantic and keyword results.
        """
        results = []
        
        if mode == SearchMode.SEMANTIC:
            results = await self._semantic_search(query, top_k, filters)
        elif mode == SearchMode.KEYWORD:
            results = self._keyword_search(query, top_k)
        elif mode == SearchMode.HYBRID:
            # Get results from both
            semantic_results = await self._semantic_search(query, top_k * 2, filters)
            keyword_results = self._keyword_search(query, top_k * 2)
            
            # Merge and re-score
            results = self._merge_results(semantic_results, keyword_results, top_k)
        
        return results
    
    async def _semantic_search(
        self,
        query: str,
        top_k: int,
        filters: Dict[str, Any] = None
    ) -> List[RAGResult]:
        """Perform semantic search using vector store"""
        if not self.vector_store:
            return []
        
        try:
            # Query vector store
            query_result = self.vector_store.query(
                query_texts=[query],
                n_results=top_k,
                where=filters
            )
            
            results = []
            if query_result and query_result.get("documents"):
                docs = query_result["documents"][0]
                ids = query_result.get("ids", [[]])[0]
                distances = query_result.get("distances", [[]])[0]
                metadatas = query_result.get("metadatas", [[]])[0]
                
                for i, doc in enumerate(docs):
                    # Convert distance to similarity score
                    score = 1.0 / (1.0 + distances[i]) if i < len(distances) else 0.5
                    
                    results.append(RAGResult(
                        id=ids[i] if i < len(ids) else f"doc_{i}",
                        content=doc,
                        score=score,
                        source="semantic",
                        metadata=metadatas[i] if i < len(metadatas) else {},
                        original_score=score
                    ))
            
            return results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    def _keyword_search(self, query: str, top_k: int) -> List[RAGResult]:
        """Perform keyword search using BM25"""
        bm25_results = self.bm25.search(query, top_k)
        
        results = []
        max_score = max((score for _, score in bm25_results), default=1.0)
        
        for idx, score in bm25_results:
            if idx < len(self._indexed_docs):
                doc = self._indexed_docs[idx]
                normalized_score = score / max_score if max_score > 0 else 0
                
                results.append(RAGResult(
                    id=doc.get("id", f"doc_{idx}"),
                    content=doc.get("content", ""),
                    score=normalized_score,
                    source="keyword",
                    metadata=doc.get("metadata", {}),
                    original_score=normalized_score
                ))
        
        return results
    
    def _merge_results(
        self,
        semantic_results: List[RAGResult],
        keyword_results: List[RAGResult],
        top_k: int
    ) -> List[RAGResult]:
        """Merge semantic and keyword results with weighted scoring"""
        # Create lookup by content hash
        merged: Dict[str, RAGResult] = {}
        
        for result in semantic_results:
            content_hash = hashlib.sha256(result.content.encode()).hexdigest()[:16]
            if content_hash not in merged:
                merged[content_hash] = result
                merged[content_hash].score = result.score * self.semantic_weight
            else:
                merged[content_hash].score += result.score * self.semantic_weight
        
        for result in keyword_results:
            content_hash = hashlib.sha256(result.content.encode()).hexdigest()[:16]
            if content_hash not in merged:
                merged[content_hash] = result
                merged[content_hash].score = result.score * self.keyword_weight
            else:
                merged[content_hash].score += result.score * self.keyword_weight
        
        # Sort by combined score
        results = list(merged.values())
        results.sort(key=lambda r: r.score, reverse=True)
        
        return results[:top_k]


class ReRanker:
    """
    Re-ranking engine using cross-encoder models.
    Improves retrieval quality by re-scoring results with a more powerful model.
    """
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the cross-encoder model"""
        try:
            from sentence_transformers import CrossEncoder
            self.model = CrossEncoder(self.model_name)
            logger.info(f"Loaded re-ranker model: {self.model_name}")
        except ImportError:
            logger.warning("sentence-transformers not installed. Re-ranking disabled.")
        except Exception as e:
            logger.error(f"Failed to load re-ranker model: {e}")
    
    def rerank(
        self,
        query: str,
        results: List[RAGResult],
        top_k: int = 10
    ) -> List[RAGResult]:
        """Re-rank results using cross-encoder"""
        if not self.model or not results:
            return results[:top_k]
        
        try:
            # Prepare pairs for cross-encoder
            pairs = [(query, r.content) for r in results]
            
            # Get cross-encoder scores
            scores = self.model.predict(pairs)
            
            # Update results with rerank scores
            for i, result in enumerate(results):
                result.rerank_score = float(scores[i])
                result.score = result.rerank_score  # Use rerank score as final score
            
            # Sort by rerank score
            results.sort(key=lambda r: r.rerank_score, reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Re-ranking failed: {e}")
            return results[:top_k]
    
    def rerank_with_diversity(
        self,
        query: str,
        results: List[RAGResult],
        top_k: int = 10,
        diversity_weight: float = 0.3
    ) -> List[RAGResult]:
        """Re-rank with diversity consideration (MMR-like)"""
        if not results:
            return []
        
        # First, get rerank scores
        reranked = self.rerank(query, results, len(results))
        
        # Apply MMR-like diversity
        selected = []
        remaining = reranked.copy()
        
        while len(selected) < top_k and remaining:
            if not selected:
                # First item is highest scoring
                selected.append(remaining.pop(0))
            else:
                # Score remaining by relevance - similarity to selected
                best_idx = 0
                best_score = -float('inf')
                
                for i, candidate in enumerate(remaining):
                    # Relevance score
                    relevance = candidate.rerank_score
                    
                    # Diversity: penalize similarity to already selected
                    max_sim = max(
                        self._content_similarity(candidate.content, s.content)
                        for s in selected
                    )
                    
                    # Combined score
                    score = (1 - diversity_weight) * relevance - diversity_weight * max_sim
                    
                    if score > best_score:
                        best_score = score
                        best_idx = i
                
                selected.append(remaining.pop(best_idx))
        
        return selected
    
    def _content_similarity(self, text1: str, text2: str) -> float:
        """Simple content similarity using word overlap"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0


class GraphRAGEngine:
    """
    GraphRAG Engine - Knowledge graph-enhanced retrieval.
    
    Uses the knowledge graph to:
    - Find related concepts
    - Traverse relationships
    - Provide structured context
    - Enhance retrieval with graph traversal
    """
    
    def __init__(self, knowledge_graph=None):
        self.knowledge_graph = knowledge_graph
    
    async def search(
        self,
        query: str,
        user_id: str = None,
        max_hops: int = 2,
        top_k: int = 10
    ) -> List[RAGResult]:
        """
        Search using knowledge graph traversal.
        """
        if not self.knowledge_graph:
            return []
        
        results = []
        
        try:
            # Extract concepts from query
            concepts = await self._extract_concepts(query)
            
            if not concepts:
                return []
            
            # Get graph context for each concept
            for concept in concepts[:5]:
                context = await self._get_concept_context(concept, max_hops)
                
                if context:
                    results.append(RAGResult(
                        id=f"graph_{concept}",
                        content=context["description"],
                        score=context["relevance"],
                        source="graph",
                        metadata={
                            "concept": concept,
                            "domain": context.get("domain", ""),
                            "prerequisites": context.get("prerequisites", [])
                        },
                        graph_context=context.get("related_content", []),
                        related_concepts=context.get("related_concepts", [])
                    ))
            
            # If user_id provided, personalize with mastery info
            if user_id:
                results = await self._personalize_results(results, user_id)
            
            # Sort by relevance
            results.sort(key=lambda r: r.score, reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"GraphRAG search failed: {e}")
            return []
    
    async def _extract_concepts(self, query: str) -> List[str]:
        """Extract concepts from query using knowledge graph"""
        try:
            cypher = """
            MATCH (c:Concept)
            WHERE ANY(keyword IN c.keywords WHERE $query CONTAINS keyword)
               OR $query CONTAINS c.name
            RETURN c.name as concept, c.domain as domain
            ORDER BY size(c.name) DESC
            LIMIT 10
            """
            
            async with self.knowledge_graph.session() as session:
                result = await session.run(cypher, {"query": query.lower()})
                records = await result.data()
                return [r["concept"] for r in records]
                
        except Exception as e:
            logger.error(f"Concept extraction failed: {e}")
            # Fallback: simple keyword extraction
            return [w for w in query.split() if len(w) > 3][:5]
    
    async def _get_concept_context(
        self,
        concept: str,
        max_hops: int
    ) -> Optional[Dict[str, Any]]:
        """Get rich context for a concept from the graph"""
        try:
            cypher = """
            MATCH (c:Concept {name: $concept})
            OPTIONAL MATCH (c)-[:PREREQUISITE_OF]->(advanced:Concept)
            OPTIONAL MATCH (prereq:Concept)-[:PREREQUISITE_OF]->(c)
            OPTIONAL MATCH (c)-[:RELATED_TO]-(related:Concept)
            OPTIONAL MATCH (content)-[:COVERS]->(c)
            
            RETURN c.name as name,
                   c.description as description,
                   c.domain as domain,
                   c.difficulty as difficulty,
                   collect(DISTINCT prereq.name) as prerequisites,
                   collect(DISTINCT advanced.name) as leads_to,
                   collect(DISTINCT related.name) as related_concepts,
                   count(DISTINCT content) as content_count
            """
            
            async with self.knowledge_graph.session() as session:
                result = await session.run(cypher, {"concept": concept})
                record = await result.single()
                
                if not record:
                    return None
                
                return {
                    "name": record["name"],
                    "description": record["description"] or f"Concept: {concept}",
                    "domain": record["domain"],
                    "difficulty": record["difficulty"],
                    "prerequisites": [p for p in record["prerequisites"] if p],
                    "leads_to": [l for l in record["leads_to"] if l],
                    "related_concepts": [r for r in record["related_concepts"] if r],
                    "content_count": record["content_count"],
                    "relevance": 0.8  # Base relevance for graph results
                }
                
        except Exception as e:
            logger.error(f"Failed to get concept context: {e}")
            return None
    
    async def _personalize_results(
        self,
        results: List[RAGResult],
        user_id: str
    ) -> List[RAGResult]:
        """Personalize results based on user's mastery levels"""
        try:
            concepts = [r.metadata.get("concept", "") for r in results if r.metadata.get("concept")]
            
            if not concepts:
                return results
            
            # Get user mastery
            cypher = """
            MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
            WHERE c.name IN $concepts
            RETURN c.name as concept, k.mastery_level as mastery
            """
            
            async with self.knowledge_graph.session() as session:
                result = await session.run(cypher, {
                    "user_id": int(user_id) if user_id.isdigit() else 0,
                    "concepts": concepts
                })
                records = await result.data()
                
                mastery_map = {r["concept"]: r["mastery"] for r in records}
                
                # Adjust scores based on mastery (prioritize weak areas)
                for r in results:
                    concept = r.metadata.get("concept", "")
                    if concept in mastery_map:
                        mastery = mastery_map[concept]
                        # Boost score for concepts user is weak in
                        r.score *= (1.5 - mastery)
                        r.metadata["user_mastery"] = mastery
            
            return results
            
        except Exception as e:
            logger.error(f"Personalization failed: {e}")
            return results
    
    async def get_learning_path(
        self,
        target_concept: str,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get recommended learning path to a concept"""
        try:
            cypher = """
            MATCH path = (start:Concept)-[:PREREQUISITE_OF*1..5]->(target:Concept {name: $target})
            WHERE NOT EXISTS {
                MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(start)
                WHERE k.mastery_level > 0.7
            }
            UNWIND nodes(path) as concept
            RETURN DISTINCT concept.name as name, 
                   concept.difficulty as difficulty,
                   concept.description as description
            ORDER BY concept.difficulty ASC
            """
            
            async with self.knowledge_graph.session() as session:
                result = await session.run(cypher, {
                    "target": target_concept,
                    "user_id": int(user_id) if user_id.isdigit() else 0
                })
                return await result.data()
                
        except Exception as e:
            logger.error(f"Learning path generation failed: {e}")
            return []


class AgenticRAGEngine:
    """
    Agentic RAG - Agents autonomously decide retrieval strategy.
    
    The agent analyzes the query and decides:
    - Whether retrieval is needed
    - Which retrieval method to use
    - How many results to fetch
    - Whether to do follow-up retrievals
    """
    
    def __init__(
        self,
        ai_client=None,
        hybrid_search: HybridSearchEngine = None,
        graph_rag: GraphRAGEngine = None,
        reranker: ReRanker = None
    ):
        self.ai_client = ai_client
        self.hybrid_search = hybrid_search
        self.graph_rag = graph_rag
        self.reranker = reranker
        
        # Decision history for learning
        self._decision_history: List[Dict[str, Any]] = []
    
    async def retrieve(
        self,
        query: str,
        user_id: str = None,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Agentic retrieval - agent decides the best strategy.
        
        Returns:
            Dict with results, strategy used, and reasoning
        """
        # Step 1: Analyze query to decide strategy
        strategy = await self._decide_strategy(query, context)
        
        logger.info(f"Agentic RAG decided strategy: {strategy['method']} for query: {query[:50]}...")
        
        # Step 2: Execute retrieval based on strategy
        results = await self._execute_strategy(strategy, query, user_id)
        
        # Step 3: Evaluate results and decide if follow-up needed
        if strategy.get("allow_followup", True):
            results, followup_done = await self._evaluate_and_followup(
                query, results, strategy, user_id
            )
        else:
            followup_done = False
        
        # Step 4: Re-rank if enabled
        if self.reranker and strategy.get("use_reranking", True):
            results = self.reranker.rerank(query, results, strategy.get("top_k", 10))
        
        # Record decision for learning
        self._record_decision(query, strategy, len(results))
        
        return {
            "results": results,
            "strategy": strategy,
            "followup_performed": followup_done,
            "total_results": len(results)
        }
    
    async def _decide_strategy(
        self,
        query: str,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Decide retrieval strategy based on query analysis"""
        context = context or {}
        
        # Analyze query characteristics
        query_lower = query.lower()
        query_length = len(query.split())
        
        # Default strategy
        strategy = {
            "method": SearchMode.HYBRID,
            "top_k": 10,
            "use_reranking": True,
            "allow_followup": True,
            "reasoning": ""
        }
        
        # Rule-based decisions (can be enhanced with AI)
        
        # 1. Short, specific queries -> keyword search might be better
        if query_length <= 3:
            strategy["method"] = SearchMode.KEYWORD
            strategy["reasoning"] = "Short query - using keyword search"
        
        # 2. Conceptual/learning queries -> use graph
        concept_indicators = ["what is", "explain", "how does", "concept", "definition", 
                            "relationship between", "prerequisite", "learn"]
        if any(ind in query_lower for ind in concept_indicators):
            strategy["method"] = SearchMode.GRAPH
            strategy["reasoning"] = "Conceptual query - using knowledge graph"
        
        # 3. Specific content queries -> hybrid
        content_indicators = ["find", "search", "show me", "list", "examples of"]
        if any(ind in query_lower for ind in content_indicators):
            strategy["method"] = SearchMode.HYBRID
            strategy["top_k"] = 15
            strategy["reasoning"] = "Content search query - using hybrid search"
        
        # 4. Complex queries -> use AI to decide
        if query_length > 10 and self.ai_client:
            ai_strategy = await self._ai_decide_strategy(query, context)
            if ai_strategy:
                strategy.update(ai_strategy)
        
        # 5. Context-based adjustments
        if context.get("user_struggling"):
            strategy["top_k"] = min(strategy["top_k"] + 5, 20)
            strategy["reasoning"] += " | User struggling - fetching more results"
        
        if context.get("quick_answer_needed"):
            strategy["top_k"] = 5
            strategy["use_reranking"] = False
            strategy["reasoning"] += " | Quick answer needed - minimal retrieval"
        
        return strategy
    
    async def _ai_decide_strategy(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Use AI to decide strategy for complex queries"""
        if not self.ai_client:
            return None
        
        prompt = f"""Analyze this query and decide the best retrieval strategy.

Query: {query}

Context:
- User topics of interest: {context.get('topics_of_interest', [])}
- Recent conversation topics: {context.get('recent_topics', [])}
- User is struggling: {context.get('user_struggling', False)}

Decide:
1. search_method: "semantic" (meaning-based), "keyword" (exact match), "hybrid" (both), or "graph" (concept relationships)
2. num_results: how many results to fetch (5-20)
3. need_reranking: true/false

Return JSON only:
{{"search_method": "...", "num_results": N, "need_reranking": true/false, "reasoning": "..."}}"""

        try:
            response = self.ai_client.generate(prompt, max_tokens=200, temperature=0.3)
            
            # Parse JSON from response
            json_match = re.search(r'\{[^}]+\}', response)
            if json_match:
                data = json.loads(json_match.group())
                
                method_map = {
                    "semantic": SearchMode.SEMANTIC,
                    "keyword": SearchMode.KEYWORD,
                    "hybrid": SearchMode.HYBRID,
                    "graph": SearchMode.GRAPH
                }
                
                return {
                    "method": method_map.get(data.get("search_method", "hybrid"), SearchMode.HYBRID),
                    "top_k": min(max(data.get("num_results", 10), 5), 20),
                    "use_reranking": data.get("need_reranking", True),
                    "reasoning": data.get("reasoning", "AI-decided strategy")
                }
        except Exception as e:
            logger.error(f"AI strategy decision failed: {e}")
        
        return None
    
    async def _execute_strategy(
        self,
        strategy: Dict[str, Any],
        query: str,
        user_id: str = None
    ) -> List[RAGResult]:
        """Execute the decided retrieval strategy"""
        method = strategy.get("method", SearchMode.HYBRID)
        top_k = strategy.get("top_k", 10)
        
        results = []
        
        if method == SearchMode.GRAPH and self.graph_rag:
            results = await self.graph_rag.search(query, user_id, top_k=top_k)
        
        elif method in [SearchMode.SEMANTIC, SearchMode.KEYWORD, SearchMode.HYBRID]:
            if self.hybrid_search:
                results = await self.hybrid_search.search(query, top_k, mode=method)
        
        # If graph search returned few results, supplement with hybrid
        if method == SearchMode.GRAPH and len(results) < top_k // 2:
            if self.hybrid_search:
                hybrid_results = await self.hybrid_search.search(
                    query, top_k - len(results), mode=SearchMode.HYBRID
                )
                results.extend(hybrid_results)
        
        return results
    
    async def _evaluate_and_followup(
        self,
        query: str,
        results: List[RAGResult],
        strategy: Dict[str, Any],
        user_id: str = None
    ) -> Tuple[List[RAGResult], bool]:
        """Evaluate results and perform follow-up retrieval if needed"""
        
        # Check if results are sufficient
        if len(results) >= strategy.get("top_k", 10) // 2:
            return results, False
        
        # Check result quality
        avg_score = sum(r.score for r in results) / max(len(results), 1)
        if avg_score > 0.5:
            return results, False
        
        # Perform follow-up with different strategy
        logger.info("Agentic RAG performing follow-up retrieval due to insufficient results")
        
        followup_method = (
            SearchMode.HYBRID if strategy["method"] == SearchMode.GRAPH
            else SearchMode.GRAPH if self.graph_rag
            else SearchMode.SEMANTIC
        )
        
        followup_results = await self._execute_strategy(
            {"method": followup_method, "top_k": strategy.get("top_k", 10)},
            query,
            user_id
        )
        
        # Merge results, avoiding duplicates
        existing_ids = {r.id for r in results}
        for fr in followup_results:
            if fr.id not in existing_ids:
                results.append(fr)
        
        return results, True
    
    def _record_decision(
        self,
        query: str,
        strategy: Dict[str, Any],
        result_count: int
    ):
        """Record decision for future learning"""
        self._decision_history.append({
            "query": query[:100],
            "strategy": strategy["method"].value if isinstance(strategy["method"], SearchMode) else strategy["method"],
            "top_k": strategy.get("top_k", 10),
            "result_count": result_count,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only recent history
        if len(self._decision_history) > 1000:
            self._decision_history = self._decision_history[-500:]


class AdvancedRAGSystem:
    """
    Main Advanced RAG System combining all components.
    
    Provides unified interface for:
    - Hybrid search (semantic + keyword)
    - Re-ranking
    - GraphRAG
    - Agentic RAG
    - Query enhancement (rewriting, expansion, decomposition)
    - Contextual compression
    - Parent-child retrieval
    - Metadata filtering
    """
    
    def __init__(
        self,
        ai_client=None,
        knowledge_graph=None,
        vector_store=None,
        embedding_model=None
    ):
        self.ai_client = ai_client
        self.knowledge_graph = knowledge_graph
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        
        # Initialize core components
        self.hybrid_search = HybridSearchEngine(
            vector_store=vector_store,
            embedding_model=embedding_model
        )
        
        self.reranker = ReRanker()
        
        self.graph_rag = GraphRAGEngine(knowledge_graph) if knowledge_graph else None
        
        self.agentic_rag = AgenticRAGEngine(
            ai_client=ai_client,
            hybrid_search=self.hybrid_search,
            graph_rag=self.graph_rag,
            reranker=self.reranker
        )
        
        # Initialize new enhancement components
        self.query_enhancer = QueryEnhancer(ai_client=ai_client)
        self.compressor = ContextualCompressor(ai_client=ai_client)
        self.parent_child = ParentChildRetriever(
            vector_store=vector_store,
            embedding_model=embedding_model
        )
        self.metadata_filter = MetadataFilter()
        
        # Cache for frequently accessed content
        self._cache: Dict[str, Tuple[List[RAGResult], datetime]] = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def retrieve(
        self,
        query: str,
        user_id: str = None,
        mode: SearchMode = SearchMode.AGENTIC,
        top_k: int = 10,
        use_cache: bool = True,
        context: Dict[str, Any] = None,
        enhance_query: bool = True,
        compress_results: bool = True,
        use_parent_child: bool = False,
        max_context_length: int = 2000
    ) -> Dict[str, Any]:
        """
        Main retrieval method with all enhancements.
        
        Args:
            query: Search query
            user_id: Optional user ID for personalization
            mode: Search mode (AGENTIC recommended)
            top_k: Number of results
            use_cache: Whether to use caching
            context: Additional context for retrieval
            enhance_query: Apply query enhancement
            compress_results: Apply contextual compression
            use_parent_child: Use parent-child retrieval
            max_context_length: Maximum context length for compression
        
        Returns:
            Dict with results and metadata
        """
        context = context or {}
        
        # Check cache
        cache_key = f"{query}:{user_id}:{mode.value}:{use_parent_child}"
        if use_cache and cache_key in self._cache:
            cached_results, cached_time = self._cache[cache_key]
            if (datetime.utcnow() - cached_time).seconds < self._cache_ttl:
                logger.info(f"Cache hit for query: {query[:50]}")
                return {
                    "results": cached_results,
                    "from_cache": True,
                    "mode": mode.value
                }
        
        # Step 1: Query Enhancement
        enhanced_queries = None
        if enhance_query:
            try:
                enhanced_queries = await self.query_enhancer.enhance_query(
                    query,
                    user_context=context
                )
                logger.info(f"Enhanced query: {enhanced_queries.get('rewritten', query)[:50]}")
            except Exception as e:
                logger.error(f"Query enhancement failed: {e}")
        
        # Step 2: Build metadata filters
        metadata_filters = self.metadata_filter.build_filter(
            user_context=context,
            query_type=QueryType(enhanced_queries["query_type"]) if enhanced_queries else None
        )
        
        # Step 3: Retrieve based on mode
        if use_parent_child:
            # Use parent-child retrieval
            results = await self.parent_child.retrieve_with_parents(query, top_k)
            metadata = {"mode": "parent_child"}
        
        elif mode == SearchMode.AGENTIC:
            # Use agentic RAG with enhanced queries
            queries_to_try = [query]
            if enhanced_queries:
                queries_to_try = enhanced_queries.get("all_queries", [query])[:3]
            
            all_results = []
            for q in queries_to_try:
                result = await self.agentic_rag.retrieve(q, user_id, context)
                all_results.extend(result["results"])
            
            # Deduplicate and re-rank
            results = self._deduplicate_results(all_results)
            if self.reranker:
                results = self.reranker.rerank(query, results, top_k)
            
            metadata = {
                "strategy": "agentic_enhanced",
                "queries_used": len(queries_to_try),
                "enhanced": enhanced_queries is not None
            }
        
        elif mode == SearchMode.GRAPH and self.graph_rag:
            results = await self.graph_rag.search(query, user_id, top_k=top_k)
            metadata = {"mode": "graph"}
        
        else:
            # Hybrid search with filters
            results = await self.hybrid_search.search(
                query,
                top_k * 2,  # Get more for re-ranking
                mode=mode,
                filters=metadata_filters
            )
            
            # Apply re-ranking
            if self.reranker:
                results = self.reranker.rerank(query, results, top_k)
            
            metadata = {"mode": mode.value, "filtered": metadata_filters is not None}
        
        # Step 4: Contextual Compression
        if compress_results and results:
            try:
                results = self.compressor.compress_results(
                    results,
                    query,
                    max_length=max_context_length,
                    compression_ratio=0.6
                )
                metadata["compressed"] = True
            except Exception as e:
                logger.error(f"Compression failed: {e}")
                metadata["compressed"] = False
        
        # Cache results
        if use_cache:
            self._cache[cache_key] = (results, datetime.utcnow())
        
        return {
            "results": results,
            "from_cache": False,
            "total": len(results),
            "enhanced_query": enhanced_queries,
            **metadata
        }
    
    def _deduplicate_results(self, results: List[RAGResult]) -> List[RAGResult]:
        """Remove duplicate results based on content similarity"""
        if not results:
            return results
        
        unique = []
        seen_content = set()
        
        for result in results:
            # Create content hash
            content_hash = hashlib.sha256(result.content[:200].encode()).hexdigest()[:16]
            
            if content_hash not in seen_content:
                seen_content.add(content_hash)
                unique.append(result)
        
        return unique
    
    def index_content(
        self,
        content_type: str,
        items: List[Dict[str, Any]],
        use_parent_child: bool = False
    ):
        """
        Index content for retrieval.
        
        Args:
            content_type: Type of content (notes, flashcards, etc.)
            items: List of items to index
            use_parent_child: Whether to use parent-child indexing
        """
        documents = []
        
        for item in items:
            doc = {
                "id": f"{content_type}_{item.get('id', '')}",
                "content": item.get("content", item.get("text", "")),
                "metadata": {
                    "type": content_type,
                    "title": item.get("title", ""),
                    "difficulty": item.get("difficulty", "intermediate"),
                    "topic": item.get("topic", ""),
                    "created_at": item.get("created_at", datetime.utcnow().isoformat()),
                    **{k: v for k, v in item.items() if k not in ["content", "text", "id"]}
                }
            }
            documents.append(doc)
        
        if use_parent_child:
            # Use hierarchical indexing
            self.parent_child.index_with_hierarchy(documents)
        else:
            # Standard indexing
            self.hybrid_search.index_documents(documents)
        
        logger.info(f"Indexed {len(documents)} {content_type} items (parent_child={use_parent_child})")
    
    async def get_context_for_query(
        self,
        query: str,
        user_id: str = None,
        max_context_length: int = 2000,
        enhance: bool = True
    ) -> str:
        """
        Get formatted context string for LLM prompts.
        Includes query enhancement and compression.
        """
        result = await self.retrieve(
            query,
            user_id,
            mode=SearchMode.AGENTIC,
            enhance_query=enhance,
            compress_results=True,
            max_context_length=max_context_length
        )
        
        context_parts = []
        
        for r in result["results"]:
            source_label = r.metadata.get("title", r.source)
            context_parts.append(f"[{source_label}]\n{r.content}")
        
        return "\n\n---\n\n".join(context_parts)
    
    async def get_learning_context(
        self,
        query: str,
        user_id: str,
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive learning context combining RAG and graph.
        Uses all enhancement features.
        """
        # Get enhanced RAG results
        rag_result = await self.retrieve(
            query,
            user_id,
            mode=SearchMode.AGENTIC,
            context=user_context,
            enhance_query=True,
            compress_results=True,
            max_context_length=3000
        )
        
        # Get graph context if available
        graph_context = {}
        if self.graph_rag:
            try:
                concepts = await self.graph_rag._extract_concepts(query)
                
                if concepts:
                    learning_path = await self.graph_rag.get_learning_path(
                        concepts[0], user_id
                    )
                    graph_context = {
                        "main_concept": concepts[0],
                        "related_concepts": concepts[1:],
                        "learning_path": learning_path
                    }
            except Exception as e:
                logger.error(f"Failed to get graph context: {e}")
        
        return {
            "retrieved_content": [r.to_dict() for r in rag_result["results"]],
            "graph_context": graph_context,
            "retrieval_metadata": {
                "mode": rag_result.get("strategy", "unknown"),
                "total_results": rag_result.get("total", 0),
                "enhanced": rag_result.get("enhanced", False),
                "compressed": rag_result.get("compressed", False)
            },
            "enhanced_query": rag_result.get("enhanced_query")
        }
    
    def clear_cache(self):
        """Clear the result cache"""
        self._cache.clear()
        logger.info("RAG cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            "cache_size": len(self._cache),
            "agentic_decisions": len(self.agentic_rag._decision_history),
            "reranker_available": self.reranker.model is not None,
            "graph_rag_available": self.graph_rag is not None,
            "query_enhancer_available": self.query_enhancer.ai_client is not None,
            "compressor_available": self.compressor.ai_client is not None,
            "parent_child_indexed": len(self.parent_child.parent_store)
        }
