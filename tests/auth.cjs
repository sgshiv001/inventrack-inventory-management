const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const folder = mkdtempSync(join(tmpdir(), 'inventrack-auth-test-'));
const port = 31874;
const base = `http://127.0.0.1:${port}`;
const credentials = { email: 'admin@example.com', password: 'correct horse battery staple' };
let child;

async function start() {
  child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', AUTH_REQUIRED: 'false', ADMIN_EMAIL: credentials.email, ADMIN_PASSWORD: credentials.password, DB_PATH: join(folder, 'auth.db') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.stderr.once('data', data => reject(new Error(data.toString())));
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited ${code}`)));
  });
}

async function stop() {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}

const get = path => fetch(`${base}${path}`);
const post = (path, data, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });

(async () => {
  try {
    await start();
    const initialSession = await get('/api/auth/session');
    assert.equal(initialSession.status, 200);
    assert.deepEqual(await initialSession.json(), { required: true, authenticated: false, user: null });
    assert.equal((await get('/api/inventory')).status, 401);
    assert.equal((await get('/api/inventory.csv')).status, 401);

    const badLogin = await post('/api/auth/login', { email: credentials.email, password: 'not-the-password' });
    assert.equal(badLogin.status, 401);

    const login = await post('/api/auth/login', credentials);
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(loginBody.authenticated, true);
    assert.equal(loginBody.user.role, 'admin');
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /^inventrack_session=[^;]+;/);
    const cookieHeader = { Cookie: cookie.split(';')[0] };

    const inventoryResponse = await fetch(`${base}/api/inventory`, { headers: cookieHeader });
    assert.equal(inventoryResponse.status, 200);
    const inventory = await inventoryResponse.json();
    assert.equal(inventory.products.length, 0);

    const testDb = new DatabaseSync(join(folder, 'auth.db'));
    const admin = testDb.prepare('SELECT password_hash FROM users WHERE email=?').get(credentials.email);
    testDb.prepare('INSERT INTO products(id,name,sku,category,quantity,reorder_level,cost,price) VALUES(?,?,?,?,0,0,0,0)').run('primary_product','Organization-isolation fixture','ISOLATION-001','General');
    testDb.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)').run('org_other', 'Other organization', new Date().toISOString());
    testDb.prepare('INSERT INTO users (id, organization_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('user_other', 'org_other', 'retailer@example.com', admin.password_hash, 'retailer', new Date().toISOString());
    testDb.close();

    const retailerLogin = await post('/api/auth/login', { email: 'retailer@example.com', password: credentials.password });
    assert.equal(retailerLogin.status, 200);
    const retailerCookie = retailerLogin.headers.get('set-cookie').split(';')[0];
    const otherInventory = await fetch(`${base}/api/inventory`, { headers: { Cookie: retailerCookie } });
    assert.equal(otherInventory.status, 200);
    assert.equal((await otherInventory.json()).products.length, 0);
    assert.equal((await (await fetch(`${base}/api/inventory`,{headers:cookieHeader})).json()).products.length,1);
    const otherCsv = await fetch(`${base}/api/inventory.csv`, { headers: { Cookie: retailerCookie } });
    assert.equal(otherCsv.status, 200);
    assert.doesNotMatch(await otherCsv.text(), /ISOLATION-001|Organization-isolation fixture/);
    const primaryCsv = await fetch(`${base}/api/inventory.csv`, { headers: cookieHeader });
    assert.equal(primaryCsv.status, 200);
    assert.match(await primaryCsv.text(), /ISOLATION-001/);
    const forbiddenWrite = await fetch(`${base}/api/inventory`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: retailerCookie }, body: JSON.stringify(inventory) });
    assert.equal(forbiddenWrite.status, 403);
    assert.equal((await post('/api/stock-movements', { productId: 'p2', type: 'in', quantity: 1 }, { Cookie: retailerCookie })).status, 403);
    assert.equal((await post('/api/purchase-orders', { supplierId: 's1', items: [{ productId: 'p2', quantity: 1 }] }, { Cookie: retailerCookie })).status, 403);
    assert.equal((await post('/api/demo-reset', {}, cookieHeader)).status, 405);
    const createAccount = await post('/api/users', { email: 'operator@example.com', password: 'another secure password', role: 'wholesaler' }, cookieHeader);
    assert.equal(createAccount.status, 201);
    const operator = (await createAccount.json()).find(user => user.email === 'operator@example.com');
    assert.equal(operator.role, 'wholesaler');
    const operatorLogin=await post('/api/auth/login',{email:'operator@example.com',password:'another secure password'});
    assert.equal(operatorLogin.status,200);
    const operatorCookie=operatorLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/api/users`, { headers: { Cookie: retailerCookie } })).status, 403);
    assert.equal((await post(`/api/users/${loginBody.user.id}/disable`, {}, cookieHeader)).status, 400);
    assert.equal((await post(`/api/users/${operator.id}/disable`, {}, cookieHeader)).status, 200);
    assert.equal((await fetch(`${base}/api/inventory`,{headers:{Cookie:operatorCookie}})).status,401);
    assert.equal((await post('/api/auth/login', { email: 'operator@example.com', password: 'another secure password' })).status, 401);
    for(let i=0;i<8;i++)assert.equal((await post('/api/auth/login',{email:'rate-limit@example.com',password:'invalid-password'})).status,401);
    assert.equal((await post('/api/auth/login',{email:'rate-limit@example.com',password:'invalid-password'})).status,429);

    const logout = await post('/api/auth/logout', {}, cookieHeader);
    assert.equal(logout.status, 200);
    assert.equal((await fetch(`${base}/api/inventory`, { headers: cookieHeader })).status, 401);
    console.log('PASS: authentication, password verification, organization isolation, roles, account administration, login throttling, and logout.');
  } finally {
    await stop();
    rmSync(folder, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
