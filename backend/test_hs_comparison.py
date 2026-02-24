"""
test_hs_comparison.py — Compare AI output WITH and WITHOUT HS Mode (curriculum RAG).

Usage (server must be running on http://localhost:8000):
    python test_hs_comparison.py
    python test_hs_comparison.py --topic "mitosis" --user your@email.com
    python test_hs_comparison.py --mode notes     # test notes instead of quiz
    python test_hs_comparison.py --mode flashcards
    python test_hs_comparison.py --mode quiz      # default

The script runs the same request twice — once with use_hs_context=False (baseline)
and once with use_hs_context=True (HS Mode). It then prints both outputs side by side
so you can see exactly what the curriculum context added.
"""

import argparse
import json
import sys
import textwrap
import time
from typing import Any, Optional, Union

# Force UTF-8 on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests

BASE_URL = "http://localhost:8000"
DIVIDER = "=" * 80
HALF_DIV = "-" * 80


# ─── helpers ─────────────────────────────────────────────────────────────────

def _post(path: str, data: Optional[dict] = None, files: Optional[dict] = None) -> Union[dict, list]:
    url = f"{BASE_URL}{path}"
    try:
        if files:
            r = requests.post(url, data=data, files=files, timeout=90)
        else:
            r = requests.post(url, json=data, timeout=90)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        print(f"\n[ERROR] Cannot connect to {BASE_URL}. Is the backend running?")
        print("  Start it with:  uvicorn main:app --reload  (from backend/ folder)")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"\n[ERROR] HTTP {e.response.status_code}: {e.response.text[:300]}")
        sys.exit(1)


def _get(path: str, params: Optional[dict] = None) -> Union[dict, list]:
    url = f"{BASE_URL}{path}"
    try:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        print(f"\n[ERROR] Cannot connect to {BASE_URL}.")
        sys.exit(1)


def _wrap(text: str, width: int = 76, indent: int = 4) -> str:
    return textwrap.fill(text, width=width, initial_indent=" " * indent, subsequent_indent=" " * indent)


def _banner(label: str, prefix: str = ">>"):
    print(f"\n{DIVIDER}")
    print(f"  {prefix}  {label}")
    print(DIVIDER)


def _section(label: str):
    print(f"\n{HALF_DIV}")
    print(f"  {label}")
    print(HALF_DIV)


# ─── RAG search sanity check ──────────────────────────────────────────────────

