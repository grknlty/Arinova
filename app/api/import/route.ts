import { canImport, sameOrigin } from '@/lib/auth';
import { parseDocx } from '@/lib/docx';
import { bytes } from '@/lib/http';
// Turns an uploaded Word file into draft sets. Nothing is saved here: the
// parent checks the drafts and saves them through POST /api/sets.
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await canImport(req)))
    return new Response(null, { status: 403 });
  try {
    const sets = parseDocx(await bytes(req, 4000000));
    if (!sets.length) throw new Error('No numbered questions found');
    return Response.json(sets);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
