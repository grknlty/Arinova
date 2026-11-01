import { role } from '@/lib/auth';
import { list } from '@/lib/store';
import { unavailable } from '@/lib/http';
export async function GET() {
  if ((await role()) !== 'parent') return new Response(null, { status: 403 });
  try {
    return Response.json(await list('attempts'));
  } catch {
    return unavailable();
  }
}
