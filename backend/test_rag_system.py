#!/usr/bin/env python3
"""
Complete RAG System Test Script
Tests all components of the Advanced RAG system
"""

import asyncio
import sys
import time
import json
from datetime import datetime
from typing import Dict, Any, List
import requests

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USER_ID = "1"
TEST_SESSION_ID = "test_session"

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    """Print section header"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}\n")

def print_test(test_name: str):
    """Print test name"""
    print(f"{Colors.BLUE}▶ Testing: {Colors.BOLD}{test_name}{Colors.END}")

def print_success(message: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    """Print error message"""
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def print_info(message: str):
    """Print info message"""
    print(f"  {message}")

# Test Results Tracker
class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.tests = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.total += 1
        self.passed += 1
        self.tests.append({"name": test_name, "status": "PASS", "details": details})
        print_success(f"{test_name} - PASSED")
        if details:
            print_info(details)
    
    def add_fail(self, test_name: str, error: str):
        self.total += 1
        self.failed += 1
        self.tests.append({"name": test_name, "status": "FAIL", "error": error})
        print_error(f"{test_name} - FAILED")
        print_info(f"Error: {error}")
    
    def add_warning(self, test_name: str, warning: str):
        self.warnings += 1
        self.tests.append({"name": test_name, "status": "WARNING", "warning": warning})
        print_warning(f"{test_name} - WARNING")
        print_info(f"Warning: {warning}")
    
    def print_summary(self):
        """Print final test summary"""
        print_header("TEST SUMMARY")
        
        total_tests = self.total
        pass_rate = (self.passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {Colors.BOLD}{total_tests}{Colors.END}")
        print(f"Passed: {Colors.GREEN}{self.passed}{Colors.END}")
        print(f"Failed: {Colors.RED}{self.failed}{Colors.END}")
        print(f"Warnings: {Colors.YELLOW}{self.warnings}{Colors.END}")
        print(f"Pass Rate: {Colors.BOLD}{pass_rate:.1f}%{Colors.END}\n")
        
        if self.failed == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! RAG SYSTEM IS WORKING PROPERLY{Colors.END}\n")
        else:
            print(f"{Colors.RED}{Colors.BOLD}⚠️  SOME TESTS FAILED - CHECK ERRORS ABOVE{Colors.END}\n")

results = TestResults()

# ==================== TEST FUNCTIONS ====================

def test_server_running():
    """Test 1: Check if server is running"""
    print_test("Server Running")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code in [200, 404]:  # 404 is ok, means server is up
            results.add_pass("Server Running", f"Server is up at {BASE_URL}")
        else:
            results.add_fail("Server Running", f"Unexpected status code: {response.status_code}")
    except requests.exceptions.ConnectionError:
        results.add_fail("Server Running", f"Cannot connect to {BASE_URL}. Is the server running?")
        print_error(f"\n💡 Start the server with: cd backend && python main.py\n")
        sys.exit(1)
    except Exception as e:
        results.add_fail("Server Running", str(e))

def test_rag_stats():
    """Test 2: Check RAG system statistics"""
    print_test("RAG System Statistics")
    try:
        response = requests.get(f"{BASE_URL}/api/rag/stats", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            if data.get("status") == "healthy":
                results.add_pass("RAG Stats - Status", "RAG system is healthy")
            else:
                results.add_warning("RAG Stats - Status", f"Status: {data.get('status')}")
            
            # Check reranker
            if data.get("reranker_available"):
                results.add_pass("RAG Stats - Reranker", "Cross-encoder reranker is available")
            else:
                results.add_warning("RAG Stats - Reranker", "Reranker not available (install sentence-transformers)")
            
            # Check GraphRAG
            if data.get("graph_rag_available"):
                results.add_pass("RAG Stats - GraphRAG", "Knowledge graph integration is available")
            else:
                results.add_warning("RAG Stats - GraphRAG", "GraphRAG not available (Neo4j not connected)")
            
            print_info(f"Cache size: {data.get('cache_size', 0)}")
            print_info(f"Agentic decisions: {data.get('agentic_decisions', 0)}")
            
        else:
            results.add_fail("RAG Stats", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("RAG Stats", str(e))

def test_auto_indexer_status():
    """Test 3: Check auto-indexer status"""
    print_test("Auto-Indexer Status")
    try:
        response = requests.get(f"{BASE_URL}/api/rag/auto-indexer/status", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") == "initialized":
                results.add_pass("Auto-Indexer - Initialized", "Auto-indexer is initialized")
            else:
                results.add_fail("Auto-Indexer - Initialized", f"Status: {data.get('status')}")
            
            if data.get("is_running"):
                results.add_pass("Auto-Indexer - Running", f"Running with {data.get('interval_minutes')}min interval")
            else:
                results.add_warning("Auto-Indexer - Running", "Auto-indexer is not running")
        else:
            results.add_fail("Auto-Indexer Status", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("Auto-Indexer Status", str(e))

def test_search_modes():
    """Test 4: Test all search modes"""
    print_test("Search Modes")
    
    modes = ["semantic", "keyword", "hybrid", "graph", "agentic"]
    test_query = "explain sorting algorithms"
    
    for mode in modes:
        try:
            response = requests.post(
                f"{BASE_URL}/api/rag/retrieve",
                json={
                    "query": test_query,
                    "mode": mode,
                    "top_k": 3,
                    "user_id": TEST_USER_ID
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                results_count = data.get("total", 0)
                from_cache = data.get("from_cache", False)
                
                details = f"Mode: {mode}, Results: {results_count}, Cached: {from_cache}"
                
                if mode == "agentic" and "strategy" in data:
                    strategy = data["strategy"]
                    details += f", Strategy: {strategy.get('method', 'unknown')}"
                
                results.add_pass(f"Search Mode - {mode.capitalize()}", details)
            else:
                results.add_fail(f"Search Mode - {mode.capitalize()}", f"Status: {response.status_code}")
        except Exception as e:
            results.add_fail(f"Search Mode - {mode.capitalize()}", str(e))

def test_caching():
    """Test 5: Test result caching"""
    print_test("Result Caching")
    
    test_query = "test caching query"
    
    try:
        # First request (should not be cached)
        start_time = time.time()
        response1 = requests.post(
            f"{BASE_URL}/api/rag/retrieve",
            json={
                "query": test_query,
                "mode": "hybrid",
                "top_k": 5,
                "use_cache": True
            },
            timeout=10
        )
        time1 = (time.time() - start_time) * 1000
        
        if response1.status_code == 200:
            data1 = response1.json()
            if not data1.get("from_cache", True):
                results.add_pass("Caching - First Request", f"Not cached (as expected), Time: {time1:.0f}ms")
            else:
                results.add_warning("Caching - First Request", "Unexpectedly cached")
        
        # Second request (should be cached)
        time.sleep(0.5)
        start_time = time.time()
        response2 = requests.post(
            f"{BASE_URL}/api/rag/retrieve",
            json={
                "query": test_query,
                "mode": "hybrid",
                "top_k": 5,
                "use_cache": True
            },
            timeout=10
        )
        time2 = (time.time() - start_time) * 1000
        
        if response2.status_code == 200:
            data2 = response2.json()
            if data2.get("from_cache", False):
                speedup = time1 / time2 if time2 > 0 else 0
                results.add_pass("Caching - Second Request", f"Cached! Time: {time2:.0f}ms (speedup: {speedup:.1f}x)")
            else:
                results.add_warning("Caching - Second Request", "Not cached (cache may have expired)")
    except Exception as e:
        results.add_fail("Caching", str(e))

def test_user_rag_stats():
    """Test 6: Check user-specific RAG stats"""
    print_test("User RAG Statistics")
    try:
        response = requests.get(f"{BASE_URL}/api/rag/user/stats/{TEST_USER_ID}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            indexed_items = data.get("indexed_items", 0)
            has_collection = data.get("has_collection", False)
            
            if has_collection:
                results.add_pass("User RAG - Collection", f"User has ChromaDB collection: {data.get('collection_name')}")
            else:
                results.add_warning("User RAG - Collection", "User collection not created yet")
            
            if indexed_items > 0:
                results.add_pass("User RAG - Indexed Items", f"{indexed_items} items indexed")
            else:
                results.add_warning("User RAG - Indexed Items", "No items indexed yet (create some content)")
            
            print_info(f"Retrieval count: {data.get('retrieval_count', 0)}")
            print_info(f"Preferences: {json.dumps(data.get('preferences', {}))}")
        else:
            results.add_fail("User RAG Stats", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("User RAG Stats", str(e))

def test_user_retrieval():
    """Test 7: Test user-specific retrieval"""
    print_test("User-Specific Retrieval")
    try:
        response = requests.post(
            f"{BASE_URL}/api/rag/user/retrieve",
            json={
                "user_id": TEST_USER_ID,
                "query": "test retrieval",
                "top_k": 5
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            results_count = len(data.get("results", []))
            
            if results_count > 0:
                results.add_pass("User Retrieval", f"Retrieved {results_count} results from user's content")
                
                # Show first result
                if data.get("results"):
                    first = data["results"][0]
                    print_info(f"Sample result: {first.get('metadata', {}).get('type', 'unknown')} - Score: {first.get('score', 0):.2f}")
            else:
                results.add_warning("User Retrieval", "No results (user may not have content yet)")
        else:
            results.add_fail("User Retrieval", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("User Retrieval", str(e))

def test_learning_context():
    """Test 8: Test learning context API"""
    print_test("Learning Context API")
    try:
        response = requests.post(
            f"{BASE_URL}/api/rag/learning-context",
            json={
                "query": "binary search trees",
                "user_id": TEST_USER_ID
            },
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            
            retrieved_count = len(data.get("retrieved_content", []))
            graph_context = data.get("graph_context", {})
            metadata = data.get("retrieval_metadata", {})
            
            results.add_pass("Learning Context", f"Retrieved {retrieved_count} items")
            
            if graph_context:
                print_info(f"Main concept: {graph_context.get('main_concept', 'N/A')}")
                print_info(f"Related concepts: {len(graph_context.get('related_concepts', []))}")
                print_info(f"Learning path steps: {len(graph_context.get('learning_path', []))}")
            
            print_info(f"Retrieval mode: {metadata.get('mode', 'unknown')}")
        else:
            results.add_fail("Learning Context", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("Learning Context", str(e))

def test_context_string():
    """Test 9: Test context string generation"""
    print_test("Context String Generation")
    try:
        response = requests.get(
            f"{BASE_URL}/api/rag/context",
            params={
                "query": "explain algorithms",
                "user_id": TEST_USER_ID,
                "max_length": 1000
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            context = data.get("context", "")
            length = data.get("length", 0)
            
            if length > 0:
                results.add_pass("Context String", f"Generated {length} chars of context")
                print_info(f"Preview: {context[:100]}...")
            else:
                results.add_warning("Context String", "Empty context (no relevant content found)")
        else:
            results.add_fail("Context String", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("Context String", str(e))

def test_manual_indexing():
    """Test 10: Test manual indexing trigger"""
    print_test("Manual Indexing Trigger")
    try:
        response = requests.post(
            f"{BASE_URL}/api/rag/user/auto-index/{TEST_USER_ID}",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "auto_indexed":
                results.add_pass("Manual Indexing", f"Successfully indexed content for user {TEST_USER_ID}")
            else:
                results.add_warning("Manual Indexing", f"Status: {data.get('status')}")
        else:
            results.add_fail("Manual Indexing", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("Manual Indexing", str(e))

def test_performance():
    """Test 11: Performance benchmarks"""
    print_test("Performance Benchmarks")
    
    queries = [
        ("semantic", "explain data structures"),
        ("keyword", "binary search"),
        ("hybrid", "sorting algorithms"),
        ("agentic", "what is recursion")
    ]
    
    for mode, query in queries:
        try:
            start_time = time.time()
            response = requests.post(
                f"{BASE_URL}/api/rag/retrieve",
                json={
                    "query": query,
                    "mode": mode,
                    "top_k": 5,
                    "use_cache": False
                },
                timeout=20
            )
            elapsed = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                # Performance thresholds
                thresholds = {
                    "semantic": 1000,
                    "keyword": 500,
                    "hybrid": 1500,
                    "agentic": 2000
                }
                
                threshold = thresholds.get(mode, 2000)
                
                if elapsed < threshold:
                    results.add_pass(f"Performance - {mode.capitalize()}", f"{elapsed:.0f}ms (threshold: {threshold}ms)")
                else:
                    results.add_warning(f"Performance - {mode.capitalize()}", f"{elapsed:.0f}ms (slower than {threshold}ms)")
            else:
                results.add_fail(f"Performance - {mode.capitalize()}", f"Request failed")
        except Exception as e:
            results.add_fail(f"Performance - {mode.capitalize()}", str(e))

def test_agentic_decision():
    """Test 12: Test agentic decision making"""
    print_test("Agentic Decision Making")
    
    test_cases = [
        ("what is binary search", "Should choose graph/semantic for conceptual query"),
        ("find examples of sorting", "Should choose hybrid for content search"),
        ("BST", "Should choose keyword for short query")
    ]
    
    for query, expected in test_cases:
        try:
            response = requests.post(
                f"{BASE_URL}/api/rag/retrieve",
                json={
                    "query": query,
                    "mode": "agentic",
                    "top_k": 3,
                    "user_id": TEST_USER_ID
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                strategy = data.get("strategy", {})
                method = strategy.get("method", "unknown")
                reasoning = strategy.get("reasoning", "")
                
                results.add_pass(f"Agentic - '{query[:20]}...'", f"Chose: {method}")
                print_info(f"Reasoning: {reasoning}")
            else:
                results.add_fail(f"Agentic - '{query[:20]}...'", f"Status: {response.status_code}")
        except Exception as e:
            results.add_fail(f"Agentic - '{query[:20]}...'", str(e))

def test_error_handling():
    """Test 13: Test error handling"""
    print_test("Error Handling")
    
    # Test invalid mode
    try:
        response = requests.post(
            f"{BASE_URL}/api/rag/retrieve",
            json={
                "query": "test",
                "mode": "invalid_mode",
                "top_k": 5
            },
            timeout=10
        )
        
        # Should either handle gracefully or return error
        if response.status_code in [200, 400, 422]:
            results.add_pass("Error Handling - Invalid Mode", "Handled gracefully")
        else:
            results.add_warning("Error Handling - Invalid Mode", f"Unexpected status: {response.status_code}")
    except Exception as e:
        results.add_fail("Error Handling - Invalid Mode", str(e))
    
    # Test missing required fields
    try:
        response = requests.post(
            f"{BASE_URL}/api/rag/retrieve",
            json={
                "mode": "semantic"
                # Missing query
            },
            timeout=10
        )
        
        if response.status_code in [400, 422]:
            results.add_pass("Error Handling - Missing Fields", "Validation working")
        else:
            results.add_warning("Error Handling - Missing Fields", f"Status: {response.status_code}")
    except Exception as e:
        results.add_fail("Error Handling - Missing Fields", str(e))

# ==================== MAIN TEST RUNNER ====================

def main():
    """Run all tests"""
    print_header("RAG SYSTEM COMPREHENSIVE TEST SUITE")
    print(f"Testing server at: {Colors.BOLD}{BASE_URL}{Colors.END}")
    print(f"Test user ID: {Colors.BOLD}{TEST_USER_ID}{Colors.END}")
    print(f"Timestamp: {Colors.BOLD}{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
    
    # Run all tests
    test_server_running()
    test_rag_stats()
    test_auto_indexer_status()
    test_search_modes()
    test_caching()
    test_user_rag_stats()
    test_user_retrieval()
    test_learning_context()
    test_context_string()
    test_manual_indexing()
    test_performance()
    test_agentic_decision()
    test_error_handling()
    
    # Print summary
    results.print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if results.failed == 0 else 1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Test interrupted by user{Colors.END}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n{Colors.RED}Fatal error: {e}{Colors.END}\n")
        sys.exit(1)
