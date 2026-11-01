import { createHmac } from 'node:crypto';
import { database } from './database';
const runtime = globalThis as unknown as {
  arinovaLimits?: Map<string, { count: number; until: number }>;
};
export async function allowLogin(req: Request, role: string) {
  const ip = process.env.VERCEL
    ? (req.headers.get('x-vercel-forwarded-for') ?? 'unknown')
    : 'local';
  const key = createHmac(
    'sha256',
    process.env.SESSION_SECRET ?? 'local-development',
  )
    .update(`${ip}:${role}`)
    .digest('hex');
  const now = Date.now();
  const until = now + 15 * 60 * 1000;
  const db = await database();
  if (db) {
    const result = await db.query(
      'INSERT INTO public.arinova_login_limits (key,count,expires) VALUES ($1,1,$2) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN arinova_login_limits.expires < $3 THEN 1 ELSE arinova_login_limits.count + 1 END, expires = CASE WHEN arinova_login_limits.expires < $3 THEN $2 ELSE arinova_login_limits.expires END RETURNING count',
      [key, until, now],
    );
    return result.rows[0].count <= 20;
  }
  const map = (runtime.arinovaLimits ??= new Map());
  const item = map.get(key);
  const next =
    item && item.until > now
      ? { ...item, count: item.count + 1 }
      : { count: 1, until };
  map.set(key, next);
  return next.count <= 20;
}
