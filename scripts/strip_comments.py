import os
import re
import tokenize
import io
import sys


SKIP_DIRS = {
    "__pycache__", ".venv", "node_modules", ".git", "build", "dist",
    "migrations", "mobile", ".chroma_data",
}

SKIP_FILES = {
    "strip_comments.py",
}


def strip_py(source: str) -> str:
    lines = source.splitlines(keepends=True)
    if not lines:
        return source

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except tokenize.TokenError:
        return source

    removed_lines = set()
    inline_comment_cols = {}
    docstring_line_ranges = []

    prev_meaningful_idx = -1
    for i, (tok_type, tok_string, tok_start, tok_end, _) in enumerate(tokens):
        row, col = tok_start

        if tok_type == tokenize.COMMENT:
            line_content = lines[row - 1]
            non_comment = line_content[:col].strip()
            if not non_comment:
                removed_lines.add(row)
            else:
                inline_comment_cols[row] = col

        if tok_type == tokenize.STRING and tok_string[:3] in ('"""', "'''"):
            j = prev_meaningful_idx
            is_docstring = False
            if j < 0:
                is_docstring = True
            else:
                pt = tokens[j][0]
                ps = tokens[j][1]
                if pt == tokenize.OP and ps == ":":
                    is_docstring = True

            if is_docstring:
                start_row, end_row = tok_start[0], tok_end[0]
                docstring_line_ranges.append((start_row, end_row))

        if tok_type not in (
            tokenize.NEWLINE, tokenize.NL, tokenize.INDENT,
            tokenize.DEDENT, tokenize.COMMENT, tokenize.ENCODING,
        ):
            prev_meaningful_idx = i

    for start_row, end_row in docstring_line_ranges:
        for r in range(start_row, end_row + 1):
            removed_lines.add(r)

    result = []
    for lineno, line in enumerate(lines, start=1):
        if lineno in removed_lines:
            continue
        if lineno in inline_comment_cols:
            col = inline_comment_cols[lineno]
            stripped = line[:col].rstrip()
            if stripped:
                result.append(stripped + "\n")
            else:
                continue
        else:
            result.append(line)

    output = "".join(result)
    output = re.sub(r"\n{3,}", "\n\n", output)
    return output


def strip_js_css(source: str) -> str:
    result = []
    i = 0
    n = len(source)
    in_string_single = False
    in_string_double = False
    in_template = False
    in_regex_char_class = False
    prev_non_ws = ""

    while i < n:
        ch = source[i]

        if in_string_single:
            result.append(ch)
            if ch == "\\" and i + 1 < n:
                i += 1
                result.append(source[i])
            elif ch == "'":
                in_string_single = False
            i += 1
            continue

        if in_string_double:
            result.append(ch)
            if ch == "\\" and i + 1 < n:
                i += 1
                result.append(source[i])
            elif ch == '"':
                in_string_double = False
            i += 1
            continue

        if in_template:
            result.append(ch)
            if ch == "\\" and i + 1 < n:
                i += 1
                result.append(source[i])
            elif ch == "`":
                in_template = False
            i += 1
            continue

        if ch == "'" and not in_string_double and not in_template:
            in_string_single = True
            result.append(ch)
            i += 1
            continue

        if ch == '"' and not in_string_single and not in_template:
            in_string_double = True
            result.append(ch)
            i += 1
            continue

        if ch == "`" and not in_string_single and not in_string_double:
            in_template = True
            result.append(ch)
            i += 1
            continue

        # Block comment
        if ch == "/" and i + 1 < n and source[i + 1] == "*":
            end = source.find("*/", i + 2)
            if end == -1:
                i = n
            else:
                skipped = source[i:end + 2]
                newlines = skipped.count("\n")
                result.append("\n" * newlines)
                i = end + 2
            continue

        # Line comment
        if ch == "/" and i + 1 < n and source[i + 1] == "/":
            end = source.find("\n", i)
            if end == -1:
                i = n
            else:
                i = end
            continue

        result.append(ch)
        if ch not in (" ", "\t", "\n", "\r"):
            prev_non_ws = ch
        i += 1

    output = "".join(result)
    output = re.sub(r"\n{3,}", "\n\n", output)
    return output


def process_file(path: str) -> bool:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            original = f.read()
    except Exception:
        return False

    ext = os.path.splitext(path)[1].lower()
    if ext == ".py":
        processed = strip_py(original)
    elif ext in (".js", ".jsx", ".css"):
        processed = strip_js_css(original)
    else:
        return False

    if processed != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(processed)
        return True
    return False


def walk(root: str) -> list:
    paths = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            if fname in SKIP_FILES:
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext in (".py", ".js", ".jsx", ".css"):
                paths.append(os.path.join(dirpath, fname))
    return paths


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    files = walk(root)
    changed = 0
    errors = []
    for path in files:
        try:
            if process_file(path):
                changed += 1
                print(f"  stripped: {path}")
        except Exception as e:
            errors.append((path, str(e)))

    print(f"\nDone: {changed}/{len(files)} files modified")
    if errors:
        print(f"Errors ({len(errors)}):")
        for p, e in errors:
            print(f"  {p}: {e}")
