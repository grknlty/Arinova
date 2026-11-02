import { role, sameOrigin } from '@/lib/auth';
import { faceSchema, getFaces, setFace } from '@/lib/faces';
import { body, unavailable } from '@/lib/http';

// Family photos: only signed-in users may see them, and never from a cache.
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  if (!(await role())) return new Response(null, { status: 401 });
  try {
    return Response.json(await getFaces(), { headers: privateHeaders });
  } catch {
    return unavailable();
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req) || (await role()) !== 'parent')
    return new Response(null, { status: 403 });
  let input;
  try {
    input = faceSchema.parse(await body(req));
  } catch {
    return Response.json({ error: 'Invalid face image' }, { status: 400 });
  }
  try {
    await setFace(input.name, input.image);
    return new Response(null, { status: 204 });
  } catch {
    return unavailable();
  }
}
