import { allowLogin } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { equal, sameOrigin, token } from '@/lib/auth';
import { body } from '@/lib/http';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  try {
    const data = await body(req);
    if (!['parent', 'learner'].includes(data.role))
      return new Response(null, { status: 400 });
    if (!(await allowLogin(req, data.role)))
      return Response.json(
        { error: 'Too many attempts. Try again in 15 minutes.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    const expected =
      data.role === 'parent'
        ? process.env.PARENT_PASSWORD
        : data.role === 'learner'
          ? process.env.LEARNER_PASSWORD
          : null;
    if (
      !expected ||
      typeof data.password !== 'string' ||
      !equal(data.password, expected)
    )
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    const value = token(data.role);
    (await cookies()).set('arinova_session', value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
      path: '/',
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: 'Unable to sign in. Check authentication configuration.' },
      { status: 400 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  (await cookies()).delete('arinova_session');
  return Response.json({ ok: true });
}
