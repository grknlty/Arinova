import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../lib/database';
import { add, list } from '../lib/store';
import { allowLogin } from '../lib/rate-limit';
import { grade } from '../lib/model';
import { sample } from '../lib/sample';

test(
  'PostgreSQL storage, throttling and anonymous-role isolation',
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    // This suite creates tables and a test role; use a disposable local database only.
    const url = new URL(process.env.TEST_DATABASE_URL!);
    assert.ok(
      ['localhost', '127.0.0.1'].includes(url.hostname),
      'Integration tests require a local disposable PostgreSQL database',
    );
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = process.env.TEST_DATABASE_URL;
    const db = await database();
    assert.ok(db);
    try {
      await t.test(
        'creates owner-accessible tables with RLS enabled',
        async () => {
          const result = await db.query(
            "SELECT relname, relrowsecurity FROM pg_class WHERE oid IN ('public.arinova_records'::regclass, 'public.arinova_login_limits'::regclass)",
          );
          assert.equal(result.rows.length, 2);
          assert.ok(result.rows.every((row) => row.relrowsecurity));
        },
      );
      await t.test(
        'persists imported content and scored attempts via POSTGRES_URL',
        async () => {
          const set = {
            ...sample,
            id: crypto.randomUUID(),
            sample: false,
            title: 'PostgreSQL integration fixture',
          };
          await add('sets', set);
          const stored = (await list('sets')).find((s) => s.id === set.id);
          assert.deepEqual(stored, set);
          const attempt = grade(set, [
            { option: 2, confidence: 'best_guess' },
            { option: 0, confidence: 'sure' },
            { option: null, confidence: 'not_understood' },
          ]);
          await add('attempts', attempt);
          assert.deepEqual(
            (await list('attempts')).find((a) => a.id === attempt.id),
            attempt,
          );
        },
      );
      await t.test(
        'login limiting persists and enforces its limit in PostgreSQL',
        async () => {
          const req = new Request('http://localhost/api/auth');
          const role = `test-${crypto.randomUUID()}`;
          for (let i = 0; i < 20; i++)
            assert.equal(await allowLogin(req, role), true);
          assert.equal(await allowLogin(req, role), false);
          assert.ok(
            (
              await db.query(
                'SELECT count FROM public.arinova_login_limits WHERE count=21',
              )
            ).rowCount,
          );
        },
      );
      await t.test(
        'RLS blocks reads and writes even with Supabase-style table grants',
        async () => {
          await db.query('CREATE ROLE arinova_test_anon NOLOGIN');
          await db.query('GRANT USAGE ON SCHEMA public TO arinova_test_anon');
          await db.query(
            'GRANT ALL ON public.arinova_records, public.arinova_login_limits TO arinova_test_anon',
          );
          const client = await db.connect();
          try {
            await client.query('SET ROLE arinova_test_anon');
            for (const table of ['arinova_records', 'arinova_login_limits']) {
              assert.equal(
                (await client.query(`SELECT * FROM public.${table}`)).rowCount,
                0,
              );
              assert.equal(
                (await client.query(`DELETE FROM public.${table}`)).rowCount,
                0,
              );
            }
            await assert.rejects(
              client.query(
                "INSERT INTO public.arinova_records (id,kind,payload) VALUES (gen_random_uuid(),'sets','{}')",
              ),
              { code: '42501' },
            );
            await assert.rejects(
              client.query(
                "INSERT INTO public.arinova_login_limits (key,count,expires) VALUES ('anonymous',1,0)",
              ),
              { code: '42501' },
            );
          } finally {
            await client.query('RESET ROLE');
            client.release();
            await db.query('DROP OWNED BY arinova_test_anon');
            await db.query('DROP ROLE arinova_test_anon');
          }
        },
      );
    } finally {
      await db.end();
    }
  },
);
