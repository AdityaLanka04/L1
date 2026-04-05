"""
Math Processor — ensures all AI responses have proper LaTeX delimiters for KaTeX rendering.

Pipeline:
  1. Protect code blocks so we never touch them
  2. Protect already-delimited math so we don't double-wrap
  3. Convert \(...\) → $...$ and \[...\] → $$...$$
  4. Auto-detect bare math expressions and wrap them
  5. Clean up formatting (display math on its own line)
  6. Restore protected content
"""

import re

# ─────────────────────────────────────────────────────────────────────────────
# LaTeX commands that are *only* meaningful inside math
# ─────────────────────────────────────────────────────────────────────────────
_LATEX_MATH_CMDS = re.compile(
    r'\\(?:'
    r'frac|sqrt|sum|int|oint|prod|lim|sup|inf|max|min|log|ln|exp|'
    r'sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|'
    r'partial|nabla|infty|pm|mp|times|cdot|div|'
    r'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|'
    r'iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|'
    r'tau|upsilon|phi|varphi|chi|psi|omega|'
    r'Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|'
    r'mathbb|mathbf|mathrm|mathit|mathcal|text|vec|hat|bar|dot|ddot|'
    r'left|right|big|Big|bigg|Bigg|'
    r'leq|geq|neq|approx|equiv|subset|supset|subseteq|supseteq|in|notin|'
    r'rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|'
    r'to|gets|iff|forall|exists|nexists|'
    r'matrix|pmatrix|bmatrix|vmatrix|cases|aligned|align|'
    r'overline|underline|overbrace|underbrace|'
    r'ldots|cdots|vdots|ddots'
    r')(?![a-zA-Z])'
)

# Pattern: bare superscript — e.g. x^2, e^x, a^{n}, 2^{10}
_SUPERSCRIPT = re.compile(r'[a-zA-Z0-9]\^[\da-zA-Z{(\\-]')

# Pattern: bare subscript — e.g. x_1, a_n, x_{ij}
_SUBSCRIPT = re.compile(r'[a-zA-Z]\d*_[\da-zA-Z{]')


def _has_math_signal(token: str) -> bool:
    """Return True if this text token contains un-delimited math."""
    if _LATEX_MATH_CMDS.search(token):
        return True
    if _SUPERSCRIPT.search(token):
        return True
    if _SUBSCRIPT.search(token):
        return True
    return False


def _protect(text: str):
    """
    Save code blocks and existing math delimiters.
    Returns (modified_text, restore_fn).
    """
    saved = []

    def save(m):
        idx = len(saved)
        saved.append(m.group(0))
        return f'\x00SAVE{idx}\x00'

    # Code fences first
    text = re.sub(r'```[\s\S]*?```', save, text)
    text = re.sub(r'`[^`\n]+`', save, text)

    # Existing display math
    text = re.sub(r'\$\$[\s\S]+?\$\$', save, text)
    # Existing inline math
    text = re.sub(r'\$(?!\s)[^\n$]+?(?<!\s)\$', save, text)
    # \[...\] and \(...\)
    text = re.sub(r'\\\[[\s\S]+?\\\]', save, text)
    text = re.sub(r'\\\(.+?\\\)', save, text)

    def restore(t: str) -> str:
        for i, content in enumerate(saved):
            t = t.replace(f'\x00SAVE{i}\x00', content)
        return t

    return text, restore


def _convert_latex_delimiters(text: str) -> str:
    """Convert \[...\] → $$...$$ and \(...\) → $...$."""
    text = re.sub(r'\\\[([\s\S]+?)\\\]', r'$$\1$$', text)
    text = re.sub(r'\\\((.+?)\\\)', r'$\1$', text)
    return text


