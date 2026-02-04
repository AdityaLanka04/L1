#!/usr/bin/env python3
"""
Test script for JSON repair functionality
"""
import json
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_json_issues(json_str: str) -> str:
    """Attempt to fix common JSON formatting issues"""
    
    # Remove any BOM or special characters at start
    json_str = json_str.lstrip('\ufeff\ufffe')
    
    # Replace smart quotes with regular quotes
    json_str = json_str.replace('"', '"').replace('"', '"')
    json_str = json_str.replace(''', "'").replace(''', "'")
    
    # FIRST: Fix the most common pattern we're seeing - extra braces before final bracket
    # This must happen BEFORE any other fixes
    # Pattern: }}}] at the very end
    if json_str.rstrip().endswith('}}}]'):
        json_str = json_str.rstrip()[:-4] + '}]'
    elif json_str.rstrip().endswith('}}}}]'):
        json_str = json_str.rstrip()[:-5] + '}]'
    elif json_str.rstrip().endswith('}}}}}]'):
        json_str = json_str.rstrip()[:-6] + '}]'
    
    # Fix ALL instances of }}}] pattern anywhere in the string (not just at end)
    json_str = re.sub(r'\}\}\}\}\}\]', '}}]', json_str)
    json_str = re.sub(r'\}\}\}\}\]', '}}]', json_str)
    json_str = re.sub(r'\}\}\}\]', '}}]', json_str)
    json_str = re.sub(r'\]\}\}\]', ']}]', json_str)
    
    # Fix missing commas between objects in arrays
    # Pattern: }{ should be },{
    json_str = re.sub(r'\}\s*\{', '},{', json_str)
    
    # Fix missing commas between array elements
    # Pattern: "] [" should be "], ["
    json_str = re.sub(r'\]\s*\[', '],[', json_str)
    
    # Fix missing commas after closing braces/brackets before new keys
    # Pattern: } "key" should be }, "key"
    json_str = re.sub(r'\}(\s*)"(\w+)"(\s*):', r'},\1"\2"\3:', json_str)
    json_str = re.sub(r'\](\s*)"(\w+)"(\s*):', r'],\1"\2"\3:', json_str)
    
    # Fix missing commas between string values and keys
    # Pattern: "value" "key": should be "value", "key":
    json_str = re.sub(r'"(\s+)"(\w+)"(\s*):', r'",\1"\2"\3:', json_str)
    
    # Remove trailing commas before closing brackets/braces (do this multiple times)
    for _ in range(3):
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    # Fix extra closing braces/brackets patterns (more comprehensive)
    # Pattern: ]}}] should be ]}]
    json_str = re.sub(r'\]\}\}\}+\]', ']}]', json_str)  # ]}}}}] -> ]}]
    json_str = re.sub(r'\]\}\}+\]', ']}]', json_str)    # ]}}] -> ]}]
    # Pattern: }}}] should be }}]
    json_str = re.sub(r'\}\}\}\}+\]', '}}]', json_str)  # }}}}] -> }}]
    json_str = re.sub(r'\}\}\}+\]', '}}]', json_str)    # }}}] -> }}]
    # Pattern: }}} should be }}
    json_str = re.sub(r'\}{3,}', '}}', json_str)  # }}} -> }}
    # Pattern: ]]] should be ]]
    json_str = re.sub(r'\]{3,}', ']]', json_str)  # ]]] -> ]]
    # Pattern: }]] should be }]
    json_str = re.sub(r'\}\]\]', '}]', json_str)
    
    # Fix incomplete strings at the end (missing closing quote)
    if json_str.count('"') % 2 != 0:
        # Find the last quote and check if it's opening or closing
        last_quote_pos = json_str.rfind('"')
        if last_quote_pos > 0:
            # Check if there's a colon before it (likely a key)
            before_quote = json_str[:last_quote_pos].rstrip()
            if before_quote.endswith(':') or before_quote.endswith(','):
                # It's an opening quote for a value, close it
                json_str += '"'
    
    # Try to fix truncated JSON by ensuring it ends properly
    # Count opening and closing braces
    open_braces = json_str.count('{')
    close_braces = json_str.count('}')
    open_brackets = json_str.count('[')
    close_brackets = json_str.count(']')
    
    # If we have TOO MANY closing braces/brackets, remove extras from the end
    if close_braces > open_braces:
        # Remove extra closing braces from the end
        extra = close_braces - open_braces
        logger.info(f"Removing {extra} extra closing braces")
        for _ in range(extra):
            last_brace = json_str.rfind('}')
            if last_brace > 0:
                json_str = json_str[:last_brace] + json_str[last_brace + 1:]
    
    if close_brackets > open_brackets:
        # Remove extra closing brackets from the end
        extra = close_brackets - open_brackets
        logger.info(f"Removing {extra} extra closing brackets")
        for _ in range(extra):
            last_bracket = json_str.rfind(']')
            if last_bracket > 0:
                json_str = json_str[:last_bracket] + json_str[last_bracket + 1:]
    
    # Recount after removal
    open_braces = json_str.count('{')
    close_braces = json_str.count('}')
    open_brackets = json_str.count('[')
    close_brackets = json_str.count(']')
    
    # If JSON appears truncated, try to close it
    if open_braces > close_braces:
        # Add missing closing braces
        missing = open_braces - close_braces
        logger.info(f"Adding {missing} missing closing braces")
        json_str += '}' * missing
    
    if open_brackets > close_brackets:
        # Add missing closing brackets
        missing = open_brackets - close_brackets
        logger.info(f"Adding {missing} missing closing brackets")
        json_str += ']' * missing
    
    # Final cleanup: remove any trailing commas we might have created
    for _ in range(3):
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    return json_str

def test_json_repair():
    """Test various malformed JSON patterns"""
    
    test_cases = [
        # Case 1: Extra closing braces at end
        ('{"title": "Test", "nodes": [{"id": 1}]}}]}}', 'Extra closing braces'),
        
        # Case 2: Missing comma between keys
        ('{"title": "Test" "nodes": []}', 'Missing comma'),
        
        # Case 3: Trailing comma
        ('{"title": "Test", "nodes": []}', 'Trailing comma'),
        
        # Case 4: Multiple extra closing braces
        ('{"title": "Test", "nodes": [{"id": 1}]}}}]', 'Multiple extra braces'),
        
        # Case 5: Valid JSON (should pass through)
        ('{"title": "Test", "nodes": [{"id": 1}]}', 'Valid JSON'),
        
        # Case 6: The specific pattern from the logs
        ('{"title": "Test", "nodes": [{"id": 1, "data": {"value": "test"}}]}}', 'Nested objects with extra brace'),
    ]
    
    print("Testing JSON repair functionality...\n")
    
    passed = 0
    failed = 0
    
    for malformed_json, description in test_cases:
        print(f"Test: {description}")
        print(f"Input: {malformed_json}")
        
        try:
            # Try to fix it
            fixed = fix_json_issues(malformed_json)
            
            # Try to parse
            parsed = json.loads(fixed)
            
            print(f"✓ PASSED - Successfully repaired and parsed")
            print(f"  Fixed: {fixed}")
            print(f"  Parsed: {json.dumps(parsed, indent=2)}")
            passed += 1
        except Exception as e:
            print(f"✗ FAILED - {e}")
            print(f"  Fixed attempt: {fixed if 'fixed' in locals() else 'N/A'}")
            failed += 1
        
        print()
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0

if __name__ == "__main__":
    import sys
    success = test_json_repair()
    sys.exit(0 if success else 1)
