"""
Quick test script to verify concept generation is working
Run this after starting the backend to test the endpoint
"""

import requests
import json

API_URL = "http://localhost:8000"

def test_generation(username):
    """Test concept web generation"""
    
    print(f"Testing concept generation for user: {username}")
    
    # Test the generation endpoint
    response = requests.post(
        f"{API_URL}/api/generate_concept_web",
        json={"user_id": username}
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get("status") == "success":
            print(f"\n✅ SUCCESS!")
            print(f"   Concepts created: {data.get('concepts_created', 0)}")
            print(f"   Connections created: {data.get('connections_created', 0)}")
        elif data.get("status") == "no_content":
            print(f"\n⚠️  No content found to generate from")
            print(f"   Make sure you have notes, quizzes, or flashcards")
        else:
            print(f"\n❌ Unknown status: {data.get('status')}")
    else:
        print(f"❌ Error: {response.text}")
    
    # Test getting the concept web
    print(f"\n\nTesting get_concept_web...")
    response = requests.get(
        f"{API_URL}/api/get_concept_web",
        params={"user_id": username}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Nodes: {len(data.get('nodes', []))}")
        print(f"Connections: {len(data.get('connections', []))}")
        
        if data.get('nodes'):
            print(f"\nFirst 3 concepts:")
            for node in data['nodes'][:3]:
                print(f"  - {node['concept_name']} ({node['category']})")
        
        if data.get('connections'):
            print(f"\nFirst 3 connections:")
            for conn in data['connections'][:3]:
                print(f"  - {conn['connection_type']}: {conn['source_id']} -> {conn['target_id']}")
    else:
        print(f"❌ Error getting concept web: {response.text}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input("Enter username: ")
    
    test_generation(username)
