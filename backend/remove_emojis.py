#!/usr/bin/env python3
"""
Emoji Removal Script for Cerbyl Backend
Run this script to remove all emojis from Python log messages
Usage: python remove_emojis.py
"""
import os
import re

# All emojis to remove
emojis = ['🗄️', '🎯', '✅', 'ℹ️', '🎵', '⚠️', '❌', '🔧', '💾', '📦', '🔍', '🎴', '🗑️', '💡', '🔵', '🚀', '⚔️', '📝', '💬', '🐘', '📡']

def remove_emojis_from_file(filepath):
    """Remove all emojis from a Python file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        for emoji in emojis:
            content = content.replace(emoji, '')
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Process all Python files in the backend directory"""
    fixed_count = 0
    for root, dirs, files in os.walk('.'):
        # Skip __pycache__, .venv, and .git directories
        dirs[:] = [d for d in dirs if d not in ['__pycache__', '.venv', '.git']]
        
        for file in files:
            if file.endswith('.py') and file != 'remove_emojis.py':
                filepath = os.path.join(root, file)
                if remove_emojis_from_file(filepath):
                    fixed_count += 1
    
    print(f"\nDone! Fixed {fixed_count} files")
    print("Remember to clear __pycache__ folders and restart the server")

if __name__ == '__main__':
    main()
