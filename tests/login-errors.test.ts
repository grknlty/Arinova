import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/auth/route';

test('login failures distinguish setup, credentials, rate limits and database errors', async (t) => {
  const names = [
    'PARENT_PASSWORD',
    'LEARNER_PASSWORD',
    'SESSION_SECRET',
    'DATABASE_URL',
    'POSTGRES_URL',
    'NODE_ENV',
    'VERCEL',
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const request = (data: unknown) =>
    new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: {
        host: 'localhost',
        origin: 'http://localhost',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  async function check(data: unknown, status: number, code: string) {
    const response = await POST(request(data));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { code });
  }
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { NODE_ENV: 'development' });
    await t.test(
      'malformed requests are not reported as incorrect passwords',
      async () => {
        await check(null, 400, 'AUTH_INVALID_REQUEST');
        await check({ role: 'parent' }, 400, 'AUTH_INVALID_REQUEST');
      },
    );
    await t.test(
      'missing role password and missing/short session secret have specific errors',
      async () => {
        await check(
          { role: 'parent', password: 'test-input' },
          503,
          'AUTH_PASSWORD_NOT_CONFIGURED',
        );
        process.env.PARENT_PASSWORD = 'test-parent-password';
        await check(
          { role: 'parent', password: 'test-input' },
          503,
          'AUTH_SESSION_NOT_CONFIGURED',
        );
        process.env.SESSION_SECRET = 'short';
        await check(
          { role: 'parent', password: 'test-input' },
          503,
          'AUTH_SESSION_NOT_CONFIGURED',
        );
        process.env.SESSION_SECRET = 'test-session-secret-for-local-tests-only';
      },
    );
    await t.test(
      'wrong password remains unauthorized and learner has a separate password',
      async () => {
        await check(
          { role: 'parent', password: 'incorrect' },
          401,
          'AUTH_INVALID_CREDENTIALS',
        );
        await check(
          { role: 'learner', password: 'test-parent-password' },
          503,
          'AUTH_PASSWORD_NOT_CONFIGURED',
        );
        process.env.LEARNER_PASSWORD = 'test-learner-password';
        await check(
          { role: 'learner', password: 'test-parent-password' },
          401,
          'AUTH_INVALID_CREDENTIALS',
        );
      },
    );
    await t.test(
      'rate-limited login is distinct from wrong credentials',
      async () => {
        for (let i = 0; i < 20; i++)
          await POST(request({ role: 'parent', password: 'incorrect' }));
        const response = await POST(
          request({ role: 'parent', password: 'incorrect' }),
        );
        assert.equal(response.status, 429);
        assert.equal(response.headers.get('Retry-After'), '900');
        assert.deepEqual(await response.json(), { code: 'AUTH_RATE_LIMITED' });
      },
    );
    await t.test(
      'unreachable database returns a safe category and logs no connection values',
      async () => {
        process.env.POSTGRES_URL =
          'postgresql://postgres@127.0.0.1:1/nonexistent_test_database';
        const output: unknown[][] = [];
        const original = console.error;
        console.error = (...args) => {
          output.push(args);
        };
        try {
          const response = await POST(
            request({ role: 'parent', password: 'test-parent-password' }),
          );
          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), {
            code: 'AUTH_DATABASE_UNAVAILABLE',
            diagnostic: 'database_network',
          });
          assert.deepEqual(output, [['Arinova sign-in:', 'database_network']]);
        } finally {
          console.error = original;
        }
      },
    );
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
