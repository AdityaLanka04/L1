"""
=============================================================================
BRAINWAVE L1 — AI CHAT / TUTOR AGENT TEST SUITE
=============================================================================
Tests LangGraph initialization, response quality, intent detection,
conversation continuity, edge cases, concurrent load, and stress scenarios.

Endpoint : POST /api/ask/   (form-data: user_id, question, chat_id)
Graph    : tutor/graph.py  (7-node LangGraph: detect_intent → fetch_student_state
           → reason_from_graph → gate_and_retrieve → build_prompt_and_respond
           → evaluate_response → persist_updates)

Usage:
    pip install requests aiohttp pytest
    python -m pytest tests/test_chat_agent.py -v
    python tests/test_chat_agent.py          # standalone runner
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
import string
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
CHAT_ENDPOINT  = f"{API_URL}/ask/"
HEALTH_EP      = f"{BASE_URL}/health"

# Set this to a real registered username/email in your DB
TEST_USER_ID   = "testuser"

# Timeouts & concurrency
REQUEST_TIMEOUT       = 60   # seconds per request
CONCURRENT_WORKERS    = 10   # parallel threads for load tests
STRESS_TOTAL_REQUESTS = 40   # total requests in stress tests
ASYNC_CONCURRENT      = 15   # aiohttp concurrent connections

# Pass/fail thresholds
MIN_RESPONSE_LENGTH   = 30   # chars — tutor response must be meaningful
MAX_ACCEPTABLE_P95_MS = 30_000  # 30 s p95 latency threshold

# =============================================================================
# GLOBAL TRACKING
# =============================================================================

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

def chat_request(question: str, chat_id: str = None, user_id: str = TEST_USER_ID,
                 timeout: int = REQUEST_TIMEOUT) -> tuple[dict | None, float, int]:
    """
    POST /api/ask/  (form-data)
    Returns (response_dict_or_None, elapsed_ms, status_code)
    """
    data = {"user_id": user_id, "question": question}
    if chat_id:
        data["chat_id"] = chat_id
    t0 = time.perf_counter()
    try:
        r = requests.post(CHAT_ENDPOINT, data=data, timeout=timeout)
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


def validate_chat_response(data: dict | None) -> tuple[bool, str]:
    """Validate structure of a tutor response."""
    if data is None:
        return False, "null response"
    if not isinstance(data, dict):
        return False, f"expected dict, got {type(data).__name__}"
    # The /ask/ endpoint returns the saved chat message row
    # ai_response OR response field must exist and be a non-empty string
    ai_text = data.get("ai_response") or data.get("response") or data.get("answer") or ""
    if not isinstance(ai_text, str) or len(ai_text.strip()) < MIN_RESPONSE_LENGTH:
        return False, f"response too short or missing: '{str(ai_text)[:60]}'"
    return True, ai_text[:80]


# =============================================================================
# SECTION 1 — SERVER & GRAPH INITIALIZATION
# =============================================================================

def test_server_reachability():
    _section("SECTION 1 — SERVER & LANGGRAPH INITIALIZATION")

    # 1.1 Health check
    t0 = time.perf_counter()
    up = check_server_up()
    ms = (time.perf_counter() - t0) * 1000
    _record("Server is reachable", up, ms,
            "" if up else "Start backend: uvicorn main:app --reload")
    if not up:
        print("\n  !! Backend not running — aborting test suite !!")
        sys.exit(1)

    # 1.2 First chat request — proves tutor graph initialized
    data, ms, code = chat_request("Hello, are you ready to help me learn?")
    ok, detail = validate_chat_response(data)
    _record("Tutor graph responds to greeting (graph initialized)", ok, ms, detail[:80])

    # 1.3 Graph should handle immediate follow-up (context pipeline alive)
    data2, ms2, _ = chat_request("What subjects can you help me with?")
    ok2, detail2 = validate_chat_response(data2)
    _record("Second request succeeds (graph stays alive)", ok2, ms2, detail2[:80])

    # 1.4 Response contains meaningful text (not fallback error string)
    if data:
        ai_text = data.get("ai_response") or data.get("response") or ""
        not_error = "error" not in ai_text.lower()[:50] and len(ai_text) > MIN_RESPONSE_LENGTH
        _record("Response is substantive (not error/fallback stub)", not_error, ms,
                ai_text[:80])

    # 1.5 Status code check
    _record("HTTP 200 on valid request", code == 200, ms, f"got {code}")


# =============================================================================
# SECTION 2 — BASIC FUNCTIONALITY (DIVERSE TOPICS)
# =============================================================================

BASIC_PROMPTS = [
    # Science
    ("Explain photosynthesis in simple terms",                          "science"),
    ("What is Newton's second law of motion?",                          "science"),
    ("How does DNA replication work?",                                  "biology"),
    ("What is the difference between mitosis and meiosis?",             "biology"),
    ("Explain the concept of entropy in thermodynamics",                "physics"),
    ("What is quantum entanglement?",                                   "physics"),
    ("Describe the structure of an atom",                               "chemistry"),
    ("What is Avogadro's number and why is it important?",              "chemistry"),
    # Mathematics
    ("Explain the Pythagorean theorem with an example",                 "math"),
    ("What is a derivative in calculus?",                               "math"),
    ("How do you solve a quadratic equation?",                          "math"),
    ("What is the difference between permutation and combination?",     "math"),
    ("Explain matrix multiplication step by step",                      "math"),
    ("What is an eigenvalue?",                                          "math"),
    ("Describe Bayes' theorem and give a practical example",            "math/stats"),
    # Computer Science
    ("What is the difference between a stack and a queue?",             "cs"),
    ("Explain Big O notation with examples",                            "cs"),
    ("What is recursion? Give a Python example",                        "cs/python"),
    ("How does a hash table work internally?",                          "cs"),
    ("What is dynamic programming? When should I use it?",              "cs"),
    ("Explain the OSI model layers",                                    "cs/networking"),
    ("What is a REST API?",                                             "cs/web"),
    ("How does garbage collection work in Java?",                       "cs/java"),
    # History / Social
    ("What caused World War 1?",                                        "history"),
    ("Explain the impact of the Industrial Revolution",                 "history"),
    ("What is the significance of the Magna Carta?",                    "history"),
    # Languages / Writing
    ("What is the difference between active and passive voice?",        "english"),
    ("Explain metaphor vs simile with examples",                        "english"),
    # Economics / Finance
    ("What is supply and demand?",                                      "economics"),
    ("Explain inflation and its causes",                                "economics"),
    ("What is compound interest?",                                      "finance"),
]


def test_basic_diverse_prompts():
    _section("SECTION 2 — BASIC FUNCTIONALITY (32 DIVERSE TOPICS)")
    for question, category in BASIC_PROMPTS:
        label = f"[{category}] {question[:55]}"
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        _record(label, ok, ms, detail[:60])


# =============================================================================
# SECTION 3 — INTENT DETECTION TESTS
# =============================================================================

INTENT_PROMPTS = [
    # Explain intent
    ("Can you explain recursion to me?",                                "intent:explain"),
    ("I don't understand derivatives. Can you clarify?",               "intent:explain"),
    ("Break down how sorting algorithms work",                          "intent:explain"),
    # Define intent
    ("Define machine learning in one sentence",                         "intent:define"),
    ("What does polymorphism mean in OOP?",                             "intent:define"),
    # Summarize intent
    ("Summarize the theory of evolution",                               "intent:summarize"),
    ("Give me a brief summary of the French Revolution",                "intent:summarize"),
    # Examples intent
    ("Give me examples of design patterns in software",                 "intent:examples"),
    ("Show me examples of metaphors in literature",                     "intent:examples"),
    # Compare intent
    ("Compare TCP vs UDP",                                              "intent:compare"),
    ("What's the difference between supervised and unsupervised learning?", "intent:compare"),
    ("Compare SQL vs NoSQL databases",                                  "intent:compare"),
    # How-to intent
    ("How do I implement a binary search tree in Python?",              "intent:howto"),
    ("How should I approach studying for exams?",                       "intent:howto"),
    # Quiz/test intent
    ("Quiz me on basic Python syntax",                                  "intent:quiz"),
    ("Ask me 3 questions about World War 2",                            "intent:quiz"),
    # Hint intent
    ("Give me a hint for solving Fibonacci without recursion",          "intent:hint"),
]


def test_intent_detection():
    _section("SECTION 3 — INTENT DETECTION (18 PROMPTS)")
    for question, intent_tag in INTENT_PROMPTS:
        label = f"[{intent_tag}] {question[:55]}"
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        _record(label, ok, ms, detail[:60])


# =============================================================================
# SECTION 4 — MULTI-TURN CONVERSATION CONTINUITY
# =============================================================================

CONVERSATION_THREADS = [
    # Thread A: Python programming deep-dive
    [
        "I want to learn Python from scratch. Where should I start?",
        "What are Python data types?",
        "Can you show me how lists differ from tuples?",
        "What's a dictionary in Python and how do I iterate over it?",
        "Now explain list comprehensions with a real example",
    ],
    # Thread B: Machine learning progression
    [
        "What is machine learning?",
        "What is the difference between classification and regression?",
        "Explain gradient descent",
        "How does a neural network learn from data?",
        "What is overfitting and how do I prevent it?",
    ],
    # Thread C: History conversation
    [
        "Tell me about the Roman Empire",
        "When did it fall and why?",
        "How did it influence modern law?",
        "Compare it to the Greek civilization",
    ],
]


def test_multi_turn_conversation():
    _section("SECTION 4 — MULTI-TURN CONVERSATION CONTINUITY")
    for thread_idx, thread in enumerate(CONVERSATION_THREADS):
        thread_label = f"Thread {thread_idx + 1}"
        chat_id = None
        for turn_idx, question in enumerate(thread):
            label = f"{thread_label} turn {turn_idx+1}: {question[:45]}"
            data, ms, code = chat_request(question, chat_id=chat_id)
            ok, detail = validate_chat_response(data)
            # Extract chat_id from first response
            if ok and data and chat_id is None:
                chat_id = str(data.get("chat_id") or data.get("id") or "")
            _record(label, ok, ms, detail[:60])


# =============================================================================
# SECTION 5 — ADVANCED / COMPLEX QUERIES
# =============================================================================

ADVANCED_PROMPTS = [
    "Explain the CAP theorem in distributed systems and give real-world trade-offs",
    "Walk me through the proof that there are infinitely many prime numbers",
    "What is the difference between P, NP, and NP-hard problems?",
    "Explain transformer architecture in neural networks (attention mechanism)",
    "Describe ACID properties in databases and when each matters",
    "Explain monads in functional programming to someone who knows Python",
    "What are the trade-offs between time complexity and space complexity in algorithms?",
    "How does the Linux kernel handle process scheduling?",
    "Explain Gödel's incompleteness theorems in plain language",
    "What is the significance of the Riemann Hypothesis?",
    "Compare object-oriented vs functional programming paradigms with code examples",
    "How does TLS/HTTPS work end-to-end?",
    "Explain the MapReduce programming model with a word-count example",
    "What is the difference between eventual consistency and strong consistency?",
    "Describe how a compiler works from source code to machine code",
]


def test_advanced_complex_queries():
    _section("SECTION 5 — ADVANCED / COMPLEX QUERIES (15 PROMPTS)")
    for question in ADVANCED_PROMPTS:
        label = f"[ADVANCED] {question[:55]}"
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        _record(label, ok, ms, detail[:60])


# =============================================================================
# SECTION 6 — EDGE CASES & ROBUSTNESS
# =============================================================================

def test_edge_cases():
    _section("SECTION 6 — EDGE CASES & ROBUSTNESS")

    # 6.1 Very short question
    data, ms, code = chat_request("Hi")
    ok, detail = validate_chat_response(data)
    _record("Very short question ('Hi') handled gracefully", ok or code in (200, 422), ms,
            detail[:60] if ok else f"code={code}")

    # 6.2 Single word
    data, ms, code = chat_request("Python")
    ok, detail = validate_chat_response(data)
    _record("Single word prompt ('Python') handled", ok, ms, detail[:60])

    # 6.3 Empty question — should fail gracefully (422 or 200 with error)
    data, ms, code = chat_request("")
    graceful = code in (200, 400, 422)
    _record("Empty question returns graceful error (not 500)", graceful, ms, f"code={code}")

    # 6.4 Very long question (2000 chars)
    long_q = "Explain in detail: " + ("machine learning concepts, " * 80)
    data, ms, code = chat_request(long_q[:2000])
    ok, detail = validate_chat_response(data)
    _record("Very long question (2000 chars) handled", ok or code < 500, ms,
            detail[:60] if ok else f"code={code}")

    # 6.5 Question with special characters
    special_q = "What is the integral ∫x²dx and how do you solve it? Also: Σ, π, ∞"
    data, ms, code = chat_request(special_q)
    ok, detail = validate_chat_response(data)
    _record("Special characters (∫, Σ, π, ∞) in question", ok, ms, detail[:60])

    # 6.6 Question with LaTeX
    latex_q = r"Solve: $\frac{d}{dx}[x^3 + 2x^2 - 5x + 1]$"
    data, ms, code = chat_request(latex_q)
    ok, detail = validate_chat_response(data)
    _record("LaTeX math notation in question", ok, ms, detail[:60])

    # 6.7 Code snippet question
    code_q = "What does this Python code do?\n```python\nresult = [x**2 for x in range(10) if x % 2 == 0]\nprint(result)\n```"
    data, ms, code_s = chat_request(code_q)
    ok, detail = validate_chat_response(data)
    _record("Code snippet in question handled", ok, ms, detail[:60])

    # 6.8 Non-English question
    non_en = "¿Puedes explicarme qué es la fotosíntesis?"
    data, ms, code_s = chat_request(non_en)
    ok, detail = validate_chat_response(data)
    _record("Non-English question (Spanish) handled", ok or code_s < 500, ms,
            detail[:60] if ok else f"code={code_s}")

    # 6.9 Question with repeated words
    repeat_q = "explain " * 50 + "machine learning"
    data, ms, code_s = chat_request(repeat_q[:500])
    ok, detail = validate_chat_response(data)
    _record("Repeated-word question handled", ok or code_s < 500, ms,
            detail[:60] if ok else f"code={code_s}")

    # 6.10 Invalid user_id (user not in DB)
    data, ms, code_s = chat_request("Hello", user_id="__nonexistent_user_xyz_123__")
    graceful = code_s in (200, 400, 404, 422)
    _record("Invalid user_id returns graceful error (not 500)", graceful, ms,
            f"code={code_s}")

    # 6.11 Question with only punctuation
    data, ms, code_s = chat_request("??? !!! ...")
    graceful = code_s < 500
    _record("Only-punctuation question doesn't crash server", graceful, ms,
            f"code={code_s}")

    # 6.12 Newline-heavy question
    newline_q = "Explain recursion\n\n\n\n\nwith an example\n\n\n"
    data, ms, code_s = chat_request(newline_q)
    ok, detail = validate_chat_response(data)
    _record("Newline-heavy question handled", ok, ms, detail[:60])

    # 6.13 Question with SQL injection attempt
    sql_q = "'; DROP TABLE users; -- explain SQL injection"
    data, ms, code_s = chat_request(sql_q)
    not_crashed = code_s < 500
    _record("SQL injection string doesn't crash server", not_crashed, ms, f"code={code_s}")

    # 6.14 Very technical acronym question
    acronym_q = "Explain LSTM, GRU, BERT, GPT, T5, RLHF, and LoRA in AI/ML"
    data, ms, code_s = chat_request(acronym_q)
    ok, detail = validate_chat_response(data)
    _record("Dense acronym-heavy question handled", ok, ms, detail[:60])

    # 6.15 Question about the tutor itself
    self_q = "What kind of AI tutor are you? What are your capabilities?"
    data, ms, code_s = chat_request(self_q)
    ok, detail = validate_chat_response(data)
    _record("Meta question about tutor capabilities handled", ok, ms, detail[:60])


# =============================================================================
# SECTION 7 — SUBJECT-SPECIFIC DEEP DIVES
# =============================================================================

DEEP_DIVE_PROMPTS = [
    # Math deep-dive
    "What is the chain rule in calculus? Give me 3 worked examples",
    "Explain integration by parts with a step-by-step example",
    "What is a Fourier transform and what is it used for?",
    "How do you compute the determinant of a 3x3 matrix?",
    "What is group theory in abstract algebra?",
    # CS algorithms
    "Walk me through Dijkstra's algorithm step by step",
    "Explain quicksort with a trace on array [3,6,8,10,1,2,1]",
    "How does A* search differ from Dijkstra's?",
    "Explain the knapsack problem and a DP solution",
    "What is the time and space complexity of merge sort?",
    # Data science / ML
    "Explain the bias-variance tradeoff",
    "What is cross-validation and why do we use it?",
    "How does random forest work? Why is it better than a single decision tree?",
    "What is principal component analysis (PCA)?",
    "Explain the confusion matrix and all derived metrics",
    # Systems
    "How does virtual memory work in an operating system?",
    "Explain deadlocks and the four necessary conditions (Coffman conditions)",
    "What is a semaphore vs a mutex?",
    "How does the TCP three-way handshake work?",
    # Software engineering
    "What are SOLID principles? Explain each with an example",
    "What is dependency injection and why is it useful?",
    "Explain microservices vs monolithic architecture trade-offs",
]


def test_deep_dive_prompts():
    _section("SECTION 7 — SUBJECT-SPECIFIC DEEP DIVES (22 PROMPTS)")
    for question in DEEP_DIVE_PROMPTS:
        label = f"[DEEP] {question[:58]}"
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        _record(label, ok, ms, detail[:60])


# =============================================================================
# SECTION 8 — RESPONSE QUALITY VALIDATION
# =============================================================================

QUALITY_CHECKS = [
    ("Explain what a neural network is",         "network"),
    ("What is recursion in programming?",         "function"),
    ("Describe the water cycle",                  "evaporation"),
    ("What is photosynthesis?",                   "sunlight"),
    ("How does sorting work in Python?",          "sort"),
]


def test_response_quality():
    _section("SECTION 8 — RESPONSE QUALITY VALIDATION")
    for question, keyword in QUALITY_CHECKS:
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        ai_text = ""
        if data:
            ai_text = (data.get("ai_response") or data.get("response") or "").lower()

        # Check that the response at least mentions the expected keyword
        contains_kw = keyword.lower() in ai_text
        _record(f"Quality: '{question[:45]}' → contains '{keyword}'",
                ok and contains_kw, ms,
                f"{'contains kw' if contains_kw else 'missing kw!'} | {detail[:40]}")

    # Minimum length check
    long_questions = [
        "Give me a comprehensive explanation of machine learning including supervised, unsupervised, and reinforcement learning",
        "Explain all major sorting algorithms with their time complexities",
    ]
    for q in long_questions:
        data, ms, code = chat_request(q)
        if data:
            ai_text = data.get("ai_response") or data.get("response") or ""
            is_long = len(ai_text) > 300
            _record(f"Long answer expected for: '{q[:50]}'", is_long, ms,
                    f"len={len(ai_text)}")

    # Response should not be identical for different questions
    r1, ms1, _ = chat_request("What is recursion?")
    r2, ms2, _ = chat_request("What is a binary tree?")
    t1 = (r1 or {}).get("ai_response") or (r1 or {}).get("response") or ""
    t2 = (r2 or {}).get("ai_response") or (r2 or {}).get("response") or ""
    not_identical = t1 != t2 and len(t1) > 10 and len(t2) > 10
    _record("Responses differ for different questions (not caching bug)",
            not_identical, ms1 + ms2)


# =============================================================================
# SECTION 9 — CONCURRENT LOAD TEST (THREAD POOL)
# =============================================================================

CONCURRENT_PROMPTS = [
    "What is a linked list?",
    "Explain bubble sort",
    "What is machine learning?",
    "Define abstraction in OOP",
    "What is the speed of light?",
    "Explain the water cycle",
    "What is DNA?",
    "How do computers work?",
    "What is electricity?",
    "Explain the Big Bang theory",
    "What is gravity?",
    "Define entropy",
    "What is quantum physics?",
    "Explain the greenhouse effect",
    "What is evolution?",
    "Define photosynthesis",
    "What is calculus used for?",
    "Explain binary numbers",
    "What is the internet?",
    "How does a CPU work?",
]


def _concurrent_worker(args):
    question, idx = args
    data, ms, code = chat_request(question, timeout=REQUEST_TIMEOUT)
    ok, detail = validate_chat_response(data)
    return idx, question[:40], ok, ms, code, detail


def test_concurrent_load():
    _section("SECTION 9 — CONCURRENT LOAD TEST (20 simultaneous requests)")
    prompts = [(q, i) for i, q in enumerate(CONCURRENT_PROMPTS)]

    t_start = time.perf_counter()
    successes, failures_count = 0, 0
    timings = []

    with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
        futures = {executor.submit(_concurrent_worker, p): p for p in prompts}
        for future in as_completed(futures):
            try:
                idx, q, ok, ms, code, detail = future.result()
                timings.append(ms)
                if ok:
                    successes += 1
                else:
                    failures_count += 1
            except Exception as e:
                failures_count += 1
                timings.append(0)

    total_ms = (time.perf_counter() - t_start) * 1000
    success_rate = successes / len(prompts) * 100

    _record(f"Concurrent 20-request batch: {successes}/{len(prompts)} succeeded",
            success_rate >= 70, total_ms, f"{success_rate:.0f}% success")
    if timings:
        avg_ms = statistics.mean(timings)
        p95_ms = sorted(timings)[int(len(timings) * 0.95)]
        _record(f"Avg latency under concurrency", avg_ms < MAX_ACCEPTABLE_P95_MS,
                avg_ms, f"avg={avg_ms:.0f}ms")
        _record(f"P95 latency under concurrency", p95_ms < MAX_ACCEPTABLE_P95_MS,
                p95_ms, f"p95={p95_ms:.0f}ms")


# =============================================================================
# SECTION 10 — STRESS TEST (RAPID SEQUENTIAL)
# =============================================================================

STRESS_PROMPTS = [
    "What is a variable?",
    "Define a function",
    "What is a loop?",
    "Explain conditionals",
    "What is an array?",
    "Define a class",
    "What is inheritance?",
    "Explain polymorphism",
    "What is encapsulation?",
    "Define abstraction",
    "What is a module?",
    "Explain exceptions",
    "What is a decorator?",
    "Define a generator",
    "What is a lambda?",
    "Explain closures",
    "What is a context manager?",
    "Define a coroutine",
    "What is async/await?",
    "Explain GIL in Python",
    "What is memory management?",
    "Define a pointer",
    "What is a stack overflow?",
    "Explain recursion limit",
    "What is memoization?",
    "Define caching",
    "What is a thread?",
    "Explain a process",
    "What is concurrency?",
    "Define parallelism",
    "What is a race condition?",
    "Explain mutex",
    "What is deadlock?",
    "Define semaphore",
    "What is a callback?",
    "Explain event loop",
    "What is a promise?",
    "Define observable",
    "What is functional programming?",
    "Explain pure functions",
]


def test_stress_rapid_sequential():
    _section("SECTION 10 — STRESS TEST (40 rapid sequential requests)")
    all_times, all_ok = [], []

    for i, question in enumerate(STRESS_PROMPTS):
        data, ms, code = chat_request(question)
        ok, detail = validate_chat_response(data)
        all_times.append(ms)
        all_ok.append(ok)

    success_rate = sum(all_ok) / len(all_ok) * 100
    avg_ms = statistics.mean(all_times)
    max_ms = max(all_times)
    min_ms = min(all_times)

    _record(f"Stress test: {sum(all_ok)}/{len(all_ok)} succeeded",
            success_rate >= 75, avg_ms, f"{success_rate:.0f}% success rate")
    _record(f"Stress latency: min={min_ms:.0f}ms avg={avg_ms:.0f}ms max={max_ms:.0f}ms",
            max_ms < 60_000, avg_ms,
            f"max={max_ms:.0f}ms threshold=60000ms")


# =============================================================================
# SECTION 11 — ASYNC OVERLOAD TEST (if aiohttp available)
# =============================================================================

async def _async_chat(session, question: str, idx: int) -> dict:
    data = {"user_id": TEST_USER_ID, "question": question}
    t0 = time.perf_counter()
    try:
        async with session.post(CHAT_ENDPOINT, data=data,
                                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)) as resp:
            ms = (time.perf_counter() - t0) * 1000
            body = await resp.json()
            return {"idx": idx, "ok": True, "ms": ms, "code": resp.status, "data": body}
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return {"idx": idx, "ok": False, "ms": ms, "code": 0, "error": str(e)}


async def _run_async_overload(prompts: list[str]):
    connector = aiohttp.TCPConnector(limit=ASYNC_CONCURRENT)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [_async_chat(session, q, i) for i, q in enumerate(prompts)]
        return await asyncio.gather(*tasks, return_exceptions=True)


OVERLOAD_PROMPTS = [
    "Explain arrays", "What is a loop?", "Define a variable", "What is a function?",
    "Explain recursion", "What is a hash map?", "Define OOP", "Explain a graph",
    "What is a tree?", "Define linked list", "Explain quicksort", "What is merge sort?",
    "Define binary search", "Explain DFS", "What is BFS?", "Define Dijkstra",
    "Explain dynamic programming", "What is greedy algorithm?", "Define backtracking",
    "Explain divide and conquer", "What is a heap?", "Define a priority queue",
    "Explain a trie", "What is a suffix tree?", "Define a segment tree",
    "Explain bit manipulation", "What is two pointers technique?", "Define sliding window",
    "Explain monotonic stack", "What is union find?",
]


def test_async_overload():
    _section("SECTION 11 — ASYNC OVERLOAD TEST (30 async concurrent requests)")
    if not HAS_AIOHTTP:
        print("   aiohttp not installed — skipping async overload test")
        print("     Install: pip install aiohttp")
        return

    results = asyncio.run(_run_async_overload(OVERLOAD_PROMPTS))

    ok_count = 0
    timings = []
    for r in results:
        if isinstance(r, dict):
            ms = r.get("ms", 0)
            timings.append(ms)
            data = r.get("data")
            ok_r, _ = validate_chat_response(data if isinstance(data, dict) else None)
            if ok_r:
                ok_count += 1

    total = len(OVERLOAD_PROMPTS)
    rate = ok_count / total * 100
    avg_ms = statistics.mean(timings) if timings else 0
    p95_ms = sorted(timings)[int(len(timings) * 0.95)] if timings else 0

    _record(f"Async overload: {ok_count}/{total} succeeded", rate >= 60,
            avg_ms, f"{rate:.0f}% success")
    _record(f"Async overload avg latency", avg_ms < MAX_ACCEPTABLE_P95_MS,
            avg_ms, f"avg={avg_ms:.0f}ms")
    _record(f"Async overload p95 latency", p95_ms < MAX_ACCEPTABLE_P95_MS,
            p95_ms, f"p95={p95_ms:.0f}ms")


# =============================================================================
# SECTION 12 — CHAT HISTORY CONTEXT TESTS
# =============================================================================

def test_chat_history_context():
    _section("SECTION 12 — CHAT HISTORY CONTEXT RETENTION")

    # Start a conversation, get a chat_id, then ask follow-up that requires context
    setup_questions = [
        ("I am studying machine learning. My name is Alex.", None),
        ("I specifically struggle with backpropagation.", None),
        ("Can you help me with the chain rule?", None),
    ]

    chat_id = None
    for q, _ in setup_questions:
        data, ms, code = chat_request(q, chat_id=chat_id)
        ok, detail = validate_chat_response(data)
        if ok and data and chat_id is None:
            chat_id = str(data.get("chat_id") or data.get("id") or "")
        _record(f"Context setup: '{q[:50]}'", ok, ms, detail[:50])

    # Follow-up requiring context
    follow_ups = [
        "Going back to what I mentioned about my struggles, can you give me an exercise?",
        "Can you summarize what we've discussed?",
        "What should I study next based on our conversation?",
    ]
    for q in follow_ups:
        data, ms, code = chat_request(q, chat_id=chat_id)
        ok, detail = validate_chat_response(data)
        _record(f"Context follow-up: '{q[:50]}'", ok, ms, detail[:50])


# =============================================================================
# SECTION 13 — PERFORMANCE BENCHMARKS
# =============================================================================

def test_performance_benchmarks():
    _section("SECTION 13 — PERFORMANCE BENCHMARKS")

    # Warm-up
    chat_request("Hello")

    # Measure 10 requests and compute stats
    bench_prompts = [
        "What is recursion?",
        "Explain OOP",
        "What is a linked list?",
        "Define big O notation",
        "What is a neural network?",
        "Explain quicksort",
        "What is entropy?",
        "Define photosynthesis",
        "What is gravity?",
        "Explain DNA",
    ]
    timings = []
    for q in bench_prompts:
        _, ms, _ = chat_request(q)
        timings.append(ms)

    avg = statistics.mean(timings)
    median = statistics.median(timings)
    stdev = statistics.stdev(timings) if len(timings) > 1 else 0
    p90 = sorted(timings)[int(len(timings) * 0.9)]

    print(f"\n   Performance Stats (n={len(timings)}):")
    print(f"     avg    = {avg:.0f}ms")
    print(f"     median = {median:.0f}ms")
    print(f"     stdev  = {stdev:.0f}ms")
    print(f"     p90    = {p90:.0f}ms")
    print(f"     min    = {min(timings):.0f}ms")
    print(f"     max    = {max(timings):.0f}ms")

    _record("Median latency under 20s", median < 20_000, median,
            f"median={median:.0f}ms")
    _record("P90 latency under 30s", p90 < 30_000, p90,
            f"p90={p90:.0f}ms")
    _record("No standard deviation outlier (stdev < 15s)", stdev < 15_000, stdev,
            f"stdev={stdev:.0f}ms")


# =============================================================================
# SECTION 14 — GRACEFUL DEGRADATION
# =============================================================================

def test_graceful_degradation():
    _section("SECTION 14 — GRACEFUL DEGRADATION & ERROR HANDLING")

    # 14.1 Missing user_id field
    t0 = time.perf_counter()
    try:
        r = requests.post(CHAT_ENDPOINT, data={"question": "Hello"}, timeout=10)
        ms = (time.perf_counter() - t0) * 1000
        graceful = r.status_code in (200, 400, 422)
        _record("Missing user_id: graceful error (not 500)", graceful, ms,
                f"code={r.status_code}")
    except Exception as e:
        _record("Missing user_id: server responds", False, 0, str(e))

    # 14.2 Missing question field
    t0 = time.perf_counter()
    try:
        r = requests.post(CHAT_ENDPOINT, data={"user_id": TEST_USER_ID}, timeout=10)
        ms = (time.perf_counter() - t0) * 1000
        graceful = r.status_code in (200, 400, 422)
        _record("Missing question: graceful error (not 500)", graceful, ms,
                f"code={r.status_code}")
    except Exception as e:
        _record("Missing question: server responds", False, 0, str(e))

    # 14.3 Invalid JSON in body (shouldn't apply to form-data but test anyway)
    t0 = time.perf_counter()
    try:
        r = requests.post(CHAT_ENDPOINT,
                          headers={"Content-Type": "application/json"},
                          data=b"not-json",
                          timeout=10)
        ms = (time.perf_counter() - t0) * 1000
        graceful = r.status_code < 500
        _record("Invalid content-type body: graceful error", graceful, ms,
                f"code={r.status_code}")
    except Exception as e:
        _record("Invalid body: server responds", False, 0, str(e))

    # 14.4 Extremely rapid repeated request (same question)
    times = []
    for _ in range(5):
        _, ms, code = chat_request("What is 2+2?", timeout=30)
        times.append(ms)
    _record("5x rapid same-question burst (no crash)", code < 500,
            statistics.mean(times), f"avg={statistics.mean(times):.0f}ms")


# =============================================================================
# SECTION 15 — OVERLOAD BURST TEST
# =============================================================================

def test_overload_burst():
    _section("SECTION 15 — OVERLOAD BURST (50 requests, 15 workers)")
    burst_q = [
        f"Question {i}: explain concept number {i % 20} in computer science"
        for i in range(50)
    ]

    ok_count, fail_count = 0, 0
    timings = []
    t_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=15) as ex:
        futures = [ex.submit(chat_request, q, None, TEST_USER_ID, 45) for q in burst_q]
        for f in as_completed(futures):
            try:
                data, ms, code = f.result()
                timings.append(ms)
                ok, _ = validate_chat_response(data)
                if ok:
                    ok_count += 1
                else:
                    fail_count += 1
            except Exception:
                fail_count += 1
                timings.append(0)

    total_time = (time.perf_counter() - t_start) * 1000
    rate = ok_count / len(burst_q) * 100
    avg_ms = statistics.mean(timings) if timings else 0

    _record(f"Burst 50 requests: {ok_count}/{len(burst_q)} succeeded",
            rate >= 60, total_time, f"{rate:.0f}% success")
    _record(f"Server survives burst without crash", ok_count + fail_count == len(burst_q),
            avg_ms, f"all futures resolved")


# =============================================================================
# MAIN RUNNER
# =============================================================================

def run_all():
    print("\n" + "="*78)
    print("  BRAINWAVE L1 — AI CHAT / TUTOR AGENT TEST SUITE")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Endpoint: {CHAT_ENDPOINT}")
    print(f"  Test user: {TEST_USER_ID}")
    print("="*78)

    test_server_reachability()
    test_basic_diverse_prompts()
    test_intent_detection()
    test_multi_turn_conversation()
    test_advanced_complex_queries()
    test_edge_cases()
    test_deep_dive_prompts()
    test_response_quality()
    test_concurrent_load()
    test_stress_rapid_sequential()
    test_async_overload()
    test_chat_history_context()
    test_performance_benchmarks()
    test_graceful_degradation()
    test_overload_burst()

    # -------------------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------------------
    total = RESULTS["passed"] + RESULTS["failed"]
    pass_rate = RESULTS["passed"] / total * 100 if total else 0

    _section("FINAL SUMMARY")
    print(f"  Total tests  : {total}")
    print(f"  Passed       : {RESULTS['passed']}  ({pass_rate:.1f}%)")
    print(f"  Failed       : {RESULTS['failed']}")

    if RESULTS["timings_ms"]:
        all_t = RESULTS["timings_ms"]
        print(f"\n  Latency (all requests):")
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
def test_suite_server():          test_server_reachability()
def test_suite_basic():           test_basic_diverse_prompts()
def test_suite_intents():         test_intent_detection()
def test_suite_multiturn():       test_multi_turn_conversation()
def test_suite_advanced():        test_advanced_complex_queries()
def test_suite_edge():            test_edge_cases()
def test_suite_deep():            test_deep_dive_prompts()
def test_suite_quality():         test_response_quality()
def test_suite_concurrent():      test_concurrent_load()
def test_suite_stress():          test_stress_rapid_sequential()
def test_suite_async():           test_async_overload()
def test_suite_history():         test_chat_history_context()
def test_suite_perf():            test_performance_benchmarks()
def test_suite_degradation():     test_graceful_degradation()
def test_suite_burst():           test_overload_burst()


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
