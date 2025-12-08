"""
PDF Processing Module
Extracts text from PDF files with structure preservation
"""
import PyPDF2
import fitz  # PyMuPDF
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class PDFProcessor:
    """Process PDF files and extract text content"""
    
    def extract_text(self, pdf_file):
        """
        Extract all text from PDF file
        
        Args:
            pdf_file: UploadFile object or file-like object
            
        Returns:
            str: Extracted text content
        """
        try:
            # Try PyMuPDF first (better for complex PDFs)
            return self._extract_with_pymupdf(pdf_file)
        except Exception as e:
            logger.warning(f"PyMuPDF extraction failed: {e}, trying PyPDF2")
            try:
                return self._extract_with_pypdf2(pdf_file)
            except Exception as e2:
                logger.error(f"PDF extraction failed: {e2}")
                raise ValueError(f"Could not extract text from PDF: {e2}")
    
    def _extract_with_pymupdf(self, pdf_file):
        """Extract text using PyMuPDF (better quality)"""
        pdf_file.file.seek(0)
        doc = fitz.open(stream=pdf_file.file.read(), filetype="pdf")
        
        text = ""
        for page_num, page in enumerate(doc, 1):
            page_text = page.get_text()
            if page_text.strip():
                text += f"\n\n--- Page {page_num} ---\n\n"
                text += page_text
        
        doc.close()
        return text.strip()
    
    def _extract_with_pypdf2(self, pdf_file):
        """Extract text using PyPDF2 (fallback)"""
        pdf_file.file.seek(0)
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.file.read()))
        
        text = ""
        for page_num, page in enumerate(pdf_reader.pages, 1):
            page_text = page.extract_text()
            if page_text.strip():
                text += f"\n\n--- Page {page_num} ---\n\n"
                text += page_text
        
        return text.strip()
    
    def extract_with_metadata(self, pdf_file):
        """
        Extract text with metadata
        
        Returns:
            dict: {
                'text': str,
                'page_count': int,
                'word_count': int,
                'metadata': dict
            }
        """
        pdf_file.file.seek(0)
        doc = fitz.open(stream=pdf_file.file.read(), filetype="pdf")
        
        # Extract text
        text = ""
        for page in doc:
            text += page.get_text() + "\n\n"
        
        # Get metadata
        metadata = doc.metadata
        page_count = doc.page_count
        
        doc.close()
        
        return {
            'text': text.strip(),
            'page_count': page_count,
            'word_count': len(text.split()),
            'metadata': {
                'title': metadata.get('title', ''),
                'author': metadata.get('author', ''),
                'subject': metadata.get('subject', ''),
                'creator': metadata.get('creator', '')
            }
        }
    
    def get_page_count(self, pdf_file):
        """Get number of pages in PDF"""
        pdf_file.file.seek(0)
        try:
            doc = fitz.open(stream=pdf_file.file.read(), filetype="pdf")
            count = doc.page_count
            doc.close()
            return count
        except:
            pdf_file.file.seek(0)
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.file.read()))
            return len(pdf_reader.pages)
