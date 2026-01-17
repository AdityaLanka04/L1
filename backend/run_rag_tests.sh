#!/bin/bash

# RAG System Test Runner
# This script runs comprehensive tests on the RAG system

echo "=========================================="
echo "  RAG System Test Runner"
echo "=========================================="
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check if server is running
echo "🔍 Checking if backend server is running..."
if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running!"
    echo ""
    echo "Please start the server first:"
    echo "  cd backend"
    echo "  python main.py"
    echo ""
    exit 1
fi

echo ""
echo "🚀 Starting RAG system tests..."
echo ""

# Run the test script
python3 test_rag_system.py

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All tests completed successfully!"
else
    echo "❌ Some tests failed. Check the output above."
fi

exit $EXIT_CODE
