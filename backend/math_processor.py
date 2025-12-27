import re

def process_math_in_response(text):
    if not text or not isinstance(text, str):
        return text
    
    protected = []
    
    def save(prefix, content):
        idx = len(protected)
        protected.append(content)
        return f"__P{prefix}{idx}__"
    
    text = re.sub(r'```[\s\S]*?```', lambda m: save('C', m.group(0)), text)
    text = re.sub(r'`[^`\n]+`', lambda m: save('I', m.group(0)), text)
    text = re.sub(r'https?://[^\s<>"]+', lambda m: save('U', m.group(0)), text)
    
    result = re.sub(r'\\\[([\s\S]+?)\\\]', r'$$\1$$', text)
    result = re.sub(r'\\\((.+?)\\\)', r'$\1$', result)
    
    for i, content in enumerate(protected):
        result = result.replace(f"__PC{i}__", content)
        result = result.replace(f"__PI{i}__", content)
        result = result.replace(f"__PU{i}__", content)
    
    return result


def enhance_display_math(text):
    if not text or not isinstance(text, str):
        return text
    return text


def format_math_response(text):
    if not text:
        return text
    return process_math_in_response(text)