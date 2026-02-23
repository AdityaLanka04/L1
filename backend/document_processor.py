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
import re

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

_BULLET_RE = re.compile("^\\s*(?:[-*]|\\u2022|\\d+[\\.\\)])\\s+")


def _normalize_text(text: str) -> str:
    """
    Normalize extracted text for more coherent chunking.

    - Fix hyphenated line breaks
    - Merge wrapped lines into paragraphs
    - Preserve bullet-like lines as standalone paragraphs
    - Collapse excessive whitespace
    """
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    # Join hyphenated line breaks: "exam-\nple" -> "example"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    lines = [ln.strip() for ln in text.split("\n")]
    paragraphs: list[str] = []
    current: list[str] = []

    def _flush_current():
        if current:
            paragraphs.append(" ".join(current).strip())
            current.clear()

    for line in lines:
        if not line:
            _flush_current()
            continue

        if _BULLET_RE.match(line):
            _flush_current()
            paragraphs.append(line.strip())
            continue

        current.append(line)

    _flush_current()

    # Collapse whitespace inside paragraphs
    cleaned = [re.sub(r"\s+", " ", p).strip() for p in paragraphs if p.strip()]
    return "\n\n".join(cleaned)


def _tail_overlap(text: str, overlap: int) -> str:
    if overlap <= 0 or not text:
        return ""
    if len(text) <= overlap:
        return text.strip()
    snippet = text[-overlap:]
    # Drop partial word at the start of the snippet
    idx = snippet.find(" ")
    if idx != -1 and idx + 1 < len(snippet):
        snippet = snippet[idx + 1 :]
    return snippet.strip()


def _sliding_window_chunks(
    text: str,
    chunk_size: int,
    overlap: int,
    min_length: int,
) -> list[str]:
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


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_length: int = MIN_CHUNK_LEN,
) -> list[str]:
    """
    Paragraph-aware chunker with sliding-window fallback.

    Algorithm:
      - Normalize text into paragraphs
      - Build chunks by aggregating paragraphs until chunk_size
      - Add small overlap between chunks for continuity
      - Split any single paragraph that exceeds chunk_size via sliding window
      - Discard chunks shorter than min_length

    Example for defaults (chunk_size=500, overlap=50, step=450):
      chunk 0: text[0:500]
      chunk 1: text[450:950]
      chunk 2: text[900:1400]
      ...
    """
    if not text or len(text) < min_length:
        return []

    normalized = _normalize_text(text)
    if not normalized or len(normalized) < min_length:
        return []

    paragraphs = [p for p in normalized.split("\n\n") if p.strip()]
    if len(paragraphs) <= 1:
        return _sliding_window_chunks(normalized, chunk_size, overlap, min_length)

    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # If a paragraph is too long, split it directly
        if len(para) > chunk_size:
            if len(current) >= min_length:
                chunks.append(current.strip())
            current = ""
            chunks.extend(_sliding_window_chunks(para, chunk_size, overlap, min_length))
            continue

        if not current:
            current = para
            continue

        if len(current) + 2 + len(para) <= chunk_size:
            current = f"{current}\n\n{para}"
        else:
            if len(current) >= min_length:
                chunks.append(current.strip())
                overlap_text = _tail_overlap(current, overlap)
                if overlap_text and len(overlap_text) + 2 + len(para) <= chunk_size:
                    current = f"{overlap_text}\n\n{para}"
                else:
                    current = para
            else:
                current = para

    if current and len(current) >= min_length:
        chunks.append(current.strip())

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
