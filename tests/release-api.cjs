// Exercise a running packaged app ONLY against the disposable release fixture.
const assert = require('node:assert/strict');
const base = process.argv[2];
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);

(async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'release@example.test', password: 'temporary release test password' }),
  });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' };
  const get = route => fetch(`${base}${route}`, { headers });
  const post = (route, data) => fetch(`${base}${route}`, { method: 'POST', headers, body: JSON.stringify(data) });
  const state = await (await get('/api/inventory')).json();
  assert.equal(state.products.length, 1, 'not the disposable fixture');
  assert.equal(state.products[0].sku, 'VERIFY-001', 'not the disposable fixture');
  assert.equal(state.products[0].id, 'release_product', 'not the disposable fixture');
  assert.equal(state.suppliers[0].id, 'release_supplier', 'not the disposable fixture');
  assert.equal(state.shipments[0].tracking, 'VERIFY-ROUTE-001', 'not the disposable fixture');
  assert.ok(!Object.hasOwn(state.products[0], 'modelAvailable'));
  assert.equal((await get('/api/products/release_product/model')).status, 404);
  assert.equal((await get('/vendor/model-viewer.js')).status, 404);
  assert.equal((await get('/globe.js')).status, 200);
  assert.equal((await get('/vendor/zxing-browser.min.js')).status, 200);
  const csv=await get('/api/inventory.csv');assert.equal(csv.status,200);
  assert.match(csv.headers.get('content-disposition'),/^attachment;/);assert.match(await csv.text(),/"VERIFY-001"/);
  const html = await (await get('/')).text();
  assert.doesNotMatch(html, /model-viewer|modelDialog|openModelsBtn/);
  const invalid = await post('/api/stock-movements', { productId: 'release_product', type: 'out', quantity: 999999 });
  assert.equal(invalid.status, 400);
  const movement = await post('/api/stock-movements', { productId: 'release_product', type: 'in', quantity: 1, reference: 'PACKAGED-WINDOWS-TEST' });
  assert.equal(movement.status, 200);
  const saved = await (await get('/api/inventory')).json();
  assert.equal(saved.products[0].quantity, state.products[0].quantity + 1);
  assert.ok(saved.movements.some(item => item.reference === 'PACKAGED-WINDOWS-TEST'));
  const logout = await post('/api/auth/logout', {});
  assert.equal(logout.status, 200);
  assert.equal((await get('/api/inventory')).status, 401);
  console.log('PASS: packaged Windows server login, catalogue/globe/decoder assets, CSV attachment, retired-viewer rejection, stock validation, committed stock movement, ledger, and logout.');
})().catch(error => { console.error(error); process.exitCode = 1; });
