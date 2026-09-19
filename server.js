// InvenTrack API and static-file server. Uses only Node.js built-in modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || '').replace(/\/$/,'');
const ROOT = __dirname;
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(ROOT, 'data', 'inventrack.db'));
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
  CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, phone TEXT, email TEXT, address TEXT);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL COLLATE NOCASE UNIQUE, category TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0), reorder_level INTEGER NOT NULL CHECK(reorder_level >= 0), cost REAL NOT NULL CHECK(cost >= 0), price REAL NOT NULL CHECK(price >= 0), supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL);
  CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment')), quantity INTEGER NOT NULL CHECK(quantity >= 0), balance INTEGER NOT NULL CHECK(balance >= 0), reference TEXT, notes TEXT, date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sales_regions (id TEXT PRIMARY KEY, city TEXT NOT NULL, country TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, sales REAL NOT NULL CHECK(sales >= 0), units INTEGER NOT NULL CHECK(units >= 0), status TEXT NOT NULL CHECK(status IN ('healthy', 'watch', 'risk')));
  CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY, tracking TEXT NOT NULL COLLATE NOCASE UNIQUE, customer TEXT NOT NULL, origin TEXT NOT NULL, origin_lat REAL NOT NULL, origin_lng REAL NOT NULL, destination TEXT NOT NULL, destination_lat REAL NOT NULL, destination_lng REAL NOT NULL, carrier TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending', 'in-transit', 'delivered', 'delayed')), weight REAL NOT NULL CHECK(weight >= 0), value REAL NOT NULL CHECK(value >= 0), eta TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS shipment_events (id TEXT PRIMARY KEY, shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE, status TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, location TEXT NOT NULL, date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS visitor_events (visitor_id TEXT NOT NULL, visit_date TEXT NOT NULL, path TEXT NOT NULL, visited_at TEXT NOT NULL, PRIMARY KEY (visitor_id, visit_date));`);

