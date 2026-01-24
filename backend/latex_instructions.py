"""
LaTeX Formatting Instructions for AI Responses
CRITICAL: This ensures AI uses proper LaTeX notation that renders beautifully
"""

LATEX_INSTRUCTIONS_COMPREHENSIVE = """
═══════════════════════════════════════════════════════════════════════════
🔴 CRITICAL - MATHEMATICAL NOTATION RULES (MANDATORY) 🔴
═══════════════════════════════════════════════════════════════════════════

YOU MUST USE LATEX FOR ALL MATHEMATICAL EXPRESSIONS. NO EXCEPTIONS.

## DELIMITER RULES (CRITICAL):
1. Display math (large, centered, on own line): $$...$$
   Example: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$

2. Inline math (small, in-line with text): $...$
   Example: The value $x^2$ is important

## WHEN TO USE DISPLAY MATH ($$...$$):
- Integrals: $$\\int x^2 dx$$
- Complex fractions: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$
- Summations: $$\\sum_{i=1}^n i^2$$
- Important equations: $$e^{i\\pi} + 1 = 0$$
- Any math that deserves emphasis

## WHEN TO USE INLINE MATH ($...$):
- Simple expressions in sentences: $x^2$, $f(x)$
- Variables: $x$, $y$, $\\theta$
- Simple fractions: $\\frac{1}{2}$
- Math within explanatory text

## EXAMPLES:

✅ CORRECT - Display math:
"The integral of x squared is:

$$\\int x^2 dx = \\frac{x^3}{3} + C$$

This shows that..."

✅ CORRECT - Inline math:
"When we have $x = 5$, then $y = x^2 = 25$."

✅ CORRECT - Mixed:
"To solve the quadratic equation, we use:

$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$

where $a$, $b$, and $c$ are the coefficients."

❌ WRONG - Plain text:
"The integral of x^2 is x^3/3 + C"

❌ WRONG - No delimiters:
"x = (-b ± √(b²-4ac)) / 2a"

## COMMON LATEX PATTERNS:

### Fractions:
$$\\frac{a}{b}$$, $$\\frac{x+1}{x-1}$$, $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$

### Powers:
$x^2$, $x^n$, $e^{i\\pi}$, $2^{n+1}$

### Roots:
$$\\sqrt{x}$$, $$\\sqrt{x^2 + y^2}$$, $$\\sqrt[3]{x}$$

### Integrals:
$$\\int f(x) dx$$, $$\\int_a^b f(x) dx$$, $$\\int_0^\\infty e^{-x^2} dx$$

### Summations:
$$\\sum_{i=1}^n i$$, $$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$$

### Greek Letters:
$\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\theta$, $\\lambda$, $\\pi$, $\\sigma$, $\\omega$

### Trigonometry:
$\\sin\\theta$, $\\cos\\theta$, $\\tan\\theta$, $\\sin^2\\theta + \\cos^2\\theta = 1$

### Logarithms:
$\\ln x$, $\\log x$, $\\log_b x$

### Limits:
$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$

### Derivatives:
$f'(x)$, $\\frac{df}{dx}$, $\\frac{\\partial f}{\\partial x}$

═══════════════════════════════════════════════════════════════════════════
🔴 REMEMBER: $$ for display (large), $ for inline (small) 🔴
═══════════════════════════════════════════════════════════════════════════
"""

LATEX_INSTRUCTIONS_SHORT = """
CRITICAL - Use LaTeX for ALL math:
- Display (large, centered): $$\\int_0^1 x^2 dx = \\frac{1}{3}$$
- Inline (small): $x^2 + 2x + 3$
- Fractions: $$\\frac{a}{b}$$, Roots: $$\\sqrt{x}$$, Greek: $\\alpha$, $\\theta$
- NEVER plain text - ALWAYS $$ or $
"""

LATEX_INSTRUCTIONS_MINIMAL = """
Use LaTeX: display $$\\int x dx$$, inline $x^2$. Fractions: $$\\frac{a}{b}$$. Greek: $\\alpha$. ALWAYS use $$ or $.
"""

def get_latex_instructions(level="comprehensive"):
    """Get LaTeX instructions at specified detail level"""
    if level == "comprehensive":
        return LATEX_INSTRUCTIONS_COMPREHENSIVE
    elif level == "short":
        return LATEX_INSTRUCTIONS_SHORT
    else:
        return LATEX_INSTRUCTIONS_MINIMAL
