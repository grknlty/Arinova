import { allowLogin } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { equal, sameOrigin, token } from '@/lib/auth';
import { body } from '@/lib/http';

function failure(code: string, status: number) {
  return Response.json({ code }, { status });
}

function databaseDiagnostic(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  switch (code) {
    case '28P01':
    case '28000':
      return 'database_credentials';
    case '42501':
      return 'database_permissions';
    case '3D000':
      return 'database_name';
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'EAI_AGAIN':
      return 'database_network';
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'CERT_HAS_EXPIRED':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return 'database_certificate';
    default:
      return 'database_connection';
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return failure('AUTH_ORIGIN_REJECTED', 403);
  let data;
  try {
    data = await body(req);
  } catch {
    return failure('AUTH_INVALID_REQUEST', 400);
  }
  if (
    !data ||
    !['parent', 'learner'].includes(data.role) ||
    typeof data.password !== 'string'
  )
    return failure('AUTH_INVALID_REQUEST', 400);

  const expected =
    data.role === 'parent'
      ? process.env.PARENT_PASSWORD
      : process.env.LEARNER_PASSWORD;
  if (!expected) return failure('AUTH_PASSWORD_NOT_CONFIGURED', 503);
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    return failure('AUTH_SESSION_NOT_CONFIGURED', 503);

  try {
    if (!(await allowLogin(req, data.role)))
      return Response.json(
        { code: 'AUTH_RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
  } catch (error) {
    // Log only a fixed diagnostic label. Database errors may contain credentials.
    const diagnostic = databaseDiagnostic(error);
    console.error('Arinova sign-in:', diagnostic);
    return Response.json(
      { code: 'AUTH_DATABASE_UNAVAILABLE', diagnostic },
      { status: 503 },
    );
  }
  if (!equal(data.password, expected))
    return failure('AUTH_INVALID_CREDENTIALS', 401);
  try {
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
    return failure('AUTH_UNAVAILABLE', 500);
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return failure('AUTH_ORIGIN_REJECTED', 403);
  (await cookies()).delete('arinova_session');
  return Response.json({ ok: true });
}
