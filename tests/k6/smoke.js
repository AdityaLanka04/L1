// Smoke test: one VU, one pass over the critical paths of the site.
// Goal is "is production up and wired together correctly", not load.
//
//   k6 run tests/k6/smoke.js                                  # against prod (default)
//   k6 run -e FRONTEND_URL=http://localhost:3000 \
//          -e API_URL=http://localhost:8000/api \
//          tests/k6/smoke.js                                  # against local dev

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { FRONTEND_URL, API_URL, API_ROOT, authHeaders } from './config.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate==1'],
  },
};

export default function () {
  group('frontend availability', () => {
    const home = http.get(`${FRONTEND_URL}/`);
    check(home, {
      'home page returns 200': (r) => r.status === 200,
      'home page serves the React app shell': (r) => r.body.includes('id="root"'),
    });

    const login = http.get(`${FRONTEND_URL}/login`);
    check(login, { 'login page returns 200': (r) => r.status === 200 });
  });

  group('backend health', () => {
    const health = http.get(`${API_URL}/health`);
    check(health, {
      'health endpoint reachable (200/207)': (r) => r.status === 200 || r.status === 207,
      'health body reports a status field': (r) => {
        try {
          return !!JSON.parse(r.body).status;
        } catch (e) {
          return false;
        }
      },
    });

    const openapi = http.get(`${API_ROOT}/openapi.json`);
    check(openapi, {
      'openapi schema is reachable and valid JSON': (r) => {
        try {
          return !!JSON.parse(r.body).paths;
        } catch (e) {
          return false;
        }
      },
    });
  });

  group('auth endpoints respond (without real credentials)', () => {
    // These intentionally send bad input and expect a 4xx — tell k6 that's a
    // "successful" request so it doesn't trip the http_req_failed threshold.
    const expect4xx = { responseCallback: http.expectedStatuses({ min: 400, max: 499 }) };

    const badLogin = http.post(
      `${API_URL}/token`,
      { username: 'k6-smoke-test-nonexistent-user', password: 'wrong-password' },
      expect4xx
    );
    check(badLogin, {
      'login rejects bad creds with 4xx, not 5xx': (r) => r.status >= 400 && r.status < 500,
    });

    const badRegister = http.post(
      `${API_URL}/register`,
      JSON.stringify({}),
      { headers: { 'Content-Type': 'application/json' }, ...expect4xx }
    );
    check(badRegister, {
      'register validates input with 4xx, not 5xx': (r) => r.status >= 400 && r.status < 500,
    });
  });

  group('authenticated smoke (skipped unless TEST_USERNAME/TEST_PASSWORD set)', () => {
    const headers = authHeaders();
    if (!headers) return;

    check(http.get(`${API_URL}/me`, { headers }), {
      'authenticated /me returns 200': (r) => r.status === 200,
    });
    check(http.get(`${API_URL}/get_dashboard_data`, { headers }), {
      'authenticated dashboard data returns 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
