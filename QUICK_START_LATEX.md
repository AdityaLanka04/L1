# Quick Start - LaTeX Rendering in AI Chat

## ✅ System is Ready!

The LaTeX formatting system is fully implemented and tested. Here's how to use it:

## Start the Application

```bash
# Terminal 1 - Backend
python backend/main.py

# Terminal 2 - Frontend  
npm start
```

## Test It Immediately

Go to AI Chat and try these:

### Test 1: Simple Math
```
What is $x^2 + 2x + 3$ when $x = 5$?
```
**Expected:** Math renders in accent color, inline with text

### Test 2: Quadratic Formula
```
Show me the quadratic formula
```
**Expected:** AI responds with:
```
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```
Rendered centered, larger, in accent color

### Test 3: Integral
```
What is the integral of x squared from 0 to 1?
```
**Expected:** AI responds with:
```
$$\int_0^1 x^2 dx = \frac{1}{3}$$
```

### Test 4: Greek Letters
```
Explain Euler's identity
```
**Expected:** AI responds with:
```
$$e^{i\pi} + 1 = 0$$
```

## What You Should See

✅ **Inline math** ($x^2$): Same line as text, slightly larger, accent color
✅ **Display math** ($$\int x dx$$): Centered, larger, accent color  
✅ **Fractions**: Horizontal line properly drawn
✅ **Roots**: Radical symbol with overline
✅ **Greek letters**: Actual symbols (α, β, θ)
✅ **No plain text**: Never see "x^2" or "sqrt(x)"

## If It's Not Working

### 1. Check Backend
```bash
python backend/test_latex_system.py
```
Should show: "✅ ALL TESTS COMPLETED SUCCESSFULLY!"

### 2. Check Browser Console
- Open DevTools (F12)
- Look for KaTeX errors
- Verify KaTeX loaded from CDN

### 3. Restart Everything
```bash
# Stop both terminals (Ctrl+C)
# Clear cache
# Restart backend and frontend
```

### 4. Test Simple Expression
Ask AI: "What is $x^2$?"
If this doesn't render, check:
- Backend is running
- Frontend is running
- No console errors

## How It Works

1. **You ask a math question** → AI receives comprehensive LaTeX instructions
2. **AI responds with LaTeX** → Uses `$...$` for inline, `$$...$$` for display
3. **Backend processes** → Converts any `\(...\)` or `\[...\]` to standard format
4. **Frontend renders** → MathRenderer component uses KaTeX to display beautifully

## Common Patterns

| What You Want | LaTeX Code | Renders As |
|---------------|------------|------------|
| x squared | `$x^2$` | x² |
| Fraction | `$\frac{a}{b}$` | a/b (with line) |
| Square root | `$\sqrt{x}$` | √x |
| Integral | `$\int_a^b f(x)dx$` | ∫ᵇₐ f(x)dx |
| Sum | `$\sum_{i=1}^n i$` | Σⁿᵢ₌₁ i |
| Greek alpha | `$\alpha$` | α |
| Greek theta | `$\theta$` | θ |

## Files You Can Modify

### To Change LaTeX Instructions:
Edit: `backend/latex_instructions.py`

### To Change Math Processing:
Edit: `backend/math_processor.py`

### To Change Styling:
Edit: `src/components/MathRenderer.css` or `src/pages/AIChat.css`

## Need Help?

1. Check `LATEX_SYSTEM_COMPLETE.md` for full documentation
2. Run `python backend/test_latex_system.py` to verify backend
3. Check browser console for frontend errors
4. Verify KaTeX loaded in Network tab

## Success Indicators

✅ Math in accent color
✅ Inline math slightly larger than text
✅ Display math centered and prominent
✅ Symbols render correctly
✅ No console errors
✅ Works in light and dark mode

**Status: READY TO USE! 🚀**
