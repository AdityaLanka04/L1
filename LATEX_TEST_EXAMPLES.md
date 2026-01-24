# LaTeX Rendering Test Examples

Use these examples in the AI Chat to test the LaTeX rendering:

## Basic Inline Math

1. "What is $x^2 + y^2 = r^2$?"
2. "Explain the formula $E = mc^2$"
3. "What does $\pi \approx 3.14159$ mean?"
4. "Calculate $\sqrt{16} = 4$"

## Display Math (Block Equations)

1. "Show me the quadratic formula:"
   ```
   $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
   ```

2. "Explain the integral:"
   ```
   $$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
   ```

3. "What is the sum:"
   ```
   $$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$
   ```

4. "Show Euler's identity:"
   ```
   $$e^{i\pi} + 1 = 0$$
   ```

## Greek Letters

1. "What is $\alpha$, $\beta$, $\gamma$?"
2. "Explain $\theta$ in trigonometry"
3. "What does $\Delta$ mean in calculus?"
4. "Define $\lambda$ in physics"
5. "What is $\sigma$ in statistics?"

## Fractions

1. "Simplify $\frac{a}{b} + \frac{c}{d}$"
2. "What is $\frac{dy}{dx}$?"
3. "Calculate $\frac{1}{2} + \frac{1}{3} = \frac{5}{6}$"

## Complex Expressions

1. "Derive the integration by parts formula:"
   ```
   $$\int u \, dv = uv - \int v \, du$$
   ```

2. "Show the Taylor series:"
   ```
   $$f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n$$
   ```

3. "Explain the Fourier transform:"
   ```
   $$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) e^{-2\pi i x \xi} dx$$
   ```

4. "Show the Schrödinger equation:"
   ```
   $$i\hbar\frac{\partial}{\partial t}\Psi = \hat{H}\Psi$$
   ```

## Matrices (if supported)

1. "Show a 2x2 matrix:"
   ```
   $$\begin{pmatrix} a & b \\ c & d \end{pmatrix}$$
   ```

## Calculus

1. "What is the derivative of $f(x) = x^3$?"
2. "Calculate $\lim_{x \to 0} \frac{\sin x}{x} = 1$"
3. "Evaluate $\int_0^1 x^2 dx = \frac{1}{3}$"
4. "Find $\frac{d}{dx}(e^x) = e^x$"

## Trigonometry

1. "Show $\sin^2\theta + \cos^2\theta = 1$"
2. "What is $\tan\theta = \frac{\sin\theta}{\cos\theta}$?"
3. "Explain $e^{i\theta} = \cos\theta + i\sin\theta$"

## Logarithms

1. "What is $\log_b(xy) = \log_b x + \log_b y$?"
2. "Show $\ln(e^x) = x$"
3. "Calculate $\log_2 8 = 3$"

## Set Theory

1. "What is $A \cup B$?"
2. "Explain $x \in \mathbb{R}$"
3. "Show $\mathbb{N} \subset \mathbb{Z} \subset \mathbb{Q} \subset \mathbb{R} \subset \mathbb{C}$"

## Probability

1. "What is $P(A \cap B) = P(A) \cdot P(B|A)$?"
2. "Show $E[X] = \sum_{i} x_i P(x_i)$"
3. "Explain $\sigma^2 = E[(X - \mu)^2]$"

## Physics

1. "Show Newton's second law: $F = ma$"
2. "What is kinetic energy: $KE = \frac{1}{2}mv^2$?"
3. "Explain $\Delta x \cdot \Delta p \geq \frac{\hbar}{2}$"

## Chemistry (if mhchem is supported)

1. "Show the reaction: $\ce{H2 + O2 -> H2O}$"
2. "What is $\ce{CH4}$?"

## Test Prompts for AI Chat

Copy and paste these into the AI Chat:

### Test 1: Basic Calculus
```
Explain the fundamental theorem of calculus. Show me the formula:
$$\int_a^b f'(x) dx = f(b) - f(a)$$
```

### Test 2: Integration by Parts
```
Derive the integration by parts formula step by step. Start with the product rule and show:
$$\int u \, dv = uv - \int v \, du$$
```

### Test 3: Quadratic Formula
```
Derive the quadratic formula from $ax^2 + bx + c = 0$ and show:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

### Test 4: Taylor Series
```
Explain the Taylor series expansion and show the general formula:
$$f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n$$
```

### Test 5: Euler's Formula
```
Prove Euler's formula $e^{i\theta} = \cos\theta + i\sin\theta$ and show the special case:
$$e^{i\pi} + 1 = 0$$
```

### Test 6: Logarithm Properties
```
List the main properties of logarithms:
1. $\log_b(xy) = \log_b x + \log_b y$
2. $\log_b(x/y) = \log_b x - \log_b y$
3. $\log_b(x^n) = n\log_b x$
```

### Test 7: Trigonometric Identities
```
Show me the main trigonometric identities:
- $\sin^2\theta + \cos^2\theta = 1$
- $\tan\theta = \frac{\sin\theta}{\cos\theta}$
- $\sin(2\theta) = 2\sin\theta\cos\theta$
```

### Test 8: Limits
```
Explain the concept of limits and show:
$$\lim_{x \to 0} \frac{\sin x}{x} = 1$$
$$\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e$$
```

### Test 9: Series Convergence
```
Explain the Basel problem and show:
$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$
```

### Test 10: Complex Integration
```
Show me the Cauchy integral formula:
$$f(a) = \frac{1}{2\pi i} \oint_\gamma \frac{f(z)}{z-a} dz$$
```

## Expected Visual Results

When properly rendered, you should see:

1. **Inline math** appears in the same line as text, slightly larger than regular text, in accent color
2. **Display math** appears centered on its own line, larger than inline math, in accent color
3. **Fractions** have horizontal lines properly drawn
4. **Square roots** have the radical symbol with proper overline
5. **Integrals** have the elongated S symbol
6. **Summations** have the Σ symbol with proper limits
7. **Greek letters** appear as actual symbols (α, β, γ, etc.)
8. **Superscripts** and **subscripts** are properly positioned
9. All math elements use the **accent color** from your theme
10. Long equations are **scrollable** horizontally

## Troubleshooting

If math doesn't render:

1. Check browser console for errors
2. Verify KaTeX loaded (check Network tab)
3. Try a simple expression first: `$x^2$`
4. Clear cache and reload
5. Check that response contains `$` delimiters
6. Verify backend is running and processing math

## Success Indicators

✅ Math appears in accent color
✅ Inline math is slightly larger than text
✅ Display math is centered and prominent
✅ Symbols render correctly (not as text)
✅ No console errors
✅ Smooth rendering without flicker
✅ Works in both light and dark mode
