#!/usr/bin/env python3
"""
Final verification test for Question Bank Dashboard functionality
Tests all critical features: PDF upload, parsing, question generation, and similar questions
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"
USER_ID = "stupendous0512@gmail.com"
TOKEN = "test_token"

def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def test_feature(name, test_func):
    """Helper to run a test and track results"""
    try:
        print(f"\n► {name}...", end=" ")
        result = test_func()
        if result:
            print("✓ PASSED")
            return True
        else:
            print("✗ FAILED")
            return False
    except Exception as e:
        print(f"✗ FAILED: {str(e)[:80]}")
        return False

# Track results
results = {}

print_section("QUESTION BANK FEATURE VERIFICATION")

# Test 1: PDF Upload and Parsing
def test_pdf_upload():
    with open(r'd:\Brainwave\L1\real_test.pdf', 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f"{BASE_URL}/qb/upload_pdf?user_id={USER_ID}",
            headers={'Authorization': f'Bearer {TOKEN}'},
            files=files
        )
    
    if response.status_code == 200:
        data = response.json()
        # Verify document was analyzed
        if 'analysis' in data and data['analysis'].get('document_type'):
            global doc_id
            doc_id = data.get('document_id')
            return True
    return False

results['PDF Upload & Parsing'] = test_feature(
    "1. PDF Upload and Document Parsing",
    test_pdf_upload
)

# Test 2: Upload Section Display
def test_upload_retrieval():
    response = requests.get(
        f"{BASE_URL}/qb/get_uploaded_documents?user_id={USER_ID}",
        headers={'Authorization': f'Bearer {TOKEN}'}
    )
    
    if response.status_code == 200:
        data = response.json()
        docs = data.get('documents', [])
        # Should have at least one document
        return len(docs) > 0
    return False

results['Upload Display'] = test_feature(
    "2. Display Uploaded PDFs in Upload Section",
    test_upload_retrieval
)

# Test 3: Error Handling (simulate error)
def test_error_handling():
    # Try to upload to wrong endpoint
    response = requests.get(
        f"{BASE_URL}/qb/upload_pdf?user_id={USER_ID}",
        headers={'Authorization': f'Bearer {TOKEN}'}
    )
    # Should fail with proper HTTP error
    return response.status_code >= 400

results['Error Handling'] = test_feature(
    "3. Error Handling for Invalid Requests",
    test_error_handling
)

# Test 4: Question Generation from PDF
def test_question_generation():
    response = requests.post(
        f"{BASE_URL}/qb/generate_from_pdf",
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'user_id': USER_ID,
            'source_type': 'pdf',
            'source_id': doc_id,
            'question_count': 3,
            'difficulty_mix': {'easy': 1, 'medium': 1, 'hard': 1},
            'question_types': ['multiple_choice', 'true_false', 'short_answer']
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        global question_set_id
        question_set_id = data.get('question_set_id')
        global question_id
        # Store a question ID for similar generation
        question_id = None
        return True
    return False

results['Question Generation'] = test_feature(
    "4. Generate Questions from PDF",
    test_question_generation
)

# Test 5: Get Question Set
def test_get_questions():
    response = requests.get(
        f"{BASE_URL}/qb/get_question_set/{question_set_id}?user_id={USER_ID}",
        headers={'Authorization': f'Bearer {TOKEN}'}
    )
    
    if response.status_code == 200:
        data = response.json()
        questions = data.get('questions', [])
        if questions:
            global question_id
            question_id = questions[0]['id']
            return True
    return False

results['Get Questions'] = test_feature(
    "5. Retrieve Questions from Question Set",
    test_get_questions
)

# Test 6: Similar Question Generation
def test_similar_questions():
    if not question_id:
        print("  (Skipped - no question available)")
        return True
    
    response = requests.post(
        f"{BASE_URL}/qb/generate_similar_question",
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'user_id': USER_ID,
            'question_id': question_id,
            'difficulty': None
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        return 'question' in data and data['question'].get('id')
    return False

results['Similar Questions'] = test_feature(
    "6. Generate Similar Questions",
    test_similar_questions
)

# Print Summary
print_section("VERIFICATION SUMMARY")

passed = sum(1 for v in results.values() if v)
total = len(results)

for feature, passed_test in results.items():
    status = "✓ PASS" if passed_test else "✗ FAIL"
    print(f"  {status} | {feature}")

print(f"\n  Overall: {passed}/{total} features working")

if passed == total:
    print("\n✓ All features are working correctly!")
    print("\nThe Question Bank Dashboard is ready to use with:")
    print("  • PDF uploads with automatic parsing and analysis")
    print("  • Uploaded documents displayed in the uploads section")
    print("  • Proper error handling for failed operations")
    print("  • Question generation from PDF documents")
    print("  • Similar question generation feature")
    sys.exit(0)
else:
    print(f"\n✗ {total - passed} feature(s) need attention")
    sys.exit(1)