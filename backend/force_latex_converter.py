import re

def force_convert_to_latex(text):
    """Convert plain text math to LaTeX format"""
    if not text or not isinstance(text, str):
        return text
    
    # Don't process if already has LaTeX
    if '$$' in text or '\\[' in text:
        return text
    
    # Simple passthrough for now - AI should already provide LaTeX
    return text

def smart_latex_wrap(text):
    """Intelligently wrap math expressions"""
    if not text or not isinstance(text, str):
        return text
    return text