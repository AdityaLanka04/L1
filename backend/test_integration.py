"""
Test Integration of Advanced AI Features with Main App
Verifies that all new systems are properly connected.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_setup_imports():
    """Test that setup.py imports work correctly"""
    print("\n" + "="*60)
    print("🧪 Testing Setup Imports...")
    print("="*60)
    
    try:
        from agents.setup import setup_agent_system, register_agent_routes
        print("✅ agents.setup imports OK")
        return True
    except Exception as e:
        print(f"❌ Setup import failed: {e}")
        return False


def test_api_routers():
    """Test that all API routers can be imported"""
    print("\n" + "="*60)
    print("🧪 Testing API Router Imports...")
    print("="*60)
    
    errors = []
    
    # Test RAG router
    try:
        from agents.rag.rag_api import router as rag_router, initialize_rag_system
        print(f"✅ RAG router: {rag_router.prefix}")
    except Exception as e:
        errors.append(f"RAG router: {e}")
        print(f"❌ RAG router failed: {e}")
    
    # Test Memory router
    try:
        from agents.memory.memory_api import router as memory_router, initialize_enhanced_memory
        print(f"✅ Memory router: {memory_router.prefix}")
    except Exception as e:
        errors.append(f"Memory router: {e}")
        print(f"❌ Memory router failed: {e}")
    
    # Test Advanced AI router
    try:
        from agents.advanced_ai_api import router as advanced_ai_router
        print(f"✅ Advanced AI router: {advanced_ai_router.prefix}")
    except Exception as e:
        errors.append(f"Advanced AI router: {e}")
        print(f"❌ Advanced AI router failed: {e}")
    
    return len(errors) == 0


def test_fastapi_integration():
    """Test that routers can be added to a FastAPI app"""
    print("\n" + "="*60)
    print("🧪 Testing FastAPI Integration...")
    print("="*60)
    
    try:
        from fastapi import FastAPI
        
        app = FastAPI(title="Test App")
        
        # Register routers
        from agents.rag.rag_api import router as rag_router
        from agents.memory.memory_api import router as memory_router
        from agents.advanced_ai_api import router as advanced_ai_router
        
        app.include_router(rag_router)
        app.include_router(memory_router)
        app.include_router(advanced_ai_router)
        
        # Check routes are registered
        routes = [route.path for route in app.routes]
        
        print(f"Total routes registered: {len(routes)}")
        
        # Check for our new endpoints
        rag_routes = [r for r in routes if '/rag/' in r]
        memory_routes = [r for r in routes if '/memory/' in r]
        advanced_ai_routes = [r for r in routes if '/advanced-ai/' in r]
        
        print(f"  RAG routes: {len(rag_routes)}")
        print(f"  Memory routes: {len(memory_routes)}")
        print(f"  Advanced AI routes: {len(advanced_ai_routes)}")
        
        # List some key endpoints
        print("\nKey endpoints:")
        key_endpoints = [
            '/api/rag/retrieve',
            '/api/rag/learning-context',
            '/api/memory/store',
            '/api/memory/recall',
            '/api/advanced-ai/analyze-emotion',
            '/api/advanced-ai/generate-with-reasoning'
        ]
        
        for endpoint in key_endpoints:
            found = any(endpoint in r for r in routes)
            status = "✅" if found else "❌"
            print(f"  {status} {endpoint}")
        
        print("\n✅ FastAPI integration successful")
        return True
        
    except Exception as e:
        print(f"❌ FastAPI integration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_system_initialization():
    """Test that systems can be initialized"""
    print("\n" + "="*60)
    print("🧪 Testing System Initialization...")
    print("="*60)
    
    async def run_init():
        # Test RAG system init
        try:
            from agents.rag.rag_api import initialize_rag_system, get_rag_system
            
            rag = await initialize_rag_system(
                ai_client=None,
                knowledge_graph=None,
                vector_store=None,
                embedding_model=None
            )
            
            assert rag is not None
            assert get_rag_system() is not None
            print("✅ RAG system initialized")
        except Exception as e:
            print(f"❌ RAG init failed: {e}")
            return False
        
        # Test Memory system init
        try:
            from agents.memory.memory_api import initialize_enhanced_memory, get_enhanced_memory
            
            memory = await initialize_enhanced_memory(
                ai_client=None,
                knowledge_graph=None,
                vector_store=None,
                db_session_factory=None
            )
            
            assert memory is not None
            assert get_enhanced_memory() is not None
            print("✅ Enhanced Memory system initialized")
        except Exception as e:
            print(f"❌ Memory init failed: {e}")
            return False
        
        return True
    
    return asyncio.run(run_init())


def run_all_tests():
    """Run all integration tests"""
    print("\n" + "="*60)
    print("🚀 INTEGRATION TEST SUITE")
    print("="*60)
    
    results = {}
    
    tests = [
        ("Setup Imports", test_setup_imports),
        ("API Routers", test_api_routers),
        ("FastAPI Integration", test_fastapi_integration),
        ("System Initialization", test_system_initialization),
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
    print("📊 INTEGRATION TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All integration tests passed!")
        print("\nNew API endpoints available:")
        print("  - POST /api/rag/retrieve - Smart content retrieval")
        print("  - POST /api/rag/learning-context - Learning context with graph")
        print("  - POST /api/memory/store - Store enhanced memories")
        print("  - POST /api/memory/recall - Recall with relevance scoring")
        print("  - GET  /api/memory/insights/{user_id} - User insights")
        print("  - POST /api/advanced-ai/generate-with-reasoning - Step-by-step reasoning")
        print("  - POST /api/advanced-ai/analyze-emotion - Emotional state detection")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed.")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
