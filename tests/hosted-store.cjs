const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { HostedStore, attachHostedStorage } = require('../tools/hosted-store.cjs');
const http = require('node:http');

function memoryStorage() {
  let contents, etag;
  return async (url, options = {}) => {
    if (options.method !== 'PUT') return contents ? new Response(contents, { headers: { ETag: etag } }) : new Response(null, { status: 404 });
    if (options.headers['If-Match'] && options.headers['If-Match'] !== etag || options.headers['If-None-Match'] === '*' && contents) {
      return new Response(null, { status: 412 });
    }
    contents = Buffer.from(options.body);
    etag = `"${crypto.randomUUID()}"`;
    return new Response(null, { status: 204, headers: { ETag: etag } });
  };
}

test('hosted snapshots preserve committed WAL data, encrypt records, and reject stale writers', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-hosted-test-'));
  const databaseFile = path.join(folder, 'live.db');
  const database = new DatabaseSync(databaseFile);
  const request = memoryStorage();
  const settings = { databaseFile, storageUrl: 'https://storage.example.test', token: 'test-storage-token', encryptionKey: crypto.randomBytes(32).toString('hex'), request };
  try {
    database.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value TEXT); INSERT INTO records VALUES('private inventory');");
    const live = new HostedStore(settings);
    await live.persist();
    const saved = Buffer.from(await (await request()).arrayBuffer());
    assert.equal(saved.includes(Buffer.from('private inventory')), false);
    const restored = new HostedStore({ ...settings, databaseFile: path.join(folder, 'restored.db') });
    await restored.restore();
    const restoredDatabase = new DatabaseSync(restored.databaseFile);
    try { assert.equal(restoredDatabase.prepare('SELECT value FROM records').get().value, 'private inventory'); }
    finally { restoredDatabase.close(); }
    database.exec("INSERT INTO records VALUES('next committed record')");
    await live.persist();
    await assert.rejects(restored.persist(), /newer database/);
    const invalidKey = new HostedStore({ ...settings, databaseFile: path.join(folder, 'invalid.db'), encryptionKey: crypto.randomBytes(32).toString('hex') });
    await assert.rejects(invalidKey.restore());
    assert.equal(fs.existsSync(invalidKey.databaseFile), false);
  } finally {
    database.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('hosted responses wait for persistence and reject traffic after an unconfirmed save', async () => {
  let saves = 0, acknowledge, failed = false;
  const store = { persist: async () => { saves++; if (saves === 2) await new Promise(resolve => { acknowledge = resolve; }); if (saves === 3) throw new Error('Storage unavailable'); } };
  const server = http.createServer(async (request, response) => {
    if (request.method === 'POST') await new Promise(resolve => { request.on('data', () => {}); request.on('end', resolve); });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"saved":true}');
  });
  attachHostedStorage(server, store, () => { failed = true; });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/test`;
  try {
    let completed = false;
    const saving = fetch(url, { method: 'POST', body: 'payload' }).then(response => { completed = true; return response; });
    while (!acknowledge) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(completed, false);
    acknowledge();
    assert.equal((await saving).status, 200);
    assert.equal((await fetch(url, { method: 'POST', body: 'next' })).status, 503);
    assert.equal(failed, true);
    assert.equal((await fetch(url)).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('storage worker requires authentication and version conditions', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../hosting/state-store/worker/index.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  let stored = false;
  const env = { STORAGE_TOKEN: 'test-token', BUCKET: { get: async () => null, put: async (key, body, options) => { stored = options.onlyIf.get('If-None-Match') === '*'; return { httpEtag: '"confirmed"' }; } } };
  assert.equal((await worker.fetch(new Request('https://store.example/state'), env)).status, 401);
  const headers = { Authorization: 'Bearer test-token' };
  assert.equal((await worker.fetch(new Request('https://store.example/state', { headers }), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://store.example/state', { method: 'PUT', headers, body: new Uint8Array(40) }), env)).status, 428);
  const response = await worker.fetch(new Request('https://store.example/state', { method: 'PUT', headers: { ...headers, 'If-None-Match': '*' }, body: new Uint8Array(40) }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('etag'), '"confirmed"');
  assert.equal(stored, true);
});
