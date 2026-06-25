import { getTokenUsageFromResponse } from '../../utils/fetchInterceptor';

describe('getTokenUsageFromResponse', () => {
  test('reads the post-request token usage headers', () => {
    const response = new Response(null, {
      headers: {
        'X-TokenLimit-Used': '178250',
        'X-TokenLimit-Limit': '5000000',
        'X-TokenLimit-Remaining': '4821750',
        'X-TokenLimit-Plan': 'power',
      },
    });

    expect(getTokenUsageFromResponse(response)).toEqual({
      usedTokens: 178250,
      includedTokens: 5000000,
      remainingTokens: 4821750,
      currentPlanId: 'power',
    });
  });

  test('ignores responses without token usage headers', () => {
    expect(getTokenUsageFromResponse(new Response())).toBeNull();
  });
});
