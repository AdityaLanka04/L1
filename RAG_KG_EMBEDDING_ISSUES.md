# RAG / Knowledge Graph / Embedding Architecture Issues

## Current Architecture Overview

### Components
1. **ChromaDB** - Vector store for embeddings
2. **SentenceTransformer** - Embedding model (all-MiniLM-L6-v2)
3. **Neo4j** - Knowledge graph for concept relationships
4. **User RAG Manager** - Per-user vector collections
5. **Advanced RAG System** - Hybrid search, re-ranking, GraphRAG
6. **LangChain** - Used in some places but not consistently

## Identified Issues

### 1. DUPLICATE INITIALIZATION
**Problem**: RAG system initialized TWICE with different configurations
- `setup_agent_system()` in `agents/setup.py` (line 106-150)
- `fix_database_sequences()` in `main.py` (line 948-990)

**Impact**: 
- Second initialization may override first
- Different embedding models/vector stores
- Inconsistent state

**Fix**: Remove duplicate, use single initialization point

---

### 2. MISSING GLOBAL INSTANCES
**Problem**: `get_user_rag_manager()` and `get_user_knowledge_graph()` return None
- Called in main.py but never set globally
- Functions exist but global variables not initialized

**Location**: 
- `backend/agents/rag/user_rag_manager.py` line 400-403
- `backend/knowledge_graph/user_knowledge_graph.py` (needs checking)

**Fix**: Ensure `initialize_user_rag_manager()` sets global `_user_rag_manager`

---

### 3. VECTOR STORE CONFUSION
**Problem**: Multiple ChromaDB clients/collections
- Global collection: "brainwave_content" 
- Per-user collections: "user_{hash}"
- Unclear which is used where

**Impact**: 
- Content indexed in wrong collection
- Retrieval fails to find user content
- Memory waste with duplicate storage

**Fix**: Clarify collection strategy, document usage

---

### 4. EMBEDDING MODEL INCONSISTENCY
**Problem**: Multiple embedding approaches
- SentenceTransformer (HuggingFace) in setup.py
- OpenAI embeddings mentioned in code
- LangChain embeddings in some places
- Unclear which is actually used

**Impact**:
- Embeddings not compatible across systems
- Can't retrieve content indexed with different model
- Performance issues

**Fix**: Standardize on ONE embedding model

---

### 5. KNOWLEDGE GRAPH NOT CONNECTED TO RAG
**Problem**: KG and RAG initialized separately, no integration
- `advanced_rag.py` has GraphRAG code but KG may be None
- No concept-to-content linking
- User mastery not used in retrieval

**Impact**:
- GraphRAG features don't work
- Can't boost content for weak concepts
- Missing personalization

**Fix**: Pass KG to RAG, implement GraphRAG queries

---

### 6. AUTO-INDEXER MAY NOT RUN
**Problem**: Auto-indexer depends on user_rag_manager being set
- If initialization fails silently, no background indexing
- User content never gets indexed
- RAG returns empty results

**Fix**: Add error handling, verify indexer is running

---

### 7. CHAT AGENT RAG INTEGRATION UNCLEAR
**Problem**: `chat_agent.py` truncated, can't see RAG integration
- Unclear if chat uses RAG at all
- May not retrieve user's notes/flashcards
- Context building incomplete

**Fix**: Review chat agent RAG integration

---

### 8. CACHING WRAPPER TIMING
**Problem**: Embedding models wrapped with cache AFTER RAG init
- May cause issues if RAG already has reference
- Unclear if caching actually works

**Fix**: Wrap before RAG initialization

---

## Recommended Fixes (Priority Order)

### HIGH PRIORITY

1. **Remove Duplicate RAG Initialization**
   - Keep only `setup_agent_system()` version
   - Remove lines 948-990 from main.py
   - Ensure single source of truth

2. **Fix Global Instance Management**
   ```python
   # In user_rag_manager.py
   async def initialize_user_rag_manager(...):
       global _user_rag_manager
       _user_rag_manager = UserRAGManager(...)
       return _user_rag_manager
   ```

3. **Standardize Embedding Model**
   - Use SentenceTransformer('all-MiniLM-L6-v2') everywhere
   - Remove OpenAI/LangChain embedding references
   - Document in code

4. **Connect KG to RAG**
   - Ensure KG passed to AdvancedRAGSystem
   - Implement GraphRAG queries
   - Use user mastery for retrieval boosting

### MEDIUM PRIORITY

5. **Clarify Vector Store Strategy**
   - Document: Global collection for what?
   - Document: User collections for what?
   - Add collection management utilities

6. **Verify Auto-Indexer**
   - Add startup log to confirm running
   - Add health check endpoint
   - Test background indexing

7. **Review Chat Agent Integration**
   - Read full chat_agent.py
   - Verify RAG context retrieval
   - Test with user content

### LOW PRIORITY

8. **Optimize Caching**
   - Move embedding cache wrap before RAG init
   - Add cache hit rate logging
   - Monitor performance

---

## Testing Checklist

- [ ] RAG initialized only once
- [ ] `get_user_rag_manager()` returns valid instance
- [ ] `get_user_knowledge_graph()` returns valid instance
- [ ] User content indexed in correct collection
- [ ] Retrieval returns user's notes/flashcards
- [ ] Knowledge graph queries work
- [ ] Auto-indexer runs every 30 minutes
- [ ] Chat agent uses RAG context
- [ ] Embedding cache reduces API calls
- [ ] GraphRAG features functional

---

## Files to Modify

1. `backend/main.py` - Remove duplicate RAG init (lines 948-990)
2. `backend/agents/setup.py` - Ensure proper initialization order
3. `backend/agents/rag/user_rag_manager.py` - Fix global instance
4. `backend/knowledge_graph/user_knowledge_graph.py` - Fix global instance
5. `backend/agents/rag/advanced_rag.py` - Verify KG integration
6. `backend/agents/chat_agent.py` - Verify RAG usage

---

## Next Steps

1. Read full `chat_agent.py` to see RAG integration
2. Check `knowledge_graph/user_knowledge_graph.py` for global instance
3. Test current system to identify which specific features are broken
4. Apply fixes in priority order
5. Add integration tests
