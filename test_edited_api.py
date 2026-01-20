import requests

# Test the API endpoint
response = requests.get('http://localhost:8000/api/get_flashcards_in_set?set_id=3')
data = response.json()

print("Set Title:", data['set_title'])
print("\nFlashcards:")
for card in data['flashcards']:
    print(f"\nCard ID: {card['id']}")
    print(f"Question: {card['question'][:50]}...")
    print(f"Is Edited: {card.get('is_edited', 'NOT IN RESPONSE')}")
    print(f"Edited At: {card.get('edited_at', 'NOT IN RESPONSE')}")
    if card.get('is_edited'):
        print("✓ This card is marked as edited!")