function rows() {
  const shipments = db.prepare('SELECT id, tracking, customer, origin, origin_lat AS originLat, origin_lng AS originLng, destination, destination_lat AS destinationLat, destination_lng AS destinationLng, carrier, status, weight, value, eta, created_at AS createdAt, updated_at AS updatedAt FROM shipments ORDER BY updated_at DESC').all();
  return {
    revision: db.prepare("SELECT value FROM metadata WHERE key='revision'").get().value,
    suppliers: db.prepare('SELECT id, name, contact, phone, email, address FROM suppliers ORDER BY name').all(),
    products: db.prepare('SELECT id, name, sku, category, quantity, reorder_level AS reorder, cost, price, COALESCE(supplier_id, \'\') AS supplierId FROM products ORDER BY rowid DESC').all(),
    movements: db.prepare('SELECT id, product_id AS productId, type, quantity, balance, reference, notes, date FROM movements ORDER BY date DESC').all(),
    regions: db.prepare('SELECT id, city, country, latitude, longitude, sales, units, status FROM sales_regions ORDER BY sales DESC').all(),
    shipments: shipments.map(shipment => ({ ...shipment, origin: { label: shipment.origin, latitude: shipment.originLat, longitude: shipment.originLng }, destination: { label: shipment.destination, latitude: shipment.destinationLat, longitude: shipment.destinationLng }, events: db.prepare('SELECT id, status, title, detail, location, date FROM shipment_events WHERE shipment_id=? ORDER BY date DESC').all(shipment.id) }))
  };
}
function visitorStats() {
  const stats = db.prepare("SELECT COUNT(DISTINCT visitor_id) AS totalVisitors, COUNT(DISTINCT CASE WHEN visit_date=date('now') THEN visitor_id END) AS todayVisitors, COUNT(DISTINCT CASE WHEN visit_date>=date('now','-6 day') THEN visitor_id END) AS weekVisitors FROM visitor_events").get();
  return { totalVisitors: stats.totalVisitors, todayVisitors: stats.todayVisitors, weekVisitors: stats.weekVisitors };
}
function replaceInventory(payload) {
  if (!payload || !Array.isArray(payload.suppliers) || !Array.isArray(payload.products) || !Array.isArray(payload.movements)) throw new Error('Expected suppliers, products, and movements arrays.');
  for (const collection of [payload.suppliers, payload.products, payload.movements, payload.regions || [], payload.shipments || []]) {
    if (!Array.isArray(collection) || collection.length > 10000) throw new Error('Invalid collection size.');
    for (const item of collection) if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) throw new Error('Invalid record ID.');
  }
  for (const p of payload.products) {
    if (![p.name,p.sku,p.category].every(v=>typeof v==='string' && v.trim() && v.length<=100)) throw new Error('Product name, SKU and category are required.');
    if (![p.quantity,p.reorder].every(v=>Number.isSafeInteger(v)&&v>=0) || ![p.cost,p.price].every(v=>Number.isFinite(v)&&v>=0)) throw new Error('Invalid product quantity or price.');
  }
  for (const m of payload.movements) if (![m.quantity,m.balance].every(v=>Number.isSafeInteger(v)&&v>=0) || !Number.isFinite(Date.parse(m.date))) throw new Error('Invalid stock movement.');
  const shipmentStatuses = new Set(['pending','in-transit','delivered','delayed']);
  for (const s of (payload.shipments || [])) {
    if (![s.tracking,s.customer,s.origin?.label,s.destination?.label,s.carrier,s.eta].every(v=>typeof v==='string' && v.trim() && v.length<=120)) throw new Error('Shipment tracking, customer, route, carrier and ETA are required.');
    if (!shipmentStatuses.has(s.status) || ![s.weight,s.value].every(v=>Number.isFinite(v)&&v>=0) || ![s.origin?.latitude,s.origin?.longitude,s.destination?.latitude,s.destination?.longitude].every(v=>Number.isFinite(v))) throw new Error('Invalid shipment status, value, weight or coordinates.');
    if (!Array.isArray(s.events) || s.events.length > 100) throw new Error('Invalid shipment event history.');
    for (const event of s.events) if (!event || typeof event.id !== 'string' || !shipmentStatuses.has(event.status) || ![event.title,event.detail,event.location,event.date].every(v=>typeof v==='string' && v.trim() && v.length<=240) || !Number.isFinite(Date.parse(event.date))) throw new Error('Invalid shipment event.');
  }
  const insertSupplier = db.prepare('INSERT INTO suppliers VALUES (?, ?, ?, ?, ?, ?)');
  const insertProduct = db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMovement = db.prepare('INSERT INTO movements VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertRegion = db.prepare('INSERT INTO sales_regions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipment = db.prepare('INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipmentEvent = db.prepare('INSERT INTO shipment_events VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM shipment_events; DELETE FROM shipments; DELETE FROM movements; DELETE FROM products; DELETE FROM suppliers;');
    if (payload.regions) db.exec('DELETE FROM sales_regions;');
    for (const s of payload.suppliers) insertSupplier.run(s.id, s.name, s.contact || '', s.phone || '', s.email || '', s.address || '');
    for (const p of payload.products) insertProduct.run(p.id, p.name, p.sku, p.category, p.quantity, p.reorder, p.cost, p.price, p.supplierId || null);
    for (const m of payload.movements) insertMovement.run(m.id, m.productId, m.type, m.quantity, m.balance, m.reference || '', m.notes || '', m.date);
    for (const region of (payload.regions || [])) insertRegion.run(region.id, region.city, region.country, region.latitude, region.longitude, region.sales, region.units, region.status);
    for (const s of (payload.shipments || [])) {
      insertShipment.run(s.id, s.tracking, s.customer, s.origin.label, s.origin.latitude, s.origin.longitude, s.destination.label, s.destination.latitude, s.destination.longitude, s.carrier, s.status, s.weight, s.value, s.eta, s.createdAt, s.updatedAt);
      for (const event of s.events) insertShipmentEvent.run(event.id, s.id, event.status, event.title, event.detail, event.location, event.date);
    }
    db.exec("UPDATE metadata SET value=value+1 WHERE key='revision'; COMMIT;");
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (!db.prepare("SELECT 1 FROM metadata WHERE key='initialized'").get()) {
  if (!db.prepare('SELECT 1 FROM products LIMIT 1').get() && !db.prepare('SELECT 1 FROM suppliers LIMIT 1').get()) replaceInventory(seed);
  db.prepare("INSERT INTO metadata VALUES ('initialized',1)").run();
}
if (!db.prepare('SELECT 1 FROM sales_regions LIMIT 1').get()) {
  const insertRegion = db.prepare('INSERT INTO sales_regions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const region of seed.regions) insertRegion.run(region.id, region.city, region.country, region.latitude, region.longitude, region.sales, region.units, region.status);
}
if (!db.prepare('SELECT 1 FROM shipments LIMIT 1').get()) {
  const insertShipment = db.prepare('INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertShipmentEvent = db.prepare('INSERT INTO shipment_events VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const shipment of seed.shipments) {
    insertShipment.run(shipment.id, shipment.tracking, shipment.customer, shipment.origin.label, shipment.origin.latitude, shipment.origin.longitude, shipment.destination.label, shipment.destination.latitude, shipment.destination.longitude, shipment.carrier, shipment.status, shipment.weight, shipment.value, shipment.eta, shipment.createdAt, shipment.updatedAt);
    for (const event of shipment.events) insertShipmentEvent.run(event.id, shipment.id, event.status, event.title, event.detail, event.location, event.date);
  }
}

db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('edition-3-20260913', 'Edition 3 — Clear workspace', 'New forest-green dashboard, larger readable text, sharp charts, database status and serialized saves. Added revision conflict protection, SQLite WAL, private-file protection and a domain/commercial launch guide.', '2026-09-13T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('globe-refresh-20260913', 'Distribution globe refresh', 'Rebuilt the sales globe with an orthographic spherical projection, geographic land shapes, atmospheric depth, clean route arcs, accessible region markers and a focused location callout.', '2026-09-13T13:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('logistics-center-20260917', 'Logistics Center and shipment tracking', 'Added a database-backed shipping workspace with shipment KPIs, status filters, route map, tracking history, delivery activity and a create-shipment workflow.', '2026-09-17T09:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visual-intelligence-20260917', '3D distribution and partner intelligence', 'Added a rotating 3D Earth model with country labels, territory and shipment routes, plus image-backed product portfolio cards and supplier partner profiles with market-value share and route context.', '2026-09-17T12:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('webgl-earth-20260917', 'Interactive WebGL Earth model', 'Replaced the flat globe renderer with a real textured WebGL sphere mesh. Added drag rotation, tilt, scroll zoom, reset controls, depth-tested lighting, and route overlays that reproject with the view.', '2026-09-17T13:30:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('visitor-counter-20260917', 'Visitor pulse counter', 'Added a privacy-friendly unique visitor counter backed by SQLite with daily de-duplication, a seven-day pulse, and a local fallback for the hosted static portfolio demo. No IP addresses or personal data are stored.', '2026-09-17T14:00:00Z');
db.prepare('INSERT OR IGNORE INTO release_log VALUES (?,?,?,?)').run('production-readiness-20260917', 'Production readiness foundation', 'Added runtime API-origin configuration, controlled CORS support for split hosting, environment templates, and a documented production checklist for authentication, organization isolation, backups, domain setup, and privacy.', '2026-09-17T15:00:00Z');
function send(res, code, body, type = 'application/json') { const headers={ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY' }; if(CORS_ORIGIN){headers['Access-Control-Allow-Origin']=CORS_ORIGIN;headers['Access-Control-Allow-Methods']='GET, PUT, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';headers.Vary='Origin'} res.writeHead(code, headers); res.end(type === 'application/json' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body); }
function originAllowed(req) { const origin=req.headers.origin; if(!origin)return true; try { const requestOrigin=new URL(origin),hostOrigin=`${requestOrigin.protocol}//${req.headers.host}`; return origin===hostOrigin || (CORS_ORIGIN && origin===CORS_ORIGIN); } catch { return false; } }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('Request body is too large.')); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON.')); } }); }); }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if(req.method==='OPTIONS'){if(!originAllowed(req))return send(res,403,{error:'Origin is not allowed.'});res.writeHead(204,CORS_ORIGIN?{'Access-Control-Allow-Origin':CORS_ORIGIN,'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{});return res.end();}
    if (url.pathname === '/api/inventory' && req.method === 'GET') return send(res, 200, rows());
    if (url.pathname === '/api/inventory' && req.method === 'PUT') {
      if (!originAllowed(req)) return send(res,403,{error:'Cross-origin writes are not allowed.'});
      const payload=await body(req);
      if (payload.revision !== rows().revision) return send(res,409,{error:'Inventory changed in another session. Reload before editing.'});
      replaceInventory(payload); return send(res, 200, rows());
    }
    if (url.pathname === '/api/releases' && req.method === 'GET') return send(res,200,db.prepare('SELECT * FROM release_log ORDER BY date DESC').all());
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
