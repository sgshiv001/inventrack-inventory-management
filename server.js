// InvenTrack API and static-file server. Uses only Node.js built-in modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { prepareDatabase } = require('./tools/database.cjs');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || '').replace(/\/$/,'');
const AUTH_REQUIRED = true;
const configuredSessionTtl = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const SESSION_TTL_MS = Number.isFinite(configuredSessionTtl) ? Math.max(15 * 60 * 1000, configuredSessionTtl) : 8 * 60 * 60 * 1000;
const loginAttempts = new Map();
const ROOT = __dirname;
const DB_PATH = prepareDatabase(ROOT);
// Keep the legacy organization ID so existing databases remain readable.
const PRIMARY_ORG_ID = 'org_demo';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });


const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
  INSERT OR IGNORE INTO metadata VALUES ('revision', 0);
  CREATE TABLE IF NOT EXISTS release_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, detail TEXT NOT NULL, date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin', 'wholesaler', 'retailer')), created_at TEXT NOT NULL, UNIQUE(organization_id, email));
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', name TEXT NOT NULL, contact TEXT, phone TEXT, email TEXT, address TEXT);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', name TEXT NOT NULL, sku TEXT NOT NULL COLLATE NOCASE UNIQUE, barcode TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0), reorder_level INTEGER NOT NULL CHECK(reorder_level >= 0), cost REAL NOT NULL CHECK(cost >= 0), price REAL NOT NULL CHECK(price >= 0), supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL);
  CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', product_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment')), quantity INTEGER NOT NULL CHECK(quantity >= 0), balance INTEGER NOT NULL CHECK(balance >= 0), reference TEXT, notes TEXT, date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sales_regions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', city TEXT NOT NULL, country TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, sales REAL NOT NULL CHECK(sales >= 0), units INTEGER NOT NULL CHECK(units >= 0), status TEXT NOT NULL CHECK(status IN ('healthy', 'watch', 'risk')));
  CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', tracking TEXT NOT NULL COLLATE NOCASE UNIQUE, customer TEXT NOT NULL, origin TEXT NOT NULL, origin_lat REAL NOT NULL, origin_lng REAL NOT NULL, destination TEXT NOT NULL, destination_lat REAL NOT NULL, destination_lng REAL NOT NULL, carrier TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending', 'in-transit', 'delivered', 'delayed')), weight REAL NOT NULL CHECK(weight >= 0), value REAL NOT NULL CHECK(value >= 0), eta TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS shipment_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL DEFAULT 'org_demo', shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE, status TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, location TEXT NOT NULL, date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS visitor_events (visitor_id TEXT NOT NULL, visit_date TEXT NOT NULL, path TEXT NOT NULL, visited_at TEXT NOT NULL, PRIMARY KEY (visitor_id, visit_date));
  CREATE TABLE IF NOT EXISTS purchase_orders (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, supplier_id TEXT NOT NULL, supplier_name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('ordered','received')), created_at TEXT NOT NULL, received_at TEXT);
  CREATE TABLE IF NOT EXISTS purchase_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL, product_name TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_cost REAL NOT NULL CHECK(unit_cost >= 0));`);

const productColumns = db.prepare('PRAGMA table_info(products)').all();
if (!productColumns.some(column => column.name === 'barcode')) db.exec("ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''");
// Retain the retired attachment column for non-destructive upgrades and backups.
if (!productColumns.some(column => column.name === 'model_file')) db.exec("ALTER TABLE products ADD COLUMN model_file TEXT NOT NULL DEFAULT ''");
const purchaseOrderColumns=db.prepare('PRAGMA table_info(purchase_orders)').all();
if(!purchaseOrderColumns.some(column=>column.name==='supplier_name'))db.exec("ALTER TABLE purchase_orders ADD COLUMN supplier_name TEXT NOT NULL DEFAULT ''");
const receiptColumns=db.prepare('PRAGMA table_info(purchase_order_items)').all();
if(!receiptColumns.some(column=>column.name==='received_quantity')){
  db.exec('ALTER TABLE purchase_order_items ADD COLUMN received_quantity INTEGER NOT NULL DEFAULT 0 CHECK(received_quantity >= 0 AND received_quantity <= quantity)');
  db.exec("UPDATE purchase_order_items SET received_quantity=quantity WHERE order_id IN (SELECT id FROM purchase_orders WHERE status='received')");
}
const userColumns=db.prepare('PRAGMA table_info(users)').all();
if(!userColumns.some(column=>column.name==='active'))db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))');
const organizationTables = ['suppliers', 'products', 'movements', 'sales_regions', 'shipments', 'shipment_events', 'purchase_orders'];
for (const table of organizationTables) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(column => column.name === 'organization_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN organization_id TEXT`);
  db.prepare(`UPDATE ${table} SET organization_id=? WHERE organization_id IS NULL OR organization_id=''`).run(PRIMARY_ORG_ID);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_nocase ON products(organization_id, barcode COLLATE NOCASE) WHERE barcode <> '';");
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
  CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
  CREATE INDEX IF NOT EXISTS idx_movements_organization ON movements(organization_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_organization ON shipments(organization_id);
  CREATE INDEX IF NOT EXISTS idx_events_organization ON shipment_events(organization_id);`);
db.prepare('INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)').run(PRIMARY_ORG_ID, String(process.env.ORGANIZATION_NAME || 'My organization').trim().slice(0, 100), new Date().toISOString());

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
function verifyPassword(password, stored) {
  const [, saltText, hashText] = String(stored || '').split('$');
  if (!saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, { N: 16384, r: 8, p: 1 });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split('='))
    .filter(([key, value]) => key && value).map(([key, ...value]) => [key, decodeURIComponent(value.join('='))]));
}
function publicUser(user) {
  return user ? { id: user.id, email: user.email, role: user.role, organizationId: user.organization_id, organizationName: user.organization_name } : null;
}
function currentUser(req) {
  const token = parseCookies(req.headers.cookie).inventrack_session;
  if (!token) return null;
  const user = db.prepare(`SELECT users.id, users.email, users.role, users.organization_id, organizations.name AS organization_name
    FROM sessions JOIN users ON users.id=sessions.user_id JOIN organizations ON organizations.id=users.organization_id
    WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1`).get(tokenHash(token), new Date().toISOString());
  if (user) db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(new Date().toISOString(), tokenHash(token));
  return user || null;
}
function cookieHeader(token, req, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  const sameSite = CORS_ORIGIN && secure ? 'None' : 'Lax';
  return `inventrack_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
    .run(tokenHash(token), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now.toISOString(), now.toISOString());
  return cookieHeader(token, req, Math.floor(SESSION_TTL_MS / 1000));
}
function ensureAdminUser() {
  if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return;
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email && !password) throw new Error('First startup needs ADMIN_EMAIL and ADMIN_PASSWORD. Set both before starting the web server.');
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length>254 || password.length < 12 || password.length>200) {
    throw new Error('ADMIN_EMAIL must be valid and ADMIN_PASSWORD must contain at least 12 characters.');
  }
  db.prepare('INSERT INTO users (id, organization_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('user_admin', PRIMARY_ORG_ID, email, hashPassword(password), 'admin', new Date().toISOString());
}
function usersFor(organizationId) {
  return db.prepare('SELECT id, email, role, active, created_at AS createdAt FROM users WHERE organization_id=? ORDER BY created_at').all(organizationId);
}
function createUser(payload, organizationId) {
  const email=normalizeEmail(payload.email),password=String(payload.password||''),role=String(payload.role||'');
  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||password.length<12||password.length>200||!['admin','wholesaler','retailer'].includes(role))throw new Error('Enter a valid email, a 12–200 character password, and a supported role.');
  if(db.prepare('SELECT 1 FROM users WHERE lower(email)=?').get(email))throw new Error('This email address already has an account.');
  db.prepare('INSERT INTO users(id,organization_id,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(`user_${crypto.randomUUID().replaceAll('-','')}`,organizationId,email,hashPassword(password),role,new Date().toISOString());
  return usersFor(organizationId);
}
function disableUser(id, user) {
  if(id===user.id)throw new Error('You cannot disable your own account.');
  const target=db.prepare('SELECT id FROM users WHERE id=? AND organization_id=?').get(id,user.organization_id);
  if(!target)throw new Error('Account was not found.');
  db.prepare('UPDATE users SET active=0 WHERE id=? AND organization_id=?').run(id,user.organization_id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  return usersFor(user.organization_id);
}

function rows(organizationId = PRIMARY_ORG_ID) {
  const shipments = db.prepare('SELECT id, tracking, customer, origin, origin_lat AS originLat, origin_lng AS originLng, destination, destination_lat AS destinationLat, destination_lng AS destinationLng, carrier, status, weight, value, eta, created_at AS createdAt, updated_at AS updatedAt FROM shipments WHERE organization_id=? ORDER BY updated_at DESC').all(organizationId);
  const purchaseOrders=db.prepare('SELECT id, supplier_id AS supplierId, supplier_name AS supplierName, status, created_at AS createdAt, received_at AS receivedAt FROM purchase_orders WHERE organization_id=? ORDER BY created_at DESC').all(organizationId).map(order=>{
    const items=db.prepare('SELECT product_id AS productId, product_name AS name, sku, quantity, received_quantity AS receivedQuantity, unit_cost AS unitCost FROM purchase_order_items WHERE order_id=?').all(order.id);
    return {...order,status:order.status==='ordered'&&items.some(item=>item.receivedQuantity>0)?'partial':order.status,items,total:items.reduce((total,item)=>total+item.quantity*item.unitCost,0)};
  });
  return {
    revision: db.prepare("SELECT value FROM metadata WHERE key='revision'").get().value,
    suppliers: db.prepare('SELECT id, name, contact, phone, email, address FROM suppliers WHERE organization_id=? ORDER BY name').all(organizationId),
    products: db.prepare("SELECT id, name, sku, barcode, category, quantity, reorder_level AS reorder, cost, price, COALESCE(supplier_id, '') AS supplierId FROM products WHERE organization_id=? ORDER BY rowid DESC").all(organizationId),
    movements: db.prepare('SELECT id, product_id AS productId, type, quantity, balance, reference, notes, date FROM movements WHERE organization_id=? ORDER BY date DESC').all(organizationId),
    regions: db.prepare('SELECT id, city, country, latitude, longitude, sales, units, status FROM sales_regions WHERE organization_id=? ORDER BY sales DESC').all(organizationId),
    shipments: shipments.map(shipment => ({ ...shipment, origin: { label: shipment.origin, latitude: shipment.originLat, longitude: shipment.originLng }, destination: { label: shipment.destination, latitude: shipment.destinationLat, longitude: shipment.destinationLng }, events: db.prepare('SELECT id, status, title, detail, location, date FROM shipment_events WHERE organization_id=? AND shipment_id=? ORDER BY date DESC').all(organizationId, shipment.id) })),
    purchaseOrders
  };
}
function visitorStats() {
  const stats = db.prepare("SELECT COUNT(DISTINCT visitor_id) AS totalVisitors, COUNT(DISTINCT CASE WHEN visit_date=date('now') THEN visitor_id END) AS todayVisitors, COUNT(DISTINCT CASE WHEN visit_date>=date('now','-6 day') THEN visitor_id END) AS weekVisitors FROM visitor_events").get();
  return { totalVisitors: stats.totalVisitors, todayVisitors: stats.todayVisitors, weekVisitors: stats.weekVisitors };
}
function replaceInventory(payload, organizationId = PRIMARY_ORG_ID) {
  if (!payload || !Array.isArray(payload.suppliers) || !Array.isArray(payload.products) || !Array.isArray(payload.movements)) throw new Error('Expected suppliers, products, and movements arrays.');
  for (const collection of [payload.suppliers, payload.products, payload.movements, payload.regions || [], payload.shipments || []]) {
    if (!Array.isArray(collection) || collection.length > 10000) throw new Error('Invalid collection size.');
    for (const item of collection) if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) throw new Error('Invalid record ID.');
  }
  const newProducts=new Map(), productIds=new Set(payload.products.map(product=>product.id));
  const existingModels=new Map(db.prepare('SELECT id, model_file FROM products WHERE organization_id=?').all(organizationId).map(product=>[product.id,product.model_file]));
  const orderedItems=db.prepare("SELECT DISTINCT poi.product_id AS productId FROM purchase_order_items poi JOIN purchase_orders po ON po.id=poi.order_id WHERE po.organization_id=? AND po.status='ordered'").all(organizationId);
  if(orderedItems.some(item=>!productIds.has(item.productId)))throw new Error('Receive outstanding purchase orders before deleting their products.');
  for (const p of payload.products) {
    if (![p.name,p.sku,p.category].every(v=>typeof v==='string' && v.trim() && v.length<=100)) throw new Error('Product name, SKU and category are required.');
    if (![p.quantity,p.reorder].every(v=>Number.isSafeInteger(v)&&v>=0) || ![p.cost,p.price].every(v=>Number.isFinite(v)&&v>=0)) throw new Error('Invalid product quantity or price.');
    if(p.barcode!==undefined&&(typeof p.barcode!=='string'||p.barcode.length>100))throw new Error('Invalid product barcode.');
    const current=db.prepare('SELECT quantity FROM products WHERE id=? AND organization_id=?').get(p.id,organizationId);
    if(current&&current.quantity!==p.quantity)throw new Error('Use a stock movement to change an existing product quantity.');
    if(!current)newProducts.set(p.id,p);
  }
  const openingCounts=new Map();
  for (const m of payload.movements){
    if (![m.quantity,m.balance].every(v=>Number.isSafeInteger(v)&&v>=0) || !Number.isFinite(Date.parse(m.date))) throw new Error('Invalid stock movement.');
    const existing=db.prepare('SELECT organization_id FROM movements WHERE id=?').get(m.id);
    if(existing){if(existing.organization_id!==organizationId)throw new Error('Movement belongs to another organization.');continue;}
    const product=newProducts.get(m.productId);
    if(!product||m.type!=='in'||m.quantity!==product.quantity||m.balance!==product.quantity||!['OPENING','CSV IMPORT'].includes(m.reference))throw new Error('New movements must record opening stock for a new product.');
    openingCounts.set(m.productId,(openingCounts.get(m.productId)||0)+1);
  }
  for(const product of newProducts.values())if((openingCounts.get(product.id)||0)!==(product.quantity>0?1:0))throw new Error('Each new product needs one matching opening-stock movement.');
  const shipmentStatuses = new Set(['pending','in-transit','delivered','delayed']);
  for (const s of (payload.shipments || [])) {
    if (![s.tracking,s.customer,s.origin?.label,s.destination?.label,s.carrier,s.eta].every(v=>typeof v==='string' && v.trim() && v.length<=120)) throw new Error('Shipment tracking, customer, route, carrier and ETA are required.');
    if (!shipmentStatuses.has(s.status) || ![s.weight,s.value].every(v=>Number.isFinite(v)&&v>=0) || ![s.origin?.latitude,s.origin?.longitude,s.destination?.latitude,s.destination?.longitude].every(v=>Number.isFinite(v))) throw new Error('Invalid shipment status, value, weight or coordinates.');
    if([s.origin.latitude,s.destination.latitude].some(v=>Math.abs(v)>90)||[s.origin.longitude,s.destination.longitude].some(v=>Math.abs(v)>180)||!/^\d{4}-\d{2}-\d{2}$/.test(s.eta)||!Number.isFinite(Date.parse(s.eta))||![s.createdAt,s.updatedAt].every(v=>Number.isFinite(Date.parse(v))))throw new Error('Invalid shipment date or coordinate range.');
    if (!Array.isArray(s.events) || s.events.length > 100) throw new Error('Invalid shipment event history.');
    for (const event of s.events) if (!event || typeof event.id !== 'string' || !shipmentStatuses.has(event.status) || ![event.title,event.detail,event.location,event.date].every(v=>typeof v==='string' && v.trim() && v.length<=240) || !Number.isFinite(Date.parse(event.date))) throw new Error('Invalid shipment event.');
  }
  const insertSupplier = db.prepare('INSERT INTO suppliers (id, organization_id, name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertProduct = db.prepare('INSERT INTO products (id, organization_id, name, sku, barcode, category, quantity, reorder_level, cost, price, supplier_id, model_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMovement = db.prepare('INSERT INTO movements (id, organization_id, product_id, type, quantity, balance, reference, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertRegion = db.prepare('INSERT INTO sales_regions (id, organization_id, city, country, latitude, longitude, sales, units, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipment = db.prepare('INSERT INTO shipments (id, organization_id, tracking, customer, origin, origin_lat, origin_lng, destination, destination_lat, destination_lng, carrier, status, weight, value, eta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipmentEvent = db.prepare('INSERT INTO shipment_events (id, organization_id, shipment_id, status, title, detail, location, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM shipment_events WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM shipments WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM products WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM suppliers WHERE organization_id=?').run(organizationId);
    if (payload.regions) db.prepare('DELETE FROM sales_regions WHERE organization_id=?').run(organizationId);
    for (const s of payload.suppliers) insertSupplier.run(s.id, organizationId, s.name, s.contact || '', s.phone || '', s.email || '', s.address || '');
    for (const p of payload.products) insertProduct.run(p.id, organizationId, p.name, p.sku, p.barcode || '', p.category, p.quantity, p.reorder, p.cost, p.price, p.supplierId || null, existingModels.get(p.id) || '');
    for (const m of payload.movements) db.prepare('INSERT OR IGNORE INTO movements (id, organization_id, product_id, type, quantity, balance, reference, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(m.id, organizationId, m.productId, m.type, m.quantity, m.balance, m.reference || '', m.notes || '', m.date);
    for (const region of (payload.regions || [])) insertRegion.run(region.id, organizationId, region.city, region.country, region.latitude, region.longitude, region.sales, region.units, region.status);
    for (const s of (payload.shipments || [])) {
      insertShipment.run(s.id, organizationId, s.tracking, s.customer, s.origin.label, s.origin.latitude, s.origin.longitude, s.destination.label, s.destination.latitude, s.destination.longitude, s.carrier, s.status, s.weight, s.value, s.eta, s.createdAt, s.updatedAt);
      for (const event of s.events) insertShipmentEvent.run(event.id, organizationId, s.id, event.status, event.title, event.detail, event.location, event.date);
    }
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
ensureAdminUser();

db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('edition-3-20260913', 'Edition 3 — Clear workspace', 'New forest-green dashboard, larger readable text, sharp charts, database status and serialized saves. Added revision conflict protection, SQLite WAL, private-file protection and a domain/commercial launch guide.', '2026-09-13T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('globe-refresh-20260913', 'Distribution globe refresh', 'Rebuilt the sales globe with an orthographic spherical projection, geographic land shapes, atmospheric depth, clean route arcs, accessible region markers and a focused location callout.', '2026-09-13T13:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('logistics-center-20260917', 'Logistics Center and shipment tracking', 'Added a database-backed shipping workspace with shipment KPIs, status filters, route map, tracking history, delivery activity and a create-shipment workflow.', '2026-09-17T09:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visual-intelligence-20260917', '3D distribution and partner intelligence', 'Added a rotating 3D Earth model with country labels, territory and shipment routes, plus image-backed product portfolio cards and supplier partner profiles with market-value share and route context.', '2026-09-17T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('webgl-earth-20260917', 'Interactive WebGL Earth model', 'Replaced the flat globe renderer with a real textured WebGL sphere mesh. Added drag rotation, tilt, scroll zoom, reset controls, depth-tested lighting, and route overlays that reproject with the view.', '2026-09-17T13:30:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visitor-counter-20260917', 'Visitor pulse counter', 'Added a unique visitor counter backed by SQLite with daily de-duplication and a seven-day pulse. No IP addresses are stored.', '2026-09-17T14:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('production-readiness-20260917', 'Production readiness foundation', 'Added runtime API-origin configuration, controlled CORS support for split hosting, environment templates, and a documented production checklist for authentication, organization isolation, backups, domain setup, and privacy.', '2026-09-17T15:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('secure-pilot-foundation-20260920', 'Secure pilot foundation', 'Added scrypt-backed authentication, expiring HTTP-only sessions, server-side role enforcement, organization-scoped inventory queries, and automated authentication coverage.', '2026-09-20T10:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('operations-upgrade-20260924', 'Stock transactions, barcode scanning and purchase orders', 'Added product barcodes and browser camera scanning, atomic role-protected stock transactions with append-only movement history, supplier purchase orders generated from reorder suggestions, and transactional order receiving.', '2026-09-24T09:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('windows-web-3-20261001', 'InvenTrack 3.0 — Windows and web operations', 'Empty first-run workspaces, mandatory authentication, team accounts, desktop/browser launcher, recorded delivery globe, and workspace backups.', '2026-10-01T09:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('focused-inventory-301-20261001', 'InvenTrack 3.0.1 — Focused inventory operations', 'Removed the optional product-model viewer and upload API. The recorded delivery globe remains. Existing retired attachments are preserved during upgrades and backups.', '2026-10-01T10:00:00Z');
function send(res, code, body, type = 'application/json', extraHeaders = {}) { const headers={ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', ...extraHeaders }; if(CORS_ORIGIN){headers['Access-Control-Allow-Origin']=CORS_ORIGIN;headers['Access-Control-Allow-Methods']='GET, PUT, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Allow-Credentials']='true';headers.Vary='Origin'} res.writeHead(code, headers); res.end(type === 'application/json' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body); }
function originAllowed(req) { const origin=req.headers.origin; if(!origin)return true; try { const requestOrigin=new URL(origin),hostOrigin=`${requestOrigin.protocol}//${req.headers.host}`; return origin===hostOrigin || (CORS_ORIGIN && origin===CORS_ORIGIN); } catch { return false; } }
function body(req) { return new Promise((resolve, reject) => { let length=0;const chunks=[];req.on('data',chunk=>{length+=chunk.length;if(length>1_000_000){chunks.length=0;reject(new Error('Request body is too large.'));}else chunks.push(chunk);});req.on('error',reject);req.on('end',()=>{if(length>1_000_000)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch{reject(new Error('Invalid JSON.'));}}); }); }
function requireUser(req, res, roles = []) {
  const user = currentUser(req);
  if (!user) { send(res, 401, { error: 'Authentication required.' }); return null; }
  if (roles.length && !roles.includes(user.role)) { send(res, 403, { error: 'Your role cannot perform this action.' }); return null; }
  return user;
}
function stockMovement(payload, organizationId) {
  const productId=String(payload.productId||''), type=String(payload.type||''), quantity=payload.quantity;
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(productId) || !['in','out','adjustment'].includes(type) || !Number.isSafeInteger(quantity) || quantity<0 || quantity>10000000) throw new Error('Choose a valid product, movement type, and quantity.');
  if(type!=='adjustment' && quantity===0) throw new Error('Stock movement quantity must be greater than zero.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const product=db.prepare('SELECT id, quantity FROM products WHERE id=? AND organization_id=?').get(productId,organizationId);
    if(!product) throw new Error('Product was not found in this organization.');
    const balance=type==='in'?product.quantity+quantity:type==='out'?product.quantity-quantity:quantity;
    if(!Number.isSafeInteger(balance)||balance<0) throw new Error(`Only ${product.quantity} units are currently available.`);
    const now=new Date().toISOString(), id=crypto.randomUUID().replaceAll('-','');
    db.prepare('UPDATE products SET quantity=? WHERE id=? AND organization_id=?').run(balance,productId,organizationId);
    db.prepare('INSERT INTO movements (id,organization_id,product_id,type,quantity,balance,reference,notes,date) VALUES (?,?,?,?,?,?,?,?,?)').run(id,organizationId,productId,type,quantity,balance,String(payload.reference||'').slice(0,120),String(payload.notes||'').slice(0,240),now);
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch(error){db.exec('ROLLBACK');throw error;}
}
function createPurchaseOrder(payload, organizationId) {
  const supplierId=String(payload.supplierId||''), items=payload.items;
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(supplierId)||!Array.isArray(items)||!items.length||items.length>200) throw new Error('Choose a supplier and at least one purchase-order item.');
  const supplier=db.prepare('SELECT name FROM suppliers WHERE id=? AND organization_id=?').get(supplierId,organizationId);
  if(!supplier) throw new Error('Supplier was not found in this organization.');
  const orderId=`po${crypto.randomUUID().replaceAll('-','')}`, now=new Date().toISOString(), seen=new Set();
  db.exec('BEGIN');
  try {
    db.prepare("INSERT INTO purchase_orders(id,organization_id,supplier_id,supplier_name,status,created_at) VALUES(?,?,?,?,'ordered',?)").run(orderId,organizationId,supplierId,supplier.name,now);
    for(const item of items){
      const productId=String(item.productId||''), quantity=item.quantity;
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(productId)||seen.has(productId)||!Number.isSafeInteger(quantity)||quantity<=0||quantity>10000000) throw new Error('Purchase order contains an invalid or duplicate item.');
      seen.add(productId);
      const product=db.prepare('SELECT id,name,sku,cost FROM products WHERE id=? AND organization_id=? AND supplier_id=?').get(productId,organizationId,supplierId);
      if(!product) throw new Error('Every purchase-order item must belong to the selected supplier.');
      db.prepare('INSERT INTO purchase_order_items(id,order_id,product_id,product_name,sku,quantity,unit_cost) VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID().replaceAll('-',''),orderId,product.id,product.name,product.sku,quantity,product.cost);
    }
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch(error){db.exec('ROLLBACK');throw error;}
}
function receivePurchaseOrder(orderId, organizationId, payload = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const order=db.prepare("SELECT id,status FROM purchase_orders WHERE id=? AND organization_id=?").get(orderId,organizationId);
    if(!order) throw new Error('Purchase order was not found.');
    if(order.status==='received') throw new Error('This purchase order has already been received.');
    const items=db.prepare('SELECT id,product_id,quantity,received_quantity FROM purchase_order_items WHERE order_id=?').all(orderId), now=new Date().toISOString();
    const requested=payload.items===undefined?items.filter(item=>item.received_quantity<item.quantity).map(item=>({productId:item.product_id,quantity:item.quantity-item.received_quantity})):payload.items;
    if(!Array.isArray(requested)||!requested.length||requested.length>200)throw new Error('Enter at least one receipt quantity.');
    const seen=new Set();
    for(const receipt of requested){
      const item=items.find(item=>item.product_id===receipt?.productId);
      if(!item||seen.has(item.product_id)||!Number.isSafeInteger(receipt.quantity)||receipt.quantity<=0||receipt.quantity>item.quantity-item.received_quantity)throw new Error('Receipt quantity must be positive and cannot exceed the units remaining on the order.');
      seen.add(item.product_id);
      const product=db.prepare('SELECT quantity FROM products WHERE id=? AND organization_id=?').get(item.product_id,organizationId);
      if(!product) throw new Error('A product on this order no longer exists.');
      const balance=product.quantity+receipt.quantity;
      if(!Number.isSafeInteger(balance))throw new Error('Stock quantity exceeds the supported range.');
      db.prepare('UPDATE products SET quantity=? WHERE id=? AND organization_id=?').run(balance,item.product_id,organizationId);
      db.prepare('UPDATE purchase_order_items SET received_quantity=received_quantity+? WHERE id=?').run(receipt.quantity,item.id);
      db.prepare("INSERT INTO movements(id,organization_id,product_id,type,quantity,balance,reference,notes,date) VALUES(?,?,?,'in',?,?,?,?,?)").run(crypto.randomUUID().replaceAll('-',''),organizationId,item.product_id,receipt.quantity,balance,orderId,'Purchase order receipt',now);
    }
    const remaining=db.prepare('SELECT SUM(quantity-received_quantity) AS remaining FROM purchase_order_items WHERE order_id=?').get(orderId).remaining;
    db.prepare('UPDATE purchase_orders SET status=?,received_at=? WHERE id=? AND organization_id=?').run(remaining===0?'received':'ordered',remaining===0?now:null,orderId,organizationId);
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch(error){db.exec('ROLLBACK');throw error;}
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

function inventoryCsv(inventory) {
  const headers=['Name','SKU','Barcode','Category','Quantity','Reorder Level','Cost Price','Selling Price','Inventory Value','Gross Margin','Supplier','Status'];
  const records=inventory.products.map(product=>[
    product.name,product.sku,product.barcode||'',product.category,product.quantity,product.reorder,
    product.cost,product.price,product.quantity*product.cost,product.quantity*(product.price-product.cost),
    inventory.suppliers.find(supplier=>supplier.id===product.supplierId)?.name||'',
    product.quantity===0?'Out of stock':product.quantity<=product.reorder?'Low stock':'In stock',
  ]);
  // Quote every cell, preserve Unicode in Excel, and neutralize text formulas.
  const cell=value=>{const text=String(value??'');const safe=typeof value==='string'&&/^[\s]*[=+\-@]/.test(text)?`'${text}`:text;return `"${safe.replaceAll('"','""')}"`;};
  return '\uFEFF'+[headers,...records].map(record=>record.map(cell).join(',')).join('\r\n')+'\r\n';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if(req.method==='OPTIONS'){if(!originAllowed(req))return send(res,403,{error:'Origin is not allowed.'});res.writeHead(204,CORS_ORIGIN?{'Access-Control-Allow-Origin':CORS_ORIGIN,'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Credentials':'true','Vary':'Origin'}:{});return res.end();}
    if (url.pathname === '/api/auth/session' && req.method === 'GET') {
      const user = currentUser(req);
      return send(res, 200, { required: AUTH_REQUIRED, authenticated: Boolean(user), user: publicUser(user) });
    }
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const payload = await body(req), email = normalizeEmail(payload.email), password = String(payload.password || '');
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length>254 || !password || password.length>200) return send(res, 400, { error: 'Enter a valid email and password.' });
      const attemptKey=`${req.socket.remoteAddress}|${email}`,now=Date.now(),attempt=loginAttempts.get(attemptKey);
      if(attempt?.until>now&&attempt.count>=8)return send(res,429,{error:'Too many sign-in attempts. Try again in 15 minutes.'});
      const user = db.prepare(`SELECT users.id, users.email, users.password_hash, users.role, users.organization_id, organizations.name AS organization_name
        FROM users JOIN organizations ON organizations.id=users.organization_id WHERE lower(users.email)=? AND users.active=1`).get(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        const count=attempt?.until>now?attempt.count+1:1;loginAttempts.set(attemptKey,{count,until:now+15*60*1000});
        if(loginAttempts.size>10000)for(const [key,value] of loginAttempts)if(value.until<=now)loginAttempts.delete(key);
        return send(res, 401, { error: 'Email or password is incorrect.' });
      }
      loginAttempts.delete(attemptKey);
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(new Date().toISOString());
      const setCookie = createSession(user.id, req);
      return send(res, 200, { authenticated: true, user: publicUser(user) }, 'application/json', { 'Set-Cookie': setCookie });
    }
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const token = parseCookies(req.headers.cookie).inventrack_session;
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
      return send(res, 200, { authenticated: false }, 'application/json', { 'Set-Cookie': cookieHeader('', req, 0) });
    }
    if (url.pathname === '/api/users' && req.method === 'GET') {
      const user=requireUser(req,res,['admin']);return user?send(res,200,usersFor(user.organization_id)):undefined;
    }
    if (url.pathname === '/api/users' && req.method === 'POST') {
      if(!originAllowed(req))return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin']);if(!user)return;
      return send(res,201,createUser(await body(req),user.organization_id));
    }
    const disableUserMatch=url.pathname.match(/^\/api\/users\/([a-zA-Z0-9_-]{1,80})\/disable$/);
    if (disableUserMatch && req.method === 'POST') {
      if(!originAllowed(req))return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin']);if(!user)return;
      return send(res,200,disableUser(disableUserMatch[1],user));
    }
    if (url.pathname === '/api/inventory' && req.method === 'GET') {
      const user = requireUser(req, res);
      return user ? send(res, 200, rows(user.organization_id)) : undefined;
    }
    if (url.pathname === '/api/inventory.csv' && req.method === 'GET') {
      const user=requireUser(req,res);if(!user)return;
      const filename=`inventrack-inventory-${new Date().toISOString().slice(0,10)}.csv`;
      return send(res,200,inventoryCsv(rows(user.organization_id)),'text/csv',{'Content-Disposition':`attachment; filename="${filename}"`});
    }
    if (url.pathname === '/api/inventory' && req.method === 'PUT') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user = requireUser(req, res, ['admin', 'wholesaler']);
      if (!user) return;
      const payload=await body(req);
      if (payload.revision !== rows(user.organization_id).revision) return send(res,409,{error:'Inventory changed in another session. Reload before editing.'});
      replaceInventory(payload, user.organization_id); return send(res, 200, rows(user.organization_id));
    }
    if (url.pathname === '/api/stock-movements' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin','wholesaler']);if(!user)return;
      stockMovement(await body(req),user.organization_id);return send(res,200,rows(user.organization_id));
    }
    if (url.pathname === '/api/purchase-orders' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin','wholesaler']);if(!user)return;
      createPurchaseOrder(await body(req),user.organization_id);return send(res,201,rows(user.organization_id));
    }
    const receiveOrderMatch=url.pathname.match(/^\/api\/purchase-orders\/([a-zA-Z0-9_-]{1,80})\/receive$/);
    if (receiveOrderMatch && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin','wholesaler']);if(!user)return;
      receivePurchaseOrder(receiveOrderMatch[1],user.organization_id,await body(req));return send(res,200,rows(user.organization_id));
    }
    if (url.pathname === '/api/releases' && req.method === 'GET') {
      if (!requireUser(req, res)) return;
      return send(res,200,db.prepare('SELECT * FROM release_log ORDER BY date DESC').all());
    }
    if (url.pathname === '/api/visits' && req.method === 'GET') return send(res,200,visitorStats());
    if (url.pathname === '/api/visits' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const payload=await body(req),visitorId=String(payload.visitorId||'').trim(),pagePath=String(payload.path||'/').trim().slice(0,120);
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(visitorId) || !/^#[a-zA-Z0-9_-]{1,40}$|^\/[a-zA-Z0-9_/?=&.-]{0,110}$/.test(pagePath)) return send(res,400,{error:'Invalid visitor payload.'});
      const visitedAt=new Date().toISOString();db.prepare('INSERT OR IGNORE INTO visitor_events (visitor_id, visit_date, path, visited_at) VALUES (?, ?, ?, ?)').run(visitorId,visitedAt.slice(0,10),pagePath,visitedAt);
      return send(res,200,visitorStats());
    }
    if (url.pathname === '/api/health') return send(res, 200, { status: 'ok' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const publicAsset = /^(?:assets\/(?:products|suppliers)\/[a-z0-9_-]+\.png|assets\/(?:earth-texture|earth-globe|product-catalog|supplier-team)\.png)$/i.test(requested);
    if (!['index.html','styles.css','workspace.css','globe.css','app.js','globe.js','globe-math.js','runtime-config.js','vendor/zxing-browser.min.js','assets/earth-daymap.jpg','assets/countries-110m.json'].includes(requested) && !publicAsset) return send(res,404,'Not found','text/plain');
    const file = path.resolve(ROOT, requested);
    if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
    return send(res, 200, req.method === 'HEAD' ? '' : fs.readFileSync(file), mime[path.extname(file)] || 'application/octet-stream');
  } catch (error) { console.error(error); return send(res, 400, { error: error.message || 'Request failed.' }); }
});
server.listen(PORT, HOST, () => console.log(`InvenTrack is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${server.address().port}`));
module.exports = server;
