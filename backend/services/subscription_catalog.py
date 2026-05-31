from __future__ import annotations

from copy import deepcopy
from typing import Any

DEFAULT_PLAN_ID = "starter"

SUBSCRIPTION_PLANS: dict[str, dict[str, Any]] = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "monthly_price_usd": 0.0,
        "yearly_price_usd": 0.0,
        "included_tokens_monthly": 100_000,
        "estimated_cost_at_included_usage_usd": 0.74,
        "summary": "Great for getting started with everyday studying.",
        "features": [
            "Ask your AI tutor quick doubts any time",
            "Create notes, flashcards, and quizzes in minutes",
            "Track progress with basic streaks and rewards",
            "Best for light and occasional study sessions",
        ],
        "rate_limits": {
            "ai_heavy": 12,
            "ai_light": 70,
            "file_upload": 10,
            "write": 200,
            "read": 700,
        },
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "monthly_price_usd": 15.0,
        "yearly_price_usd": 150.0,
        "included_tokens_monthly": 500_000,
        "estimated_cost_at_included_usage_usd": 2.13,
        "summary": "Best for students who study regularly each week.",
        "features": [
            "Everything in Starter",
            "More AI study sessions and faster output",
            "Smarter revision recommendations based on your learning",
            "Deeper progress insights and study planning tools",
            "Ideal for consistent daily learners",
        ],
        "rate_limits": {
            "ai_heavy": 45,
            "ai_light": 250,
            "file_upload": 45,
            "write": 650,
            "read": 2_500,
        },
    },
    "power": {
        "id": "power",
        "name": "Power",
        "monthly_price_usd": 25.0,
        "yearly_price_usd": 249.0,
        "included_tokens_monthly": 3_000_000,
        "estimated_cost_at_included_usage_usd": 6.95,
        "summary": "For intensive learners who rely on AI every day.",
        "features": [
            "Everything in Pro",
            "Highest AI allowance for heavy study workloads",
            "Priority processing for large and complex tasks",
            "Advanced learning tools for deep prep",
            "Built for power users and exam crunch periods",
        ],
        "rate_limits": {
            "ai_heavy": 120,
            "ai_light": 650,
            "file_upload": 120,
            "write": 1_800,
            "read": 7_000,
        },
    },
}

def normalize_plan_id(plan_id: str | None) -> str:
    candidate = (plan_id or "").strip().lower()
    return candidate if candidate in SUBSCRIPTION_PLANS else DEFAULT_PLAN_ID

def get_plan(plan_id: str | None) -> dict[str, Any]:
    plan = SUBSCRIPTION_PLANS[normalize_plan_id(plan_id)]
    payload = deepcopy(plan)
    monthly_price = float(payload.get("monthly_price_usd") or 0.0)
    estimated_cost = float(payload.get("estimated_cost_at_included_usage_usd") or 0.0)
    margin = monthly_price - estimated_cost
    payload["estimated_margin_usd"] = round(margin, 2)
    payload["estimated_margin_pct"] = round((margin / monthly_price) * 100, 1) if monthly_price > 0 else None
    return payload

def list_plans() -> list[dict[str, Any]]:
    return [get_plan(plan_id) for plan_id in ("starter", "pro", "power")]

def get_plan_ids() -> list[str]:
    return list(SUBSCRIPTION_PLANS.keys())

def get_effective_rate_limit(plan_id: str | None, limiter_tier: str, base_limit: int) -> int:
    plan = SUBSCRIPTION_PLANS.get(normalize_plan_id(plan_id))
    if not plan:
        return base_limit
    return int(plan.get("rate_limits", {}).get(limiter_tier, base_limit))

def estimate_usage_cost_usd(plan_id: str | None, token_count: int | float) -> float:
    plan = SUBSCRIPTION_PLANS.get(normalize_plan_id(plan_id))
    if not plan:
        return 0.0
    included_tokens = float(plan.get("included_tokens_monthly") or 0)
    included_cost = float(plan.get("estimated_cost_at_included_usage_usd") or 0.0)
    if included_tokens <= 0 or included_cost <= 0:
        return 0.0
    cost_per_token = included_cost / included_tokens
    return round(max(0.0, float(token_count) * cost_per_token), 2)
