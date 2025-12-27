# 🚀 Prompt Optimization Quick Reference

## Before vs After Examples

### ❌ BEFORE (Verbose)
```python
system_prompt = """You are an expert AI tutor helping a student who is studying Computer Science.

CRITICAL RULES:
1. Provide clear explanations
2. Use examples
3. Be encouraging
4. Format with HTML tags

Learning Style: Visual
Level: Intermediate
Pace: Moderate

Provide educational responses tailored to the student."""
```
**Token Count: ~60 tokens**

### ✅ AFTER (Optimized)
```python
system_prompt = "AI tutor for student (Computer Science). Level: intermediate, Style: visual."
```
**Token Count: ~15 tokens**
**Savings: 75%**

---

## Optimization Rules

### 1. Remove Verbose Introductions
- ❌ "You are an expert AI tutor who specializes in..."
- ✅ "AI tutor for..."

### 2. Eliminate Numbered Lists
- ❌ "RULES:\n1. Do this\n2. Do that\n3. Do this"
- ✅ "Do this, that, this."

### 3. Remove Redundant Phrases
- ❌ "CRITICAL:", "IMPORTANT:", "NOTE:"
- ✅ Just state the instruction directly

### 4. Consolidate Instructions
- ❌ "Use HTML formatting. Use <h2> for headers. Use <p> for paragraphs."
- ✅ "Use HTML tags."

### 5. Abbreviate Common Terms
- ❌ "difficulty_level", "first_name", "the user"
- ✅ "level", "student", "user"

### 6. Remove Motivational Language
- ❌ "Be warm and make them excited to learn!"
- ✅ "Be warm."

### 7. Remove Explanatory Text
- ❌ "Generate now:", "Return only:", "Output:"
- ✅ (Just provide the schema)

### 8. Simplify JSON Instructions
- ❌ "Return ONLY valid JSON with no markdown, no code blocks, no extra text"
- ✅ "Return JSON."

---

## Common Patterns

### Content Generation
```python
# BEFORE (150 tokens)
"""You are an educational content expert.
CRITICAL RULES:
1. NO greetings
2. Start DIRECTLY with content
3. Use HTML: <h2>, <h3>, <p>, <ul>, <li>
4. Break down complex concepts
5. Use analogies and examples
Student Level: intermediate
Topic: {topic}
Provide clear explanation."""

# AFTER (20 tokens)
"Explain for intermediate level. No greetings. Use HTML tags. Include examples."
```

### Evaluation
```python
# BEFORE (150 tokens)
"""You are an expert evaluator assessing learning.
TASK: Compare student response to expected points.
RULES:
1. Point is covered if understanding shown
2. Look for semantic similarity
3. Be fair but thorough
OUTPUT FORMAT (JSON only):
{schema}
Generate evaluation now:"""

# AFTER (35 tokens)
"""Evaluate learning retention.
EXPECTED: {points}
STUDENT: {response}
RULES: Semantic match, not exact words.
OUTPUT JSON: {schema}"""
```

### Title Generation
```python
# BEFORE (20 tokens)
"You are a title generator. Return only the title, 3-4 words maximum."

# AFTER (8 tokens)
"Generate 3-4 word title only."
```

---

## Token Counting Tips

**Rough Estimate**: 1 token ≈ 4 characters

```python
def count_tokens(text: str) -> int:
    return len(text) // 4
```

---

## Testing Checklist

Before deploying optimized prompts:

- [ ] Test main functionality works
- [ ] Verify response quality maintained
- [ ] Check JSON parsing still works
- [ ] Ensure HTML formatting correct
- [ ] Test math rendering (if applicable)
- [ ] Monitor actual token usage
- [ ] Compare response times
- [ ] Verify no syntax errors

---

## Cost Impact Calculator

```python
def calculate_savings(requests_per_month: int, tokens_saved_per_request: int):
    # Groq pricing: $0.59 per 1M input tokens
    groq_cost_per_token = 0.59 / 1_000_000
    
    # GPT-4 pricing: $30 per 1M input tokens
    gpt4_cost_per_token = 30 / 1_000_000
    
    total_tokens_saved = requests_per_month * tokens_saved_per_request
    
    groq_savings = total_tokens_saved * groq_cost_per_token
    gpt4_savings = total_tokens_saved * gpt4_cost_per_token
    
    return {
        "groq_savings": f"${groq_savings:.2f}",
        "gpt4_savings": f"${gpt4_savings:.2f}",
        "tokens_saved": total_tokens_saved
    }

# Example: 100K requests, 1,548 tokens saved per request
print(calculate_savings(100_000, 1_548))
# Output: {'groq_savings': '$91.33', 'gpt4_savings': '$4644.00', 'tokens_saved': 154800000}
```

---

## Best Practices

### DO ✅
- Keep prompts concise and direct
- Use abbreviations for common terms
- Combine related instructions
- Test thoroughly after optimization
- Monitor quality metrics

### DON'T ❌
- Remove critical context
- Over-optimize at expense of quality
- Skip testing after changes
- Optimize prompts that are rarely used
- Sacrifice clarity for brevity

---

## When NOT to Optimize

Some prompts should remain verbose:

1. **Complex reasoning tasks** - Need detailed context
2. **Safety-critical prompts** - Clarity over brevity
3. **Rarely-used endpoints** - Not worth the effort
4. **Prompts with high quality requirements** - Don't risk degradation

---

## Monitoring & Metrics

Track these metrics after optimization:

```python
metrics = {
    "avg_tokens_per_request": 362,  # Down from 1,910
    "avg_response_time_ms": 450,    # Down from 650
    "response_quality_score": 4.5,  # Maintained from 4.5
    "monthly_cost": 21.36,          # Down from 112.79
    "requests_per_minute": 120      # Up from 80
}
```

---

## Quick Wins

Easiest optimizations with biggest impact:

1. **Remove "You are an expert..."** - Save 5-10 tokens
2. **Eliminate numbered lists** - Save 10-20 tokens
3. **Remove "CRITICAL:", "IMPORTANT:"** - Save 2-5 tokens
4. **Consolidate formatting instructions** - Save 20-50 tokens
5. **Abbreviate common terms** - Save 5-15 tokens

---

## Resources

- Test script: `test_prompt_optimization.py`
- Full documentation: `PROMPT_OPTIMIZATION_SUMMARY.md`
- Main file: `backend/main.py`

---

## Support

If you notice quality degradation after optimization:
1. Check the specific prompt in main.py
2. Add back critical context if needed
3. Test with various inputs
4. Monitor user feedback
5. Adjust as needed

Remember: **Quality > Cost Savings**

But with proper optimization, you can have both! 🎉
