"""
Test script for comprehensive slide analyzer
Run this to test the analysis system without the full API
"""

import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from comprehensive_slide_analyzer import ComprehensiveSlideAnalyzer
from database import SessionLocal
import json

def test_analyzer():
    """Test the comprehensive slide analyzer"""
    db = SessionLocal()
    
    try:
        analyzer = ComprehensiveSlideAnalyzer(db)
        
        # Test with a sample slide data
        sample_slide = {
            "slide_number": 1,
            "content": """
            Introduction to Machine Learning
            
            Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.
            
            Key Types:
            - Supervised Learning
            - Unsupervised Learning
            - Reinforcement Learning
            
            Applications:
            - Image Recognition
            - Natural Language Processing
            - Predictive Analytics
            """,
            "title": "Introduction to Machine Learning"
        }
        
        all_slides = [sample_slide]
        
        print("Testing comprehensive analysis...")
        print("-" * 80)
        
        analysis = analyzer.generate_comprehensive_analysis(
            sample_slide,
            all_slides,
            0
        )
        
        print(json.dumps(analysis, indent=2))
        print("-" * 80)
        print("✅ Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    test_analyzer()
