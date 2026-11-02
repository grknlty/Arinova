import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { database } from './database';
import { directory } from './store';

// Family members who appear in the home sky. A parent can give each one a
// real face, cropped in the browser; otherwise the drawing is shown.
export const friends = ['arin', 'neco', 'mia', 'piso'] as const;
export type Friend = (typeof friends)[number];
export type Faces = Partial<Record<Friend, string>>;

// A small cropped photo as a data URL, or null to go back to the drawing.
export const faceSchema = z.object({
  name: z.enum(friends),
  image: z
    .string()
    .max(400000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/)
    .nullable(),
});

// One fixed record per friend, so a new upload replaces the old face.
const ids: Record<Friend, string> = {
  arin: '00000000-0000-4000-8000-00000000fa01',
  neco: '00000000-0000-4000-8000-00000000fa02',
  mia: '00000000-0000-4000-8000-00000000fa03',
  piso: '00000000-0000-4000-8000-00000000fa04',
};
const file = () => path.join(directory, 'faces.json');

async function local(): Promise<Faces> {
  try {
    return JSON.parse(await readFile(file(), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

export async function getFaces(): Promise<Faces> {
  const db = await database();
  if (!db) return local();
  const rows = (
    await db.query(
      "SELECT payload FROM public.arinova_records WHERE kind = 'face'",
    )
  ).rows as { payload: { name: Friend; image: string } }[];
  return Object.fromEntries(rows.map((r) => [r.payload.name, r.payload.image]));
}

export async function setFace(name: Friend, image: string | null) {
  const db = await database();
  if (db) {
    if (image === null)
      await db.query('DELETE FROM public.arinova_records WHERE id = $1', [
        ids[name],
      ]);
    else
      await db.query(
        `INSERT INTO public.arinova_records (id, kind, payload) VALUES ($1, 'face', $2)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
        [ids[name], JSON.stringify({ name, image })],
      );
    return;
  }
  const faces = await local();
  if (image === null) delete faces[name];
  else faces[name] = image;
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(faces), { mode: 0o600 });
  await rename(temporary, file());
}
