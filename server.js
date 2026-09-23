// InvenTrack API and static-file server. Uses only Node.js built-in modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || '').replace(/\/$/,'');
const AUTH_REQUIRED = /^true$/i.test(String(process.env.AUTH_REQUIRED || 'false'));
const configuredSessionTtl = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const SESSION_TTL_MS = Number.isFinite(configuredSessionTtl) ? Math.max(15 * 60 * 1000, configuredSessionTtl) : 8 * 60 * 60 * 1000;
const ROOT = __dirname;
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(ROOT, 'data', 'inventrack.db'));
const DEMO_ORG_ID = 'org_demo';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const seed = {
  suppliers: [
    { id: 's1', name: 'Nova Tech Distributors', contact: 'Arjun Mehta', phone: '+91 98765 43210', email: 'orders@novatech.example', address: 'Bengaluru, Karnataka' },
    { id: 's2', name: 'GreenLeaf Wholesale', contact: 'Priya Nair', phone: '+91 98220 11223', email: 'sales@greenleaf.example', address: 'Kochi, Kerala' },
    { id: 's3', name: 'Metro Office Supplies', contact: 'Rohan Shah', phone: '+91 97654 32109', email: 'hello@metrooffice.example', address: 'Mumbai, Maharashtra' }
  ],
  products: [
    { id: 'p1', name: 'Wireless Keyboard', sku: 'ELEC-001', category: 'Electronics', quantity: 28, reorder: 10, cost: 1250, price: 1899, supplierId: 's1' },
    { id: 'p2', name: 'USB-C Hub 7-in-1', sku: 'ELEC-014', category: 'Electronics', quantity: 7, reorder: 8, cost: 1750, price: 2499, supplierId: 's1' },
    { id: 'p3', name: 'A4 Premium Paper', sku: 'STAT-021', category: 'Stationery', quantity: 64, reorder: 15, cost: 245, price: 349, supplierId: 's3' },
    { id: 'p4', name: 'Ergonomic Office Chair', sku: 'FURN-005', category: 'Furniture', quantity: 4, reorder: 5, cost: 7200, price: 9999, supplierId: 's3' },
    { id: 'p5', name: 'Organic Green Tea', sku: 'PAN-032', category: 'Pantry', quantity: 42, reorder: 12, cost: 180, price: 275, supplierId: 's2' },
    { id: 'p6', name: 'Desk Organizer', sku: 'STAT-044', category: 'Stationery', quantity: 0, reorder: 6, cost: 320, price: 499, supplierId: 's3' }
  ],
  movements: [
    { id: 'm1', productId: 'p1', type: 'in', quantity: 20, balance: 28, reference: 'PO-1042', notes: 'Monthly replenishment', date: '2026-08-20T09:30:00' },
    { id: 'm2', productId: 'p3', type: 'out', quantity: 6, balance: 64, reference: 'SALE-218', notes: 'Customer order', date: '2026-08-19T14:10:00' },
    { id: 'm3', productId: 'p4', type: 'out', quantity: 2, balance: 4, reference: 'SALE-215', notes: 'Corporate order', date: '2026-08-18T11:20:00' },
    { id: 'm4', productId: 'p5', type: 'in', quantity: 24, balance: 42, reference: 'PO-1039', notes: 'Supplier delivery', date: '2026-08-17T16:00:00' }
  ],
  regions: [
    { id: 'r1', city: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.877, sales: 284000, units: 176, status: 'healthy' },
    { id: 'r2', city: 'Bengaluru', country: 'India', latitude: 12.972, longitude: 77.594, sales: 219000, units: 142, status: 'healthy' },
    { id: 'r3', city: 'Delhi', country: 'India', latitude: 28.614, longitude: 77.209, sales: 178000, units: 93, status: 'watch' },
    { id: 'r4', city: 'Dubai', country: 'UAE', latitude: 25.205, longitude: 55.271, sales: 133000, units: 61, status: 'healthy' },
    { id: 'r5', city: 'Singapore', country: 'Singapore', latitude: 1.352, longitude: 103.82, sales: 97000, units: 48, status: 'watch' },
    { id: 'r6', city: 'London', country: 'United Kingdom', latitude: 51.507, longitude: -0.128, sales: 76000, units: 31, status: 'risk' }
  ],
  shipments: [
    { id: 'sh1', tracking: 'IT-2026-1042', customer: 'Nova Retail Co.', origin: { label: 'Mumbai, India', latitude: 19.076, longitude: 72.877 }, destination: { label: 'Bengaluru, India', latitude: 12.972, longitude: 77.594 }, carrier: 'InvenTrack Express', status: 'in-transit', weight: 184, value: 284000, eta: '2026-09-19', createdAt: '2026-09-13T08:30:00Z', updatedAt: '2026-09-16T10:10:00Z', events: [
      { id: 'she1', status: 'delivered', title: 'Shipment booked', detail: 'Order confirmed and packed at the Mumbai fulfilment hub.', location: 'Mumbai, India', date: '2026-09-13T08:30:00Z' },
      { id: 'she2', status: 'in-transit', title: 'In transit', detail: 'Carrier has collected the shipment and it is moving to Bengaluru.', location: 'Pune, India', date: '2026-09-16T10:10:00Z' }
    ] },
    { id: 'sh2', tracking: 'IT-2026-1037', customer: 'GreenLeaf Wholesale', origin: { label: 'Kochi, India', latitude: 9.931, longitude: 76.267 }, destination: { label: 'Dubai, UAE', latitude: 25.205, longitude: 55.271 }, carrier: 'Skyline Cargo', status: 'delivered', weight: 92, value: 176500, eta: '2026-09-15', createdAt: '2026-09-10T06:50:00Z', updatedAt: '2026-09-15T14:20:00Z', events: [
      { id: 'she3', status: 'delivered', title: 'Delivered', detail: 'Delivery confirmed by the receiving team.', location: 'Dubai, UAE', date: '2026-09-15T14:20:00Z' },
      { id: 'she4', status: 'in-transit', title: 'Customs cleared', detail: 'Shipment cleared destination customs.', location: 'Dubai, UAE', date: '2026-09-14T11:05:00Z' }
    ] },
    { id: 'sh3', tracking: 'IT-2026-1051', customer: 'Metro Office Supplies', origin: { label: 'Mumbai, India', latitude: 19.076, longitude: 72.877 }, destination: { label: 'Delhi, India', latitude: 28.614, longitude: 77.209 }, carrier: 'RapidRoute Logistics', status: 'pending', weight: 48, value: 98500, eta: '2026-09-21', createdAt: '2026-09-16T09:15:00Z', updatedAt: '2026-09-16T09:15:00Z', events: [
      { id: 'she5', status: 'pending', title: 'Ready for pickup', detail: 'Shipment is packed and waiting for carrier collection.', location: 'Mumbai, India', date: '2026-09-16T09:15:00Z' }
    ] },
    { id: 'sh4', tracking: 'IT-2026-1029', customer: 'Northstar Retail', origin: { label: 'Bengaluru, India', latitude: 12.972, longitude: 77.594 }, destination: { label: 'Singapore', latitude: 1.352, longitude: 103.82 }, carrier: 'OceanLink Freight', status: 'delayed', weight: 310, value: 342000, eta: '2026-09-20', createdAt: '2026-09-08T07:40:00Z', updatedAt: '2026-09-16T18:40:00Z', events: [
      { id: 'she6', status: 'delayed', title: 'Weather delay', detail: 'Departure moved by 24 hours due to adverse weather.', location: 'Chennai, India', date: '2026-09-16T18:40:00Z' },
      { id: 'she7', status: 'in-transit', title: 'Departed origin hub', detail: 'Shipment left the Bengaluru consolidation centre.', location: 'Bengaluru, India', date: '2026-09-12T12:25:00Z' }
    ] },
    { id: 'sh5', tracking: 'IT-2026-1018', customer: 'Atlas Trade Group', origin: { label: 'Mumbai, India', latitude: 19.076, longitude: 72.877 }, destination: { label: 'London, United Kingdom', latitude: 51.507, longitude: -0.128 }, carrier: 'GlobalParcel', status: 'delivered', weight: 126, value: 219000, eta: '2026-09-12', createdAt: '2026-09-04T09:05:00Z', updatedAt: '2026-09-12T16:05:00Z', events: [
      { id: 'she8', status: 'delivered', title: 'Delivered', detail: 'Signed for by the receiving warehouse.', location: 'London, United Kingdom', date: '2026-09-12T16:05:00Z' }
    ] },
    { id: 'sh6', tracking: 'IT-2026-1054', customer: 'Harbour Retail Network', origin: { label: 'Kochi, India', latitude: 9.931, longitude: 76.267 }, destination: { label: 'Delhi, India', latitude: 28.614, longitude: 77.209 }, carrier: 'InvenTrack Express', status: 'in-transit', weight: 76, value: 126000, eta: '2026-09-22', createdAt: '2026-09-16T15:35:00Z', updatedAt: '2026-09-17T07:20:00Z', events: [
      { id: 'she9', status: 'in-transit', title: 'Departed origin hub', detail: 'Shipment is on the line-haul route to Delhi.', location: 'Kochi, India', date: '2026-09-17T07:20:00Z' }
    ] }
  ]
};

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
const purchaseOrderColumns=db.prepare('PRAGMA table_info(purchase_orders)').all();
if(!purchaseOrderColumns.some(column=>column.name==='supplier_name'))db.exec("ALTER TABLE purchase_orders ADD COLUMN supplier_name TEXT NOT NULL DEFAULT ''");
const organizationTables = ['suppliers', 'products', 'movements', 'sales_regions', 'shipments', 'shipment_events', 'purchase_orders'];
for (const table of organizationTables) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(column => column.name === 'organization_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN organization_id TEXT`);
  db.prepare(`UPDATE ${table} SET organization_id=? WHERE organization_id IS NULL OR organization_id=''`).run(DEMO_ORG_ID);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_nocase ON products(organization_id, barcode COLLATE NOCASE) WHERE barcode <> '';");
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
  CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
  CREATE INDEX IF NOT EXISTS idx_movements_organization ON movements(organization_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_organization ON shipments(organization_id);
  CREATE INDEX IF NOT EXISTS idx_events_organization ON shipment_events(organization_id);`);
db.prepare('INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)').run(DEMO_ORG_ID, 'InvenTrack demo organization', new Date().toISOString());

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
  if (!AUTH_REQUIRED) return { id: 'demo-user', email: 'demo@inventrack.local', role: 'admin', organization_id: DEMO_ORG_ID, organization_name: 'InvenTrack demo organization' };
  const token = parseCookies(req.headers.cookie).inventrack_session;
  if (!token) return null;
  const user = db.prepare(`SELECT users.id, users.email, users.role, users.organization_id, organizations.name AS organization_name
    FROM sessions JOIN users ON users.id=sessions.user_id JOIN organizations ON organizations.id=users.organization_id
    WHERE sessions.token_hash=? AND sessions.expires_at>?`).get(tokenHash(token), new Date().toISOString());
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
  if (!email && !password) {
    if (AUTH_REQUIRED) throw new Error('AUTH_REQUIRED=true needs ADMIN_EMAIL and ADMIN_PASSWORD on the first startup.');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    throw new Error('ADMIN_EMAIL must be valid and ADMIN_PASSWORD must contain at least 12 characters.');
  }
  db.prepare('INSERT INTO users (id, organization_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('user_admin', DEMO_ORG_ID, email, hashPassword(password), 'admin', new Date().toISOString());
}

function rows(organizationId = DEMO_ORG_ID) {
  const shipments = db.prepare('SELECT id, tracking, customer, origin, origin_lat AS originLat, origin_lng AS originLng, destination, destination_lat AS destinationLat, destination_lng AS destinationLng, carrier, status, weight, value, eta, created_at AS createdAt, updated_at AS updatedAt FROM shipments WHERE organization_id=? ORDER BY updated_at DESC').all(organizationId);
  const purchaseOrders=db.prepare('SELECT id, supplier_id AS supplierId, supplier_name AS supplierName, status, created_at AS createdAt, received_at AS receivedAt FROM purchase_orders WHERE organization_id=? ORDER BY created_at DESC').all(organizationId).map(order=>{
    const items=db.prepare('SELECT product_id AS productId, product_name AS name, sku, quantity, unit_cost AS unitCost FROM purchase_order_items WHERE order_id=?').all(order.id);
    return {...order,items,total:items.reduce((total,item)=>total+item.quantity*item.unitCost,0)};
  });
  return {
    revision: db.prepare("SELECT value FROM metadata WHERE key='revision'").get().value,
    suppliers: db.prepare('SELECT id, name, contact, phone, email, address FROM suppliers WHERE organization_id=? ORDER BY name').all(organizationId),
    products: db.prepare('SELECT id, name, sku, barcode, category, quantity, reorder_level AS reorder, cost, price, COALESCE(supplier_id, \'\') AS supplierId FROM products WHERE organization_id=? ORDER BY rowid DESC').all(organizationId),
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
function replaceInventory(payload, organizationId = DEMO_ORG_ID, {resetDemo=false} = {}) {
  if (!payload || !Array.isArray(payload.suppliers) || !Array.isArray(payload.products) || !Array.isArray(payload.movements)) throw new Error('Expected suppliers, products, and movements arrays.');
  for (const collection of [payload.suppliers, payload.products, payload.movements, payload.regions || [], payload.shipments || []]) {
    if (!Array.isArray(collection) || collection.length > 10000) throw new Error('Invalid collection size.');
    for (const item of collection) if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) throw new Error('Invalid record ID.');
  }
  const newProducts=new Map(), productIds=new Set(payload.products.map(product=>product.id));
  if(!resetDemo){
    const orderedItems=db.prepare("SELECT DISTINCT poi.product_id AS productId FROM purchase_order_items poi JOIN purchase_orders po ON po.id=poi.order_id WHERE po.organization_id=? AND po.status='ordered'").all(organizationId);
    if(orderedItems.some(item=>!productIds.has(item.productId)))throw new Error('Receive outstanding purchase orders before deleting their products.');
  }
  for (const p of payload.products) {
    if (![p.name,p.sku,p.category].every(v=>typeof v==='string' && v.trim() && v.length<=100)) throw new Error('Product name, SKU and category are required.');
    if (![p.quantity,p.reorder].every(v=>Number.isSafeInteger(v)&&v>=0) || ![p.cost,p.price].every(v=>Number.isFinite(v)&&v>=0)) throw new Error('Invalid product quantity or price.');
    if(p.barcode!==undefined&&(typeof p.barcode!=='string'||p.barcode.length>100))throw new Error('Invalid product barcode.');
    const current=db.prepare('SELECT quantity FROM products WHERE id=? AND organization_id=?').get(p.id,organizationId);
    if(!resetDemo&&current&&current.quantity!==p.quantity)throw new Error('Use a stock movement to change an existing product quantity.');
    if(!current)newProducts.set(p.id,p);
  }
  const openingCounts=new Map();
  for (const m of payload.movements){
    if (![m.quantity,m.balance].every(v=>Number.isSafeInteger(v)&&v>=0) || !Number.isFinite(Date.parse(m.date))) throw new Error('Invalid stock movement.');
    if(resetDemo)continue;
    const existing=db.prepare('SELECT organization_id FROM movements WHERE id=?').get(m.id);
    if(existing){if(existing.organization_id!==organizationId)throw new Error('Movement belongs to another organization.');continue;}
    const product=newProducts.get(m.productId);
    if(!product||m.type!=='in'||m.quantity!==product.quantity||m.balance!==product.quantity||!['OPENING','CSV IMPORT'].includes(m.reference))throw new Error('New movements must record opening stock for a new product.');
    openingCounts.set(m.productId,(openingCounts.get(m.productId)||0)+1);
  }
  if(!resetDemo)for(const product of newProducts.values())if((openingCounts.get(product.id)||0)!==(product.quantity>0?1:0))throw new Error('Each new product needs one matching opening-stock movement.');
  const shipmentStatuses = new Set(['pending','in-transit','delivered','delayed']);
  for (const s of (payload.shipments || [])) {
    if (![s.tracking,s.customer,s.origin?.label,s.destination?.label,s.carrier,s.eta].every(v=>typeof v==='string' && v.trim() && v.length<=120)) throw new Error('Shipment tracking, customer, route, carrier and ETA are required.');
    if (!shipmentStatuses.has(s.status) || ![s.weight,s.value].every(v=>Number.isFinite(v)&&v>=0) || ![s.origin?.latitude,s.origin?.longitude,s.destination?.latitude,s.destination?.longitude].every(v=>Number.isFinite(v))) throw new Error('Invalid shipment status, value, weight or coordinates.');
    if (!Array.isArray(s.events) || s.events.length > 100) throw new Error('Invalid shipment event history.');
    for (const event of s.events) if (!event || typeof event.id !== 'string' || !shipmentStatuses.has(event.status) || ![event.title,event.detail,event.location,event.date].every(v=>typeof v==='string' && v.trim() && v.length<=240) || !Number.isFinite(Date.parse(event.date))) throw new Error('Invalid shipment event.');
  }
  const insertSupplier = db.prepare('INSERT INTO suppliers (id, organization_id, name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertProduct = db.prepare('INSERT INTO products (id, organization_id, name, sku, barcode, category, quantity, reorder_level, cost, price, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMovement = db.prepare('INSERT INTO movements (id, organization_id, product_id, type, quantity, balance, reference, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertRegion = db.prepare('INSERT INTO sales_regions (id, organization_id, city, country, latitude, longitude, sales, units, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipment = db.prepare('INSERT INTO shipments (id, organization_id, tracking, customer, origin, origin_lat, origin_lng, destination, destination_lat, destination_lng, carrier, status, weight, value, eta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipmentEvent = db.prepare('INSERT INTO shipment_events (id, organization_id, shipment_id, status, title, detail, location, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    if(resetDemo){
      db.prepare('DELETE FROM purchase_orders WHERE organization_id=?').run(organizationId);
      db.prepare('DELETE FROM movements WHERE organization_id=?').run(organizationId);
    }
    db.prepare('DELETE FROM shipment_events WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM shipments WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM products WHERE organization_id=?').run(organizationId);
    db.prepare('DELETE FROM suppliers WHERE organization_id=?').run(organizationId);
    if (payload.regions) db.prepare('DELETE FROM sales_regions WHERE organization_id=?').run(organizationId);
    for (const s of payload.suppliers) insertSupplier.run(s.id, organizationId, s.name, s.contact || '', s.phone || '', s.email || '', s.address || '');
    for (const p of payload.products) insertProduct.run(p.id, organizationId, p.name, p.sku, p.barcode || '', p.category, p.quantity, p.reorder, p.cost, p.price, p.supplierId || null);
    for (const m of payload.movements) db.prepare('INSERT OR IGNORE INTO movements (id, organization_id, product_id, type, quantity, balance, reference, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(m.id, organizationId, m.productId, m.type, m.quantity, m.balance, m.reference || '', m.notes || '', m.date);
    for (const region of (payload.regions || [])) insertRegion.run(region.id, organizationId, region.city, region.country, region.latitude, region.longitude, region.sales, region.units, region.status);
    for (const s of (payload.shipments || [])) {
      insertShipment.run(s.id, organizationId, s.tracking, s.customer, s.origin.label, s.origin.latitude, s.origin.longitude, s.destination.label, s.destination.latitude, s.destination.longitude, s.carrier, s.status, s.weight, s.value, s.eta, s.createdAt, s.updatedAt);
      for (const event of s.events) insertShipmentEvent.run(event.id, organizationId, s.id, event.status, event.title, event.detail, event.location, event.date);
    }
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (!db.prepare("SELECT 1 FROM metadata WHERE key='initialized'").get()) {
  if (!db.prepare('SELECT 1 FROM products WHERE organization_id=? LIMIT 1').get(DEMO_ORG_ID) && !db.prepare('SELECT 1 FROM suppliers WHERE organization_id=? LIMIT 1').get(DEMO_ORG_ID)) replaceInventory(seed, DEMO_ORG_ID, {resetDemo:true});
  db.prepare("INSERT INTO metadata VALUES ('initialized',1)").run();
}
if (!db.prepare('SELECT 1 FROM sales_regions WHERE organization_id=? LIMIT 1').get(DEMO_ORG_ID)) {
  const insertRegion = db.prepare('INSERT INTO sales_regions (id, organization_id, city, country, latitude, longitude, sales, units, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const region of seed.regions) insertRegion.run(region.id, DEMO_ORG_ID, region.city, region.country, region.latitude, region.longitude, region.sales, region.units, region.status);
}
if (!db.prepare('SELECT 1 FROM shipments WHERE organization_id=? LIMIT 1').get(DEMO_ORG_ID)) {
  const insertShipment = db.prepare('INSERT INTO shipments (id, organization_id, tracking, customer, origin, origin_lat, origin_lng, destination, destination_lat, destination_lng, carrier, status, weight, value, eta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipmentEvent = db.prepare('INSERT INTO shipment_events (id, organization_id, shipment_id, status, title, detail, location, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const shipment of seed.shipments) {
    insertShipment.run(shipment.id, DEMO_ORG_ID, shipment.tracking, shipment.customer, shipment.origin.label, shipment.origin.latitude, shipment.origin.longitude, shipment.destination.label, shipment.destination.latitude, shipment.destination.longitude, shipment.carrier, shipment.status, shipment.weight, shipment.value, shipment.eta, shipment.createdAt, shipment.updatedAt);
    for (const event of shipment.events) insertShipmentEvent.run(event.id, DEMO_ORG_ID, shipment.id, event.status, event.title, event.detail, event.location, event.date);
  }
}
ensureAdminUser();

db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('edition-3-20260913', 'Edition 3 — Clear workspace', 'New forest-green dashboard, larger readable text, sharp charts, database status and serialized saves. Added revision conflict protection, SQLite WAL, private-file protection and a domain/commercial launch guide.', '2026-09-13T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('globe-refresh-20260913', 'Distribution globe refresh', 'Rebuilt the sales globe with an orthographic spherical projection, geographic land shapes, atmospheric depth, clean route arcs, accessible region markers and a focused location callout.', '2026-09-13T13:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('logistics-center-20260917', 'Logistics Center and shipment tracking', 'Added a database-backed shipping workspace with shipment KPIs, status filters, route map, tracking history, delivery activity and a create-shipment workflow.', '2026-09-17T09:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visual-intelligence-20260917', '3D distribution and partner intelligence', 'Added a rotating 3D Earth model with country labels, territory and shipment routes, plus image-backed product portfolio cards and supplier partner profiles with market-value share and route context.', '2026-09-17T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('webgl-earth-20260917', 'Interactive WebGL Earth model', 'Replaced the flat globe renderer with a real textured WebGL sphere mesh. Added drag rotation, tilt, scroll zoom, reset controls, depth-tested lighting, and route overlays that reproject with the view.', '2026-09-17T13:30:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visitor-counter-20260917', 'Visitor pulse counter', 'Added a privacy-friendly unique visitor counter backed by SQLite with daily de-duplication, a seven-day pulse, and a local fallback for the hosted static portfolio demo. No IP addresses or personal data are stored.', '2026-09-17T14:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('production-readiness-20260917', 'Production readiness foundation', 'Added runtime API-origin configuration, controlled CORS support for split hosting, environment templates, and a documented production checklist for authentication, organization isolation, backups, domain setup, and privacy.', '2026-09-17T15:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('secure-pilot-foundation-20260920', 'Secure pilot foundation', 'Added optional scrypt-backed authentication, expiring HTTP-only sessions, server-side role enforcement, organization-scoped inventory queries, and automated auth coverage. Demo mode remains available when authentication is disabled.', '2026-09-20T10:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('operations-upgrade-20260924', 'Stock transactions, barcode scanning and purchase orders', 'Added product barcodes and browser camera scanning, atomic role-protected stock transactions with append-only movement history, supplier purchase orders generated from reorder suggestions, and transactional order receiving.', '2026-09-24T09:00:00Z');
function send(res, code, body, type = 'application/json', extraHeaders = {}) { const headers={ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', ...extraHeaders }; if(CORS_ORIGIN){headers['Access-Control-Allow-Origin']=CORS_ORIGIN;headers['Access-Control-Allow-Methods']='GET, PUT, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Allow-Credentials']='true';headers.Vary='Origin'} res.writeHead(code, headers); res.end(type === 'application/json' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body); }
function originAllowed(req) { const origin=req.headers.origin; if(!origin)return true; try { const requestOrigin=new URL(origin),hostOrigin=`${requestOrigin.protocol}//${req.headers.host}`; return origin===hostOrigin || (CORS_ORIGIN && origin===CORS_ORIGIN); } catch { return false; } }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('Request body is too large.')); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON.')); } }); }); }
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
function receivePurchaseOrder(orderId, organizationId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const order=db.prepare("SELECT id,status FROM purchase_orders WHERE id=? AND organization_id=?").get(orderId,organizationId);
    if(!order) throw new Error('Purchase order was not found.');
    if(order.status==='received') throw new Error('This purchase order has already been received.');
    const items=db.prepare('SELECT product_id,quantity FROM purchase_order_items WHERE order_id=?').all(orderId), now=new Date().toISOString();
    for(const item of items){
      const product=db.prepare('SELECT quantity FROM products WHERE id=? AND organization_id=?').get(item.product_id,organizationId);
      if(!product) throw new Error('A product on this order no longer exists.');
      const balance=product.quantity+item.quantity;
      db.prepare('UPDATE products SET quantity=? WHERE id=? AND organization_id=?').run(balance,item.product_id,organizationId);
      db.prepare("INSERT INTO movements(id,organization_id,product_id,type,quantity,balance,reference,notes,date) VALUES(?,?,?,'in',?,?,?,?,?)").run(crypto.randomUUID().replaceAll('-',''),organizationId,item.product_id,item.quantity,balance,orderId,'Purchase order received',now);
    }
    db.prepare("UPDATE purchase_orders SET status='received',received_at=? WHERE id=? AND organization_id=?").run(now,orderId,organizationId);
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch(error){db.exec('ROLLBACK');throw error;}
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

http.createServer(async (req, res) => {
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
      if (!/^\S+@\S+\.\S+$/.test(email) || !password) return send(res, 400, { error: 'Enter a valid email and password.' });
      const user = db.prepare(`SELECT users.id, users.email, users.password_hash, users.role, users.organization_id, organizations.name AS organization_name
        FROM users JOIN organizations ON organizations.id=users.organization_id WHERE lower(users.email)=?`).get(email);
      if (!user || !verifyPassword(password, user.password_hash)) return send(res, 401, { error: 'Email or password is incorrect.' });
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
    if (url.pathname === '/api/inventory' && req.method === 'GET') {
      const user = requireUser(req, res);
      return user ? send(res, 200, rows(user.organization_id)) : undefined;
    }
    if (url.pathname === '/api/inventory' && req.method === 'PUT') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user = requireUser(req, res, ['admin', 'wholesaler']);
      if (!user) return;
      const payload=await body(req);
      if (payload.revision !== rows(user.organization_id).revision) return send(res,409,{error:'Inventory changed in another session. Reload before editing.'});
      replaceInventory(payload, user.organization_id); return send(res, 200, rows(user.organization_id));
    }
    if (url.pathname === '/api/demo-reset' && req.method === 'POST') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const user=requireUser(req,res,['admin']);if(!user)return;
      if(AUTH_REQUIRED||user.organization_id!==DEMO_ORG_ID)return send(res,403,{error:'Demo reset is available only in local demo mode.'});
      replaceInventory(seed,DEMO_ORG_ID,{resetDemo:true});return send(res,200,rows(DEMO_ORG_ID));
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
      receivePurchaseOrder(receiveOrderMatch[1],user.organization_id);return send(res,200,rows(user.organization_id));
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
    if (!['index.html','styles.css','workspace.css','globe.css','app.js','globe.js','globe-math.js','runtime-config.js','assets/earth-daymap.jpg','assets/countries-110m.json'].includes(requested) && !publicAsset) return send(res,404,'Not found','text/plain');
    const file = path.resolve(ROOT, requested);
    if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
    return send(res, 200, req.method === 'HEAD' ? '' : fs.readFileSync(file), mime[path.extname(file)] || 'application/octet-stream');
  } catch (error) { console.error(error); return send(res, 400, { error: error.message || 'Request failed.' }); }
}).listen(PORT, HOST, () => console.log(`InvenTrack is running at http://localhost:${PORT}`));
