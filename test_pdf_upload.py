import requests
import os

# Create a simple test PDF file
test_pdf_path = "d:\\Brainwave\\L1\\test.pdf"

# Create a minimal PDF
pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Question: What is 2+2?) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000280 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
342
%%EOF"""

with open(test_pdf_path, 'wb') as f:
    f.write(pdf_content)

print(f"Created test PDF: {test_pdf_path}")

# Test the upload endpoint
url = "http://localhost:8001/qb/upload_pdf?user_id=stupendous0512@gmail.com"
headers = {"Authorization": "Bearer test"}

with open(test_pdf_path, 'rb') as pdf_file:
    files = {'file': pdf_file}
    try:
        response = requests.post(url, files=files, headers=headers, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

# Clean up
os.remove(test_pdf_path)