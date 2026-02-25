"""
test_hs_rag.py — quick sanity check for HS curriculum retrieval.

Usage:
  python test_hs_rag.py --query "cellular respiration"
  python test_hs_rag.py --query "photosynthesis" --subject "Biology" --top-k 5
  python test_hs_rag.py --list-subjects
  python test_hs_rag.py --query "photosynthesis" --hs-only
  python test_hs_rag.py --query "photosynthesis" --private-only --user-id 123
"""

import argparse
from pathlib import Path

def _load_chroma_and_embed():
    import chromadb
    from sentence_transformers import SentenceTransformer

    chroma_path = str(Path(__file__).parent / ".chroma_data")
    print(f"[chroma] loading from {chroma_path}")
    client = chromadb.PersistentClient(path=chroma_path)

    print("[embed] loading all-MiniLM-L6-v2 ...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    import context_store
    context_store.initialize(client, model)
    return context_store

def _print_subjects(context_store):
    subjects = context_store.list_hs_subjects()
    if not subjects:
        print("No subjects found in hs_curriculum.")
        return
    print(f"\n{'Subject':<30} {'Grade':<12} {'Docs'}")
    print("-" * 52)
    for s in subjects:
        print(f"{s['subject']:<30} {s['grade_level']:<12} {s['doc_count']}")

def _print_results(results):
    if not results:
        print("\nNo results returned.")
        return
    print(f"\nReturned {len(results)} result(s):")
    for i, r in enumerate(results, 1):
        meta = r.get("metadata", {}) or {}
        snippet = (r.get("text") or "").replace("\n", " ")
        if len(snippet) > 180:
            snippet = snippet[:180] + "..."
        print(
            f"\n[{i}] dist={r.get('distance', 0):.4f} source={r.get('source','')}"
            f" subject={meta.get('subject','') or 'General'} grade={meta.get('grade_level','') or ''}"
            f" file={meta.get('filename','')}"
        )
        print(f"    {snippet}")

def main():
    parser = argparse.ArgumentParser(description="Test HS curriculum retrieval")
    parser.add_argument("--query", default="", help="Search query")
    parser.add_argument("--subject", default="", help="Optional subject filter")
    parser.add_argument("--grade", default="", help="Optional grade-level filter")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results to return")
    parser.add_argument("--user-id", default="system", help="User id to search private docs")
    parser.add_argument("--hs-only", action="store_true", help="Search only hs_curriculum")
    parser.add_argument("--private-only", action="store_true", help="Search only user_docs for --user-id")
    parser.add_argument("--list-subjects", action="store_true", help="List hs_curriculum subjects and exit")
    parser.add_argument(
        "--max-distance",
        type=float,
        default=None,
        help="Override max cosine distance filter (lower = more similar)",
    )
    parser.add_argument(
        "--min-keyword-hits",
        type=int,
        default=None,
        help="Override min keyword hits when query has >=2 keywords",
    )
    args = parser.parse_args()

    if args.hs_only and args.private_only:
        print("Choose only one: --hs-only or --private-only.")
        return

    context_store = _load_chroma_and_embed()

    if args.list_subjects:
        _print_subjects(context_store)
        return

    query = args.query.strip()
    if not query:
        print("Provide --query or use --list-subjects.")
        return

    kwargs = {}
    if args.max_distance is not None:
        kwargs["max_distance"] = args.max_distance
    if args.min_keyword_hits is not None:
        kwargs["min_keyword_hits"] = args.min_keyword_hits

    use_hs = not args.private_only
    user_id = args.user_id
    if args.hs_only:
        user_id = "__hs_only__"

    results = context_store.search_context(
        query=query,
        user_id=user_id,
        use_hs=use_hs,
        top_k=args.top_k,
        subject=args.subject or None,
        grade_level=args.grade or None,
        **kwargs,
    )
    _print_results(results)

if __name__ == "__main__":
    main()
