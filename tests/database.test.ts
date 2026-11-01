import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseUrl } from '../lib/database';

test('database configuration supports Supabase integration and explicit override', () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
  };
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    assert.equal(databaseUrl(), undefined);
    process.env.POSTGRES_URL =
      'postgresql://localhost/supabase-integration-test';
    assert.equal(databaseUrl(), process.env.POSTGRES_URL);
    process.env.DATABASE_URL = '';
    assert.equal(databaseUrl(), process.env.POSTGRES_URL);
    process.env.DATABASE_URL = 'postgresql://localhost/explicit-override-test';
    assert.equal(databaseUrl(), process.env.DATABASE_URL);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
