import { role, sameOrigin } from '@/lib/auth';
import { attemptSchema, grade } from '@/lib/model';
import { list, addAttempt } from '@/lib/store';
import { body, unavailable } from '@/lib/http';
export async function POST(req: Request) {
  const user = await role();
  if (!sameOrigin(req) || !user) return new Response(null, { status: 401 });
  let data;
  try {
    data = attemptSchema.parse(await body(req));
  } catch {
    return Response.json({ error: 'Invalid answers' }, { status: 400 });
  }
  try {
    const set = (await list('sets')).find(
      (s) => s.id === data.setId && !s.deletedAt,
    );
    if (!set) return new Response(null, { status: 404 });
    let attempt;
    try {
      attempt = grade(set, data.answers);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    await addAttempt(attempt, user);
    return Response.json(attempt, { status: 201 });
  } catch {
    return unavailable();
  }
}
