import { demo, role } from '@/lib/auth';
export async function GET() {
  return Response.json({ role: await role(), demo: demo() });
}
