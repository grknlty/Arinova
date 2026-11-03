import { role } from '@/lib/auth';
import { image } from '@/lib/store';
import { unavailable } from '@/lib/http';

// Serves a question picture: /api/images/{set}/{question}[/{option}].
// Sets never change once saved, so a picture can be cached by the browser.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await role())) return new Response(null, { status: 401 });
  const [setId, question, option, ...rest] = (await params).path;
  const numbers = [question, option].filter((n) => n !== undefined);
  if (
    rest.length ||
    !/^[0-9a-f-]{36}$/.test(setId ?? '') ||
    !numbers.every((n) => /^\d{1,3}$/.test(n))
  )
    return new Response(null, { status: 404 });
  let data;
  try {
    data = await image(
      setId,
      Number(question),
      option === undefined ? undefined : Number(option),
    );
  } catch {
    return unavailable();
  }
  const match = data?.match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/,
  );
  if (!match) return new Response(null, { status: 404 });
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
