"""Live request-first chat smoke test. Uses configured providers; creates no chats."""
import asyncio
import json
import logging
import os
import sys

logging.disable(logging.CRITICAL)
from services.api_key_pool import build_key_pool
from services.ai_utils import UnifiedAIClient
from tutor import nodes
from services.ai_result import AIProviderBusyError

_original_generate = nodes._agenerate
async def _paced_generate(*args, **kwargs):
    for attempt in range(6):
        try:
            result = await _original_generate(*args, **kwargs)
            if "Review this tutor response independently" in str(args[1] if len(args) > 1 else kwargs.get('prompt', '')):
                print('REVIEW_RESULT ' + result, file=sys.stderr, flush=True)
            return result
        except AIProviderBusyError as exc:
            if attempt == 5:
                raise
            await asyncio.sleep(max(15, exc.retry_after))
nodes._agenerate = _paced_generate


async def main():
    pool = build_key_pool('groq', ('GROQ_API_KEYS', 'GROQ_API_KEY'))
    ai = UnifiedAIClient(groq_key_pool=pool, groq_model=os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b'))
    history = []
    cases = [
        ('concept_normal', 'Explain quantum physics', False, []),
        ('concept_teach', 'Explain nuclear physics', True, []),
        ('accept_numerical', 'Yes please', True, None),
        ('new_topic', 'Explain photosynthesis', True, None),
        ('explicit_solution', 'Solve 2x + 3 = 11 step by step', True, []),
        ('recall', 'What did I ask you to explain?', False, [{'user': 'Explain quantum physics', 'ai': 'Quantum physics explains microscopic matter.'}]),
        ('decline_offer', 'No thanks', True, [{'user':'Explain nuclear physics', 'ai':'The nucleus contains protons and neutrons. Would you like a step-by-step numerical example?'}]),
        ('check_wrong_answer', 'I solved 2x + 3 = 11 and got x = 7. Is my answer correct?', True, []),
        ('no_numericals', 'Explain quantum physics without numericals or derivations', True, []),
    ]
    selected = os.getenv('PROMPT_SMOKE_CASES', '').split(',')
    for name, question, tutor_mode, given_history in cases:
        if selected != [''] and name not in selected:
            continue
        state = {'user_id': 'prompt-smoke-test', 'user_input': question, 'chat_history': history if given_history is None else given_history,
                 'tutor_mode': tutor_mode, 'tutor_reply_style': 'guided', '_ai_client': ai,
                 'selected_style': 'Forge', 'intelligence_context': 'Start with a worked numerical example before theory.'}
        state.update(nodes.detect_intent(state))
        state.update(await nodes.build_prompt_and_respond(state))
        if tutor_mode:
            state.update(await nodes.review_tutor_response(state))
        raw = state['response']
        payload = json.loads(raw) if tutor_mode else {'answer': raw}
        print(json.dumps({'case': name, 'intent': state['intent'], 'answer': payload['answer'], 'tutor_state': payload.get('tutor_state', {})}), flush=True)
        history = state['chat_history'] + [{'user': question, 'ai': payload['answer']}]


if __name__ == '__main__':
    asyncio.run(main())
