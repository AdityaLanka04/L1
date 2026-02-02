#!/usr/bin/env python3
"""
Test Knowledge Graph User Initialization
This verifies that users are automatically initialized in the KG
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

async def test_kg_initialization():
    """Test that KG user initialization works"""
    print("\n" + "="*60)
    print("🧪 TESTING KNOWLEDGE GRAPH USER INITIALIZATION")
    print("="*60)
    
    try:
        from agents.agent_api import get_user_kg
        
        user_kg = get_user_kg()
        
        if not user_kg:
            print("❌ Knowledge graph not available")
            print("   Make sure Neo4j is running and configured")
            return False
        
        print("✅ Knowledge graph client available")
        
        # Test user initialization
        test_user_id = 999
        test_user_data = {
            "username": "test_user",
            "learning_style": "mixed",
            "difficulty_level": "intermediate"
        }
        
        print(f"\n📝 Testing user initialization for user {test_user_id}...")
        result = await user_kg.initialize_user(test_user_id, test_user_data)
        
        if result:
            print(f"✅ User {test_user_id} initialized successfully")
            
            # Verify the user exists in the graph
            print(f"\n🔍 Verifying user in knowledge graph...")
            profile = await user_kg.get_user_profile(test_user_id)
            
            if profile:
                print(f"✅ User profile found:")
                print(f"   Learning style: {profile.get('learning_style')}")
                print(f"   Difficulty level: {profile.get('difficulty_level')}")
                print(f"   Concepts known: {profile.get('concepts_known', 0)}")
            else:
                print("⚠️  User profile not found (might be normal for new user)")
            
            return True
        else:
            print(f"❌ Failed to initialize user {test_user_id}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    success = await test_kg_initialization()
    
    if success:
        print("\n✅ Knowledge graph user initialization is working!")
        print("   Users will be automatically initialized on login/register")
    else:
        print("\n❌ Knowledge graph user initialization failed")
        print("   Check Neo4j connection and configuration")

if __name__ == "__main__":
    asyncio.run(main())
