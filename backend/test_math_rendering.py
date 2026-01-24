"""
Test script to verify math rendering fixes
Run this to test the math processing pipeline
"""

from math_processor import format_math_response
from force_latex_converter import force_convert_to_latex

def test_math_processing():
    """Test various math expressions"""
    
    test_cases = [
        {
            "name": "LaTeX display math",
            "input": "The integral is \\[\\int x^2 dx\\]",
            "expected_contains": "$$"
        },
        {
            "name": "LaTeX inline math",
            "input": "The value \\(x^2\\) is important",
            "expected_contains": "$x^2$"
        },
        {
            "name": "Plain text integral",
            "input": "Calculate integral x^2 dx",
            "expected_contains": "$"
        },
        {
            "name": "Fraction",
            "input": "The result is (x^3)/(3)",
            "expected_contains": "frac"
        },
        {
            "name": "Power",
            "input": "The value x^2 is squared",
            "expected_contains": "$x^2$"
        },
        {
            "name": "Already has delimiters",
            "input": "The value $x^2$ is already formatted",
            "expected_contains": "$x^2$"
        }
    ]
    
    print("=" * 60)
    print("MATH RENDERING TEST SUITE")
    print("=" * 60)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{i}. {test['name']}")
        print(f"   Input:  {test['input']}")
        
        # Apply math processing
        result = format_math_response(test['input'])
        result = force_convert_to_latex(result)
        
        print(f"   Output: {result}")
        
        # Check if expected content is present
        if test['expected_contains'] in result:
            print(f"   ✅ PASS - Contains '{test['expected_contains']}'")
        else:
            print(f"   ❌ FAIL - Missing '{test['expected_contains']}'")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


def test_delimiter_detection():
    """Test delimiter detection"""
    
    print("\n" + "=" * 60)
    print("DELIMITER DETECTION TEST")
    print("=" * 60)
    
    test_strings = [
        "No math here",
        "Inline math: $x^2$",
        "Display math: $$\\int x^2 dx$$",
        "Both: $x^2$ and $$\\int x dx$$",
        "LaTeX: \\(x^2\\) and \\[\\int x dx\\]"
    ]
    
    for s in test_strings:
        has_dollar = '$' in s
        has_double_dollar = '$$' in s
        has_latex_inline = '\\(' in s
        has_latex_display = '\\[' in s
        
        print(f"\nString: {s}")
        print(f"  $ delimiter: {has_dollar}")
        print(f"  $$ delimiter: {has_double_dollar}")
        print(f"  \\(...\\) delimiter: {has_latex_inline}")
        print(f"  \\[...\\] delimiter: {has_latex_display}")


if __name__ == "__main__":
    test_math_processing()
    test_delimiter_detection()
    
    print("\n" + "=" * 60)
    print("CRITICAL RULES:")
    print("  - $$ = display math (large, centered)")
    print("  - $ = inline math (small, in-line)")
    print("  - Frontend MathRenderer.js must have correct delimiter order")
    print("=" * 60)
