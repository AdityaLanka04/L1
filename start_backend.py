#!/usr/bin/env python3
"""
Proper backend startup script
"""
import os
import sys

# Change to backend directory
os.chdir('backend')

# Start uvicorn
import uvicorn

if __name__ == "__main__":
    print("="*80)
    print("Starting Brainwave Backend Server")
    print("="*80)
    print("Server will run on: http://127.0.0.1:8000")
    print("Press Ctrl+C to stop")
    print("="*80)
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
