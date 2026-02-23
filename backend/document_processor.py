"""
document_processor.py — PDF/text ingestion and chunking for Cerbyl HS Mode.

Supported file types: .pdf, .txt, .md
Max file size: enforced by the calling route (10 MB)

Chunking strategy:
  - Chunk size: ~500 characters
  - Overlap:    50 characters (sliding window, step = 450)
  - Minimum chunk length: 80 characters (discard short trailing fragments)

PDF extraction priority:
  1. PyPDF2 (try first)
  2. pdfplumber (fallback if PyPDF2 returns empty text)

Both PyPDF2 and pdfplumber are common in Python ML environments.
Install if missing: pip install PyPDF2 pdfplumber
"""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
MIN_CHUNK_LEN = 80


# ── Text extraction ───────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all text from a PDF file.

    Tries PyPDF2 first (faster), falls back to pdfplumber if the result is empty.
    Never raises — returns "" on total failure.
    """
    text = ""

    # Attempt 1: PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            pages.append(page_text)
        text = "\n\n".join(pages).strip()
    except Exception as e:
        logger.warning(f"PyPDF2 extraction failed: {e}")

    # Attempt 2: pdfplumber fallback
    if not text:
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages = []
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    pages.append(page_text)
                text = "\n\n".join(pages).strip()
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed: {e}")

    return text


def extract_text_from_txt(file_bytes: bytes) -> str:
    """
    Decode plain text from uploaded .txt or .md files.
    Tries UTF-8 first, then latin-1 as fallback.
    """
    try:
        return file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace").strip()


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_length: int = MIN_CHUNK_LEN,
) -> list[str]:
    """
    Sliding-window character chunker.

    Algorithm:
      - Start at position 0
      - Extract text[start : start + chunk_size]
      - Advance by (chunk_size - overlap)  →  step = 450 with defaults
      - Repeat until end of text
      - Discard chunks shorter than min_length

    Example for defaults (chunk_size=500, overlap=50, step=450):
      chunk 0: text[0:500]
      chunk 1: text[450:950]
      chunk 2: text[900:1400]
      ...
    """
    if not text or len(text) < min_length:
        return []

    step = chunk_size - overlap
    chunks: list[str] = []
    start = 0

    while start < len(text):
        chunk = text[start : start + chunk_size].strip()
        if len(chunk) >= min_length:
            chunks.append(chunk)
        start += step

    return chunks


# ── Main pipeline ─────────────────────────────────────────────────────────────

def process_upload(
    file_bytes: bytes,
    filename: str,
    subject: str = "",
    grade_level: str = "",
    scope: str = "private",
    source_url: str = "",
) -> dict:
    """
    Full pipeline: extract text → chunk → return structured result.

    Args:
        file_bytes:  raw uploaded file bytes
        filename:    original filename (used to determine type)
        subject:     e.g. "Biology", "Algebra II"
        grade_level: e.g. "Grade 10", "AP"
        scope:       "private" or "hs_shared"
        source_url:  optional URL (for admin-seeded curriculum entries)

    Returns:
        {
            "chunks":      list[str],
            "chunk_count": int,
            "char_count":  int,
            "filename":    str,
            "subject":     str,
            "grade_level": str,
            "scope":       str,
            "error":       str | None,
        }

    Never raises — sets "error" key on failure.
    """
    lower_name = (filename or "").lower()
    text = ""
    error = None

    try:
        if lower_name.endswith(".pdf"):
            text = extract_text_from_pdf(file_bytes)
        elif lower_name.endswith((".txt", ".md")):
            text = extract_text_from_txt(file_bytes)
        else:
            error = (
                f"Unsupported file type: '{filename}'. "
                "Please upload a .pdf, .txt, or .md file."
            )
    except Exception as e:
        error = f"Text extraction failed: {e}"
        logger.error(error)

    if not text and not error:
        error = "No text could be extracted from this file. It may be a scanned image PDF."

    chunks = chunk_text(text) if text else []

    return {
        "chunks":      chunks,
        "chunk_count": len(chunks),
        "char_count":  len(text),
        "filename":    filename,
        "subject":     subject,
        "grade_level": grade_level,
        "scope":       scope,
        "error":       error,
    }
