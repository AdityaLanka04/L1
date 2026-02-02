#!/usr/bin/env python3
"""
Verify Knowledge Graph Setup
Simple script to check if KG is properly configured
"""

import os
from dotenv import load_dotenv
load_dotenv()

print("\n" + "="*60)
print("🔍 KNOWLEDGE GRAPH CONFIGURATION CHECK")
print("="*60)

# Check environment variables
neo4j_uri = os.getenv("NEO4J_URI")
neo4j_user = os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME")
neo4j_password = os.getenv("NEO4J_PASSWORD")

print("\n📋 Environment Variables:")
print(f"   NEO4J_URI: {neo4j_uri or '❌ NOT SET'}")
print(f"   NEO4J_USER: {neo4j_user or '❌ NOT SET'}")
print(f"   NEO4J_PASSWORD: {'✅ SET' if neo4j_password else '❌ NOT SET'}")

if not all([neo4j_uri, neo4j_user, neo4j_password]):
    print("\n❌ Neo4j environment variables not configured")
    print("\n📝 To configure Neo4j:")
    print("   1. Add to your .env file:")
    print("      NEO4J_URI=bolt://localhost:7687")
    print("      NEO4J_USER=neo4j")
    print("      NEO4J_PASSWORD=your_password")
    print("   2. Start Neo4j: docker-compose -f docker-compose.neo4j.yml up -d")
    print("   3. Seed the graph: python backend/seed_knowledge_graph.py")
else:
    print("\n✅ Neo4j environment variables configured")
    
    # Try to connect
    try:
        from neo4j import GraphDatabase
        
        print("\n🔌 Testing Neo4j connection...")
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        
        with driver.session() as session:
            result = session.run("RETURN 1 as test")
            record = result.single()
            if record and record["test"] == 1:
                print("✅ Neo4j connection successful!")
                
                # Check if data exists
                result = session.run("MATCH (c:Concept) RETURN count(c) as count")
                concept_count = result.single()["count"]
                
                result = session.run("MATCH (t:Topic) RETURN count(t) as count")
                topic_count = result.single()["count"]
                
                result = session.run("MATCH (u:User) RETURN count(u) as count")
                user_count = result.single()["count"]
                
                print(f"\n📊 Knowledge Graph Stats:")
                print(f"   Topics: {topic_count}")
                print(f"   Concepts: {concept_count}")
                print(f"   Users: {user_count}")
                
                if concept_count == 0:
                    print("\n⚠️  No concepts found in knowledge graph")
                    print("   Run: python backend/seed_knowledge_graph.py")
                else:
                    print("\n✅ Knowledge graph is seeded and ready!")
                    print("\n🎯 User Initialization:")
                    print("   ✅ Users will be automatically initialized in KG on login/register")
                    print("   ✅ No manual initialization needed")
        
        driver.close()
        
    except Exception as e:
        print(f"❌ Neo4j connection failed: {e}")
        print("\n📝 Troubleshooting:")
        print("   1. Make sure Neo4j is running")
        print("   2. Check docker-compose.neo4j.yml configuration")
        print("   3. Verify credentials in .env file")

print("\n" + "="*60)
