import type { Pool, PoolClient } from 'pg';
import { database } from './database';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StudySet, Attempt } from './model';
import type { Role } from './auth';
import { sample } from './sample';
import { insertAttempt, insertSet, readAttempts, readSets } from './records';
type Data = { sets: StudySet[]; attempts: Attempt[] };
const globalStore = globalThis as unknown as {
  arinovaQueue?: Promise<unknown>;
};
export const directory =
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
  const db = await database();
  // In PostgreSQL the sample is seeded as a row so attempts can refer to it.
  if (db)
    return (
      kind === 'sets' ? await readSets(db) : await readAttempts(db)
    ) as Data[T];
  const values = (await local())[kind];
  return (kind === 'sets' ? [...values, sample] : values) as Data[T];
}
async function transaction(
  db: Pool,
  work: (client: PoolClient) => Promise<void>,
) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await work(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function addSets(sets: StudySet[]) {
  const db = await database();
  if (db)
    return transaction(db, async (client) => {
      for (const set of sets) await insertSet(client, set);
    });
  await writeLocal((data) => data.sets.unshift(...sets));
}
export async function addAttempt(attempt: Attempt, role: Role) {
  const db = await database();
  if (db)
    return transaction(db, (client) => insertAttempt(client, attempt, role));
  await writeLocal((data) => data.attempts.unshift(attempt));
}
async function writeLocal(change: (data: Data) => void) {
  const write = async () => {
    const data = await local();
    change(data);
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, path.join(directory, 'store.json'));
  };
  const pending = (globalStore.arinovaQueue ?? Promise.resolve()).then(write);
  globalStore.arinovaQueue = pending.catch(() => {});
  await pending;
}
