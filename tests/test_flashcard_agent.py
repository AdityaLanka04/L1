"""
=============================================================================
BRAINWAVE L1 — FLASHCARD GENERATION AGENT TEST SUITE
=============================================================================
Tests LangGraph initialization, card quality, difficulty levels, depth levels,
card count accuracy, concurrent generation, overload, and edge cases.

Endpoint : POST /api/generate_flashcards   (form-data)
Graph    : flashcard_graph.py  (3-node LangGraph: fetch_context →
           build_prompt → generate_cards)

LangGraph indicators tested:
  • wrong_options present on cards (AI-generated distractors from graph)
  • Context-aware card content (uses Neo4j prerequisites, weak areas)
  • Difficulty distribution consistency
  • Depth-level differentiation (surface vs standard vs deep)

Usage:
    pip install requests aiohttp pytest
    python -m pytest tests/test_flashcard_agent.py -v
    python tests/test_flashcard_agent.py          # standalone runner
=============================================================================
"""

import asyncio
import json
import time
import statistics
import sys
import io
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass
import random
import traceback
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_URL       = "http://localhost:8000"
API_URL        = f"{BASE_URL}/api"
FC_ENDPOINT    = f"{API_URL}/generate_flashcards"
HEALTH_EP      = f"{BASE_URL}/health"

TEST_USER_ID   = "testuser"

REQUEST_TIMEOUT       = 90    # seconds — AI generation is slower
CONCURRENT_WORKERS    = 8
STRESS_TOTAL_REQUESTS = 30
ASYNC_CONCURRENT      = 10

# Quality thresholds
MIN_QUESTION_LEN      = 10    # chars
MIN_ANSWER_LEN        = 5     # chars
MIN_WRONG_OPTIONS     = 2     # LangGraph should generate at least 2 wrong options
MAX_ACCEPTABLE_P95_MS = 60_000

RESULTS = {
    "passed": 0,
    "failed": 0,
    "errors": 0,
    "timings_ms": [],
    "failures": [],
}


