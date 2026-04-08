"""
NeuralUCB Contextual Bandit — Adaptive Teaching Style Selection.

Replaces LinUCB with per-arm neural networks (small MLPs) that learn
non-linear reward functions via online SGD.  Exploration is via
MC Dropout: at inference time, dropout stays ON and we sample K forward
passes — the mean gives the predicted reward, the std gives uncertainty.
UCB score = mean + alpha * std.

This lets the bandit learn student-specific, non-linear reward landscapes
that LinUCB (which assumes linear relationships between context and reward)
cannot capture.

Arms (teaching styles)
----------------------
example_first   Lead with 2 concrete examples, then theory
step_by_step    Numbered breakdown, 3–5 steps, no paragraphs
analogy         Real-world analogy mapped explicitly to the concept
conceptual      Formal definition first, then intuition, no examples
socratic        Guiding questions — make the student discover the answer
problem_solving Give a concrete problem and work through it together

Context features (d=12)
-----------------------
0  difficulty_norm    0=easy, 0.5=intermediate, 1.0=hard
1  recent_avg         mean of last 5 knowledge signals (−1…+1)
2  confusion_rate     fraction of last 10 msgs with negative signal
3  gap_norm           min(session_gap_days / 30, 1)
4  count_norm         min(total_interactions / 100, 1)
5  mastery_mean       mean effective mastery (0…1)
6  mastery_std        std of effective mastery (unevenness of knowledge)
7  top_weak_mastery   lowest single-concept effective mastery (0…1)
8  top_strong_mastery highest single-concept effective mastery (0…1)
9  n_decayed_norm     min(n_decayed_concepts / 10, 1)
10 recent_trend       last_signal − recent_avg (trend direction, −2…+2, clipped)
11 bias               always 1.0

NeuralArm architecture
-----------------------
Linear(12→32) → ReLU → Dropout(0.2) → Linear(32→16) → ReLU → Dropout(0.2) → Linear(16→1)
Online update: Adam, MSE loss.
MC Dropout at inference (K=30 samples) → mean ± std → UCB.

Persistence
-----------
Full torch state_dict per arm, serialised to JSON, stored in
StudentStyleModel.bandit_state.  Old LinUCB format (has "A" key) is
detected and discarded → fresh NeuralBandit initialised.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

STYLES = [
    "example_first",
    "step_by_step",
    "analogy",
    "conceptual",
    "socratic",
    "problem_solving",
]

N_FEATURES = 12
ALPHA      = 1.0
MC_SAMPLES = 30
_HIDDEN    = 32

STYLE_INSTRUCTIONS: dict[str, str] = {
    "example_first": (
        "TEACHING FORMAT — EXAMPLES FIRST:\n"
        "• Open with exactly 2 concrete, real-world examples before any theory.\n"
        "• Make examples specific and tangible — numbers, names, scenarios.\n"
        "• After both examples, explain the underlying principle in one paragraph.\n"
        "• Show explicitly how each example maps to the theory.\n"
        "DO NOT open with a definition or abstract statement."
    ),
    "step_by_step": (
        "TEACHING FORMAT — STEP BY STEP:\n"
        "• Structure your entire response as exactly 3–5 numbered steps.\n"
        "• Each step = one sentence maximum.\n"
        "• No paragraphs between steps.\n"
        "• End with a single bold 'Key point:' line.\n"
        "DO NOT use prose paragraphs."
    ),
    "analogy": (
        "TEACHING FORMAT — ANALOGY FIRST:\n"
        "• Open with one vivid, real-world analogy the student can immediately picture.\n"
        "• Explicitly map each component of the analogy to the technical concept.\n"
        "• Then state the formal principle.\n"
        "• Close by noting where the analogy breaks down (honesty builds trust).\n"
        "DO NOT skip the explicit analogy-to-concept mapping."
    ),
    "conceptual": (
        "TEACHING FORMAT — CONCEPTUAL:\n"
        "• State the formal definition in one precise sentence.\n"
        "• Explain the intuition behind it in plain language.\n"
        "• State why it matters and what it lets us do.\n"
        "• Skip examples unless clarity absolutely requires one.\n"
        "DO NOT pad with examples or analogies."
    ),
    "socratic": (
        "TEACHING FORMAT — SOCRATIC:\n"
        "• Do NOT give the answer directly.\n"
        "• Ask 1–2 guiding questions that scaffold toward the answer.\n"
        "• After each question, wait — indicate you want their response.\n"
        "• When they respond, build on their answer rather than replacing it.\n"
        "DO NOT state the conclusion for them."
    ),
    "problem_solving": (
        "TEACHING FORMAT — PROBLEM SOLVING:\n"
        "• Present one concrete, worked problem directly related to the concept.\n"
        "• Walk through the solution step by step, narrating each decision.\n"
        "• Highlight the key insight at the moment it appears.\n"
        "• End with: 'Now try this simpler variation: [variant problem]'\n"
        "DO NOT explain theory before the problem."
    ),
}


# ── Neural Arm ────────────────────────────────────────────────────────────────

class _NeuralArm(nn.Module):
    """
    Small MLP with MC Dropout for per-arm reward prediction.

    Exploration via MC Dropout:
      - At inference, keep dropout ON, run K forward passes
      - UCB = mean(preds) + alpha * std(preds)
      - Fresh arm (all zeros init via default PyTorch) → high std → exploration
      - Trained arm → lower std → exploitation
    """

    def __init__(self, d_in: int = N_FEATURES, hidden: int = _HIDDEN, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_in, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden // 2, 1),
        )
        nn.init.xavier_uniform_(self.net[0].weight)
        nn.init.xavier_uniform_(self.net[3].weight)
        nn.init.zeros_(self.net[6].weight)   # output starts near 0 → unbiased start
        self.optimizer = torch.optim.Adam(self.parameters(), lr=5e-3)
        self.n_updates = 0

    def score(self, x: np.ndarray, alpha: float = ALPHA) -> float:
        """MC Dropout UCB score."""
        xt = torch.FloatTensor(x).unsqueeze(0)
        self.train()   # dropout ON during inference for uncertainty
        with torch.no_grad():
            preds = torch.cat([self.net(xt) for _ in range(MC_SAMPLES)], dim=0)
        mu  = float(preds.mean())
        std = float(preds.std())
        return mu + alpha * std

    def update(self, x: np.ndarray, reward: float):
        """Single online gradient step on MSE loss."""
        xt = torch.FloatTensor(x).unsqueeze(0)
        rt = torch.tensor([[reward]], dtype=torch.float32)
        self.train()
        self.optimizer.zero_grad()
        F.mse_loss(self.net(xt), rt).backward()
        self.optimizer.step()
        self.n_updates += 1

    def to_dict(self) -> dict:
        return {
            "type":  "neural",
            "state": {k: v.tolist() for k, v in self.state_dict().items()},
            "n":     self.n_updates,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "_NeuralArm":
        arm = cls()
        if d.get("state"):
            state = {k: torch.tensor(v) for k, v in d["state"].items()}
            arm.load_state_dict(state)
        arm.n_updates = d.get("n", 0)
        return arm


# ── Bandit ────────────────────────────────────────────────────────────────────

class StyleBandit:
    def __init__(self, alpha: float = ALPHA):
        self.alpha = alpha
        self.arms: dict[str, _NeuralArm] = {s: _NeuralArm() for s in STYLES}

    def select(
        self,
        context: np.ndarray,
        forced: Optional[str] = None,
    ) -> tuple[str, dict[str, float]]:
        scores = {s: arm.score(context, self.alpha) for s, arm in self.arms.items()}
        if forced and forced in self.arms:
            return forced, scores
        return max(scores, key=scores.__getitem__), scores

    def update(self, style: str, context: np.ndarray, reward: float):
        if style in self.arms:
            self.arms[style].update(context, reward)
            logger.info(f"[BANDIT] updated arm={style!r} reward={reward:+.3f} n={self.arms[style].n_updates}")

    def to_json(self) -> str:
        return json.dumps({s: arm.to_dict() for s, arm in self.arms.items()})

    @classmethod
    def from_json(cls, payload: str, alpha: float = ALPHA) -> "StyleBandit":
        bandit = cls(alpha=alpha)
        data   = json.loads(payload)
        for style, arm_data in data.items():
            if style not in bandit.arms:
                continue
            if arm_data.get("type") != "neural":
                logger.info(f"[BANDIT] Old LinUCB state for arm={style!r} discarded — using fresh NeuralArm.")
                continue
            try:
                bandit.arms[style] = _NeuralArm.from_dict(arm_data)
            except Exception as e:
                logger.warning(f"[BANDIT] Failed to load arm={style!r}: {e} — using fresh arm.")
        return bandit


# ── Context builder ───────────────────────────────────────────────────────────

def build_context(
    difficulty_level:  str,
    recent_signals:    list[float],
    session_gap_days:  Optional[float],
    n_interactions:    int,
    concept_mastery:   float = 0.5,
    mastery_dict:      Optional[dict[str, float]] = None,
    n_decayed:         int   = 0,
) -> np.ndarray:
    """
    Build the d=12 context vector for NeuralUCB.

    New vs old (d=7 LinUCB):
      - mastery_std, top_weak_mastery, top_strong_mastery: more info from DKT
      - n_decayed_norm: how many concepts are at risk of forgetting
      - recent_trend: is the student improving or declining right now?
    """
    diff_map   = {"easy": 0.0, "beginner": 0.0, "intermediate": 0.5, "hard": 1.0, "advanced": 1.0}
    difficulty = diff_map.get((difficulty_level or "intermediate").lower(), 0.5)

    last5          = recent_signals[-5:] if recent_signals else []
    recent_avg     = float(np.mean(last5)) if last5 else 0.0

    last10         = recent_signals[-10:] if recent_signals else []
    confusion_rate = sum(1 for s in last10 if s < 0) / max(len(last10), 1)

    gap_norm       = min((session_gap_days or 0.0) / 30.0, 1.0)
    count_norm     = min(n_interactions / 100.0, 1.0)

    if mastery_dict and len(mastery_dict) > 0:
        vals           = list(mastery_dict.values())
        mastery_mean   = float(np.mean(vals))
        mastery_std    = float(np.std(vals))
        top_weak_m     = float(np.min(vals))
        top_strong_m   = float(np.max(vals))
    else:
        mastery_mean   = float(np.clip(concept_mastery, 0.0, 1.0))
        mastery_std    = 0.1
        top_weak_m     = max(0.0, mastery_mean - 0.2)
        top_strong_m   = min(1.0, mastery_mean + 0.2)

    n_decayed_norm = min(n_decayed / 10.0, 1.0)

    last_sig       = recent_signals[-1] if recent_signals else 0.0
    recent_trend   = float(np.clip(last_sig - recent_avg, -1.0, 1.0))

    return np.array([
        difficulty,
        recent_avg,
        confusion_rate,
        gap_norm,
        count_norm,
        mastery_mean,
        mastery_std,
        top_weak_m,
        top_strong_m,
        n_decayed_norm,
        recent_trend,
        1.0,   # bias
    ], dtype=np.float64)


# ── DB helpers ────────────────────────────────────────────────────────────────

def load_bandit(user_id: int, db) -> StyleBandit:
    try:
        from models import StudentStyleModel
        row = db.query(StudentStyleModel).filter(StudentStyleModel.user_id == user_id).first()
        if row and row.bandit_state:
            return StyleBandit.from_json(row.bandit_state)
    except Exception as e:
        logger.warning(f"[BANDIT] load failed for user={user_id}: {e}")
    return StyleBandit()


def save_bandit(user_id: int, bandit: StyleBandit, db):
    try:
        from models import StudentStyleModel
        from datetime import datetime, timezone
        row     = db.query(StudentStyleModel).filter(StudentStyleModel.user_id == user_id).first()
        payload = bandit.to_json()
        now     = datetime.now(timezone.utc)
        if row:
            row.bandit_state = payload
            row.updated_at   = now
        else:
            db.add(StudentStyleModel(user_id=user_id, bandit_state=payload, updated_at=now))
        db.commit()
    except Exception as e:
        logger.warning(f"[BANDIT] save failed for user={user_id}: {e}")


def get_recent_signals(user_id: int, db, limit: int = 20) -> list[float]:
    try:
        from models import ChatConceptSignal
        rows = (
            db.query(ChatConceptSignal.knowledge_signal)
            .filter(ChatConceptSignal.user_id == user_id)
            .order_by(ChatConceptSignal.created_at.desc())
            .limit(limit)
            .all()
        )
        return [float(r[0]) for r in reversed(rows)]
    except Exception as e:
        logger.warning(f"[BANDIT] recent signals fetch failed: {e}")
        return []


def get_pending_update(user_id: int, db) -> Optional[dict]:
    try:
        from models import StudentStyleModel
        row = db.query(StudentStyleModel).filter(StudentStyleModel.user_id == user_id).first()
        if row and row.pending_style and row.pending_context:
            return {
                "style":   row.pending_style,
                "context": np.array(json.loads(row.pending_context), dtype=np.float64),
            }
    except Exception as e:
        logger.warning(f"[BANDIT] pending update fetch failed: {e}")
    return None


def set_pending_update(user_id: int, style: str, context: np.ndarray, db):
    try:
        from models import StudentStyleModel
        from datetime import datetime, timezone
        row     = db.query(StudentStyleModel).filter(StudentStyleModel.user_id == user_id).first()
        payload = json.dumps(context.tolist())
        now     = datetime.now(timezone.utc)
        if row:
            row.pending_style   = style
            row.pending_context = payload
            row.updated_at      = now
        else:
            db.add(StudentStyleModel(
                user_id         = user_id,
                pending_style   = style,
                pending_context = payload,
                updated_at      = now,
            ))
        db.commit()
    except Exception as e:
        logger.warning(f"[BANDIT] set_pending_update failed: {e}")
