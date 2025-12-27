with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''CRITICAL - Mathematical Notation Rules:
- ONLY use LaTeX for actual mathematical formulas and equations
- Use $...$ for inline math: "The derivative $f'(x) = 2x$ shows..."
- Use $$...$$ for display equations on their own line
- Regular text should NOT be in LaTeX - only the math parts
- Examples:
  * CORRECT: "The function $f(x) = e^x$ is its own derivative"
  * WRONG: "$The function f(x) = e^x is its own derivative$"
  * CORRECT: "For the series $$\\\\sum_{n=1}^{\\\\infty} \\\\frac{1}{n^2} = \\\\frac{\\\\pi^2}{6}$$"
  * CORRECT: "When $x^2 + y^2 = r^2$, we have a circle of radius $r$"'''

new = '''CRITICAL FORMATTING RULE - YOU MUST FOLLOW THIS:
When writing ANY mathematical expression, formula, or equation, you MUST wrap it in dollar signs.
Inline math: $f(x) = x^2$
Display math on its own line: $$f(x) = x^2$$

EXAMPLES - The Maclaurin series for $f(x)$ around $x = 0$ is: $$f(x) = f(0) + f'(0)x + f''(0)x^2/2! + f'''(0)x^3/3! + ...$$
EXAMPLES - The derivative $f'(x) = 2x$ shows the rate
EXAMPLES - For $e^x$ we have $$e^x = 1 + x + x^2/2! + x^3/3! + ...$$

WRONG - DO NOT write f(x) = x^2 without dollar signs
WRONG - DO NOT write f'(0) or f''(0) without dollar signs'''

content = content.replace(old, new)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated')