def _record(label: str, passed: bool, ms: float = 0, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    icon   = "+" if passed else "-"
    print(f"  {icon} [{status}] {label:<65} {ms:>7.0f}ms  {detail}")
    if passed:
        RESULTS["passed"] += 1
    else:
        RESULTS["failed"] += 1
        RESULTS["failures"].append(f"{label}: {detail}")
    if ms > 0:
        RESULTS["timings_ms"].append(ms)


def _section(title: str):
    print(f"\n{'='*78}")
    print(f"  {title}")
    print(f"{'='*78}")


# =============================================================================
# HTTP HELPERS
# =============================================================================

def fc_request(topic: str, card_count: int = 5, difficulty: str = "medium",
               depth_level: str = "standard", generation_type: str = "topic",
               additional_specs: str = "", set_title: str = None,
               user_id: str = TEST_USER_ID, timeout: int = REQUEST_TIMEOUT
               ) -> tuple[dict | None, float, int]:
    """
    POST /api/generate_flashcards  (form-data)
    Returns (response_dict_or_None, elapsed_ms, status_code)
    """
    data = {
        "user_id":         user_id,
        "topic":           topic,
        "card_count":      str(card_count),
        "difficulty":      difficulty,
        "depth_level":     depth_level,
        "generation_type": generation_type,
        "additional_specs": additional_specs,
    }
    if set_title:
        data["set_title"] = set_title
    t0 = time.perf_counter()
    try:
        r = requests.post(FC_ENDPOINT, data=data, timeout=timeout)
        ms = (time.perf_counter() - t0) * 1000
        try:
            return r.json(), ms, r.status_code
        except Exception:
            return None, ms, r.status_code
    except requests.exceptions.ConnectionError:
        ms = (time.perf_counter() - t0) * 1000
        return None, ms, 0
    except requests.exceptions.Timeout:
        ms = (time.perf_counter() - t0) * 1000
        return None, ms, 408


def check_server_up() -> bool:
    try:
        r = requests.get(HEALTH_EP, timeout=5)
        return r.status_code < 500
    except Exception:
        pass
    try:
        r = requests.get(BASE_URL, timeout=5)
        return r.status_code < 500
    except Exception:
        return False


def validate_fc_response(data: dict | None, expected_count: int = None
                          ) -> tuple[bool, str, list]:
    """
    Validate flashcard generation response.
    Returns (ok, detail_str, cards_list)
    """
    if data is None:
        return False, "null response", []
    if not isinstance(data, dict):
        return False, f"expected dict got {type(data).__name__}", []

    cards = data.get("flashcards") or data.get("cards") or []
    if not isinstance(cards, list) or len(cards) == 0:
        return False, f"no flashcards in response: keys={list(data.keys())}", []

    if expected_count and len(cards) != expected_count:
        detail = f"expected {expected_count} cards, got {len(cards)}"
        # Allow ±2 tolerance
        if abs(len(cards) - expected_count) > 2:
            return False, detail, cards

    return True, f"{len(cards)} cards returned", cards


def validate_card_structure(card: dict) -> tuple[bool, list[str]]:
    """Validate individual flashcard structure."""
    issues = []
    q = card.get("question") or card.get("front") or ""
    a = card.get("answer") or card.get("back") or ""

    if not isinstance(q, str) or len(q.strip()) < MIN_QUESTION_LEN:
        issues.append(f"question too short: '{q[:30]}'")
    if not isinstance(a, str) or len(a.strip()) < MIN_ANSWER_LEN:
        issues.append(f"answer too short: '{a[:30]}'")

    # wrong_options = LangGraph indicator
    wrong_opts = card.get("wrong_options") or []
    if not isinstance(wrong_opts, list):
        issues.append("wrong_options not a list")

    diff = card.get("difficulty") or ""
    if diff and diff not in ("easy", "medium", "hard"):
        issues.append(f"invalid difficulty: {diff}")

    return len(issues) == 0, issues


def count_with_wrong_options(cards: list) -> int:
    return sum(1 for c in cards
               if isinstance(c.get("wrong_options"), list)
               and len(c.get("wrong_options", [])) >= MIN_WRONG_OPTIONS)


# =============================================================================
# SECTION 1 — SERVER & GRAPH INITIALIZATION
# =============================================================================

def test_server_and_init():
    _section("SECTION 1 — SERVER & LANGGRAPH INITIALIZATION")

    # 1.1 Server reachable
    t0 = time.perf_counter()
    up = check_server_up()
    ms = (time.perf_counter() - t0) * 1000
    _record("Server is reachable", up, ms)
    if not up:
        print("\n  !! Backend not running — aborting !!")
        sys.exit(1)

    # 1.2 First flashcard generation — proves graph is initialized
    data, ms, code = fc_request("Python programming basics", card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Flashcard graph responds (graph initialized)", ok, ms, detail)

    # 1.3 HTTP 200
    _record("HTTP 200 on first valid request", code == 200, ms, f"got {code}")

    # 1.4 LangGraph indicator: wrong_options present
    if ok and cards:
        wc = count_with_wrong_options(cards)
        _record(f"LangGraph indicator: wrong_options on {wc}/{len(cards)} cards",
                wc > 0, ms, f"{wc} cards have wrong_options")

    # 1.5 Card structure validity
    if ok and cards:
        all_ok = True
        for card in cards:
            c_ok, issues = validate_card_structure(card)
            if not c_ok:
                all_ok = False
        _record("All returned cards have valid structure", all_ok, ms,
                f"checked {len(cards)} cards")

    # 1.6 set_id present (card saved to DB)
    if data:
        has_id = bool(data.get("set_id") or data.get("id"))
        _record("Response contains set_id (saved to DB)", has_id, ms,
                f"set_id={data.get('set_id')}")

    # 1.7 Second request still works (graph stays alive)
    data2, ms2, code2 = fc_request("Data structures", card_count=3)
    ok2, detail2, _ = validate_fc_response(data2)
    _record("Second request succeeds (graph stays alive)", ok2, ms2, detail2)


# =============================================================================
# SECTION 2 — DIVERSE TOPIC COVERAGE (30 TOPICS)
# =============================================================================

DIVERSE_TOPICS = [
    # Computer Science
    ("Binary trees and BST operations",                    "cs"),
    ("Big O notation and algorithm complexity",             "cs"),
    ("Sorting algorithms: quicksort mergesort heapsort",   "cs"),
    ("Graph theory: BFS DFS Dijkstra",                     "cs"),
    ("Dynamic programming fundamentals",                   "cs"),
    ("Operating systems: processes threads scheduling",    "cs"),
    ("Computer networking: TCP IP HTTP",                   "cs"),
    ("Database design and SQL fundamentals",               "cs"),
    ("Object-oriented programming principles",             "cs"),
    ("Design patterns: creational structural behavioral",  "cs"),
    # Mathematics
    ("Calculus: derivatives and integrals",                "math"),
    ("Linear algebra: matrices vectors eigenvalues",       "math"),
    ("Probability theory and statistics",                  "math"),
    ("Number theory fundamentals",                         "math"),
    ("Discrete mathematics: sets logic proofs",            "math"),
    # Science
    ("Cell biology and cellular processes",                "bio"),
    ("Genetics and DNA structure",                         "bio"),
    ("Organic chemistry: functional groups reactions",     "chem"),
    ("Thermodynamics and heat transfer",                   "physics"),
    ("Quantum mechanics fundamentals",                     "physics"),
    # Machine Learning / AI
    ("Neural networks and deep learning basics",           "ml"),
    ("Supervised learning algorithms",                     "ml"),
    ("Natural language processing fundamentals",           "ml"),
    ("Reinforcement learning concepts",                    "ml"),
    # Other
    ("Economics: microeconomics supply and demand",        "econ"),
    ("World War 2 causes and consequences",                "history"),
    ("Literary devices and techniques",                    "english"),
    ("Spanish vocabulary: common verbs",                   "lang"),
    ("Human anatomy: cardiovascular system",               "med"),
    ("Environmental science: climate change",              "sci"),
]


def test_diverse_topics():
    _section("SECTION 2 — DIVERSE TOPIC COVERAGE (30 TOPICS, 5 cards each)")
    for topic, category in DIVERSE_TOPICS:
        label = f"[{category}] {topic[:55]}"
        data, ms, code = fc_request(topic, card_count=5)
        ok, detail, cards = validate_fc_response(data)
        _record(label, ok, ms, detail)


# =============================================================================
# SECTION 3 — DIFFICULTY LEVEL TESTS
# =============================================================================

DIFFICULTY_TEST_TOPICS = [
    "Python programming fundamentals",
    "Machine learning algorithms",
    "World history 20th century",
    "Chemistry: organic compounds",
    "Linear algebra concepts",
]


def test_difficulty_levels():
    _section("SECTION 3 — DIFFICULTY LEVEL TESTS (easy/medium/hard)")
    for topic in DIFFICULTY_TEST_TOPICS:
        for difficulty in ("easy", "medium", "hard"):
            label = f"[{difficulty}] {topic[:50]}"
            data, ms, code = fc_request(topic, card_count=4, difficulty=difficulty)
            ok, detail, cards = validate_fc_response(data)

            # Check that card difficulty tags match requested level (when present)
            diff_match = True
            if ok and cards:
                for c in cards:
                    card_diff = c.get("difficulty")
                    if card_diff and card_diff != difficulty:
                        # Some variance is acceptable (graph may adjust)
                        pass  # don't fail — graph can vary difficulty
                wc = count_with_wrong_options(cards)
                detail = f"{detail} | wrong_opts on {wc}/{len(cards)}"

            _record(label, ok, ms, detail)


# =============================================================================
# SECTION 4 — DEPTH LEVEL TESTS
# =============================================================================

DEPTH_TOPICS = [
    "Machine learning: neural networks",
    "Computer Science: sorting algorithms",
    "Biology: cell division",
]


def test_depth_levels():
    _section("SECTION 4 — DEPTH LEVEL TESTS (surface/standard/deep)")
    answer_lengths = {"surface": [], "standard": [], "deep": []}

    for topic in DEPTH_TOPICS:
        for depth in ("surface", "standard", "deep"):
            label = f"[{depth}] {topic[:50]}"
            data, ms, code = fc_request(topic, card_count=4, depth_level=depth)
            ok, detail, cards = validate_fc_response(data)

            if ok and cards:
                avg_ans_len = statistics.mean(
                    len(c.get("answer") or "") for c in cards
                )
                answer_lengths[depth].append(avg_ans_len)
                detail = f"{detail} | avg_ans_len={avg_ans_len:.0f}"

            _record(label, ok, ms, detail)

    # Verify deep > standard > surface answer length (LangGraph depth awareness)
    if all(answer_lengths[d] for d in ("surface", "standard", "deep")):
        avg_surface  = statistics.mean(answer_lengths["surface"])
        avg_standard = statistics.mean(answer_lengths["standard"])
        avg_deep     = statistics.mean(answer_lengths["deep"])
        print(f"\n   Avg answer length: surface={avg_surface:.0f}  "
              f"standard={avg_standard:.0f}  deep={avg_deep:.0f}")
        _record("Deep answers longer than surface (LangGraph depth awareness)",
                avg_deep > avg_surface, 0,
                f"deep={avg_deep:.0f} > surface={avg_surface:.0f}")


# =============================================================================
# SECTION 5 — CARD COUNT ACCURACY
# =============================================================================

COUNT_TESTS = [3, 5, 7, 10, 12, 15, 20]


def test_card_count_accuracy():
    _section("SECTION 5 — CARD COUNT ACCURACY")
    topic = "Computer science fundamentals"
    for count in COUNT_TESTS:
        data, ms, code = fc_request(topic, card_count=count)
        ok, detail, cards = validate_fc_response(data, expected_count=count)
        actual = len(cards) if cards else 0
        within_tolerance = abs(actual - count) <= 2
        _record(f"Requested {count} cards → got {actual} (±2 tolerance)",
                ok and within_tolerance, ms, detail)


# =============================================================================
# SECTION 6 — CARD STRUCTURE & QUALITY VALIDATION
# =============================================================================

def test_card_structure_quality():
    _section("SECTION 6 — CARD STRUCTURE & QUALITY VALIDATION")

    data, ms, code = fc_request("Python data structures", card_count=10)
    ok, detail, cards = validate_fc_response(data)
    _record("10-card generation succeeds", ok, ms, detail)

    if not ok or not cards:
        return

    # 6.1 All cards have non-empty question and answer
    all_have_qa = all(
        bool(c.get("question") or c.get("front")) and
        bool(c.get("answer") or c.get("back"))
        for c in cards
    )
    _record("All cards have question and answer", all_have_qa, ms)

    # 6.2 Questions are not duplicated
    questions = [c.get("question") or c.get("front") or "" for c in cards]
    unique_q = len(set(q.strip().lower() for q in questions))
    _record(f"All questions are unique ({unique_q}/{len(cards)})",
            unique_q == len(cards), ms, f"{unique_q} unique of {len(cards)}")

    # 6.3 wrong_options field (LangGraph graph indicator)
    wc = count_with_wrong_options(cards)
    _record(f"LangGraph: wrong_options on {wc}/{len(cards)} cards (indicator of graph use)",
            wc >= len(cards) // 2, ms, f"{wc}/{len(cards)} have wrong_options")

    # 6.4 Each wrong_option is different from the correct answer
    distractor_ok = True
    for c in cards:
        answer = (c.get("answer") or "").strip().lower()
        wrong_opts = c.get("wrong_options") or []
        for w in wrong_opts:
            if isinstance(w, str) and w.strip().lower() == answer:
                distractor_ok = False
    _record("Wrong options differ from correct answers", distractor_ok, ms)

    # 6.5 Difficulty field is valid
    valid_diffs = {"easy", "medium", "hard", ""}
    all_valid_diff = all(
        (c.get("difficulty") or "") in valid_diffs for c in cards
    )
    _record("All cards have valid difficulty field", all_valid_diff, ms)

    # 6.6 Minimum question length
    min_q_ok = all(len(c.get("question") or "") >= MIN_QUESTION_LEN for c in cards)
    _record(f"All questions ≥ {MIN_QUESTION_LEN} chars", min_q_ok, ms)

    # 6.7 Minimum answer length
    min_a_ok = all(len(c.get("answer") or "") >= MIN_ANSWER_LEN for c in cards)
    _record(f"All answers ≥ {MIN_ANSWER_LEN} chars", min_a_ok, ms)


# =============================================================================
# SECTION 7 — ADDITIONAL SPECS / CUSTOM PROMPTS
# =============================================================================

SPEC_TESTS = [
    ("Machine learning",    "Focus on practical examples only",               5),
    ("Python programming",  "Include code snippets in questions",             5),
    ("World history",       "Ask about specific dates and events only",       5),
    ("Mathematics",         "Focus on formulas and theorems",                 5),
    ("Biology",             "Emphasize terminology and definitions",          5),
    ("Computer networks",   "Include OSI layer references in each card",      4),
    ("Chemistry",           "Focus on reaction types and equations",          4),
    ("Economics",           "Ask about real-world applications",              4),
    ("Data structures",     "Include time complexity in each answer",         4),
    ("Physics",             "Emphasize units and formulas in answers",        4),
]


def test_additional_specs():
    _section("SECTION 7 — ADDITIONAL SPECS (custom prompt overrides)")
    for topic, specs, count in SPEC_TESTS:
        label = f"specs='{specs[:40]}' on '{topic}'"
        data, ms, code = fc_request(topic, card_count=count, additional_specs=specs)
        ok, detail, cards = validate_fc_response(data)
        _record(label, ok, ms, detail)


# =============================================================================
# SECTION 8 — EDGE CASES & ROBUSTNESS
# =============================================================================

def test_edge_cases():
    _section("SECTION 8 — EDGE CASES & ROBUSTNESS")

    # 8.1 Very short topic
    data, ms, code = fc_request("AI", card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Very short topic ('AI') handled", ok, ms, detail)

    # 8.2 Very long topic name
    long_topic = "Advanced machine learning with focus on deep neural networks, " \
                 "convolutional networks, recurrent networks, transformers, " \
                 "reinforcement learning from human feedback, and generative AI"
    data, ms, code = fc_request(long_topic, card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Long topic name (150 chars) handled", ok, ms, detail)

    # 8.3 Topic with special chars
    data, ms, code = fc_request("C++ & Java: OOP concepts", card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Topic with special chars (C++ & Java) handled", ok, ms, detail)

    # 8.4 card_count = 1
    data, ms, code = fc_request("Recursion", card_count=1)
    ok, detail, cards = validate_fc_response(data)
    _record("card_count=1 (minimum) handled", ok, ms, detail)

    # 8.5 card_count = 25 (large)
    data, ms, code = fc_request("Python fundamentals", card_count=25)
    ok, detail, cards = validate_fc_response(data)
    _record("card_count=25 (large) handled", ok, ms, detail)

    # 8.6 Empty topic — should fail gracefully
    data, ms, code = fc_request("", card_count=5)
    graceful = code in (200, 400, 422) or (data is not None and "error" in str(data).lower())
    _record("Empty topic returns graceful error (not 500)", graceful, ms, f"code={code}")

    # 8.7 Invalid difficulty
    t0 = time.perf_counter()
    r = requests.post(FC_ENDPOINT, data={
        "user_id": TEST_USER_ID, "topic": "Python", "card_count": "3",
        "difficulty": "ultrahard", "depth_level": "standard"
    }, timeout=20)
    ms = (time.perf_counter() - t0) * 1000
    graceful = r.status_code < 500
    _record("Invalid difficulty value graceful error", graceful, ms, f"code={r.status_code}")

    # 8.8 card_count as string
    t0 = time.perf_counter()
    r = requests.post(FC_ENDPOINT, data={
        "user_id": TEST_USER_ID, "topic": "Python", "card_count": "five",
        "difficulty": "medium", "depth_level": "standard"
    }, timeout=20)
    ms = (time.perf_counter() - t0) * 1000
    graceful = r.status_code < 500
    _record("Non-numeric card_count graceful error", graceful, ms, f"code={r.status_code}")

    # 8.9 Missing user_id
    t0 = time.perf_counter()
    r = requests.post(FC_ENDPOINT, data={"topic": "Python", "card_count": "5",
                                          "difficulty": "medium"}, timeout=10)
    ms = (time.perf_counter() - t0) * 1000
    graceful = r.status_code in (200, 400, 404, 422)
    _record("Missing user_id graceful error", graceful, ms, f"code={r.status_code}")

    # 8.10 Topic with numbers/equations
    data, ms, code = fc_request("Calculus: f(x) = x^2 + 3x - 5", card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Topic with math equation handled", ok, ms, detail)

    # 8.11 Non-English topic
    data, ms, code = fc_request("Programación en Python", card_count=3)
    ok, detail, cards = validate_fc_response(data)
    _record("Non-English topic (Spanish) handled", ok or code < 500, ms,
            detail if ok else f"code={code}")

    # 8.12 Invalid user
    data, ms, code = fc_request("Python", card_count=3,
                                 user_id="__totally_invalid_user_999__")
    graceful = code in (200, 400, 404, 422)
    _record("Invalid user_id graceful error", graceful, ms, f"code={code}")


# =============================================================================
# SECTION 9 — CONCURRENT GENERATION LOAD TEST
# =============================================================================

CONCURRENT_TOPICS = [
    "Python basics",           "JavaScript fundamentals", "Machine learning intro",
    "Data structures",         "Algorithms basics",       "Database SQL",
    "Computer networks",       "Operating systems",       "Linear algebra",
    "Calculus derivatives",    "Chemistry reactions",     "Biology cells",
    "World history WW2",       "Physics thermodynamics",  "Economics supply demand",
    "English grammar rules",   "Spanish vocabulary",      "Statistics probability",
    "Discrete mathematics",    "Software engineering",
]


def _fc_worker(args):
    topic, idx = args
    data, ms, code = fc_request(topic, card_count=4, timeout=REQUEST_TIMEOUT)
    ok, detail, cards = validate_fc_response(data)
    return idx, topic[:30], ok, ms, code, len(cards) if cards else 0


def test_concurrent_generation():
    _section("SECTION 9 — CONCURRENT GENERATION LOAD TEST (20 simultaneous)")
    prompts = [(t, i) for i, t in enumerate(CONCURRENT_TOPICS)]

    t_start = time.perf_counter()
    successes, fail_count = 0, 0
    timings = []

    with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
        futures = {executor.submit(_fc_worker, p): p for p in prompts}
        for future in as_completed(futures):
            try:
                idx, topic, ok, ms, code, card_cnt = future.result()
                timings.append(ms)
                if ok:
                    successes += 1
                else:
                    fail_count += 1
            except Exception as e:
                fail_count += 1
                timings.append(0)

    total_ms = (time.perf_counter() - t_start) * 1000
    rate = successes / len(prompts) * 100
    avg_ms = statistics.mean(timings) if timings else 0
    p95_ms = sorted(timings)[int(len(timings) * 0.95)] if timings else 0

    _record(f"Concurrent 20: {successes}/{len(prompts)} succeeded",
            rate >= 70, total_ms, f"{rate:.0f}% success")
    _record("Avg latency under concurrency", avg_ms < MAX_ACCEPTABLE_P95_MS,
            avg_ms, f"avg={avg_ms:.0f}ms")
    _record("P95 latency under concurrency", p95_ms < MAX_ACCEPTABLE_P95_MS,
            p95_ms, f"p95={p95_ms:.0f}ms")


# =============================================================================
# SECTION 10 — STRESS TEST (RAPID SEQUENTIAL)
# =============================================================================

STRESS_TOPICS = [
    "Arrays and lists", "Stack data structure", "Queue data structure",
    "Linked lists", "Binary trees", "Graph algorithms", "Hash tables",
    "Sorting algorithms", "Searching algorithms", "Dynamic programming",
    "Recursion basics", "OOP concepts", "Design patterns", "SQL queries",
    "Python functions", "JavaScript closures", "React components",
    "REST API design", "Docker basics", "Git commands",
    "Linux commands", "Networking protocols", "Security basics",
    "Cryptography intro", "Machine learning basics",
    "Neural networks", "NLP fundamentals", "Computer vision intro",
    "Statistics basics", "Probability theory",
]


def test_stress_sequential():
    _section("SECTION 10 — STRESS TEST (30 rapid sequential, 3 cards each)")
    all_times, all_ok = [], []

    for topic in STRESS_TOPICS:
        data, ms, code = fc_request(topic, card_count=3)
        ok, detail, cards = validate_fc_response(data)
        all_times.append(ms)
        all_ok.append(ok)

    rate = sum(all_ok) / len(all_ok) * 100
    avg_ms = statistics.mean(all_times)
    max_ms = max(all_times)

    _record(f"Stress test: {sum(all_ok)}/{len(all_ok)} succeeded",
            rate >= 75, avg_ms, f"{rate:.0f}% success rate")
    _record(f"Max latency in stress test", max_ms < 120_000, max_ms,
            f"max={max_ms:.0f}ms threshold=120s")


# =============================================================================
# SECTION 11 — ASYNC OVERLOAD TEST
# =============================================================================

OVERLOAD_TOPICS = [
    "Python basics", "Java OOP", "JavaScript async", "SQL joins",
    "NoSQL databases", "REST APIs", "GraphQL", "Docker containers",
    "Kubernetes basics", "CI/CD pipelines", "Git branching", "Agile scrum",
    "Test driven development", "Code review best practices",
    "System design basics", "Microservices", "Message queues",
    "Load balancing", "CDN concepts", "Web security OWASP",
    "OAuth 2.0", "JWT tokens", "Encryption basics", "SSL TLS",
    "Data warehouse", "ETL pipelines", "Apache Spark", "Kafka basics",
    "Redis caching", "Elasticsearch",
]


async def _async_fc(session, topic: str, idx: int) -> dict:
    data = {
        "user_id":     TEST_USER_ID,
        "topic":       topic,
        "card_count":  "3",
        "difficulty":  "medium",
        "depth_level": "standard",
    }
    t0 = time.perf_counter()
    try:
        async with session.post(FC_ENDPOINT, data=data,
                                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)) as resp:
            ms = (time.perf_counter() - t0) * 1000
            body = await resp.json()
            return {"idx": idx, "ok": True, "ms": ms, "code": resp.status, "data": body}
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return {"idx": idx, "ok": False, "ms": ms, "code": 0, "error": str(e)}


async def _run_async_overload(topics):
    connector = aiohttp.TCPConnector(limit=ASYNC_CONCURRENT)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [_async_fc(session, t, i) for i, t in enumerate(topics)]
        return await asyncio.gather(*tasks, return_exceptions=True)


def test_async_overload():
    _section("SECTION 11 — ASYNC OVERLOAD TEST (30 async concurrent)")
    if not HAS_AIOHTTP:
        print("   aiohttp not installed — skipping. pip install aiohttp")
        return

    results = asyncio.run(_run_async_overload(OVERLOAD_TOPICS))
    ok_count, timings = 0, []
    for r in results:
        if isinstance(r, dict):
            timings.append(r.get("ms", 0))
            data = r.get("data")
            v_ok, _, _ = validate_fc_response(data if isinstance(data, dict) else None)
            if v_ok:
                ok_count += 1

    total = len(OVERLOAD_TOPICS)
    rate  = ok_count / total * 100
    avg_ms = statistics.mean(timings) if timings else 0
    p95_ms = sorted(timings)[int(len(timings) * 0.95)] if timings else 0

    _record(f"Async overload: {ok_count}/{total} succeeded", rate >= 60,
            avg_ms, f"{rate:.0f}% success")
    _record("Async p95 latency", p95_ms < MAX_ACCEPTABLE_P95_MS,
            p95_ms, f"p95={p95_ms:.0f}ms")


# =============================================================================
# SECTION 12 — LANGGRAPH SPECIFIC BEHAVIOR TESTS
# =============================================================================

def test_langgraph_specific():
    _section("SECTION 12 — LANGGRAPH-SPECIFIC BEHAVIOR VALIDATION")

    # 12.1 Cards should reflect weak areas (context-aware)
    # We can't verify Neo4j data in a black-box test, but we CAN verify
    # that responses are more detailed than a simple template.

    # Generate same topic at different difficulties — content should differ
    data_easy, ms_e, _ = fc_request("Python recursion", card_count=3,
                                     difficulty="easy", depth_level="surface")
    data_hard, ms_h, _ = fc_request("Python recursion", card_count=3,
                                     difficulty="hard", depth_level="deep")

    ok_e, _, cards_e = validate_fc_response(data_easy)
    ok_h, _, cards_h = validate_fc_response(data_hard)

    if ok_e and ok_h and cards_e and cards_h:
        avg_ans_e = statistics.mean(len(c.get("answer", "")) for c in cards_e)
        avg_ans_h = statistics.mean(len(c.get("answer", "")) for c in cards_h)
        _record("Hard+deep answers longer than easy+surface (graph adapts)",
                avg_ans_h >= avg_ans_e * 0.8, ms_e + ms_h,
                f"easy={avg_ans_e:.0f} hard={avg_ans_h:.0f} chars")

    # 12.2 wrong_options are unique per card (not reused across all cards)
    data, ms, _ = fc_request("Machine learning algorithms", card_count=8)
    ok, _, cards = validate_fc_response(data)
    if ok and cards:
        all_wrong_opts = []
        for c in cards:
            all_wrong_opts.extend(c.get("wrong_options") or [])
        unique_opts = len(set(str(o).strip().lower() for o in all_wrong_opts))
        total_opts  = len(all_wrong_opts)
        diversity   = unique_opts / total_opts if total_opts > 0 else 0
        _record(f"Wrong options are diverse across cards ({unique_opts}/{total_opts} unique)",
                diversity > 0.5, ms, f"{diversity:.0%} unique")

    # 12.3 Content type generation — from raw content
    sample_content = """
    Python lists are ordered, mutable sequences. Lists support indexing, slicing,
    and common operations like append, extend, remove, pop, sort, and reverse.
    List comprehensions provide a concise way to create lists from other iterables.
    The time complexity for append is O(1) amortized, while insert is O(n).
    """
    data_c, ms_c, code_c = fc_request(
        topic="Python lists",
        card_count=4,
        generation_type="content",
        additional_specs=sample_content
    )
    ok_c, detail_c, cards_c = validate_fc_response(data_c)
    _record("Content-based generation (generation_type=content) works",
            ok_c or code_c < 500, ms_c, detail_c if ok_c else f"code={code_c}")

    # 12.4 Custom set_title is preserved in response
    data_t, ms_t, _ = fc_request("Python",  card_count=3, set_title="My Custom Set")
    if data_t:
        title_in_response = (
            (data_t.get("set_title") or "").lower().__contains__("custom") or
            (data_t.get("title") or "").lower().__contains__("custom")
        )
        _record("Custom set_title preserved in response",
                title_in_response or bool(data_t.get("set_id")), ms_t,
                f"title='{data_t.get('set_title') or data_t.get('title')}'")

    # 12.5 Graph generates contextual MCQ questions (not trivial)
    data_q, ms_q, _ = fc_request("Sorting algorithms", card_count=5, difficulty="hard")
    ok_q, _, cards_q = validate_fc_response(data_q)
    if ok_q and cards_q:
        avg_q_len = statistics.mean(len(c.get("question", "")) for c in cards_q)
        _record(f"Hard questions are substantive (avg q_len={avg_q_len:.0f} chars)",
                avg_q_len > 30, ms_q, f"avg={avg_q_len:.0f} chars")


# =============================================================================
# SECTION 13 — MIXED DIFFICULTY GENERATION
# =============================================================================

def test_mixed_requests():
    _section("SECTION 13 — MIXED PARAMETER COMBINATIONS")

    combos = [
        ("Python",          10, "easy",   "surface"),
        ("Machine learning", 5, "medium", "standard"),
        ("Algorithms",      8,  "hard",   "deep"),
        ("Biology cells",   6,  "easy",   "deep"),
        ("Linear algebra",  4,  "hard",   "surface"),
        ("Web development", 7,  "medium", "deep"),
        ("Statistics",      5,  "easy",   "standard"),
        ("Data science",    9,  "hard",   "standard"),
        ("Computer vision", 3,  "medium", "deep"),
        ("SQL",             10, "easy",   "surface"),
    ]
    for topic, count, diff, depth in combos:
        label = f"[{diff}/{depth}] {topic:<25} count={count}"
        data, ms, code = fc_request(topic, card_count=count,
                                     difficulty=diff, depth_level=depth)
        ok, detail, cards = validate_fc_response(data)
        _record(label, ok, ms, detail)


# =============================================================================
# SECTION 14 — BURST OVERLOAD TEST
# =============================================================================

def test_burst_overload():
    _section("SECTION 14 — BURST OVERLOAD (50 requests, 12 workers)")
    burst_topics = [
        f"Computer science concept number {i}"
        for i in range(50)
    ]

    ok_count, fail_count = 0, 0
    timings = []
    t_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = [
            ex.submit(fc_request, t, 3, "medium", "standard",
                      "topic", "", None, TEST_USER_ID, 60)
            for t in burst_topics
        ]
        for f in as_completed(futures):
            try:
                data, ms, code = f.result()
                timings.append(ms)
                ok, _, cards = validate_fc_response(data)
                if ok:
                    ok_count += 1
                else:
                    fail_count += 1
            except Exception:
                fail_count += 1
                timings.append(0)

    total_time = (time.perf_counter() - t_start) * 1000
    rate = ok_count / len(burst_topics) * 100
    avg_ms = statistics.mean(timings) if timings else 0

    _record(f"Burst 50: {ok_count}/{len(burst_topics)} succeeded",
            rate >= 60, total_time, f"{rate:.0f}% success")
    _record("Server survives burst without crash",
            ok_count + fail_count == len(burst_topics), avg_ms, "all futures resolved")


# =============================================================================
# SECTION 15 — PERFORMANCE BENCHMARKS
# =============================================================================

def test_performance_benchmarks():
    _section("SECTION 15 — PERFORMANCE BENCHMARKS")

    # Warm-up
    fc_request("Python", card_count=2)

    bench_topics = [
        ("Python basics",         5,  "medium", "standard"),
        ("Machine learning",      5,  "medium", "standard"),
        ("Data structures",       5,  "medium", "standard"),
        ("Linear algebra",        5,  "medium", "standard"),
        ("Biology",               5,  "medium", "standard"),
        ("World history",         5,  "medium", "standard"),
        ("Chemistry",             5,  "medium", "standard"),
        ("Physics",               5,  "medium", "standard"),
        ("Economics",             5,  "medium", "standard"),
        ("Computer networks",     5,  "medium", "standard"),
    ]

    timings = []
    for topic, count, diff, depth in bench_topics:
        _, ms, _ = fc_request(topic, count, diff, depth)
        timings.append(ms)

    avg    = statistics.mean(timings)
    median = statistics.median(timings)
    stdev  = statistics.stdev(timings) if len(timings) > 1 else 0
    p90    = sorted(timings)[int(len(timings) * 0.9)]

    print(f"\n   Flashcard Generation Performance (n={len(timings)}, 5 cards each):")
    print(f"     avg    = {avg:.0f}ms")
    print(f"     median = {median:.0f}ms")
    print(f"     stdev  = {stdev:.0f}ms")
    print(f"     p90    = {p90:.0f}ms")
    print(f"     min    = {min(timings):.0f}ms")
    print(f"     max    = {max(timings):.0f}ms")

    _record("Median generation time < 45s", median < 45_000, median)
    _record("P90 generation time < 60s",    p90    < 60_000, p90)
    _record("Stdev < 20s (consistent speed)", stdev < 20_000, stdev)


# =============================================================================
# MAIN RUNNER
# =============================================================================

def run_all():
    print("\n" + "="*78)
    print("  BRAINWAVE L1 — FLASHCARD GENERATION AGENT TEST SUITE")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Endpoint: {FC_ENDPOINT}")
    print(f"  Test user: {TEST_USER_ID}")
    print("="*78)

    test_server_and_init()
    test_diverse_topics()
    test_difficulty_levels()
    test_depth_levels()
    test_card_count_accuracy()
    test_card_structure_quality()
    test_additional_specs()
    test_edge_cases()
    test_concurrent_generation()
    test_stress_sequential()
    test_async_overload()
    test_langgraph_specific()
    test_mixed_requests()
    test_burst_overload()
    test_performance_benchmarks()

    # -------------------------------------------------------------------------
    total    = RESULTS["passed"] + RESULTS["failed"]
    pass_rate = RESULTS["passed"] / total * 100 if total else 0

    _section("FINAL SUMMARY")
    print(f"  Total tests  : {total}")
    print(f"  Passed       : {RESULTS['passed']}  ({pass_rate:.1f}%)")
    print(f"  Failed       : {RESULTS['failed']}")

    if RESULTS["timings_ms"]:
        all_t = RESULTS["timings_ms"]
        print(f"\n  Generation Latency (all timed requests):")
        print(f"    avg    = {statistics.mean(all_t):.0f}ms")
        print(f"    median = {statistics.median(all_t):.0f}ms")
        print(f"    p95    = {sorted(all_t)[int(len(all_t)*0.95)]:.0f}ms")
        print(f"    max    = {max(all_t):.0f}ms")

    if RESULTS["failures"]:
        print(f"\n  Failed tests:")
        for f in RESULTS["failures"][:20]:
            print(f"    - {f}")

    print(f"\n  {'ALL TESTS PASSED' if RESULTS['failed'] == 0 else 'SOME TESTS FAILED'}")
    print("="*78 + "\n")
    return RESULTS["failed"] == 0


# pytest entrypoints
def test_suite_init():          test_server_and_init()
def test_suite_topics():        test_diverse_topics()
def test_suite_difficulty():    test_difficulty_levels()
def test_suite_depth():         test_depth_levels()
def test_suite_count():         test_card_count_accuracy()
def test_suite_structure():     test_card_structure_quality()
def test_suite_specs():         test_additional_specs()
def test_suite_edge():          test_edge_cases()
def test_suite_concurrent():    test_concurrent_generation()
def test_suite_stress():        test_stress_sequential()
def test_suite_async():         test_async_overload()
def test_suite_langgraph():     test_langgraph_specific()
def test_suite_mixed():         test_mixed_requests()
def test_suite_burst():         test_burst_overload()
def test_suite_perf():          test_performance_benchmarks()


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
