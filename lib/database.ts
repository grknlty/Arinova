import { Pool, type PoolConfig } from 'pg';
import { supabaseRootCa } from './supabase-ca';

const runtime = globalThis as unknown as {
  arinovaDatabase?: Pool;
  arinovaSchema?: Promise<void>;
};

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

// pg treats sslmode=require as full verification, and SSL settings in the URL
// replace the ssl option. For Supabase, drop them and verify against its CA.
export function connectionConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  if (!/(^|\.)supabase\.(com|co)$/.test(url.hostname))
    return { connectionString };
  for (const key of [
    'sslmode',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'uselibpqcompat',
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca: supabaseRootCa, rejectUnauthorized: true },
  };
}

async function initialize(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.arinova_records (
        id uuid PRIMARY KEY,
        kind text NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      'ALTER TABLE public.arinova_records ENABLE ROW LEVEL SECURITY',
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.arinova_login_limits (
        key text PRIMARY KEY,
        count integer NOT NULL,
        expires bigint NOT NULL
      )
    `);
    await client.query(
      'ALTER TABLE public.arinova_login_limits ENABLE ROW LEVEL SECURITY',
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function database(): Promise<Pool | null> {
  const connectionString = databaseUrl();
  if (!connectionString) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production')
      throw new Error('DATABASE_URL or POSTGRES_URL is required in production');
    return null;
  }
  const pool = (runtime.arinovaDatabase ??= new Pool({
    ...connectionConfig(connectionString),
    max: 3,
    connectionTimeoutMillis: 10000,
  }));
  await (runtime.arinovaSchema ??= initialize(pool).catch((error) => {
    runtime.arinovaSchema = undefined;
    throw error;
  }));
  return pool;
}