def check_rag(topic: str, user_id: str, token: str):
    """Hit /api/context/search directly so we can see raw RAG results."""
    _section("RAG SEARCH CHECK — raw curriculum chunks for this topic")
    try:
        r = requests.get(
            f"{BASE_URL}/api/context/search",
            params={"query": topic, "use_hs": "true", "top_k": 5},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if r.status_code == 200:
            data = r.json()
            results = data.get("results", [])
            print(f"  Found {len(results)} chunk(s) relevant to '{topic}':\n")
            for i, res in enumerate(results):
                src = res.get("source", "?")
                meta = res.get("metadata", {})
                text = res.get("text", "")[:200].replace("\n", " ")
                print(f"  [{i}] source={src}  file={meta.get('filename','?')}  subject={meta.get('subject','?')}")
                print(f"       {text}...")
                print()
        else:
            print(f"  RAG search returned {r.status_code} — {r.text[:200]}")
    except Exception as e:
        print(f"  RAG search failed: {e}")


# ─── Login helper ──────────────────────────────────────────────────────────

def login(user: str, password: str) -> str:
    """Returns JWT token."""
    print(f"\n  Logging in as {user}...")
    r = requests.post(
        f"{BASE_URL}/token",
        data={"username": user, "password": password},
        timeout=15,
    )
    if r.status_code == 200:
        token = r.json().get("access_token", "")
        print(f"  Token obtained: {token[:20]}...")
        return token
    else:
        print(f"  Login failed ({r.status_code}): {r.text[:200]}")
        print("  Continuing without token — /api/context/search will be skipped")
        return ""


# ─── Quiz comparison ──────────────────────────────────────────────────────────

def compare_quiz(topic: str, user_id: str, token: str):
    _banner("QUIZ COMPARISON", "[QUIZ]")
    print(f"  Topic   : {topic}")
    print(f"  User    : {user_id}")
    print(f"  Endpoint: POST /generate_practice_questions")

    payload_base = {
        "user_id": user_id,
        "topic": topic,
        "question_count": 5,
        "difficulty": "medium",
        "question_types": ["multiple_choice"],
        "use_hs_context": False,
    }

    # ── WITHOUT HS ────────────────────────────────────────────────────────
    _section("WITHOUT HS Mode  (use_hs_context=False — model knowledge only)")
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_no_hs = _post("/generate_practice_questions", payload_base)
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")

    questions_no_hs = res_no_hs if isinstance(res_no_hs, list) else res_no_hs.get("questions", [])
    print(f"\n  Got {len(questions_no_hs)} question(s):\n")
    for i, q in enumerate(questions_no_hs, 1):
        qt = q.get("question_text", q.get("question", "?"))
        opts = q.get("options", [])
        print(f"  Q{i}: {qt}")
        for opt in opts[:4]:
            marker = "(*)" if opt.get("is_correct") else "   "
            print(f"      {marker} {opt.get('text', opt)}")
        print()

    # ── WITH HS ───────────────────────────────────────────────────────────
    _section("WITH HS Mode  (use_hs_context=True — curriculum RAG injected)")
    payload_hs = {**payload_base, "use_hs_context": True}
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_hs = _post("/generate_practice_questions", payload_hs)
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")

    questions_hs = res_hs if isinstance(res_hs, list) else res_hs.get("questions", [])
    print(f"\n  Got {len(questions_hs)} question(s):\n")
    for i, q in enumerate(questions_hs, 1):
        qt = q.get("question_text", q.get("question", "?"))
        opts = q.get("options", [])
        print(f"  Q{i}: {qt}")
        for opt in opts[:4]:
            marker = "(*)" if opt.get("is_correct") else "   "
            print(f"      {marker} {opt.get('text', opt)}")
        print()


# ─── Flashcard comparison ────────────────────────────────────────────────────

def compare_flashcards(topic: str, user_id: str, token: str):
    _banner("FLASHCARD COMPARISON", "[FLASH]")
    print(f"  Topic   : {topic}")
    print(f"  User    : {user_id}")
    print(f"  Endpoint: POST /generate_flashcards")

    def _make_form(use_hs: bool) -> dict:
        return {
            "user_id": user_id,
            "topic": topic,
            "generation_type": "topic",
            "card_count": "5",
            "difficulty": "medium",
            "depth_level": "standard",
            "use_hs_context": str(use_hs).lower(),
        }

    # ── WITHOUT HS ────────────────────────────────────────────────────────
    _section("WITHOUT HS Mode  (use_hs_context=false — model knowledge only)")
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_no_hs = requests.post(f"{BASE_URL}/generate_flashcards", data=_make_form(False), timeout=90)
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")
    cards_no_hs = res_no_hs.json() if res_no_hs.status_code == 200 else []
    if isinstance(cards_no_hs, dict):
        cards_no_hs = cards_no_hs.get("flashcards", cards_no_hs.get("cards", []))
    print(f"\n  Got {len(cards_no_hs)} card(s):\n")
    for i, c in enumerate(cards_no_hs, 1):
        q = c.get("question", c.get("front", "?"))
        a = c.get("answer", c.get("back", "?"))
        print(f"  [{i}] Q: {q}")
        print(f"       A: {a[:180]}")
        print()

    # ── WITH HS ───────────────────────────────────────────────────────────
    _section("WITH HS Mode  (use_hs_context=true — curriculum RAG injected)")
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_hs = requests.post(f"{BASE_URL}/generate_flashcards", data=_make_form(True), timeout=90)
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")
    cards_hs = res_hs.json() if res_hs.status_code == 200 else []
    if isinstance(cards_hs, dict):
        cards_hs = cards_hs.get("flashcards", cards_hs.get("cards", []))
    print(f"\n  Got {len(cards_hs)} card(s):\n")
    for i, c in enumerate(cards_hs, 1):
        q = c.get("question", c.get("front", "?"))
        a = c.get("answer", c.get("back", "?"))
        print(f"  [{i}] Q: {q}")
        print(f"       A: {a[:180]}")
        print()


# ─── Notes comparison ────────────────────────────────────────────────────────

def compare_notes(topic: str, user_id: str, token: str):
    _banner("NOTES COMPARISON", "[NOTE]")
    print(f"  Topic   : {topic}")
    print(f"  User    : {user_id}")
    print(f"  Endpoint: POST /api/agents/searchhub/create-note")

    def _make_payload(use_hs: bool) -> dict:
        return {
            "user_id": user_id,
            "topic": topic,
            "depth": "standard",
            "tone": "academic",
            "use_hs_context": use_hs,
        }

    # ── WITHOUT HS ────────────────────────────────────────────────────────
    _section("WITHOUT HS Mode  (use_hs_context=False — model knowledge only)")
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_no_hs = _post("/api/agents/searchhub/create-note", _make_payload(False))
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")
    content_no_hs = res_no_hs.get("content", res_no_hs.get("note", {}).get("content", ""))
    print(f"\n  Note preview (first 800 chars):\n")
    print(_wrap(content_no_hs[:800], width=76, indent=4))

    # ── WITH HS ───────────────────────────────────────────────────────────
    _section("WITH HS Mode  (use_hs_context=True — curriculum RAG injected)")
    payload_hs = _make_payload(True)
    print("  Sending request...", flush=True)
    t0 = time.time()
    res_hs = _post("/api/agents/searchhub/create-note", payload_hs)
    t1 = time.time()
    print(f"  Response time: {t1-t0:.1f}s")
    content_hs = res_hs.get("content", res_hs.get("note", {}).get("content", ""))
    print(f"\n  Note preview (first 800 chars):\n")
    print(_wrap(content_hs[:800], width=76, indent=4))


# ─── Direct RAG-only test (no auth needed) ───────────────────────────────────

def quick_rag_test(topic: str):
    """Test context_store directly without hitting the API — just embedding search."""
    _banner("DIRECT RAG TEST (no server needed)", "[RAG]")
    print(f"  Topic: '{topic}'")
    print(f"  Loading ChromaDB from backend/.chroma_data ...\n")

    try:
        import chromadb
        from pathlib import Path
        from sentence_transformers import SentenceTransformer

        chroma_path = str(Path(__file__).parent / ".chroma_data")
        client = chromadb.PersistentClient(path=chroma_path)
        model = SentenceTransformer("all-MiniLM-L6-v2")

        import context_store
        context_store.initialize(client, model)

        results = context_store.search_context(
            query=topic,
            user_id="test_user",
            use_hs=True,
            top_k=5,
        )

        if results:
            print(f"  FOUND {len(results)} chunk(s) — this content WILL be injected into the AI prompt:\n")
            for i, r in enumerate(results):
                meta = r["metadata"]
                text = r["text"][:300].replace("\n", " ")
                print(f"  [{i}] source={r['source']}  dist={r['distance']:.4f}")
                print(f"       file={meta.get('filename','?')}  subject={meta.get('subject','?')}")
                print(f"       text: {text}...")
                print()
        else:
            print(f"  NO matching chunks found for '{topic}'.")
            print("  Either the topic doesn't match the seeded content,")
            print("  or the hs_curriculum collection is empty.")
            print("\n  Run:  python seed_hs_curriculum.py --list  to check.")
    except Exception as e:
        print(f"  Direct RAG test failed: {e}")
        import traceback
        traceback.print_exc()


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Compare AI output with/without HS Mode")
    parser.add_argument("--topic",    default="photosynthesis",  help="Biology topic to test (default: photosynthesis)")
    parser.add_argument("--user",     default="test",            help="Username/email to authenticate as")
    parser.add_argument("--password", default="test",            help="Password (only needed for /api/context/search check)")
    parser.add_argument("--mode",     default="all",
                        choices=["quiz", "flashcards", "notes", "rag", "all"],
                        help="Which comparison to run (default: all)")
    args = parser.parse_args()

    topic   = args.topic
    user_id = args.user
    token   = ""

    print(f"\n{'#'*80}")
    print(f"  CERBYL HS MODE COMPARISON TEST")
    print(f"  Topic: '{topic}'  |  Mode: {args.mode}")
    print(f"{'#'*80}")

    # Always run the direct RAG test first — no server needed
    quick_rag_test(topic)

    # Try to get a token for the /api/context/search endpoint
    if args.mode in ("all", "rag"):
        token = login(user_id, args.password)
        if token:
            check_rag(topic, user_id, token)

    if args.mode in ("all", "quiz"):
        compare_quiz(topic, user_id, token)

    if args.mode in ("all", "flashcards"):
        compare_flashcards(topic, user_id, token)

    if args.mode in ("all", "notes"):
        compare_notes(topic, user_id, token)


    print(f"\n{'#'*80}")
    print(f"  TEST COMPLETE")
    print(f"  Check your uvicorn terminal for the [*_RAG] and [*_PROMPT] log lines.")
    print(f"  Lines with '*** HS CONTEXT FOUND ***' confirm RAG is working.")
    print(f"{'#'*80}\n")


if __name__ == "__main__":
    main()
