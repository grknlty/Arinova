import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameOrigin, equal, token, demo } from '../lib/auth';
test('origin protection tolerates normalized URLs but rejects other sites', () => {
  assert.equal(
    sameOrigin(
      new Request('http://localhost:3000/api/auth', {
        headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request('https://arinova.example/api/auth', {
        headers: { host: 'arinova.example', origin: 'https://other.example' },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      new Request('https://arinova.example/api/auth', {
        headers: { host: 'arinova.example', origin: 'null' },
      }),
    ),
    false,
  );
});
test('token creation requires a strong session secret', () => {
  const previous = process.env.SESSION_SECRET;
  try {
    delete process.env.SESSION_SECRET;
    assert.throws(() => token('parent'));
    process.env.SESSION_SECRET = 'short';
    assert.throws(() => token('parent'));
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
  assert.equal(equal('a', 'a'), true);
  assert.equal(equal('a', 'ab'), false);
  assert.equal(equal('a', 'b'), false);
});
test('Vercel never enables the local demo', () => {
  const previous = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    assert.equal(demo(), false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
