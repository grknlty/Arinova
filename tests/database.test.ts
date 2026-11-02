import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionConfig, databaseUrl } from '../lib/database';
import { supabaseRootCa } from '../lib/supabase-ca';

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

test('Supabase connections verify against the Supabase CA', () => {
  const url =
    'postgres://user:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x';
  const config = connectionConfig(url);
  assert.equal(
    config.connectionString,
    'postgres://user:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?supa=base-pooler.x',
  );
  assert.deepEqual(config.ssl, {
    ca: supabaseRootCa,
    rejectUnauthorized: true,
  });
  const local = 'postgresql://localhost/test?sslmode=disable';
  assert.deepEqual(connectionConfig(local), { connectionString: local });
});
