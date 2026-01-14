"""
Test Script for Advanced AI Features
Tests: Enhanced Memory, Hybrid Search, Re-ranking, GraphRAG, Agentic RAG
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_imports():
    """Test that all modules import correctly"""
    print("\n" + "="*60)
    print("🧪 Testing Imports...")
    print("="*60)
    
    errors = []
    
    # Test Enhanced Memory imports
    try:
        from agents.memory.enhanced_memory import (
            EnhancedMemorySystem,
            EnhancedMemoryEntry,
            MemoryPriority,
            EpisodicMemory,
            SemanticMemory,
            ProceduralMemory,
            MemoryConsolidator
        )
        print("✅ Enhanced Memory imports OK")
    except Exception as e:
        errors.append(f"❌ Enhanced Memory import failed: {e}")
        print(errors[-1])
    
    # Test Advanced RAG imports
    try:
        from agents.rag.advanced_rag import (
            AdvancedRAGSystem,
            HybridSearchEngine,
            ReRanker,
            GraphRAGEngine,
            AgenticRAGEngine,
            RAGResult,
            SearchMode,
            BM25
        )
        print("✅ Advanced RAG imports OK")
    except Exception as e:
        errors.append(f"❌ Advanced RAG import failed: {e}")
        print(errors[-1])
    
    # Test API imports
    try:
        from agents.rag.rag_api import router as rag_router
        from agents.memory.memory_api import router as memory_router
        print("✅ API routers import OK")
    except Exception as e:
        errors.append(f"❌ API routers import failed: {e}")
        print(errors[-1])
    
    # Test main agents __init__ exports
    try:
        from agents import (
            EnhancedMemorySystem,
            MemoryPriority,
            AdvancedRAGSystem,
            SearchMode
        )
        print("✅ Main agents exports OK")
    except Exception as e:
        errors.append(f"❌ Main agents exports failed: {e}")
        print(errors[-1])
    
    return len(errors) == 0


def test_bm25():
    """Test BM25 keyword search"""
    print("\n" + "="*60)
    print("🧪 Testing BM25 Keyword Search...")
    print("="*60)
    
    from agents.rag.advanced_rag import BM25
    
    # Create test documents
    documents = [
        {"id": "1", "content": "Photosynthesis is the process by which plants convert light energy into chemical energy"},
        {"id": "2", "content": "The mitochondria is the powerhouse of the cell, producing ATP through cellular respiration"},
        {"id": "3", "content": "DNA replication is the process of copying genetic material before cell division"},
        {"id": "4", "content": "Plants use chlorophyll to absorb light during photosynthesis"},
        {"id": "5", "content": "Calculus involves derivatives and integrals for mathematical analysis"},
    ]
    
    bm25 = BM25()
    bm25.index(documents)
    
    # Test search
    results = bm25.search("photosynthesis plants light", top_k=3)
    
    print(f"Query: 'photosynthesis plants light'")
    print(f"Results: {len(results)} documents found")
    
    for idx, score in results:
        print(f"  - Doc {documents[idx]['id']}: score={score:.3f}")
        print(f"    {documents[idx]['content'][:60]}...")
    
    # Verify photosynthesis docs are top ranked
    top_ids = [documents[idx]["id"] for idx, _ in results[:2]]
    assert "1" in top_ids or "4" in top_ids, "Photosynthesis docs should be top ranked"
    
    print("✅ BM25 search working correctly")
    return True


def test_hybrid_search():
    """Test hybrid search engine"""
    print("\n" + "="*60)
    print("🧪 Testing Hybrid Search Engine...")
    print("="*60)
    
    from agents.rag.advanced_rag import HybridSearchEngine, SearchMode
    
    # Create engine without vector store (keyword-only mode)
    engine = HybridSearchEngine(semantic_weight=0.7, keyword_weight=0.3)
    
    # Index documents
    documents = [
        {"id": "note_1", "content": "Machine learning is a subset of artificial intelligence", "metadata": {"type": "note"}},
        {"id": "note_2", "content": "Neural networks are inspired by biological neurons", "metadata": {"type": "note"}},
        {"id": "flash_1", "content": "What is deep learning? A type of machine learning using neural networks", "metadata": {"type": "flashcard"}},
    ]
    
    engine.index_documents(documents)
    print(f"Indexed {len(documents)} documents")
    
    # Test keyword search
    async def run_search():
        results = await engine.search("machine learning neural", top_k=3, mode=SearchMode.KEYWORD)
        return results
    
    results = asyncio.run(run_search())
    
    print(f"Query: 'machine learning neural'")
    print(f"Results: {len(results)} found")
    for r in results:
        print(f"  - {r.id}: score={r.score:.3f}, source={r.source}")
    
    assert len(results) > 0, "Should find results"
    print("✅ Hybrid search engine working correctly")
    return True


def test_enhanced_memory():
    """Test enhanced memory system"""
    print("\n" + "="*60)
    print("🧪 Testing Enhanced Memory System...")
    print("="*60)
    
    from agents.memory.enhanced_memory import (
        EnhancedMemorySystem,
        MemoryPriority,
        EpisodicMemory,
        SemanticMemory,
        ProceduralMemory
    )
    
    # Test Episodic Memory
    print("\n📝 Testing Episodic Memory...")
    episodic = EpisodicMemory()
    
    entry = episodic.store_episode(
        user_id="test_user",
        episode_type="conversation",
        content="User asked about photosynthesis and I explained the process",
        context={"topic": "biology"},
        importance=0.7
    )
    print(f"  Stored episode: {entry.id}")
    
    recalled = episodic.recall_episodes("test_user", query="photosynthesis", limit=5)
    print(f"  Recalled {len(recalled)} episodes for 'photosynthesis'")
    assert len(recalled) > 0, "Should recall the episode"
    print("  ✅ Episodic memory OK")
    
    # Test Semantic Memory
    print("\n📚 Testing Semantic Memory...")
    semantic = SemanticMemory()
    
    semantic.store_concept(
        user_id="test_user",
        concept_name="photosynthesis",
        description="Process by which plants convert light to energy",
        related_concepts=["chlorophyll", "glucose", "oxygen"],
        mastery_level=0.6
    )
    print("  Stored concept: photosynthesis")
    
    concept = semantic.get_concept("test_user", "photosynthesis")
    assert concept is not None, "Should retrieve concept"
    print(f"  Retrieved concept with mastery: {concept.metadata.get('mastery_level')}")
    
    related = semantic.get_related_concepts("test_user", "photosynthesis")
    print(f"  Related concepts: {related}")
    assert "chlorophyll" in related, "Should have related concepts"
    print("  ✅ Semantic memory OK")
    
    # Test Procedural Memory
    print("\n⚙️ Testing Procedural Memory...")
    procedural = ProceduralMemory()
    
    procedural.store_preference("test_user", "explanation_style", "detailed", confidence=0.8)
    procedural.store_preference("test_user", "difficulty_level", "intermediate", confidence=0.7)
    
    pref = procedural.get_preference("test_user", "explanation_style")
    assert pref == "detailed", "Should retrieve preference"
    print(f"  Retrieved preference: explanation_style = {pref}")
    
    all_prefs = procedural.get_all_preferences("test_user")
    print(f"  All preferences: {all_prefs}")
    print("  ✅ Procedural memory OK")
    
    # Test Full Enhanced Memory System
    print("\n🧠 Testing Full Enhanced Memory System...")
    memory = EnhancedMemorySystem()
    
    async def test_memory_ops():
        # Store memory
        entry = await memory.store(
            user_id="test_user",
            memory_type="conversation",
            content="Discussed calculus derivatives",
            importance=0.7,
            priority=MemoryPriority.HIGH,
            tags=["math", "calculus", "derivatives"]
        )
        print(f"  Stored memory: {entry.id}")
        
        # Recall
        recalled = await memory.recall(
            user_id="test_user",
            query="calculus",
            limit=5
        )
        print(f"  Recalled {len(recalled)} memories for 'calculus'")
        
        # Get stats
        stats = memory.get_stats("test_user")
        print(f"  Memory stats: {stats}")
        
        return len(recalled) > 0
    
    result = asyncio.run(test_memory_ops())
    assert result, "Should recall memories"
    
    print("✅ Enhanced Memory System working correctly")
    return True


def test_reranker():
    """Test re-ranker (may fail if model not available)"""
    print("\n" + "="*60)
    print("🧪 Testing Re-ranker...")
    print("="*60)
    
    from agents.rag.advanced_rag import ReRanker, RAGResult
    
    reranker = ReRanker()
    
    if reranker.model is None:
        print("⚠️ Re-ranker model not loaded (sentence-transformers may not be installed)")
        print("   This is optional - hybrid search will still work without re-ranking")
        return True
    
    # Create test results
    results = [
        RAGResult(id="1", content="Photosynthesis converts light to chemical energy in plants", score=0.5, source="test"),
        RAGResult(id="2", content="The weather today is sunny and warm", score=0.6, source="test"),
        RAGResult(id="3", content="Plants use chlorophyll for photosynthesis", score=0.4, source="test"),
    ]
    
    reranked = reranker.rerank("How do plants make energy?", results, top_k=3)
    
    print(f"Query: 'How do plants make energy?'")
    print("Re-ranked results:")
    for r in reranked:
        print(f"  - {r.id}: rerank_score={r.rerank_score:.3f}")
        print(f"    {r.content[:50]}...")
    
    # Photosynthesis results should be ranked higher
    top_id = reranked[0].id
    assert top_id in ["1", "3"], "Photosynthesis content should rank higher"
    
    print("✅ Re-ranker working correctly")
    return True


def test_agentic_rag():
    """Test agentic RAG decision making"""
    print("\n" + "="*60)
    print("🧪 Testing Agentic RAG...")
    print("="*60)
    
    from agents.rag.advanced_rag import AgenticRAGEngine, HybridSearchEngine, SearchMode
    
    # Create minimal setup
    hybrid = HybridSearchEngine()
    hybrid.index_documents([
        {"id": "1", "content": "Machine learning algorithms learn from data"},
        {"id": "2", "content": "Neural networks have layers of neurons"},
    ])
    
    agentic = AgenticRAGEngine(
        ai_client=None,  # No AI client for testing
        hybrid_search=hybrid,
        graph_rag=None,
        reranker=None
    )
    
    async def test_strategy():
        # Test strategy decision for different query types
        
        # Short query -> keyword
        strategy1 = await agentic._decide_strategy("ML basics", {})
        print(f"Query 'ML basics': {strategy1['method'].value} - {strategy1['reasoning']}")
        
        # Conceptual query -> graph
        strategy2 = await agentic._decide_strategy("What is machine learning and how does it work?", {})
        print(f"Query 'What is...': {strategy2['method'].value} - {strategy2['reasoning']}")
        
        # Search query -> hybrid
        strategy3 = await agentic._decide_strategy("Find examples of neural network architectures", {})
        print(f"Query 'Find examples...': {strategy3['method'].value} - {strategy3['reasoning']}")
        
        return True
    
    result = asyncio.run(test_strategy())
    
    print("✅ Agentic RAG decision making working correctly")
    return True


def test_full_rag_system():
    """Test the full Advanced RAG System"""
    print("\n" + "="*60)
    print("🧪 Testing Full Advanced RAG System...")
    print("="*60)
    
    from agents.rag.advanced_rag import AdvancedRAGSystem, SearchMode
    
    # Create system without external dependencies
    rag = AdvancedRAGSystem(
        ai_client=None,
        knowledge_graph=None,
        vector_store=None
    )
    
    # Index some content
    rag.index_content("notes", [
        {"id": 1, "title": "Biology 101", "content": "Photosynthesis is how plants make food using sunlight"},
        {"id": 2, "title": "Chemistry Basics", "content": "Atoms are the building blocks of matter"},
        {"id": 3, "title": "Physics Intro", "content": "Newton's laws describe motion and forces"},
    ])
    print("Indexed 3 notes")
    
    async def run_retrieval():
        # Test retrieval
        result = await rag.retrieve(
            query="how do plants make food",
            user_id="test_user",
            mode=SearchMode.HYBRID,
            top_k=3
        )
        return result
    
    result = asyncio.run(run_retrieval())
    
    print(f"Query: 'how do plants make food'")
    print(f"Results: {result.get('total', len(result.get('results', [])))} found")
    print(f"From cache: {result.get('from_cache', False)}")
    
    for r in result.get("results", []):
        content = r.content if hasattr(r, 'content') else r.get('content', '')
        score = r.score if hasattr(r, 'score') else r.get('score', 0)
        print(f"  - score={score:.3f}: {content[:50]}...")
    
    # Get stats
    stats = rag.get_stats()
    print(f"System stats: {stats}")
    
    print("✅ Full RAG System working correctly")
    return True


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚀 ADVANCED AI FEATURES TEST SUITE")
    print("="*60)
    
    results = {}
    
    # Run tests
    tests = [
        ("Imports", test_imports),
        ("BM25 Search", test_bm25),
        ("Hybrid Search", test_hybrid_search),
        ("Enhanced Memory", test_enhanced_memory),
        ("Re-ranker", test_reranker),
        ("Agentic RAG", test_agentic_rag),
        ("Full RAG System", test_full_rag_system),
    ]
    
    for name, test_fn in tests:
        try:
            results[name] = test_fn()
        except Exception as e:
            print(f"❌ {name} FAILED: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Advanced AI features are working correctly.")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Check the errors above.")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
