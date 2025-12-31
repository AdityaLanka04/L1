#!/usr/bin/env python3
"""
Script to remove all console.log, console.warn, console.error, and console.info 
statements from frontend JavaScript files.

Usage: python clean_frontend_logs.py
"""

import os
import re

def remove_console_statements(content):
    """Remove console statements while preserving code structure."""
    # Pattern to match console.log/warn/error/info with their complete arguments
    # This handles multi-line console statements and nested parentheses
    pattern = r'console\.(log|warn|error|info)\s*\([^)]*\)\s*;?'
    
    # More aggressive pattern for complex cases
    lines = content.split('\n')
    cleaned_lines = []
    skip_line = False
    
    for i, line in enumerate(lines):
        # Check if line contains console statement
        if re.search(r'console\.(log|warn|error|info)\s*\(', line):
            # Count parentheses to handle multi-line statements
            open_parens = line.count('(') - line.count(')')
            
            if open_parens == 0:
                # Single line console statement - remove it
                cleaned_line = re.sub(r'console\.(log|warn|error|info)\s*\([^)]*\)\s*;?', '', line)
                if cleaned_line.strip():
                    cleaned_lines.append(cleaned_line)
            else:
                # Multi-line console statement - skip until closing paren
                skip_line = True
                continue
        elif skip_line:
            # Check if this line closes the console statement
            open_parens -= (line.count(')') - line.count('('))
            if open_parens <= 0:
                skip_line = False
            continue
        else:
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)

def clean_frontend_files():
    """Clean all JavaScript files in src directory."""
    src_dir = 'src'
    if not os.path.exists(src_dir):
        print(f"Error: {src_dir} directory not found!")
        return
    
    js_files = []
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                js_files.append(os.path.join(root, file))
    
    print(f"Found {len(js_files)} JavaScript files")
    modified_count = 0
    
    for filepath in js_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            cleaned_content = remove_console_statements(original_content)
            
            if cleaned_content != original_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(cleaned_content)
                modified_count += 1
                print(f"✓ Cleaned: {filepath}")
        except Exception as e:
            print(f"✗ Error processing {filepath}: {e}")
    
    print(f"\n✓ Cleaned {modified_count} files")
    print("Note: Review the changes and fix any syntax errors if needed.")

if __name__ == '__main__':
    print("=" * 60)
    print("Frontend Console Log Cleaner")
    print("=" * 60)
    clean_frontend_files()
    print("=" * 60)
