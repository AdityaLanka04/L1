"""
document_processor.py — document ingestion + chunking for Cerbyl HS Mode.

Supported file types: .pdf, .txt, .md
Max file size: enforced by the calling route (50 MB)

Chunking strategy:
  - Chunk size: ~700 characters
  - Overlap:    80 characters (sliding window, step = 620)
  - Minimum chunk length: 80 characters
  - Optional TOC-aware chunking uses detected headings to split sections

PDF extraction strategy:
  1. pymupdf4llm (layout-aware, best quality for RAG)
  2. PyMuPDF blocks/text fallback
  3. pdfplumber fallback
  4. PyPDF2 final fallback

All parsers are attempted, scored, and the best candidate is selected.
"""

from __future__ import annotations

import io
import importlib.util
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

CHUNK_SIZE = 700
CHUNK_OVERLAP = 80
MIN_CHUNK_LEN = 80
MAX_HEADING_LEN = 90

@dataclass
class PDFExtractionCandidate:
    parser: str
    text: str
    page_count: int
    non_empty_pages: int
    warnings: list[str]


def _clean_pdf_page_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_repeating_page_artifacts(page_texts: list[str]) -> list[str]:
    """
    Remove common header/footer lines repeated on most pages.
    This reduces navigation noise before chunking.
    """
    if len(page_texts) < 4:
        return page_texts

    threshold = max(3, int(len(page_texts) * 0.6))
    candidates: dict[str, int] = {}
    first_lines: list[str] = []
    last_lines: list[str] = []

    for page in page_texts:
        lines = [ln.strip() for ln in page.splitlines() if ln.strip()]
        if not lines:
            continue
        first_lines.append(lines[0])
        last_lines.append(lines[-1])

    def _count_lines(lines: list[str]):
        for line in lines:
            normalized = re.sub(r"\s+", " ", line).strip()
            if len(normalized) > 140:
                continue
            candidates[normalized] = candidates.get(normalized, 0) + 1

    _count_lines(first_lines)
    _count_lines(last_lines)
    to_remove = {line for line, count in candidates.items() if count >= threshold}
    if not to_remove:
        return page_texts

    cleaned_pages = []
    for page in page_texts:
        kept = []
        for line in page.splitlines():
            normalized = re.sub(r"\s+", " ", line).strip()
            if normalized and normalized in to_remove:
                continue
            kept.append(line)
        cleaned_pages.append("\n".join(kept).strip())
    return cleaned_pages


def _score_pdf_candidate(candidate: PDFExtractionCandidate) -> float:
    text = candidate.text or ""
    if not text.strip():
        return -1.0
    char_count = len(text)
    alpha_ratio = sum(ch.isalpha() for ch in text) / max(1, char_count)
    tokens = re.findall(r"[A-Za-z0-9]{2,}", text.lower())
    unique_ratio = (len(set(tokens)) / len(tokens)) if tokens else 0.0
    coverage = candidate.non_empty_pages / max(1, candidate.page_count)

    return (
        min(char_count, 400_000) * 0.55
        + alpha_ratio * 4_000
        + unique_ratio * 1_500
        + coverage * 8_000
    )


def _extract_with_pymupdf4llm(file_bytes: bytes) -> PDFExtractionCandidate | None:
    try:
        import fitz
        import pymupdf4llm
    except Exception:
        return None

    doc = None
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_texts = [_clean_pdf_page_text(page.get_text("text", sort=True) or "") for page in doc]
        cleaned_pages = _strip_repeating_page_artifacts(page_texts)

        llm_text = _clean_pdf_page_text(pymupdf4llm.to_text(doc) or "")
        fallback_text = _clean_pdf_page_text("\n\n".join(cleaned_pages))
        final_text = llm_text if len(llm_text) >= len(fallback_text) * 0.7 else fallback_text

        return PDFExtractionCandidate(
            parser="pymupdf4llm",
            text=final_text,
            page_count=doc.page_count,
            non_empty_pages=sum(1 for p in cleaned_pages if p),
            warnings=[],
        )
    except Exception as e:
        logger.warning(f"pymupdf4llm extraction failed: {e}")
        return None
    finally:
        if doc is not None:
            doc.close()


