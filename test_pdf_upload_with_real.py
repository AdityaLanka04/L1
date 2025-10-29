import requests

url = "http://localhost:8001/qb/upload_pdf?user_id=stupendous0512@gmail.com"
headers = {"Authorization": "Bearer test"}
pdf_path = "d:\\Brainwave\\L1\\real_test.pdf"

print(f"Testing PDF upload...")
print(f"URL: {url}")
print(f"PDF: {pdf_path}")

with open(pdf_path, 'rb') as pdf_file:
    files = {'file': pdf_file}
    try:
        response = requests.post(url, files=files, headers=headers, timeout=60)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ SUCCESS!")
            print(f"  Document ID: {data.get('document_id')}")
            print(f"  Filename: {data.get('filename')}")
            print(f"  Document Type: {data.get('analysis', {}).get('document_type')}")
            print(f"\nAnalysis:")
            import json
            print(json.dumps(data.get('analysis', {}), indent=2))
        else:
            print(f"✗ FAILED")
            print(f"  Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()