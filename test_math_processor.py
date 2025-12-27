#!/usr/bin/env python3
"""
Test script for math_processor.py
Verifies that all math patterns are correctly wrapped in LaTeX
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from math_processor import process_math_in_response, enhance_display_math

def test_math_processor():
    """Test all math processing patterns"""
    
    print("🧪 TESTING MATH POST-PROCESSOR\n")
    print("=" * 70)
    
    test_cases = [
        # (input, expected_output_contains, description)
        ("The function e^x is its own derivative", "$e^{x}$", "Exponential function"),
        ("Calculate x^2 + y^2", "x^{2}", "Exponents"),  # Just check the pattern is there
        ("The fraction a/2 equals", "$\\frac{a}{2}$", "Fractions"),
        ("The sum ∑ of all values", "$\\sum$", "Summation symbol"),
        ("The value of π is 3.14", "$\\pi$", "Greek letter pi"),
        ("The integral ∫ from 0 to 1", "$\\int$", "Integral symbol"),
        ("The product ∏ of terms", "$\\prod$", "Product symbol"),
        ("Approximately 5 ≈ 4.9", "$\\approx$", "Approximation symbol"),
        ("Not equal: 5 ≠ 4", "$\\neq$", "Not equal symbol"),
        ("Less than or equal: x ≤ 5", "$\\leq$", "Less than or equal"),
        ("Greater than or equal: x ≥ 5", "$\\geq$", "Greater than or equal"),
        ("Plus minus: ±2", "$\\pm$", "Plus minus"),
        ("Multiply: 3 × 4", "$\\times$", "Multiplication"),
        ("Divide: 6 ÷ 2", "$\\div$", "Division"),
        ("Dot product: a · b", "$\\cdot$", "Dot product"),
        ("Square root: √16", "$\\sqrt$", "Square root"),
        ("Infinity: ∞", "$\\infty$", "Infinity"),
        ("Subscript: x_1", "x_{1}", "Subscript"),
        ("Factorial: 5!", "$5!$", "Factorial"),
        ("Alpha: α", "$\\alpha$", "Greek alpha"),
        ("Beta: β", "$\\beta$", "Greek beta"),
        ("Theta: θ", "$\\theta$", "Greek theta"),
        ("Lambda: λ", "$\\lambda$", "Greek lambda"),
    ]
    
    passed = 0
    failed = 0
    
    for input_text, expected, description in test_cases:
        result = process_math_in_response(input_text)
        
        if expected in result:
            print(f"✅ {description}")
            print(f"   Input:  {input_text}")
            print(f"   Output: {result}")
            passed += 1
        else:
            print(f"❌ {description}")
            print(f"   Input:    {input_text}")
            print(f"   Expected: {expected}")
            print(f"   Got:      {result}")
            failed += 1
        print()
    
    # Test protection features
    print("=" * 70)
    print("\n🛡️  TESTING PROTECTION FEATURES\n")
    
    # Test 1: Protect existing LaTeX
    input1 = "The function $e^{x}$ is already wrapped"
    result1 = process_math_in_response(input1)
    if result1.count('$') == 2:  # Should still have exactly 2 dollar signs
        print("✅ Existing LaTeX protected (no double-wrapping)")
        print(f"   Input:  {input1}")
        print(f"   Output: {result1}\n")
        passed += 1
    else:
        print("❌ Existing LaTeX NOT protected")
        print(f"   Input:  {input1}")
        print(f"   Output: {result1}\n")
        failed += 1
    
    # Test 2: Protect code blocks
    input2 = "Here's code: ```python\nx^2 + y^2\n```"
    result2 = process_math_in_response(input2)
    if "```python" in result2 and "$" not in result2.split("```")[1]:
        print("✅ Code blocks protected")
        print(f"   Input:  {input2}")
        print(f"   Output: {result2}\n")
        passed += 1
    else:
        print("❌ Code blocks NOT protected")
        print(f"   Input:  {input2}")
        print(f"   Output: {result2}\n")
        failed += 1
    
    # Test 3: Protect URLs
    input3 = "Visit http://example.com/path/to/file"
    result3 = process_math_in_response(input3)
    if "http://example.com/path/to/file" in result3 and "\\frac" not in result3:
        print("✅ URLs protected (no fraction conversion)")
        print(f"   Input:  {input3}")
        print(f"   Output: {result3}\n")
        passed += 1
    else:
        print("❌ URLs NOT protected")
        print(f"   Input:  {input3}")
        print(f"   Output: {result3}\n")
        failed += 1
    
    # Test 4: Display math enhancement
    print("=" * 70)
    print("\n📐 TESTING DISPLAY MATH ENHANCEMENT\n")
    
    input4 = "The equation x^2 + y^2 = r^2 defines a circle"
    result4 = process_math_in_response(input4)
    result4_enhanced = enhance_display_math(result4)
    
    print(f"Input:    {input4}")
    print(f"Processed: {result4}")
    print(f"Enhanced:  {result4_enhanced}\n")
    
    # Summary
    print("=" * 70)
    print(f"\n📊 TEST RESULTS\n")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Total: {passed + failed}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Math processor is working correctly.")
        print("\n✅ Ready to use in production!")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review math_processor.py")
    
    print("=" * 70)
    
    return failed == 0

if __name__ == "__main__":
    success = test_math_processor()
    sys.exit(0 if success else 1)
