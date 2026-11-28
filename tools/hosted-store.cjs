const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check, snapshot } = require('./database.cjs');

const SIGNATURE = Buffer.from('ITDB1');
const MAX_SNAPSHOT_BYTES = 40 * 1024 * 1024;

class HostedStore {
  constructor({ databaseFile, storageUrl, token, encryptionKey, request = fetch }) {
    const url = new URL(storageUrl);
    if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      throw new Error('Hosted storage requires HTTPS.');
    }
    if (!databaseFile || !token || !/^[a-f0-9]{64}$/i.test(encryptionKey || '')) {
      throw new Error('Hosted storage needs DB_PATH, STATE_STORAGE_TOKEN, and a 32-byte STATE_ENCRYPTION_KEY.');
    }
    this.databaseFile = path.resolve(databaseFile);
    this.url = new URL('/state', url).href;
    this.token = token;
    this.key = Buffer.from(encryptionKey, 'hex');
    this.request = request;
    this.etag = null;
  }

  async restore() {
    const response = await this.request(this.url, {
      headers: { Authorization: `Bearer ${this.token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404) {
      if (fs.existsSync(this.databaseFile)) throw new Error('Remote storage is empty but a local database already exists.');
      return;
    }
    if (!response.ok) throw new Error(`Could not restore hosted storage (${response.status}).`);
    const encrypted = Buffer.from(await response.arrayBuffer());
    if (encrypted.length > MAX_SNAPSHOT_BYTES || !encrypted.subarray(0, 5).equals(SIGNATURE) || encrypted.length < 34) {
      throw new Error('Hosted snapshot format is invalid.');
    }
    const etag = response.headers.get('etag');
    if (!etag) throw new Error('Hosted storage did not return a version.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, encrypted.subarray(5, 17));
    decipher.setAuthTag(encrypted.subarray(17, 33));
    const contents = Buffer.concat([decipher.update(encrypted.subarray(33)), decipher.final()]);
    fs.mkdirSync(path.dirname(this.databaseFile), { recursive: true });
    const temporary = `${this.databaseFile}.${crypto.randomUUID()}.restore`;
    try {
      fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
      check(temporary);
      for (const suffix of ['-wal', '-shm']) fs.rmSync(`${this.databaseFile}${suffix}`, { force: true });
      fs.renameSync(temporary, this.databaseFile);
      this.etag = etag;
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  async persist() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-hosted-snapshot-'));
    try {
      const file = path.join(directory, 'snapshot.db');
      snapshot(this.databaseFile, file);
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce);
      const ciphertext = Buffer.concat([cipher.update(fs.readFileSync(file)), cipher.final()]);
      const contents = Buffer.concat([SIGNATURE, nonce, cipher.getAuthTag(), ciphertext]);
      if (contents.length > MAX_SNAPSHOT_BYTES) throw new Error('Hosted database has reached its snapshot size limit.');
      const condition = this.etag ? { 'If-Match': this.etag } : { 'If-None-Match': '*' };
      const response = await this.request(this.url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/octet-stream', ...condition },
        body: contents,
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 412) throw new Error('Another app instance saved a newer database.');
      if (!response.ok) throw new Error(`Could not persist hosted storage (${response.status}).`);
      const etag = response.headers.get('etag');
      if (!etag) throw new Error('Hosted storage did not confirm its saved version.');
      this.etag = etag;
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

// Responses wait for the remote save. Requests from an old deployment cannot
// replace a newer snapshot because every upload checks the previous ETag.
function attachHostedStorage(server, store, onFailure) {
  const originalHandler = server.listeners('request')[0];
  server.removeListener('request', originalHandler);
  let failed = false;
  function fail(error) {
    if (failed) return;
    failed = true;
    onFailure(error);
  }
  let queue = store.persist().catch(fail);
  server.on('request', (request, response) => {
    if (!request.url.startsWith('/api/')) {
      originalHandler(request, response);
      return;
    }
    // Start reading queued request bodies immediately so a slow preceding save
    // cannot cause the incoming stream to lose its data/end events.
    request.pause();
    queue = queue.then(async () => {
      if (failed) {
        response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'Workspace storage is reconnecting. Please retry shortly.' }));
        request.resume();
        return;
      }
      const buffered = {
        status: 200, headers: {}, contents: '',
        writeHead(status, headers) { this.status = status; this.headers = headers; },
        end(contents = '') { this.contents = contents; },
      };
      const handling = originalHandler(request, buffered);
      request.resume();
      await handling;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && buffered.status < 400) {
        await store.persist();
      }
      response.writeHead(buffered.status, buffered.headers);
      response.end(buffered.contents);
    }).catch(error => {
      fail(error);
      if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'Your save could not be confirmed. The workspace is restarting. Please retry shortly.' }));
    });
  });
}

module.exports = { HostedStore, attachHostedStorage };