def _extract_with_pymupdf(file_bytes: bytes) -> PDFExtractionCandidate | None:
    try:
        import fitz
    except Exception:
        return None

    doc = None
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_texts: list[str] = []
        for page in doc:
            blocks = page.get_text("blocks", sort=True)
            block_lines = []
            for block in blocks:
                if len(block) > 4 and str(block[4]).strip():
                    block_lines.append(str(block[4]).strip())
            page_text = "\n".join(block_lines) if block_lines else (page.get_text("text", sort=True) or "")
            page_texts.append(_clean_pdf_page_text(page_text))

        cleaned_pages = _strip_repeating_page_artifacts(page_texts)
        return PDFExtractionCandidate(
            parser="pymupdf",
            text=_clean_pdf_page_text("\n\n".join(cleaned_pages)),
            page_count=doc.page_count,
            non_empty_pages=sum(1 for p in cleaned_pages if p),
            warnings=[],
        )
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")
        return None
    finally:
        if doc is not None:
            doc.close()


def _extract_with_pdfplumber(file_bytes: bytes) -> PDFExtractionCandidate | None:
    try:
        import pdfplumber
    except Exception:
        return None

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            page_texts: list[str] = []
            for page in pdf.pages:
                page_text = page.extract_text(
                    x_tolerance=2,
                    y_tolerance=3,
                    layout=False,
                ) or ""
                page_texts.append(_clean_pdf_page_text(page_text))

            cleaned_pages = _strip_repeating_page_artifacts(page_texts)
            return PDFExtractionCandidate(
                parser="pdfplumber",
                text=_clean_pdf_page_text("\n\n".join(cleaned_pages)),
                page_count=len(pdf.pages),
                non_empty_pages=sum(1 for p in cleaned_pages if p),
                warnings=[],
            )
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {e}")
        return None


def _extract_with_pypdf2(file_bytes: bytes) -> PDFExtractionCandidate | None:
    try:
        import PyPDF2
    except Exception:
        return None

    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        page_texts = [_clean_pdf_page_text((page.extract_text() or "")) for page in reader.pages]
        cleaned_pages = _strip_repeating_page_artifacts(page_texts)
        return PDFExtractionCandidate(
            parser="pypdf2",
            text=_clean_pdf_page_text("\n\n".join(cleaned_pages)),
            page_count=len(reader.pages),
            non_empty_pages=sum(1 for p in cleaned_pages if p),
            warnings=[],
        )
    except Exception as e:
        logger.warning(f"PyPDF2 extraction failed: {e}")
        return None


