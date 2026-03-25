"""
downloader.py — HTTP download + URL resolution for each source type.

Handles:
  openstax   — scrapes openstax.org book page for PDF download link
  gcse_aqa   — scrapes AQA specification page for PDF link
  direct     — downloads from a direct URL

All functions return (pdf_bytes: bytes, resolved_url: str).
Raises DownloadError on failure.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; BrainwaveIngest/1.0; +educational-use)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
}
_DEFAULT_TIMEOUT = 120
_MAX_PDF_BYTES = 80 * 1024 * 1024      # 80 MB for user uploads
_PIPELINE_MAX_PDF_BYTES = 500 * 1024 * 1024  # 500 MB for admin ingestion


class DownloadError(Exception):
    pass


def _get_httpx():
    try:
        import httpx
        return httpx
    except ImportError as e:
        raise DownloadError("httpx not installed — run: pip install httpx") from e


def download_bytes(
    url: str,
    timeout: int = _DEFAULT_TIMEOUT,
    retries: int = 2,
    max_bytes: int = _PIPELINE_MAX_PDF_BYTES,
) -> bytes:
    """
    Download raw bytes from any URL. Retries up to `retries` times on transient errors.
    Raises DownloadError on failure.
    """
    httpx = _get_httpx()
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout, headers=_HEADERS) as client:
                resp = client.get(url)
                resp.raise_for_status()
                data = resp.content
                if len(data) > max_bytes:
                    raise DownloadError(
                        f"File too large: {len(data) / 1024 / 1024:.1f} MB "
                        f"(max {max_bytes // 1024 // 1024} MB) from {url}"
                    )
                return data
        except DownloadError:
            raise
        except Exception as e:
            last_error = e
            if attempt < retries:
                wait = 2 ** attempt
                logger.warning(f"Download attempt {attempt + 1} failed for {url}: {e} — retrying in {wait}s")
                time.sleep(wait)
    raise DownloadError(f"Download failed after {retries + 1} attempts for {url}: {last_error}")


def _find_pdf_link_in_html(html: str, base_url: str = "") -> Optional[str]:
    """
    Scan HTML for the most likely PDF download link.
    Priority: explicit .pdf href > links with 'download' in text > links with 'specification' in text.
    """
    patterns = [
        r'href=["\']([^"\']+\.pdf)["\']',
        r'href=["\']([^"\']+/download[^"\']*)["\']',
        r'href=["\']([^"\']+specification[^"\']*)["\']',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        for match in matches:
            url = match.strip()
            if url.startswith("//"):
                url = "https:" + url
            elif url.startswith("/"):
                if base_url:
                    from urllib.parse import urlparse
                    parsed = urlparse(base_url)
                    url = f"{parsed.scheme}://{parsed.netloc}{url}"
            if url.startswith("http") and not any(
                skip in url.lower() for skip in ["javascript:", "mailto:", "#"]
            ):
                return url
    return None


def resolve_openstax(entry: dict) -> tuple[bytes, str]:
    """
    Resolve + download an OpenStax textbook PDF.

    Strategy:
    1. If entry has a direct_url, use that.
    2. Otherwise fetch the book page and scan for the PDF link.
    3. Look for hrefs matching cloudfront.net PDF or openstax.org PDF patterns.
    """
    if entry.get("direct_url"):
        url = entry["direct_url"]
        return download_bytes(url), url

    page_url = entry.get("page_url", "")
    if not page_url:
        raise DownloadError(f"No page_url or direct_url for entry: {entry.get('slug')}")

    logger.info(f"Fetching OpenStax book page: {page_url}")
    httpx = _get_httpx()
    try:
        with httpx.Client(follow_redirects=True, timeout=30, headers=_HEADERS) as client:
            resp = client.get(page_url)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise DownloadError(f"Failed to fetch OpenStax page {page_url}: {e}") from e

    pdf_url = _find_pdf_link_in_html(html, page_url)
    if not pdf_url:
        raise DownloadError(
            f"No PDF link found on OpenStax page {page_url}. "
            "Check the page manually and add direct_url to the catalog entry."
        )

    logger.info(f"Resolved OpenStax PDF: {pdf_url}")
    return download_bytes(pdf_url), pdf_url


def resolve_aqa(entry: dict) -> tuple[bytes, str]:
    """
    Resolve + download an AQA specification PDF.

    Strategy:
    1. If entry has a direct_url, use that.
    2. Otherwise fetch the AQA specification page and find the spec PDF link.
       AQA spec pages have download links with '.pdf' in the href.
    """
    if entry.get("direct_url"):
        url = entry["direct_url"]
        return download_bytes(url), url

    page_url = entry.get("page_url", "")
    if not page_url:
        raise DownloadError(f"No page_url or direct_url for entry: {entry.get('slug')}")

    logger.info(f"Fetching AQA spec page: {page_url}")
    httpx = _get_httpx()
    try:
        with httpx.Client(follow_redirects=True, timeout=30, headers=_HEADERS) as client:
            resp = client.get(page_url)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise DownloadError(f"Failed to fetch AQA page {page_url}: {e}") from e

    pdf_url = _find_pdf_link_in_html(html, page_url)
    if not pdf_url:
        raise DownloadError(
            f"No PDF link found on AQA page {page_url}. "
            "Check the page manually and add direct_url to the catalog entry."
        )

    logger.info(f"Resolved AQA spec PDF: {pdf_url}")
    return download_bytes(pdf_url), pdf_url


def resolve_entry(entry: dict) -> tuple[bytes, str]:
    """
    Main entry point: route to the correct resolver based on source_type.
    Returns (pdf_bytes, resolved_url).
    Raises DownloadError on any failure.
    """
    source_type = entry.get("source_type", "direct")

    if source_type == "openstax":
        return resolve_openstax(entry)
    elif source_type in ("gcse_aqa", "gcse_edexcel"):
        return resolve_aqa(entry)
    elif source_type == "direct":
        url = entry.get("direct_url") or entry.get("page_url", "")
        if not url:
            raise DownloadError(f"No URL for direct entry: {entry.get('slug')}")
        return download_bytes(url), url
    else:
        raise DownloadError(f"Unknown source_type: {source_type}")
