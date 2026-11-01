import { Pool } from 'pg';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StudySet, Attempt } from './model';
import { sample } from './sample';
type Data = { sets: StudySet[]; attempts: Attempt[] };
const globalStore = globalThis as unknown as {
  arinovaPool?: Pool;
  arinovaInit?: Promise<void>;
  arinovaQueue?: Promise<unknown>;
};
function database() {
  if (!process.env.DATABASE_URL) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production')
      throw new Error('DATABASE_URL is required in production');
    return null;
  }
  return (globalStore.arinovaPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
  }));
}
async function init() {
  const db = database();
  if (!db) return null;
  await (globalStore.arinovaInit ??= db
    .query(
      'CREATE TABLE IF NOT EXISTS arinova_records (id uuid PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
    )
    .then(() => {}));
  return db;
}
const directory =
  process.env.ARINOVA_DATA_DIR ?? path.join(process.cwd(), '.data');
async function local(): Promise<Data> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, 'store.json'), 'utf8'),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      return { sets: [], attempts: [] };
    throw e;
  }
}
export async function list<T extends 'sets' | 'attempts'>(
  kind: T,
): Promise<Data[T]> {
  const db = await init();
  const values = db
    ? (
        await db.query(
          'SELECT payload FROM arinova_records WHERE kind = $1 ORDER BY created_at DESC',
          [kind],
        )
      ).rows.map((r) => r.payload)
    : (await local())[kind];
  return (kind === 'sets' ? [...values, sample] : values) as Data[T];
}
export async function add(
  kind: 'sets' | 'attempts',
  record: StudySet | Attempt,
) {
  const db = await init();
  if (db) {
    await db.query(
      'INSERT INTO arinova_records (id, kind, payload) VALUES ($1, $2, $3)',
      [record.id, kind, JSON.stringify(record)],
    );
    return;
  }
  const write = async () => {
    const data = await local();
    (data[kind] as (StudySet | Attempt)[]).unshift(record);
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, path.join(directory, 'store.json'));
  };
  const pending = (globalStore.arinovaQueue ?? Promise.resolve()).then(write);
  globalStore.arinovaQueue = pending.catch(() => {});
  await pending;
}
