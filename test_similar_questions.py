import requests
import json

BASE_URL = "http://localhost:8001"
USER_ID = "stupendous0512@gmail.com"
TOKEN = "test_token"

def test_similar_questions():
    print("=" * 60)
    print("TESTING SIMILAR QUESTION GENERATION")
    print("=" * 60)
    
    # First, get a question from the latest question set
    print("\n1. Getting question sets...")
    response = requests.get(
        f"{BASE_URL}/qb/get_question_sets?user_id={USER_ID}",
        headers={'Authorization': f'Bearer {TOKEN}'}
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to get question sets: {response.status_code}")
        return
    
    data = response.json()
    question_sets = data.get('question_sets', [])
    
    if not question_sets:
        print("✗ No question sets found")
        return
    
    # Get the first question set with questions
    question_set_id = None
    for qs in question_sets:
        if qs.get('total_questions', 0) > 0:
            question_set_id = qs['id']
            break
    
    if not question_set_id:
        print("✗ No question sets with questions found")
        return
    
    print(f"✓ Found question set ID: {question_set_id}")
    
    # Get the questions
    print("\n2. Getting questions from set...")
    response = requests.get(
        f"{BASE_URL}/qb/get_question_set/{question_set_id}?user_id={USER_ID}",
        headers={'Authorization': f'Bearer {TOKEN}'}
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to get question set: {response.status_code}")
        return
    
    data = response.json()
    questions = data.get('questions', [])
    
    if not questions:
        print("✗ No questions found in set")
        return
    
    question_id = questions[0]['id']
    print(f"✓ Found {len(questions)} questions")
    print(f"✓ Testing with question ID: {question_id}")
    print(f"   Question: {questions[0]['question_text'][:50]}...")
    
    # Generate similar questions
    print("\n3. Generating similar questions...")
    response = requests.post(
        f"{BASE_URL}/qb/generate_similar_question",
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'user_id': USER_ID,
            'question_id': question_id
        }
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✓ SUCCESS!")
        if 'question' in data:
            q = data['question']
            print(f"  Generated similar question:")
            print(f"  ID: {q.get('id')}")
            print(f"  Type: {q.get('question_type')}")
            print(f"  Difficulty: {q.get('difficulty')}")
            print(f"  Topic: {q.get('topic')}")
            print(f"  Question: {q.get('question_text')[:60]}...")
        else:
            print(f"  Response: {data}")
    else:
        print(f"✗ Failed: {response.text}")

if __name__ == "__main__":
    test_similar_questions()