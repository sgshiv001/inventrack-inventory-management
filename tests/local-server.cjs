const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

test('standalone server requires sign-in and preserves legacy stock during workspace migration', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-local-test-'));
  const legacy = new DatabaseSync(path.join(folder, 'local.db'));
  legacy.exec(`CREATE TABLE products (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', name TEXT NOT NULL, sku TEXT NOT NULL COLLATE NOCASE UNIQUE, category TEXT NOT NULL, quantity INTEGER NOT NULL, reorder_level INTEGER NOT NULL, cost REAL NOT NULL, price REAL NOT NULL, supplier_id TEXT, model_file TEXT NOT NULL DEFAULT '');
    CREATE INDEX legacy_products_category ON products(category);
    INSERT INTO products VALUES('legacy_product','org_demo','Existing product','OLD-001','General',7,2,10,15,NULL,'preserved.glb');`);
  legacy.close();
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
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const inventory = await (await fetch(`${base}/api/inventory`, { headers: { Cookie: cookie } })).json();
    assert.equal(inventory.products[0].sku, 'OLD-001');
    assert.equal(inventory.products[0].quantity, 7);
    const migrated = new DatabaseSync(path.join(folder, 'local.db'));
    try {
      assert.equal(migrated.prepare('SELECT model_file FROM products WHERE id=?').get('legacy_product').model_file, 'preserved.glb');
      assert.ok(migrated.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='legacy_products_category'").get());
      assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(migrated.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally { migrated.close(); }
  } finally {
    if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
