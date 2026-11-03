import { z } from 'zod';
import { role, sameOrigin } from '@/lib/auth';
import { setDeleted } from '@/lib/store';
import { body, unavailable } from '@/lib/http';

// Parent only: { deleted: true } removes a set from the learning space,
// { deleted: false } puts it back. Attempts on it are kept either way.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req) || (await role()) !== 'parent')
    return new Response(null, { status: 403 });
  const { id } = await params;
  let deleted;
  try {
    ({ deleted } = z.object({ deleted: z.boolean() }).parse(await body(req)));
  } catch {
    return Response.json(
      { error: 'Send { "deleted": true or false }' },
      {
        status: 400,
      },
    );
  }
  if (!z.string().uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  try {
    return (await setDeleted(id, deleted))
      ? new Response(null, { status: 204 })
      : new Response(null, { status: 404 });
  } catch {
    return unavailable();
  }
}
