#!/usr/bin/env python3
"""
Create a real PDF file for testing
"""

import os
import sys

# Try with reportlab first (most reliable)
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    pdf_path = "d:\\Brainwave\\L1\\real_test.pdf"
    
    # Create PDF
    doc = SimpleDocTemplate(pdf_path, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Add title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=12,
    )
    
    elements.append(Paragraph("Question Bank - Sample Document", title_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Add content
    content_style = ParagraphStyle(
        'Content',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=10,
    )
    
    questions = [
        ("Question 1: What is the capital of France?", "Answer: Paris"),
        ("Question 2: Solve 5 + 3 =", "Answer: 8"),
        ("Question 3: What is 2 * 4?", "Answer: 8"),
        ("Question 4: What is Python?", "Answer: Python is a programming language"),
        ("Question 5: Explain machine learning", "Answer: Machine learning is a subset of artificial intelligence"),
    ]
    
    for q, a in questions:
        elements.append(Paragraph(q, content_style))
        elements.append(Paragraph(a, content_style))
        elements.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(elements)
    print(f"✓ Created real PDF: {pdf_path}")
    sys.exit(0)
    
except ImportError as e:
    print(f"reportlab not available: {e}")
    print("Trying pypdf...")

# Fallback: try with pypdf
try:
    from pypdf import PdfWriter
    from reportlab.pdfgen import canvas
    from io import BytesIO
    
    pdf_path = "d:\\Brainwave\\L1\\real_test.pdf"
    
    # Create PDF using reportlab canvas
    from reportlab.lib.pagesizes import letter
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.setFont("Helvetica-Bold", 16)
    can.drawString(50, 750, "Question Bank Sample")
    
    can.setFont("Helvetica", 11)
    y = 700
    questions = [
        ("Question 1: What is the capital of France?", "Answer: Paris"),
        ("Question 2: Solve 5 + 3 =", "Answer: 8"),
        ("Question 3: What is 2 * 4?", "Answer: 8"),
        ("Question 4: What is Python?", "Answer: Python is a programming language"),
    ]
    
    for q, a in questions:
        can.drawString(50, y, q)
        y -= 15
        can.drawString(70, y, a)
        y -= 25
    
    can.save()
    
    # Save to file
    packet.seek(0)
    with open(pdf_path, 'wb') as f:
        f.write(packet.getvalue())
    
    print(f"✓ Created PDF with reportlab canvas: {pdf_path}")
    sys.exit(0)
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)