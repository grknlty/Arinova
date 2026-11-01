import { role, canImport, sameOrigin } from '@/lib/auth';
import { setSchema, publicSet } from '@/lib/model';
import { list, add } from '@/lib/store';
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
    input = setSchema.parse(await body(req));
  } catch {
    return Response.json(
      {
        error:
          'Invalid study set. Check title, subject, language, questions, options and correctIndex (zero-based). Maximum 500 KB.',
      },
      { status: 400 },
    );
  }
  const set = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  try {
    await add('sets', set);
    return Response.json({ id: set.id }, { status: 201 });
  } catch {
    return unavailable();
  }
}
