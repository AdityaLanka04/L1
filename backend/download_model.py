import sentence_transformers
try:
    sentence_transformers.SentenceTransformer("BAAI/bge-small-en-v1.5")
    print("Cached: BAAI/bge-small-en-v1.5")
except Exception as e:
    print(f"Fallback ({e})")
    sentence_transformers.SentenceTransformer("all-MiniLM-L6-v2")
    print("Cached: all-MiniLM-L6-v2")
