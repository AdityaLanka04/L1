import requests
import os
import sys

# Make sure to use the correct database path
os.environ['DATABASE_URL'] = 'sqlite:////d:/Brainwave/L1/backend/brainwave_tutor.db'
sys.path.insert(0, 'd:\\Brainwave\\L1\\backend')

# Create a sample PDF with reportlab if available, otherwise use a simple valid PDF
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    
    test_pdf_path = "d:\\Brainwave\\L1\\test_report.pdf"
    c = canvas.Canvas(test_pdf_path, pagesize=letter)
    c.setFont("Helvetica", 12)
    c.drawString(100, 750, "Sample Question Bank Document")
    c.drawString(100, 730, "")
    c.drawString(100, 710, "Topic: Mathematics")
    c.drawString(100, 690, "")
    c.drawString(100, 670, "Question 1: What is the capital of France?")
    c.drawString(100, 650, "Answer: Paris")
    c.drawString(100, 630, "")
    c.drawString(100, 610, "Question 2: Solve: 2 + 2 = ?")
    c.drawString(100, 590, "Answer: 4")
    c.save()
    print(f"Created PDF with reportlab: {test_pdf_path}")
    pdf_path = test_pdf_path
except ImportError:
    print("reportlab not available, using PyPDF2 to create a valid PDF")
    pdf_path = None

if pdf_path is None:
    # Create a minimal but valid PDF
    test_pdf_path = "d:\\Brainwave\\L1\\test_simple.pdf"
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Sample Question Content) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000203 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
295
%%EOF"""
    
    with open(test_pdf_path, 'wb') as f:
        f.write(pdf_content)
    print(f"Created simple valid PDF: {test_pdf_path}")
    pdf_path = test_pdf_path

# Test the upload endpoint
url = "http://localhost:8001/qb/upload_pdf?user_id=stupendous0512@gmail.com"
headers = {"Authorization": "Bearer test"}

print(f"\nTesting upload to: {url}")
with open(pdf_path, 'rb') as pdf_file:
    files = {'file': pdf_file}
    try:
        response = requests.post(url, files=files, headers=headers, timeout=60)
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{response.text}")
        
        if response.status_code == 200:
            print("\n✓ PDF uploaded successfully!")
        else:
            print("\n✗ Upload failed")
    except Exception as e:
        print(f"Error: {e}")

# Clean up
try:
    os.remove(pdf_path)
    print(f"\nCleaned up test file: {pdf_path}")
except:
    pass