def extract_text_from_pdf_detailed(file_bytes: bytes) -> dict:
    """
    Extract text from PDF using multiple parsers and pick the best result.
    Never raises. Returns text + parser metadata.
    """
    candidates: list[PDFExtractionCandidate] = []
    warnings: list[str] = []

    for extractor in (
        _extract_with_pymupdf4llm,
        _extract_with_pymupdf,
        _extract_with_pdfplumber,
        _extract_with_pypdf2,
    ):
        candidate = extractor(file_bytes)
        if candidate is not None:
            candidates.append(candidate)

    if not candidates:
        missing = []
        if importlib.util.find_spec("fitz") is None:
            missing.append("PyMuPDF")
        if importlib.util.find_spec("pymupdf4llm") is None:
            missing.append("pymupdf4llm")
        if importlib.util.find_spec("pdfplumber") is None:
            missing.append("pdfplumber")
        if importlib.util.find_spec("PyPDF2") is None:
            missing.append("PyPDF2")
        if missing:
            warnings.append("Missing PDF parser dependencies: " + ", ".join(sorted(set(missing))))
        warnings.append("No PDF parser succeeded")
        return {
            "text": "",
            "parser": "",
            "page_count": 0,
            "non_empty_pages": 0,
            "warnings": warnings,
        }

    scored = sorted(
        ((candidate, _score_pdf_candidate(candidate)) for candidate in candidates),
        key=lambda item: item[1],
        reverse=True,
    )
    best, best_score = scored[0]
    logger.info(
        "PDF extraction selected parser=%s pages=%s non_empty_pages=%s score=%.2f",
        best.parser,
        best.page_count,
        best.non_empty_pages,
        best_score,
    )
    for candidate, score in scored[1:]:
        logger.debug("PDF extraction candidate parser=%s score=%.2f", candidate.parser, score)

    for c in candidates:
        warnings.extend(c.warnings)

    return {
        "text": best.text,
        "parser": best.parser,
        "page_count": best.page_count,
        "non_empty_pages": best.non_empty_pages,
        "warnings": sorted(set(warnings)),
    }


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Backward-compatible convenience wrapper.
    """
    return extract_text_from_pdf_detailed(file_bytes).get("text", "")

def extract_text_from_txt(file_bytes: bytes) -> str:
    """
    Decode plain text from uploaded .txt or .md files.
    Tries UTF-8 first, then latin-1 as fallback.
    """
    try:
        return file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace").strip()

_BULLET_RE = re.compile("^\\s*(?:[-*]|\\u2022|\\d+[\\.\\)])\\s+")
_HEADING_RE = re.compile(
    r"^(chapter|unit|module|lesson|section|part)\s+([0-9ivxlcdm]+)([:\-\.\s].*)?$",
    re.IGNORECASE,
)
_ALLCAPS_RE = re.compile(r"^[A-Z0-9][A-Z0-9\s\-:]{6,}$")

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

    cleaned = [re.sub(r"\s+", " ", p).strip() for p in paragraphs if p.strip()]
    return "\n\n".join(cleaned)

def _is_heading(line: str) -> bool:
    if not line:
        return False
    if len(line) > MAX_HEADING_LEN:
        return False
    compact = re.sub(r"\s+", " ", line.strip())
    if len(compact) < 4:
        return False
    if _HEADING_RE.match(compact):
        return True
    if _ALLCAPS_RE.match(compact) and len(compact.split()) <= 8:
        return True
    return False

def extract_chapter_headings(text: str, limit: int = 16) -> list[str]:
    """
    Extract likely chapter/section headings for preview and TOC-aware chunking.
    """
    if not text:
        return []
    headings: list[str] = []
    seen = set()
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate:
            continue
        if _is_heading(candidate):
            normalized = re.sub(r"\s+", " ", candidate)
            if normalized not in seen:
                headings.append(normalized)
                seen.add(normalized)
        if len(headings) >= limit:
            break
    return headings

_GRADE_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("AP", re.compile(r"\bAP\b|\bAdvanced Placement\b", re.IGNORECASE)),
    ("Honors", re.compile(r"\bHonors?\b", re.IGNORECASE)),
    ("Grade 12", re.compile(r"\b(12th|grade\s*12|grade\s*twelve|senior)\b", re.IGNORECASE)),
    ("Grade 11", re.compile(r"\b(11th|grade\s*11|grade\s*eleven|junior)\b", re.IGNORECASE)),
    ("Grade 10", re.compile(r"\b(10th|grade\s*10|grade\s*ten|sophomore)\b", re.IGNORECASE)),
    ("Grade 9", re.compile(r"\b(9th|grade\s*9|grade\s*nine|freshman)\b", re.IGNORECASE)),
]

def infer_grade_level(text: str) -> str:
    if not text:
        return ""
    for label, pattern in _GRADE_PATTERNS:
        if pattern.search(text):
            return label
    return ""

def _tail_overlap(text: str, overlap: int) -> str:
    if overlap <= 0 or not text:
        return ""
    if len(text) <= overlap:
        return text.strip()
    snippet = text[-overlap:]
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

def _chunk_normalized_text(
    normalized: str,
    chunk_size: int,
    overlap: int,
    min_length: int,
) -> list[str]:
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

def _split_sections(text: str) -> list[tuple[str, str]]:
    if not text:
        return []
    sections: list[tuple[str, str]] = []
    current_heading = "Intro"
    buffer: list[str] = []

    def _flush():
        if buffer:
            sections.append((current_heading, "\n".join(buffer).strip()))
            buffer.clear()

    for line in text.splitlines():
        if _is_heading(line):
            _flush()
            current_heading = re.sub(r"\s+", " ", line.strip())
        else:
            buffer.append(line)

    _flush()
    return sections

def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_length: int = MIN_CHUNK_LEN,
    toc_aware: bool = False,
) -> list[str]:
    """
    Paragraph-aware chunker with optional TOC-aware sectioning.

    Algorithm:
      - Normalize text into paragraphs
      - Build chunks by aggregating paragraphs until chunk_size
      - Add small overlap between chunks for continuity
      - Split any single paragraph that exceeds chunk_size via sliding window
      - Discard chunks shorter than min_length

    Example for defaults (chunk_size=700, overlap=80, step=620):
      chunk 0: text[0:700]
      chunk 1: text[620:1320]
      chunk 2: text[1240:1940]
      ...
    """
    if not text or len(text) < min_length:
        return []

    normalized = _normalize_text(text)
    if not normalized or len(normalized) < min_length:
        return []

    if not toc_aware:
        return _chunk_normalized_text(normalized, chunk_size, overlap, min_length)

    sections = _split_sections(text)
    if len(sections) <= 1:
        return _chunk_normalized_text(normalized, chunk_size, overlap, min_length)

    chunks: list[str] = []
    for heading, section_text in sections:
        if not section_text:
            continue
        normalized_section = _normalize_text(section_text)
        if not normalized_section:
            continue

        prefix = "" if heading.lower() == "intro" else heading
        effective_size = chunk_size
        if prefix:
            effective_size = max(min_length, chunk_size - len(prefix) - 2)

        section_chunks = _chunk_normalized_text(
            normalized_section,
            effective_size,
            overlap,
            min_length,
        )
        if prefix:
            section_chunks = [f"{prefix}\n\n{chunk}" for chunk in section_chunks]
        chunks.extend(section_chunks)

    return chunks

def process_upload(
    file_bytes: bytes,
    filename: str,
    subject: str = "",
    grade_level: str = "",
    scope: str = "private",
    source_url: str = "",
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    toc_aware: bool = True,
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
    detected_subject = ""
    detected_grade = ""
    chapters: list[str] = []
    pdf_parser = ""
    pdf_page_count = 0
    pdf_non_empty_pages = 0
    extraction_warnings: list[str] = []

    try:
        if lower_name.endswith(".pdf"):
            extracted = extract_text_from_pdf_detailed(file_bytes)
            text = extracted.get("text", "")
            pdf_parser = extracted.get("parser", "")
            pdf_page_count = extracted.get("page_count", 0) or 0
            pdf_non_empty_pages = extracted.get("non_empty_pages", 0) or 0
            extraction_warnings = extracted.get("warnings", []) or []
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
        if lower_name.endswith(".pdf") and any(
            w.lower().startswith("missing pdf parser dependencies")
            for w in extraction_warnings
        ):
            error = "PDF parsing dependencies are missing on the server."
        elif lower_name.endswith(".pdf") and pdf_page_count > 0:
            error = (
                "No extractable text found in this PDF. "
                "It appears to be image-only or scanned content without OCR text."
            )
        else:
            error = "No text could be extracted from this file."

    if text:
        chapters = extract_chapter_headings(text)
        if not subject:
            try:
                import context_store
                detected_subject = context_store.infer_subject(f"{filename} {text[:4000]}", default="")
                subject = detected_subject or subject
            except Exception:
                detected_subject = ""
        if not grade_level:
            detected_grade = infer_grade_level(f"{filename}\n{text[:4000]}")
            grade_level = detected_grade or grade_level

    chunks = chunk_text(
        text,
        chunk_size=chunk_size,
        overlap=chunk_overlap,
        min_length=MIN_CHUNK_LEN,
        toc_aware=toc_aware,
    ) if text else []

    return {
        "chunks":      chunks,
        "chunk_count": len(chunks),
        "char_count":  len(text),
        "filename":    filename,
        "subject":     subject,
        "grade_level": grade_level,
        "scope":       scope,
        "error":       error,
        "detected_subject": detected_subject,
        "detected_grade": detected_grade,
        "chapters":    chapters,
        "chunk_size":  chunk_size,
        "chunk_overlap": chunk_overlap,
        "toc_aware":   toc_aware,
        "pdf_parser": pdf_parser,
        "pdf_page_count": pdf_page_count,
        "pdf_non_empty_pages": pdf_non_empty_pages,
        "extraction_warnings": extraction_warnings,
    }
