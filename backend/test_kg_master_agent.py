"""
Test Script for Knowledge Graph and Master Agent
Run this script to test the integration between UserKnowledgeGraph and MasterAgent.

Usage:
    python test_kg_master_agent.py

Requirements:
    - Neo4j running (or tests will skip KG-specific tests)
    - Backend dependencies installed
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


# ==================== Test Configuration ====================

TEST_USER_ID = 1  # Change this to an existing user ID in your database


async def test_user_knowledge_graph():
    """Test UserKnowledgeGraph functionality"""
    print("\n" + "="*60)
    print("🧪 TESTING USER KNOWLEDGE GRAPH")
    print("="*60)
    
    try:
        from knowledge_graph import get_knowledge_graph, create_user_knowledge_graph
        from database import SessionLocal
        
        # Get Neo4j client
        neo4j_client = await get_knowledge_graph()
        
        if not neo4j_client:
            print("⚠️  Neo4j not available - skipping KG tests")
            print("   Make sure Neo4j is running and configured in .env")
            return None
        
        print("✅ Neo4j connected")
        
        # Create UserKnowledgeGraph
        user_kg = create_user_knowledge_graph(neo4j_client, SessionLocal)
        print("✅ UserKnowledgeGraph created")
        
        # Test 1: Initialize user
        print("\n📝 Test 1: Initialize user in KG")
        result = await user_kg.initialize_user(TEST_USER_ID, {
            "username": "test_user",
            "learning_style": "visual",
            "difficulty_level": "intermediate"
        })
        print(f"   Result: {'✅ Success' if result else '❌ Failed'}")
        
        # Test 2: Record concept interactions
        print("\n📝 Test 2: Record concept interactions")
        test_concepts = [
            ("Python Basics", True, 0.3),
            ("Python Basics", True, 0.3),
            ("Data Structures", False, 0.5),
            ("Machine Learning", True, 0.7),
            ("Neural Networks", False, 0.8),
            ("Calculus", True, 0.4),
        ]
        
        for concept, correct, difficulty in test_concepts:
            mastery = await user_kg.record_concept_interaction(
                user_id=TEST_USER_ID,
                concept=concept,
                correct=correct,
                source="test",
                difficulty=difficulty
            )
            print(f"   {concept}: mastery={mastery.mastery_level:.2f}, classification={mastery.mastery_classification.value}")
        
        # Test 3: Get weak concepts
        print("\n📝 Test 3: Get weak concepts")
        weak = await user_kg.get_weak_concepts(TEST_USER_ID, threshold=0.5, limit=5)
        if weak:
            for c in weak:
                print(f"   ⚠️  {c.concept}: {c.mastery_level:.2f} ({c.mastery_classification.value})")
        else:
            print("   No weak concepts found")
        
        # Test 4: Get strong concepts
        print("\n📝 Test 4: Get strong concepts")
        strong = await user_kg.get_strong_concepts(TEST_USER_ID, threshold=0.3, limit=5)
        if strong:
            for c in strong:
                print(f"   ✅ {c.concept}: {c.mastery_level:.2f} ({c.mastery_classification.value})")
        else:
            print("   No strong concepts found")
        
        # Test 5: Get domain mastery
        print("\n📝 Test 5: Get domain mastery")
        domains = await user_kg.get_domain_mastery(TEST_USER_ID)
        if domains:
            for domain, data in domains.items():
                print(f"   📚 {domain}: {data['average_mastery']:.2f} ({data['concept_count']} concepts)")
        else:
            print("   No domain data found")
        
        # Test 6: Get learning analytics
        print("\n📝 Test 6: Get learning analytics")
        analytics = await user_kg.get_learning_analytics(TEST_USER_ID)
        if analytics.get("summary"):
            summary = analytics["summary"]
            print(f"   Total concepts: {summary.get('total_concepts', 0)}")
            print(f"   Average mastery: {summary.get('average_mastery', 0):.2f}")
            print(f"   Total reviews: {summary.get('total_reviews', 0)}")
        
        if analytics.get("mastery_distribution"):
            print("   Mastery distribution:")
            for level, count in analytics["mastery_distribution"].items():
                print(f"      {level}: {count}")
        
        # Test 7: Find knowledge gaps
        print("\n📝 Test 7: Find knowledge gaps")
        gaps = await user_kg.find_knowledge_gaps(TEST_USER_ID, limit=3)
        if gaps:
            for gap in gaps:
                print(f"   🔍 {gap.get('concept')}: {gap.get('reason', 'N/A')}")
        else:
            print("   No knowledge gaps found (need more concept relationships)")
        
        # Test 8: Get recommended topics
        print("\n📝 Test 8: Get recommended topics")
        recommended = await user_kg.get_recommended_topics(TEST_USER_ID, limit=3)
        if recommended:
            for topic in recommended:
                print(f"   💡 {topic.get('topic')}: {topic.get('recommendation_reason', 'N/A')}")
        else:
            print("   No recommendations (need more topic data)")
        
        print("\n✅ UserKnowledgeGraph tests completed!")
        return user_kg
        
    except Exception as e:
        print(f"\n❌ UserKnowledgeGraph test failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_master_agent():
    """Test Master Agent functionality"""
    print("\n" + "="*60)
    print("🧪 TESTING MASTER AGENT")
    print("="*60)
    
    try:
        from database import SessionLocal
        from knowledge_graph import get_knowledge_graph, create_user_knowledge_graph
        from agents.memory import initialize_memory_manager
        from agents.master_agent import create_master_agent
        
        # Initialize AI client (same as main.py)
        GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY") or os.getenv("GEMINI_API_KEY")
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        GROQ_MODEL = "llama-3.3-70b-versatile"
        GEMINI_MODEL = "gemini-2.0-flash"
        
        groq_client = None
        gemini_client = None
        
        # Try Groq
        if GROQ_API_KEY:
            try:
                from groq import Groq
                groq_client = Groq(api_key=GROQ_API_KEY)
                print("✅ Groq client initialized")
            except Exception as e:
                print(f"⚠️  Groq init failed: {e}")
        
        # Try Gemini
        if GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                gemini_client = genai
                print("✅ Gemini client initialized")
            except Exception as e:
                print(f"⚠️  Gemini init failed: {e}")
        
        if not gemini_client and not groq_client:
            print("❌ No AI API keys configured!")
            print("   Set GOOGLE_GENERATIVE_AI_KEY or GROQ_API_KEY in .env")
            return None
        
        from ai_utils import UnifiedAIClient
        ai_client = UnifiedAIClient(gemini_client, groq_client, GEMINI_MODEL, GROQ_MODEL, GEMINI_API_KEY)
        print("✅ UnifiedAIClient initialized")
        
        # Initialize Knowledge Graph
        neo4j_client = await get_knowledge_graph()
        user_kg = None
        if neo4j_client:
            user_kg = create_user_knowledge_graph(neo4j_client, SessionLocal)
            print("✅ Knowledge Graph connected")
        else:
            print("⚠️  Knowledge Graph not available")
        
        # Initialize Memory Manager
        memory_manager = await initialize_memory_manager(
            knowledge_graph=neo4j_client,
            db_session_factory=SessionLocal
        )
        print("✅ Memory Manager initialized")
        
        # Create Master Agent
        master_agent = create_master_agent(
            ai_client=ai_client,
            knowledge_graph=neo4j_client,
            memory_manager=memory_manager,
            db_session_factory=SessionLocal,
            user_knowledge_graph=user_kg
        )
        print("✅ Master Agent created")
        
        # Test 1: Get full context
        print("\n📝 Test 1: Get full user context")
        state = {
            "user_id": str(TEST_USER_ID),
            "action": "get_full_context",
            "user_input": "show my dashboard",
            "session_id": f"test_{datetime.utcnow().timestamp()}",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        print(f"   Response preview: {result.response[:200]}..." if len(result.response) > 200 else f"   Response: {result.response}")
        
        # Test 2: Get weak topics
        print("\n📝 Test 2: Get weak topics")
        state["action"] = "get_weak_topics"
        state["user_input"] = "what are my weak topics"
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        response_data = result.metadata.get("response_data", {})
        weak_topics = response_data.get("analysis", {}).get("weak_topics", [])
        print(f"   Weak topics found: {weak_topics[:5] if weak_topics else 'None'}")
        
        # Test 3: Get strong topics
        print("\n📝 Test 3: Get strong topics")
        state["action"] = "get_strong_topics"
        state["user_input"] = "what am I good at"
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        response_data = result.metadata.get("response_data", {})
        strong_topics = response_data.get("analysis", {}).get("strong_topics", [])
        print(f"   Strong topics found: {strong_topics[:5] if strong_topics else 'None'}")
        
        # Test 4: Get recommendations
        print("\n📝 Test 4: Get recommendations")
        state["action"] = "get_recommendations"
        state["user_input"] = "what should I study"
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        response_data = result.metadata.get("response_data", {})
        recommendations = response_data.get("recommendations", [])
        print(f"   Recommendations: {len(recommendations)} found")
        for rec in recommendations[:3]:
            print(f"      - {rec.get('type', 'tip')}: {rec.get('suggested_action', rec.get('reason', 'N/A'))[:50]}...")
        
        # Test 5: Get learning insights
        print("\n📝 Test 5: Get learning insights")
        state["action"] = "get_learning_insights"
        state["user_input"] = "give me insights"
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        response_data = result.metadata.get("response_data", {})
        insights = response_data.get("insights", [])
        print(f"   Insights: {len(insights)} found")
        for insight in insights[:3]:
            print(f"      - {insight.get('title', 'Insight')}: {insight.get('insight', 'N/A')[:50]}...")
        
        # Test 6: Get user profile
        print("\n📝 Test 6: Get user profile")
        state["action"] = "get_user_profile"
        state["user_input"] = "show my profile"
        
        result = await master_agent.invoke(state)
        print(f"   Success: {result.success}")
        print(f"   Response preview: {result.response[:300]}..." if len(result.response) > 300 else f"   Response: {result.response}")
        
        print("\n✅ Master Agent tests completed!")
        return master_agent
        
    except Exception as e:
        print(f"\n❌ Master Agent test failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_api_endpoints():
    """Test the API endpoints (requires server running)"""
    print("\n" + "="*60)
    print("🧪 TESTING API ENDPOINTS")
    print("="*60)
    
    try:
        import httpx
        
        BASE_URL = "http://localhost:8000"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test 1: Agent status
            print("\n📝 Test 1: Agent system status")
            response = await client.get(f"{BASE_URL}/api/agents/status")
            if response.status_code == 200:
                data = response.json()
                print(f"   Status: {data.get('status')}")
                print(f"   Master Agent: {'✅' if data.get('agents', {}).get('master') else '❌'}")
                print(f"   User KG Available: {'✅' if data.get('user_knowledge_graph_available') else '❌'}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
            
            # Test 2: Master agent dashboard
            print("\n📝 Test 2: Master agent dashboard")
            response = await client.get(f"{BASE_URL}/api/agents/master/dashboard/{TEST_USER_ID}")
            if response.status_code == 200:
                data = response.json()
                print(f"   Success: {data.get('success')}")
                print(f"   Response preview: {data.get('response', '')[:100]}...")
            else:
                print(f"   ❌ Failed: {response.status_code} - {response.text[:100]}")
            
            # Test 3: Knowledge Graph endpoints
            print("\n📝 Test 3: Knowledge Graph - weak concepts")
            response = await client.get(f"{BASE_URL}/api/agents/knowledge-graph/user/{TEST_USER_ID}/weak-concepts")
            if response.status_code == 200:
                data = response.json()
                print(f"   Weak concepts: {len(data.get('weak_concepts', []))} found")
            else:
                print(f"   ❌ Failed: {response.status_code}")
            
            print("\n📝 Test 4: Knowledge Graph - analytics")
            response = await client.get(f"{BASE_URL}/api/agents/knowledge-graph/user/{TEST_USER_ID}/analytics")
            if response.status_code == 200:
                data = response.json()
                analytics = data.get('analytics', {})
                summary = analytics.get('summary', {})
                print(f"   Total concepts: {summary.get('total_concepts', 0)}")
                print(f"   Average mastery: {summary.get('average_mastery', 0):.2f}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
        
        print("\n✅ API endpoint tests completed!")
        
    except ImportError:
        print("⚠️  httpx not installed. Install with: pip install httpx")
        print("   Or test endpoints manually with curl/Postman")
    except Exception as e:
        print(f"\n❌ API test failed: {e}")
        print("   Make sure the backend server is running: python main.py")


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚀 KNOWLEDGE GRAPH & MASTER AGENT TEST SUITE")
    print("="*60)
    print(f"Test User ID: {TEST_USER_ID}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    
    # Test 1: UserKnowledgeGraph
    user_kg = await test_user_knowledge_graph()
    
    # Test 2: Master Agent
    master_agent = await test_master_agent()
    
    # Test 3: API Endpoints (optional - requires server running)
    print("\n" + "-"*60)
    run_api_tests = input("Run API endpoint tests? (requires server running) [y/N]: ").strip().lower()
    if run_api_tests == 'y':
        await test_api_endpoints()
    
    print("\n" + "="*60)
    print("🏁 TEST SUITE COMPLETED")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
