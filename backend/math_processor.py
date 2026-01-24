"""
Math Processor - Ensures proper LaTeX formatting in AI responses
"""

import re

def process_math_in_response(text):
    """
    Process mathematical notation in AI responses.
    Converts various math delimiters to standard $$ and $ format for KaTeX.
    
    CRITICAL RULES:
    - $$ = display math (large, centered)
    - $ = inline math (small, in-line)
    """
    if not text or not isinstance(text, str):
        return text
    
    # Protect code blocks from processing
    protected = []
    
    def save(content):
        idx = len(protected)
        protected.append(content)
        return f"__PROTECTED_{idx}__"
    
    # Protect code blocks
    text = re.sub(r'```[\s\S]*?```', lambda m: save(m.group(0)), text)
    text = re.sub(r'`[^`\n]+`', lambda m: save(m.group(0)), text)
    
    # Convert LaTeX display math \[...\] to $$...$$
    text = re.sub(r'\\\[([\s\S]+?)\\\]', r'$$\1$$', text)
    
    # Convert LaTeX inline math \(...\) to $...$
    text = re.sub(r'\\\((.+?)\\\)', r'$\1$', text)
    
    # Restore protected content
    for i, content in enumerate(protected):
        text = text.replace(f"__PROTECTED_{i}__", content)
    
    return text


def enhance_display_math(text):
    """
    Ensure display math ($$...$$) is on its own line for better rendering.
    """
    if not text or not isinstance(text, str):
        return text
    
    # Add newlines before and after $$ blocks if not already there
    text = re.sub(r'([^\n])\$\$', r'\1\n$$', text)
    text = re.sub(r'\$\$([^\n])', r'$$\n\1', text)
    
    # Clean up excessive newlines
    text = re.sub(r'\n\n\n+', '\n\n', text)
    
    return text


def format_math_response(text):
    """
    Complete math formatting pipeline for AI responses.
    """
    if not text:
        return text
    
    text = process_math_in_response(text)
    text = enhance_display_math(text)
    
    return text
