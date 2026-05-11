"""
Train the global signal classifier on the GoEmotions dataset.

Downloads GoEmotions from HuggingFace (~58K Reddit comments with 28 emotion
labels), maps those labels to our 7-class signal taxonomy, embeds with
all-MiniLM-L6-v2, and trains a global linear head via mini-batch SGD.

The saved weights (global_signal_head.npz) are loaded by language_analyzer.py
as the starting point for every new student's classifier — replacing the
zero-init cold start with a pre-trained baseline.

Usage (from backend/):
    pip install datasets          # one-time
    python -m dkt.train_signal_classifier [--epochs 10] [--lr 0.01] [--batch 64]
"""
from __future__ import annotations

import argparse
import logging
import os

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

# GoEmotions 28 emotion labels in dataset index order
_GOEMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral",
]

# Map each GoEmotions emotion → our educational signal taxonomy.
# GoEmotions is Reddit data so the mapping is approximate; the per-student
# online adaptation layer corrects any domain mismatch over time.
_EMOTION_TO_SIGNAL: dict[str, str] = {
    "admiration":     "mastery",      # "that's a great explanation!"
    "amusement":      "neutral",
    "anger":          "confusion",    # frustrated at not understanding
    "annoyance":      "re_ask",       # annoyed at a confusing explanation
    "approval":       "mastery",
    "caring":         "neutral",
    "confusion":      "confusion",    # direct match
    "curiosity":      "extension",    # wants to dig deeper
    "desire":         "extension",
    "disappointment": "re_ask",       # disappointed at the explanation quality
    "disapproval":    "re_ask",
    "disgust":        "confusion",
    "embarrassment":  "hesitation",
    "excitement":     "mastery",
    "fear":           "hesitation",
    "gratitude":      "mastery",      # "thank you, now I get it"
    "grief":          "confusion",
    "joy":            "mastery",
    "love":           "neutral",
    "nervousness":    "hesitation",
    "optimism":       "extension",
    "pride":          "mastery",
    "realization":    "mastery",      # aha moment
    "relief":         "mastery",      # finally understood
    "remorse":        "doubt",        # second-guessing themselves
    "sadness":        "confusion",
    "surprise":       "doubt",        # uncertain / surprised by information
    "neutral":        "neutral",
}

_SIGNAL_CLASSES = ["confusion", "re_ask", "doubt", "hesitation", "neutral", "extension", "mastery"]
_D_EMBED = 384
_OUT_PATH = os.path.join(os.path.dirname(__file__), "global_signal_head.npz")


def _softmax(z: np.ndarray) -> np.ndarray:
    e = np.exp(z - z.max())
    return e / (e.sum() + 1e-9)


def _collect_examples() -> tuple[list[str], list[int]]:
    """Return (texts, label_indices) from GoEmotions + seeded prototypes."""
    from datasets import load_dataset

    log.info("Downloading GoEmotions (train + validation splits)…")
    ds = load_dataset("go_emotions", split="train+validation")

    texts: list[str] = []
    label_ids: list[int] = []

    for row in ds:
        lbls = row["labels"]
        if len(lbls) != 1:
            continue  # skip multi-label / ambiguous examples
        emotion = _GOEMOTIONS[lbls[0]]
        sig = _EMOTION_TO_SIGNAL.get(emotion)
        if sig is None:
            continue
        texts.append(row["text"])
        label_ids.append(_SIGNAL_CLASSES.index(sig))

    log.info(f"  GoEmotions single-label: {len(texts):,} examples")

    # Seed with the hand-crafted prototypes from language_analyzer — these are
    # high-quality, domain-correct examples so we repeat them to give weight.
    from dkt.language_analyzer import SIGNAL_PROTOTYPES

    seed = 0
    for sig, phrases in SIGNAL_PROTOTYPES.items():
        if sig not in _SIGNAL_CLASSES:
            continue
        idx = _SIGNAL_CLASSES.index(sig)
        for phrase in phrases:
            for _ in range(8):   # repeat 8× to up-weight domain examples
                texts.append(phrase)
                label_ids.append(idx)
                seed += 1

    log.info(f"  Prototype seeds:          {seed:,} examples")
    log.info(f"  Total:                    {len(texts):,} examples, {len(_SIGNAL_CLASSES)} classes")

    dist = {}
    for i in label_ids:
        dist[_SIGNAL_CLASSES[i]] = dist.get(_SIGNAL_CLASSES[i], 0) + 1
    for cls, cnt in sorted(dist.items(), key=lambda x: -x[1]):
        log.info(f"    {cls:<20} {cnt:>6,}")

    return texts, label_ids


def train(epochs: int = 10, lr: float = 0.01, batch_size: int = 64) -> None:
    from sentence_transformers import SentenceTransformer

    texts, label_ids = _collect_examples()
    y = np.array(label_ids, dtype=np.int32)
    n = len(texts)
    n_cls = len(_SIGNAL_CLASSES)

    log.info("\nLoading all-MiniLM-L6-v2 encoder…")
    encoder = SentenceTransformer("all-MiniLM-L6-v2")

    log.info("Embedding all examples… (2–5 min on CPU)")
    X = encoder.encode(
        texts,
        batch_size=256,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    # Xavier initialisation
    W = np.random.randn(n_cls, _D_EMBED) * np.sqrt(2.0 / (_D_EMBED + n_cls))
    b = np.zeros(n_cls, dtype=np.float64)

    log.info(f"\nTraining linear head: {n:,} examples × {epochs} epochs")
    current_lr = lr
    for epoch in range(epochs):
        perm = np.random.permutation(n)
        Xs, ys = X[perm], y[perm]
        total_loss, correct = 0.0, 0

        for i in range(0, n, batch_size):
            xb = Xs[i : i + batch_size]
            yb = ys[i : i + batch_size]
            bs = len(xb)

            logits = xb @ W.T + b                        # (bs, n_cls)
            probs  = np.array([_softmax(l) for l in logits])

            total_loss += -np.log(probs[np.arange(bs), yb] + 1e-9).sum()
            correct    += (probs.argmax(axis=1) == yb).sum()

            grad = probs.copy()
            grad[np.arange(bs), yb] -= 1.0
            grad /= bs

            W -= current_lr * (grad.T @ xb)
            b -= current_lr * grad.sum(axis=0)

        current_lr *= 0.92
        log.info(
            f"  Epoch {epoch+1:>2}/{epochs}  "
            f"loss={total_loss/n:.4f}  acc={correct/n:.4f}  lr={current_lr:.5f}"
        )

    np.savez(_OUT_PATH, W=W, b=b)
    log.info(f"\nSaved → {_OUT_PATH}")
    log.info("New students will now start from this trained baseline.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Train global signal classifier on GoEmotions.")
    p.add_argument("--epochs", type=int,   default=10,   help="Training epochs (default 10)")
    p.add_argument("--lr",     type=float, default=0.01, help="Initial learning rate (default 0.01)")
    p.add_argument("--batch",  type=int,   default=64,   help="Mini-batch size (default 64)")
    args = p.parse_args()
    train(args.epochs, args.lr, args.batch)
