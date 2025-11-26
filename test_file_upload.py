#!/usr/bin/env python3
"""
Test script for file attachment upload endpoint
"""
import requests
import os

# Test file upload
def test_upload():
    url = "http://localhost:8000/api/upload-attachment"
    
    # Create a test file
    test_content = b"Test PDF content"
    test_filename = "test_document.pdf"
    
    files = {'file': (test_filename, test_content, 'application/pdf')}
    
    try:
        response = requests.post(url, files=files)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Upload successful!")
            print(f"File URL: {data['url']}")
            print(f"File size: {data['size']} bytes")
        else:
            print(f"\n❌ Upload failed")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing file upload endpoint...")
    test_upload()
