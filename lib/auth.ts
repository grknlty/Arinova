import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export type Role = 'parent' | 'learner';
export const demo = () =>
  !process.env.VERCEL &&
  process.env.NODE_ENV !== 'production' &&
  !process.env.PARENT_PASSWORD &&
  !process.env.LEARNER_PASSWORD;
function secret() {
  return process.env.SESSION_SECRET;
}
export function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function role(): Promise<Role | null> {
  if (demo()) return 'parent';
  const value = (await cookies()).get('arinova_session')?.value;
  if (!value || !secret()) return null;
  const [payload, signature] = value.split('.');
  if (
    !payload ||
    !signature ||
    !equal(
      signature,
      createHmac('sha256', secret()!).update(payload).digest('hex'),
    )
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.expires > Date.now() &&
      ['parent', 'learner'].includes(data.role)
      ? data.role
      : null;
  } catch {
    return null;
  }
}
export function token(role: Role) {
  if (!secret() || secret()!.length < 32)
    throw new Error('Set SESSION_SECRET to at least 32 random characters');
  const payload = Buffer.from(
    JSON.stringify({ role, expires: Date.now() + 86400000 }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()!).update(payload).digest('hex')}`;
}
// The import token works from any caller (e.g. a ChatGPT action, which may
// send its own Origin). A browser never adds it by itself, so the
// same-origin check is only needed for the parent's session cookie.
export async function canImport(request: Request) {
  const token = process.env.IMPORT_API_TOKEN;
  return (
    (token &&
      token.length >= 32 &&
      equal(request.headers.get('authorization') ?? '', `Bearer ${token}`)) ||
    (sameOrigin(request) && (await role()) === 'parent')
  );
}
// Why an import was refused, so an API caller (such as a ChatGPT action) can
// show what to fix. Says only whether imports are enabled, never the token.
export function importRefusal(request: Request) {
  const token = process.env.IMPORT_API_TOKEN;
  const sent = request.headers.get('authorization');
  const error = !sent
    ? 'Sign in as parent, or send the header Authorization: Bearer <IMPORT_API_TOKEN>.'
    : !/^Bearer \S+$/.test(sent)
      ? 'Send the import key as Authorization: Bearer <IMPORT_API_TOKEN> (authentication type Bearer).'
      : !token || token.length < 32
        ? 'API imports are off: set IMPORT_API_TOKEN (at least 32 characters) on the server and redeploy.'
        : 'The import key is not correct.';
  return Response.json({ error }, { status: 403 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const source = new URL(origin);
    return (
      source.host === request.headers.get('host') &&
      ['http:', 'https:'].includes(source.protocol)
    );
  } catch {
    return false;
  }
}
