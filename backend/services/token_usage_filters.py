"""Shared SQL filters for billable AI token usage.

The activity log also keeps request rows and estimated fallback token rows for
analytics. Plan limits should only use exact provider-reported model usage so
the dashboard matches API key accounting instead of charging estimates.
"""

BILLABLE_AI_USAGE_WHERE = """
AND action = 'ai_generate'
AND tokens_used > 0
AND metadata IS NOT NULL
AND (
    metadata LIKE '%"event_type": "ai_usage"%'
    OR metadata LIKE '%"event_type":"ai_usage"%'
)
AND (
    metadata LIKE '%"token_source": "model_usage"%'
    OR metadata LIKE '%"token_source":"model_usage"%'
)
"""

