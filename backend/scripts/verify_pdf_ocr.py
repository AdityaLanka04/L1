"""Image-build smoke test for the actual scanned-PDF extraction path."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    import fitz
    from services.document_processor import extract_text_from_pdf_detailed

    expected = "Data science combines statistics and computing to learn from data."
    with fitz.open() as original:
        page = original.new_page()
        page.insert_text((60, 100), expected, fontsize=14)
        image = page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
        text_pdf = original.tobytes()
    with fitz.open() as scanned:
        page = scanned.new_page()
        page.insert_image(page.rect, stream=image)
        assert not page.get_text().strip(), "Fixture must have no embedded text"
        scanned_pdf = scanned.tobytes()

    for name, content in [("text", text_pdf), ("scanned", scanned_pdf)]:
        result = extract_text_from_pdf_detailed(content)
        normalized = " ".join(result["text"].lower().split())
        assert "data science combines statistics" in normalized, (name, result)
        assert "learn from data" in normalized, (name, result)
        if name == "scanned":
            assert result["parser"] == "ocr-tesseract", result
        print(f"PASS {name} PDF: {result['parser']}")


if __name__ == "__main__":
    main()
