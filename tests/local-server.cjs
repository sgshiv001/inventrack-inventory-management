const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('standalone browser server defaults to this PC only and requires sign-in', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-local-test-'));
  const env = { ...process.env, PORT: '0', DB_PATH: path.join(folder, 'local.db'),
    ADMIN_EMAIL: 'local-test@example.test', ADMIN_PASSWORD: 'temporary local verification password' };
  delete env.HOST;
  const child = spawn(process.execPath, ['-e', "const server=require('./server.js');server.once('listening',()=>console.log('BOUND '+JSON.stringify(server.address())));"],
    { cwd: path.resolve(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const address = await new Promise((resolve, reject) => {
      let output = '', errors = '';
      const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${errors}`)), 10000);
      child.stderr.on('data', value => { errors += value; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
      child.stdout.on('data', value => {
        output += value;
        const match = output.match(/BOUND (\{[^\n]+\})/);
        if (match) { clearTimeout(timer); resolve(JSON.parse(match[1])); }
      });
    });
    assert.equal(address.address, '127.0.0.1');
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/inventory`)).status, 401);
    assert.equal((await fetch(`${base}/api/inventory.csv`)).status, 401);
    assert.equal((await fetch(`${base}/`)).status, 200);
  } finally {
    if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
