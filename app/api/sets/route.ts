import { role, canImport, sameOrigin } from '@/lib/auth';
import { z } from 'zod';
import { setSchema, publicSet } from '@/lib/model';
import { list, addSets } from '@/lib/store';
import { body, unavailable } from '@/lib/http';
export async function GET() {
  const user = await role();
  if (!user) return new Response(null, { status: 401 });
  try {
    const sets = await list('sets');
    return Response.json(user === 'parent' ? sets : sets.map(publicSet));
  } catch {
    return unavailable();
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await canImport(req)))
    return new Response(null, { status: 403 });
  let input;
  try {
    // One set, or several (a Word file can hold more than one test).
    input = z
      .union([setSchema, z.array(setSchema).min(1).max(50)])
      .parse(await body(req));
  } catch {
    return Response.json(
      {
        error:
          'Invalid study set. Check title, subject, language, questions, options and correctIndex (zero-based). Maximum 500 KB.',
      },
      { status: 400 },
    );
  }
  // Sets are listed newest first; keep a batch in its original order.
  const now = Date.now();
  const sets = [input].flat().map((s, i) => ({
    ...s,
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
