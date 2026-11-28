const OBJECT_KEY = 'inventrack/workspace.sqlite.encrypted';
const MAX_BYTES = 40 * 1024 * 1024;
const commonHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

async function authorized(request, token) {
  if (!token) return false;
  const supplied = request.headers.get('authorization') || '';
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${token}`)),
  ]);
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: env.BUCKET && env.STORAGE_TOKEN ? 'ok' : 'unconfigured' }, { status: env.BUCKET && env.STORAGE_TOKEN ? 200 : 503, headers: commonHeaders });
    }
    if (pathname !== '/state') return new Response('Not found', { status: 404, headers: commonHeaders });
    if (!await authorized(request, env.STORAGE_TOKEN)) return new Response('Unauthorized', { status: 401, headers: commonHeaders });
    if (request.method === 'GET') {
      const object = await env.BUCKET.get(OBJECT_KEY);
      if (!object) return new Response('No snapshot', { status: 404, headers: commonHeaders });
      return new Response(object.body, { headers: { ...commonHeaders, 'Content-Type': 'application/octet-stream', ETag: object.httpEtag } });
    }
    if (request.method === 'PUT') {
      const matching = request.headers.get('if-match');
      const creating = request.headers.get('if-none-match');
      if (!matching && creating !== '*') return new Response('A storage version is required', { status: 428, headers: commonHeaders });
      const contents = await request.arrayBuffer();
      if (contents.byteLength < 34 || contents.byteLength > MAX_BYTES) return new Response('Invalid snapshot size', { status: 413, headers: commonHeaders });
      const condition = new Headers(matching ? { 'If-Match': matching } : { 'If-None-Match': '*' });
      const object = await env.BUCKET.put(OBJECT_KEY, contents, { onlyIf: condition, httpMetadata: { contentType: 'application/octet-stream' } });
      if (!object) return new Response('Storage version changed', { status: 412, headers: commonHeaders });
      return new Response(null, { status: 204, headers: { ...commonHeaders, ETag: object.httpEtag } });
    }
    return new Response('Method not allowed', { status: 405, headers: { ...commonHeaders, Allow: 'GET, PUT' } });
  },
};
