import requests
import json

user_id = "stupendous0512@gmail.com"
base_url = "http://localhost:8001"
headers = {"Authorization": "Bearer test"}

print("=" * 60)
print("TESTING COMPLETE QUESTION BANK FLOW")
print("=" * 60)

# 1. Get uploaded documents
print("\n1. Getting uploaded documents...")
response = requests.get(f"{base_url}/qb/get_uploaded_documents?user_id={user_id}", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    docs = response.json()['documents']
    print(f"Found {len(docs)} documents")
    for doc in docs:
        print(f"  - {doc['filename']} (Type: {doc['document_type']})")
        print(f"    Topics: {doc['analysis'].get('main_topics', [])}")
else:
    print(f"Error: {response.text}")

# 2. Generate questions from the latest PDF
print("\n2. Generating questions from PDF...")
if docs:
    latest_doc = docs[0]
    payload = {
        "user_id": user_id,
        "source_type": "pdf",
        "source_id": latest_doc['id'],
        "question_count": 5,
        "difficulty_mix": {"easy": 2, "medium": 2, "hard": 1},
        "question_types": ["multiple_choice", "true_false"]
    }
    
    response = requests.post(
        f"{base_url}/qb/generate_from_pdf",
        json=payload,
        headers={**headers, "Content-Type": "application/json"}
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Generated {data.get('question_count')} questions")
        print(f"  Question Set ID: {data.get('question_set_id')}")
    else:
        print(f"Error: {response.text}")

# 3. Get all question sets
print("\n3. Getting question sets...")
response = requests.get(f"{base_url}/qb/get_question_sets?user_id={user_id}", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    sets = response.json()['question_sets']
    print(f"Found {len(sets)} question sets")
    for qs in sets[:3]:  # Show first 3
        print(f"  - {qs.get('title', 'Unnamed')} ({qs.get('question_count', 0)} questions)")
else:
    print(f"Error: {response.text}")

# 4. Get a specific question set
print("\n4. Getting a specific question set...")
response = requests.get(f"{base_url}/qb/get_question_sets?user_id={user_id}", headers=headers)
if response.status_code == 200:
    sets = response.json()['question_sets']
    if sets:
        set_id = sets[0]['id']
        response = requests.get(
            f"{base_url}/qb/get_question_set/{set_id}?user_id={user_id}",
            headers=headers
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            qs = response.json()
            print(f"✓ Got question set: {qs.get('title', 'Unnamed')}")
            questions = qs.get('questions', [])
            print(f"  Questions: {len(questions)}")
            if questions:
                print(f"  First question: {questions[0].get('question_text', '')[:60]}...")

print("\n" + "=" * 60)
print("FLOW TEST COMPLETE")
print("=" * 60)