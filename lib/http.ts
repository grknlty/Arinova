export async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 500000) {
      await reader.cancel();
      throw new Error('Maximum upload: 500 KB');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export const unavailable = () =>
  Response.json(
    {
      error: 'Storage is unavailable. Check the server database configuration.',
    },
    { status: 503 },
  );
