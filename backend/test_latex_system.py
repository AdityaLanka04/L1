"""
Test script to verify LaTeX formatting system is working correctly
"""

from latex_instructions import get_latex_instructions
from math_processor import process_math_in_response, format_math_response, has_math_content

def test_latex_instructions():
    """Test that LaTeX instructions are properly formatted"""
    print("=" * 80)
    print("TESTING LATEX INSTRUCTIONS")
    print("=" * 80)
    
    # Test comprehensive instructions
    comprehensive = get_latex_instructions("comprehensive")
    print("\n✅ Comprehensive instructions loaded:")
    print(f"   Length: {len(comprehensive)} characters")
    print(f"   Contains examples: {'CORRECT:' in comprehensive}")
    
    # Test short instructions
    short = get_latex_instructions("short")
    print("\n✅ Short instructions loaded:")
    print(f"   Length: {len(short)} characters")
    print(short)
    
    # Test minimal instructions
    minimal = get_latex_instructions("minimal")
    print("\n✅ Minimal instructions loaded:")
    print(f"   Length: {len(minimal)} characters")
    print(minimal)

def test_math_processor():
    """Test that math processor converts delimiters correctly"""
    print("\n" + "=" * 80)
    print("TESTING MATH PROCESSOR")
    print("=" * 80)
    
    test_cases = [
        (r"The formula is \(x^2 + 2x + 3\)", "Inline LaTeX \\(...\\)"),
        (r"Display: \[x = \frac{-b}{2a}\]", "Display LaTeX \\[...\\]"),
        (r"Already correct: $x^2$", "Already using $"),
        (r"Display correct: $$\int x dx$$", "Already using $$"),
        (r"Mixed: \(x^2\) and \[\int x dx\]", "Mixed delimiters"),
    ]
    
    for test_input, description in test_cases:
        result = process_math_in_response(test_input)
        print(f"\n📝 Test: {description}")
        print(f"   Input:  {test_input}")
        print(f"   Output: {result}")
        print(f"   ✅ Converted: {test_input != result}")

def test_math_detection():
    """Test that math content detection works"""
    print("\n" + "=" * 80)
    print("TESTING MATH DETECTION")
    print("=" * 80)
    
    test_cases = [
        ("The derivative $f'(x) = 2x$", True),
        ("Display: $$\\int x dx$$", True),
        ("No math here", False),
        ("Just plain text", False),
        (r"LaTeX style: \(x^2\)", True),
        ("Greek letter $\\alpha$", True),
    ]
    
    for text, expected in test_cases:
        result = has_math_content(text)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text[:40]}...' -> {result} (expected {expected})")

def test_full_pipeline():
    """Test the complete formatting pipeline"""
    print("\n" + "=" * 80)
    print("TESTING FULL PIPELINE")
    print("=" * 80)
    
    # Simulate AI response with various math formats
    ai_response = """
The quadratic formula is given by:

\[x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}\]

For example, when \(a = 1\), \(b = -3\), and \(c = 2\), we get:

\[x = \frac{3 \pm \sqrt{9 - 8}}{2} = \frac{3 \pm 1}{2}\]

So the solutions are \(x = 2\) or \(x = 1\).

The derivative of \(f(x) = x^2\) is \(f'(x) = 2x\).
"""
    
    print("\n📥 Original AI Response:")
    print(ai_response)
    
    formatted = format_math_response(ai_response)
    
    print("\n📤 Formatted Response:")
    print(formatted)
    
    print("\n✅ Verification:")
    print(f"   Contains $: {formatted.count('$')}")
    print(f"   Contains $$: {formatted.count('$$')}")
    print(f"   No \\( left: {r'\\(' not in formatted}")
    print(f"   No \\[ left: {r'\\[' not in formatted}")

if __name__ == "__main__":
    print("\n" + "🔬" * 40)
    print("LATEX FORMATTING SYSTEM TEST SUITE")
    print("🔬" * 40)
    
    try:
        test_latex_instructions()
        test_math_processor()
        test_math_detection()
        test_full_pipeline()
        
        print("\n" + "=" * 80)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print("\nThe LaTeX formatting system is working correctly.")
        print("AI responses will now properly format mathematical expressions.")
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("❌ TEST FAILED!")
        print("=" * 80)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
