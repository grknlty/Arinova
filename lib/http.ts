export async function bytes(request: Request, limit = 500000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`Maximum upload: ${limit / 1000} KB`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function body(request: Request, limit?: number) {
  return JSON.parse((await bytes(request, limit)).toString('utf8'));
}
export const unavailable = () =>
  Response.json(
    {
      error: 'Storage is unavailable. Check the server database configuration.',
    },
    { status: 503 },
  );