def _auto_wrap_inline(text: str) -> str:
    """
    Find bare math expressions and wrap them in $...$

    Strategy: split on sentence/phrase boundaries and test each
    candidate span for math signals.  This deliberately stays simple —
    it targets the most common patterns the AI produces.
    """

    # ── 1. Single-line display equations (standalone lines that are equations)
    # e.g.  "ax^2 + bx + c = 0" on its own line
    def wrap_display_line(m):
        expr = m.group(1).strip()
        # Only wrap if it has a math signal
        if _has_math_signal(expr) or (re.search(r'[a-zA-Z]\s*[=+\-]\s*[a-zA-Z0-9\\]', expr) and '^' in expr):
            return f'\n$$\n{expr}\n$$\n'
        return m.group(0)

    text = re.sub(
        r'\n[ \t]*([A-Za-z0-9\\(][^<\n]*?(?:\^|_\d|\\frac|\\sqrt|\\int|\\sum)[^<\n]*?[= a-zA-Z0-9)}\]\.!?])\n',
        lambda m: f'\n$$\n{m.group(1).strip()}\n$$\n' if len(m.group(1).strip()) > 4 else m.group(0),
        text
    )

    # ── 2. Inline spans with math signals — detect within running prose
    # Find runs of text between HTML tags/markdown structure that contain
    # bare math tokens and wrap each math token group.
    # We process between HTML tags (since content may be pre-marked-parsed).

    def wrap_text_node(segment: str) -> str:
        """Wrap bare math tokens inside a plain-text segment."""
        # Tokenise by space; group adjacent math tokens
        tokens = re.split(r'(\s+)', segment)
        result = []
        math_buf = []

        def flush_math():
            if not math_buf:
                return
            expr = ''.join(math_buf).strip()
            # Strip surrounding punctuation for the delimiter
            prefix = re.match(r'^([,.:;!?\(\)]*)(.+?)([,.:;!?\(\)]*)$', expr, re.S)
            if prefix:
                result.append(prefix.group(1) + '$' + prefix.group(2).strip() + '$' + prefix.group(3))
            else:
                result.append(f'${expr}$')
            math_buf.clear()

        for tok in tokens:
            if re.match(r'\s+', tok):
                if math_buf:
                    math_buf.append(tok)
                else:
                    result.append(tok)
            elif _has_math_signal(tok):
                math_buf.append(tok)
            else:
                if math_buf:
                    # Include this token if it extends a math expression
                    # (e.g. the "= 0" after "ax^2 + bx + c")
                    if re.match(r'^[=+\-*/,.)}\]0-9]+$', tok.strip()):
                        math_buf.append(tok)
                    else:
                        flush_math()
                        result.append(tok)
                else:
                    result.append(tok)

        flush_math()
        return ''.join(result)

    # Apply to text nodes between HTML tags (if HTML) or directly (if plain)
    if '<' in text and '>' in text:
        text = re.sub(r'>([^<]+)<', lambda m: '>' + wrap_text_node(m.group(1)) + '<', text)
    else:
        # Plain text — apply line by line
        lines = text.split('\n')
        text = '\n'.join(wrap_text_node(l) for l in lines)

    return text


def _fix_display_math_spacing(text: str) -> str:
    """Ensure $$...$$ blocks are on their own lines."""
    text = re.sub(r'([^\n])\$\$', r'\1\n$$', text)
    text = re.sub(r'\$\$([^\n])', r'$$\n\1', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def process_math_in_response(text: str) -> str:
    """
    Full pipeline: protect → convert delimiters → auto-wrap bare math → restore.
    Drop-in replacement; safe to call on any AI response string.
    """
    if not text or not isinstance(text, str):
        return text

    text, restore = _protect(text)
    text = _convert_latex_delimiters(text)
    text = _auto_wrap_inline(text)
    text = restore(text)
    text = _fix_display_math_spacing(text)
    return text


def enhance_display_math(text: str) -> str:
    """Legacy alias used by some routes."""
    return _fix_display_math_spacing(text)


def format_math_response(text: str) -> str:
    """Legacy alias — full pipeline."""
    return process_math_in_response(text)
