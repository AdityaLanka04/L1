import { formatUsageLimitMessage, getUsageLimitFromResponse } from '../../utils/usageLimit';

test('provider quota is distinguished from an account allowance', () => {
  expect(formatUsageLimitMessage({ code: 'ai_provider_limit_exceeded', resetAfterSeconds: 120 }))
    .toBe('The AI service has reached its shared provider limit. This is not your account allowance. Try again in 2 minutes.');
});

test('an unknown reset time is not fabricated', () => {
  expect(formatUsageLimitMessage({ resetAfterSeconds: null, resetAfterHours: null }))
    .toContain('No reset time is available yet');
});

test('a missing hour estimate does not hide the actual seconds', () => {
  expect(formatUsageLimitMessage({ resetAfterHours: null, resetAfterSeconds: 7200 })).toContain('2 hours');
});

test('response header reset is used when payload fields are null', async () => {
  const response = { status: 429, clone: () => ({ json: async () => ({ detail: {
    code: 'ai_provider_limit_exceeded', reset_after_seconds: null, reset_after_hours: null } }) }),
    headers: { get: (key) => key === 'Retry-After' ? '90' : null } };
  const limit = await getUsageLimitFromResponse(response);
  expect(limit.resetAfterSeconds).toBe(90);
  expect(formatUsageLimitMessage(limit)).toContain('2 minutes');
});

test('temporary provider busy is not interpreted as a daily quota', async () => {
  expect(await getUsageLimitFromResponse({ status: 503 })).toBe(null);
});
