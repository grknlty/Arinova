import { role, canImport, importRefusal, hasImportToken } from '@/lib/auth';
import { z } from 'zod';
import { setSchema, publicSet, imageUrls, importProblems } from '@/lib/model';
import { normalizeSets } from '@/lib/formats';
import { list, addSets } from '@/lib/store';
import { body, unavailable } from '@/lib/http';
export async function GET() {
  const user = await role();
  if (!user) return new Response(null, { status: 401 });
  try {
    const sets = (await list('sets')).map(imageUrls);
    // The parent also sees deleted sets, for the history of added material.
    return Response.json(
      user === 'parent'
        ? sets
        : sets.filter((s) => !s.deletedAt).map(publicSet),
    );
  } catch {
    return unavailable();
  }
}
export async function POST(req: Request) {
  if (!(await canImport(req))) return importRefusal(req);
  let input;
  try {
    // One set, or several (a Word file can hold more than one test). Sets
    // with pictures are larger, so allow up to 4 MB (Vercel's limit is 4.5).
    const data = normalizeSets(await body(req, 4000000));
    input = Array.isArray(data)
      ? z.array(setSchema).min(1).max(50).parse(data)
      : setSchema.parse(data);
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? importProblems(e)
            : 'Not JSON, or larger than 4 MB.',
      },
      { status: 400 },
    );
  }
  // Sets are listed newest first; keep a batch in its original order.
  const now = Date.now();
  const viaApi = hasImportToken(req);
  const sets = [input].flat().map((s, i) => ({
    ...s,
    source: viaApi ? ('api' as const) : (s.source ?? 'json'),
    id: crypto.randomUUID(),
    createdAt: new Date(now - i).toISOString(),
  }));
  try {
    await addSets(sets);
    return Response.json(
      Array.isArray(input)
        ? { ids: sets.map((s) => s.id) }
        : { id: sets[0].id },
      { status: 201 },
    );
  } catch {
    return unavailable();
  }
}
