const STORE_KEY = 'inventrack_mca_v1';
const LEGACY_STORE_KEY = 'stockflow_inventory_v1';
const API_BASE = String(window.INVENTRACK_API_BASE || '').replace(/\/$/,'');
const api = (path,options={}) => fetch(`${API_BASE}${path}`,{credentials:'include',...options});
const rupees = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
const shortDate = new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'});

const seed = {
  suppliers:[
    {id:'s1',name:'Nova Tech Distributors',contact:'Arjun Mehta',phone:'+91 98765 43210',email:'orders@novatech.example',address:'Bengaluru, Karnataka'},
    {id:'s2',name:'GreenLeaf Wholesale',contact:'Priya Nair',phone:'+91 98220 11223',email:'sales@greenleaf.example',address:'Kochi, Kerala'},
    {id:'s3',name:'Metro Office Supplies',contact:'Rohan Shah',phone:'+91 97654 32109',email:'hello@metrooffice.example',address:'Mumbai, Maharashtra'}
  ],
  products:[
    {id:'p1',name:'Wireless Keyboard',sku:'ELEC-001',category:'Electronics',quantity:28,reorder:10,cost:1250,price:1899,supplierId:'s1'},
    {id:'p2',name:'USB-C Hub 7-in-1',sku:'ELEC-014',category:'Electronics',quantity:7,reorder:8,cost:1750,price:2499,supplierId:'s1'},
    {id:'p3',name:'A4 Premium Paper',sku:'STAT-021',category:'Stationery',quantity:64,reorder:15,cost:245,price:349,supplierId:'s3'},
    {id:'p4',name:'Ergonomic Office Chair',sku:'FURN-005',category:'Furniture',quantity:4,reorder:5,cost:7200,price:9999,supplierId:'s3'},
    {id:'p5',name:'Organic Green Tea',sku:'PAN-032',category:'Pantry',quantity:42,reorder:12,cost:180,price:275,supplierId:'s2'},
    {id:'p6',name:'Desk Organizer',sku:'STAT-044',category:'Stationery',quantity:0,reorder:6,cost:320,price:499,supplierId:'s3'}
  ],
  movements:[
    {id:'m1',productId:'p1',type:'in',quantity:20,balance:28,reference:'PO-1042',notes:'Monthly replenishment',date:'2026-08-20T09:30:00'},
    {id:'m2',productId:'p3',type:'out',quantity:6,balance:64,reference:'SALE-218',notes:'Customer order',date:'2026-08-19T14:10:00'},
    {id:'m3',productId:'p4',type:'out',quantity:2,balance:4,reference:'SALE-215',notes:'Corporate order',date:'2026-08-18T11:20:00'},
    {id:'m4',productId:'p5',type:'in',quantity:24,balance:42,reference:'PO-1039',notes:'Supplier delivery',date:'2026-08-17T16:00:00'}
  ],
  regions:[
    {id:'r1',city:'Mumbai',country:'India',latitude:19.076,longitude:72.877,sales:284000,units:176,status:'healthy'},
    {id:'r2',city:'Bengaluru',country:'India',latitude:12.972,longitude:77.594,sales:219000,units:142,status:'healthy'},
    {id:'r3',city:'Delhi',country:'India',latitude:28.614,longitude:77.209,sales:178000,units:93,status:'watch'},
    {id:'r4',city:'Dubai',country:'UAE',latitude:25.205,longitude:55.271,sales:133000,units:61,status:'healthy'},
    {id:'r5',city:'Singapore',country:'Singapore',latitude:1.352,longitude:103.82,sales:97000,units:48,status:'watch'},
    {id:'r6',city:'London',country:'United Kingdom',latitude:51.507,longitude:-0.128,sales:76000,units:31,status:'risk'}
  ],
  shipments:[
    {id:'sh1',tracking:'IT-2026-1042',customer:'Nova Retail Co.',origin:{label:'Mumbai, India',latitude:19.076,longitude:72.877},destination:{label:'Bengaluru, India',latitude:12.972,longitude:77.594},carrier:'InvenTrack Express',status:'in-transit',weight:184,value:284000,eta:'2026-09-19',createdAt:'2026-09-13T08:30:00Z',updatedAt:'2026-09-16T10:10:00Z',events:[{id:'she1',status:'delivered',title:'Shipment booked',detail:'Order confirmed and packed at the Mumbai fulfilment hub.',location:'Mumbai, India',date:'2026-09-13T08:30:00Z'},{id:'she2',status:'in-transit',title:'In transit',detail:'Carrier has collected the shipment and it is moving to Bengaluru.',location:'Pune, India',date:'2026-09-16T10:10:00Z'}]},
    {id:'sh2',tracking:'IT-2026-1037',customer:'GreenLeaf Wholesale',origin:{label:'Kochi, India',latitude:9.931,longitude:76.267},destination:{label:'Dubai, UAE',latitude:25.205,longitude:55.271},carrier:'Skyline Cargo',status:'delivered',weight:92,value:176500,eta:'2026-09-15',createdAt:'2026-09-10T06:50:00Z',updatedAt:'2026-09-15T14:20:00Z',events:[{id:'she3',status:'delivered',title:'Delivered',detail:'Delivery confirmed by the receiving team.',location:'Dubai, UAE',date:'2026-09-15T14:20:00Z'},{id:'she4',status:'in-transit',title:'Customs cleared',detail:'Shipment cleared destination customs.',location:'Dubai, UAE',date:'2026-09-14T11:05:00Z'}]},
    {id:'sh3',tracking:'IT-2026-1051',customer:'Metro Office Supplies',origin:{label:'Mumbai, India',latitude:19.076,longitude:72.877},destination:{label:'Delhi, India',latitude:28.614,longitude:77.209},carrier:'RapidRoute Logistics',status:'pending',weight:48,value:98500,eta:'2026-09-21',createdAt:'2026-09-16T09:15:00Z',updatedAt:'2026-09-16T09:15:00Z',events:[{id:'she5',status:'pending',title:'Ready for pickup',detail:'Shipment is packed and waiting for carrier collection.',location:'Mumbai, India',date:'2026-09-16T09:15:00Z'}]},
    {id:'sh4',tracking:'IT-2026-1029',customer:'Northstar Retail',origin:{label:'Bengaluru, India',latitude:12.972,longitude:77.594},destination:{label:'Singapore',latitude:1.352,longitude:103.82},carrier:'OceanLink Freight',status:'delayed',weight:310,value:342000,eta:'2026-09-20',createdAt:'2026-09-08T07:40:00Z',updatedAt:'2026-09-16T18:40:00Z',events:[{id:'she6',status:'delayed',title:'Weather delay',detail:'Departure moved by 24 hours due to adverse weather.',location:'Chennai, India',date:'2026-09-16T18:40:00Z'},{id:'she7',status:'in-transit',title:'Departed origin hub',detail:'Shipment left the Bengaluru consolidation centre.',location:'Bengaluru, India',date:'2026-09-12T12:25:00Z'}]},
    {id:'sh5',tracking:'IT-2026-1018',customer:'Atlas Trade Group',origin:{label:'Mumbai, India',latitude:19.076,longitude:72.877},destination:{label:'London, United Kingdom',latitude:51.507,longitude:-0.128},carrier:'GlobalParcel',status:'delivered',weight:126,value:219000,eta:'2026-09-12',createdAt:'2026-09-04T09:05:00Z',updatedAt:'2026-09-12T16:05:00Z',events:[{id:'she8',status:'delivered',title:'Delivered',detail:'Signed for by the receiving warehouse.',location:'London, United Kingdom',date:'2026-09-12T16:05:00Z'}]},
    {id:'sh6',tracking:'IT-2026-1054',customer:'Harbour Retail Network',origin:{label:'Kochi, India',latitude:9.931,longitude:76.267},destination:{label:'Delhi, India',latitude:28.614,longitude:77.209},carrier:'InvenTrack Express',status:'in-transit',weight:76,value:126000,eta:'2026-09-22',createdAt:'2026-09-16T15:35:00Z',updatedAt:'2026-09-17T07:20:00Z',events:[{id:'she9',status:'in-transit',title:'Departed origin hub',detail:'Shipment is on the line-haul route to Delhi.',location:'Kochi, India',date:'2026-09-17T07:20:00Z'}]}
  ]
};

let db = load();
let selectedRegionId='';
let selectedShipmentId='sh1';
let databaseReady=false, saveQueue=Promise.resolve(), releases=[];
let authState={required:false,authenticated:false,user:null};
const VISITOR_ID_KEY='inventrack_visitor_id_v1',VISITOR_FALLBACK_KEY='inventrack_visitor_metrics_v1';
let visitorMetrics=(()=>{try{const saved=JSON.parse(localStorage.getItem(VISITOR_FALLBACK_KEY)||'{}');return {totalVisitors:Number(saved.totalVisitors)||0,todayVisitors:Number(saved.todayVisitors)||0,weekVisitors:Number(saved.weekVisitors)||0}}catch{return {totalVisitors:0,todayVisitors:0,weekVisitors:0}}})();
let distributionGlobe=null;
function connection(message,state){const el=document.getElementById('connectionStatus');el.textContent=message;el.dataset.state=state;}
const $ = id => document.getElementById(id);
const uid = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function authCanWrite(){return !authState.required||(authState.authenticated&&['admin','wholesaler'].includes(authState.user?.role));}
function renderAuthState(){
  const button=$('authButton');
  if(button){button.hidden=!authState.required;button.textContent=authState.authenticated?'Sign out':'Sign in';button.title=authState.authenticated?`Sign out ${authState.user.email}`:'Sign in to the organization workspace';}
  if(authState.authenticated&&authState.user?.role&&typeof roleDetails!=='undefined'){
    workspace.role=authState.user.role;persistWorkspace();
    if($('roleChip'))$('roleChip').textContent=`${roleDetails[authState.user.role].label} workspace`;
  }
  const writeControls=['importBtn','quickAddBtn','addProductBtn','addMovementBtn','addSupplierBtn','addShipmentBtn','advanceShipmentBtn','resetDataBtn'];
  for(const id of writeControls){const el=$(id);if(el)el.hidden=authState.required&&!authCanWrite();}
}
function openAuthDialog(message=''){
  $('welcomeDialog')?.open&&$('welcomeDialog').close();
  const dialog=$('authDialog');if(!dialog)return;
  $('authError').textContent=message;
  if(!dialog.open)dialog.showModal();
  setTimeout(()=>$('authEmail')?.focus(),60);
}
async function loadAuthSession(){
  const response=await api('/api/auth/session',{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('Authentication endpoint unavailable.');
  authState=await response.json();renderAuthState();return authState;
}
async function submitLogin(event){
  event.preventDefault();
  const button=$('authSubmit');button.disabled=true;$('authError').textContent='';
  try{
    const response=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('authEmail').value.trim(),password:$('authPassword').value}),signal:AbortSignal.timeout(10000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');
    authState={required:true,authenticated:true,user:result.user};renderAuthState();$('authPassword').value='';$('authDialog').close();await loadFromServer();toast(`Signed in as ${result.user.email}.`);
  }catch(error){$('authError').textContent=error.message||'Sign-in failed.';}
  finally{button.disabled=false;}
}
async function signOut(){
  try{await api('/api/auth/logout',{method:'POST',signal:AbortSignal.timeout(5000)});}catch{}
  authState={required:true,authenticated:false,user:null};databaseReady=false;renderAuthState();connection('Sign in required','error');openAuthDialog('You have been signed out.');
}

function load(){
  try{
    const current=localStorage.getItem(STORE_KEY),saved=JSON.parse(current||localStorage.getItem(LEGACY_STORE_KEY));
    if(saved?.products&&saved?.suppliers&&saved?.movements){if(!Array.isArray(saved.shipments))saved.shipments=structuredClone(seed.shipments);if(!current)localStorage.setItem(STORE_KEY,JSON.stringify(saved));return saved}
  }catch{}
  localStorage.setItem(STORE_KEY,JSON.stringify(seed));return structuredClone(seed);
}
function save(){
  const snapshot=structuredClone(db);
  localStorage.setItem(STORE_KEY,JSON.stringify(snapshot));renderAll();
  connection('Saving changes…','pending');
  saveQueue=saveQueue.then(async()=>{
    if(!databaseReady)throw new Error('Database unavailable. Export your changes before reloading.');
    snapshot.revision=db.revision;
    const response=await api('/api/inventory',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if(response.status===401){authState={required:true,authenticated:false,user:null};renderAuthState();openAuthDialog('Your session has expired.');throw new Error('Authentication required.');}
    if(response.status===403)throw new Error(result.error||'Your account is read-only.');
    if(!response.ok)throw new Error(result.error||'Database update failed.');
    const saved=result;db.revision=saved.revision;
    localStorage.setItem(STORE_KEY,JSON.stringify(db));connection('Database synced','ready');
    logActivity('Database save confirmed','Inventory changes were committed to SQLite.');renderLogbook();
  }).catch(error=>{databaseReady=false;connection('Not saved · export & reload','error');toast(error.message);});
  return saveQueue;
}
async function loadFromServer(){
  try{
    await loadAuthSession();
    if(authState.required&&!authState.authenticated){databaseReady=false;connection('Sign in required','error');openAuthDialog();return;}
    const response=await api('/api/inventory',{signal:AbortSignal.timeout(10000)});
    if(response.status===401){authState={required:true,authenticated:false,user:null};renderAuthState();databaseReady=false;connection('Sign in required','error');openAuthDialog('Your session has expired.');return;}
    if(!response.ok)throw new Error('Could not load inventory.');
    db=await response.json();
    databaseReady=true;connection('Database connected','ready');
    localStorage.setItem(STORE_KEY,JSON.stringify(db));
    renderAll();renderEnhanced();
    const releaseResponse=await api('/api/releases');
    if(releaseResponse.ok){releases=await releaseResponse.json();renderLogbook();}
  }catch(error){databaseReady=false;const hostedDemo=location.hostname.endsWith('.chatgpt.site')||location.protocol==='file:';if(!authState.required){connection(hostedDemo?'Demo mode · seeded data':'Offline · cached data',hostedDemo?'demo':'error');}else{connection('Sign in required','error');openAuthDialog(error.message);}}
}
document.addEventListener('submit',event=>{if(!databaseReady && ['productForm','movementForm','supplierForm','shipmentForm'].includes(event.target.id)){event.preventDefault();event.stopImmediatePropagation();toast('Connect the database before editing inventory.');}},true);
document.addEventListener('click',event=>{
  if(!databaseReady && event.target.closest('[data-delete-product],[data-delete-supplier],#resetDataBtn,#importBtn')){event.preventDefault();event.stopImmediatePropagation();toast('Connect the database before editing inventory.');}
},true);
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function productFor(id){return db.products.find(p=>p.id===id)}
function statusFor(p){return p.quantity===0?['Out of stock','out']:p.quantity<=p.reorder?['Low stock','low']:['In stock','good']}
function visitorId(){try{let id=localStorage.getItem(VISITOR_ID_KEY);if(!id){id=crypto.randomUUID?.()||`visitor_${uid('v')}`;localStorage.setItem(VISITOR_ID_KEY,id)}return id}catch{return `visitor_${uid('v')}`}}
function localVisitorFallback(){const today=new Date().toISOString().slice(0,10);let saved={};try{saved=JSON.parse(localStorage.getItem(VISITOR_FALLBACK_KEY)||'{}')}catch{}if(saved.lastVisit!==today){saved.totalVisitors=(Number(saved.totalVisitors)||0)+1;saved.todayVisitors=1;saved.lastVisit=today}else saved.todayVisitors=Math.max(1,Number(saved.todayVisitors)||1);saved.weekVisitors=Math.max(Number(saved.weekVisitors)||0,saved.todayVisitors);localStorage.setItem(VISITOR_FALLBACK_KEY,JSON.stringify(saved));return {totalVisitors:saved.totalVisitors,todayVisitors:saved.todayVisitors,weekVisitors:saved.weekVisitors}}
async function registerVisitor(){try{const response=await api('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:visitorId(),path:location.hash||'#dashboard'}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Visitor endpoint unavailable');visitorMetrics=await response.json()}catch{visitorMetrics=localVisitorFallback()}renderAnalytics()}
function parseCsv(text){
  const rows=[];let row=[],field='',quote=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(quote&&char==='"'&&next==='"'){field+='"';i++}
    else if(char==='"')quote=!quote;
    else if(char===','&&!quote){row.push(field);field=''}
    else if((char==='\n'||char==='\r')&&!quote){if(char==='\r'&&next==='\n')i++;row.push(field);if(row.some(cell=>cell.trim()))rows.push(row);row=[];field=''}
    else field+=char;
  }
  row.push(field);if(row.some(cell=>cell.trim()))rows.push(row);
  return rows;
}
function importProductsFromCsv(text){
  const rows=parseCsv(text),headers=rows.shift()?.map(h=>h.trim().toLowerCase())||[],required=['name','sku','category','quantity','reorder level','cost price','selling price'];
  const missing=required.filter(name=>!headers.includes(name));
  if(missing.length)throw new Error(`Missing columns: ${missing.join(', ')}`);
  const index=name=>headers.indexOf(name),seen=new Set();
  const products=rows.map((row,line)=>{const number=(name)=>Number(row[index(name)]||0),sku=(row[index('sku')]||'').trim(),name=(row[index('name')]||'').trim(),category=(row[index('category')]||'').trim();if(!name||!sku||!category)throw new Error(`Row ${line+2} needs name, SKU, and category.`);if(seen.has(sku.toLowerCase()))throw new Error(`Duplicate SKU in CSV: ${sku}`);seen.add(sku.toLowerCase());const quantity=number('quantity'),reorder=number('reorder level'),cost=number('cost price'),price=number('selling price');if([quantity,reorder,cost,price].some(n=>Number.isNaN(n)||n<0))throw new Error(`Row ${line+2} has invalid numeric values.`);return {id:uid('p'),name,sku,category,quantity,reorder,cost,price,supplierId:''}});
  if(!products.length)throw new Error('No product rows found.');
  db.products=products;
  db.movements=products.filter(p=>p.quantity>0).map(p=>({id:uid('m'),productId:p.id,type:'in',quantity:p.quantity,balance:p.quantity,reference:'CSV IMPORT',notes:'Imported opening stock',date:new Date().toISOString()}));
  save();
  toast(`Imported ${products.length} products.`);
}

const viewMeta={dashboard:['Dashboard','A clear view of your inventory today.'],products:['Products','Manage your product catalogue and stock levels.'],reorder:['Reorder Plan','Prioritize purchases before stock runs out.'],movements:['Stock Movements','Track every addition, sale, and adjustment.'],suppliers:['Suppliers','Manage the businesses that supply your stock.'],logistics:['Shipping & tracking','Follow routes, delivery commitments, and shipment activity.'],analytics:['Admin insights','Company, supplier, and stock intelligence for better decisions.'],logbook:['Log book','A transparent timeline of everything that changed in your workspace.'],about:['About Project','An MCA academic project built with core web technologies.']};
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`${name}View`));
  document.querySelectorAll('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  $('pageTitle').textContent=viewMeta[name][0];$('pageSubtitle').textContent=viewMeta[name][1];
  $('sidebar').classList.remove('open');location.hash=name;
  if(name==='logbook'&&typeof renderLogbook==='function')renderLogbook();
  if(name==='logistics'&&typeof renderLogistics==='function')renderLogistics();
}

function renderDashboard(){
  const units=db.products.reduce((n,p)=>n+p.quantity,0),low=db.products.filter(p=>p.quantity<=p.reorder),value=db.products.reduce((n,p)=>n+p.quantity*p.cost,0),margin=db.products.reduce((n,p)=>n+p.quantity*(p.price-p.cost),0),market=value+margin,cats=[...new Set(db.products.map(p=>p.category))];
  $('metricProducts').textContent=db.products.length;$('metricCategories').textContent=`${cats.length} ${cats.length===1?'category':'categories'}`;$('metricUnits').textContent=units.toLocaleString('en-IN');$('metricLow').textContent=low.length;$('metricValue').textContent=rupees.format(value);$('metricMargin').textContent=rupees.format(margin);$('metricMarket').textContent=rupees.format(market);
  const healthy=db.products.length-low.length,reorderBudget=low.reduce((n,p)=>n+suggestedReorderQty(p)*p.cost,0),supplierCounts=db.suppliers.map(s=>[s.name,db.products.filter(p=>p.supplierId===s.id).length]).sort((a,b)=>b[1]-a[1]);
  $('stockHealth').textContent=db.products.length?`${Math.round(healthy/db.products.length*100)}%`:'0%';$('reorderBudget').textContent=rupees.format(reorderBudget);$('topSupplier').textContent=supplierCounts[0]?.[1]?supplierCounts[0][0]:'--';
  const totals=Object.entries(db.products.reduce((a,p)=>{a[p.category]=(a[p.category]||0)+p.quantity;return a},{})).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...totals.map(x=>x[1]));
  $('categoryChart').innerHTML=totals.length?totals.map(([cat,n])=>`<div class="bar-row"><label title="${escapeHtml(cat)}">${escapeHtml(cat)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3,n/max*100)}%"></div></div><strong>${n}</strong></div>`).join(''):'<div class="empty">Add products to see category stock.</div>';
  $('lowStockList').innerHTML=low.length?low.slice(0,5).map(p=>`<div class="alert-item"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.sku)} - Reorder at ${p.reorder}</small></div><strong class="stock-number">${p.quantity} left</strong></div>`).join(''):'<div class="empty">Everything is well stocked.</div>';
  const recent=[...db.movements].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  $('recentTable').innerHTML=recent.length?recent.map(m=>movementRow(m,false)).join(''):'<tr><td colspan="5" class="empty">No stock activity yet.</td></tr>';
  const ratio=market?Math.round(margin/market*100):0,lowRatio=db.products.length?Math.round(low.length/db.products.length*100):0;
  $('valueComparison').innerHTML=`<div class="value-figures"><div><span>Cost value</span><strong>${rupees.format(value)}</strong></div><div><span>Market value</span><strong>${rupees.format(market)}</strong></div></div><div class="comparison-track"><span style="width:${market?value/market*100:0}%"></span></div><p><b>${rupees.format(margin)}</b> potential gross profit · ${ratio}% value uplift</p>`;
  $('stockPulse').innerHTML=`<div class="pulse-ring" style="--pulse:${100-lowRatio}%"><strong>${100-lowRatio}%</strong><span>ready</span></div><div class="pulse-copy"><strong>${db.products.length-low.length} healthy lines</strong><span>${low.length?`${low.length} product lines need attention.`:'All product lines are above their reorder level.'}</span><button class="text-btn" data-go="analytics">Open admin insights</button></div>`;
}

const productVisualIndex={p1:0,p2:1,p3:2,p4:3,p5:4,p6:5};
function productImageIndex(product){
  if(productVisualIndex[product.id]!==undefined)return productVisualIndex[product.id];
  const category=String(product.category||'').toLowerCase();
  if(category.includes('elect'))return 0;
  if(category.includes('furn'))return 3;
  if(category.includes('pantry')||category.includes('food'))return 4;
  return category.includes('station')?2:5;
}
function productVisual(product,compact=false){
  const index=productImageIndex(product),asset=`p${index+1}`;
  return `<span class="product-visual${compact?' compact':''}" role="img" aria-label="${escapeHtml(product.name)}"><img src="assets/products/${asset}.png" alt=""></span>`;
}
function renderProducts(){
  const search=$('productSearch').value.toLowerCase(),cat=$('categoryFilter').value,stock=$('stockFilter').value;
  const filtered=db.products.filter(p=>{const matches=!search||[p.name,p.sku,p.category].some(x=>x.toLowerCase().includes(search));const state=statusFor(p)[1];return matches&&(!cat||p.category===cat)&&(!stock||state===stock||(stock==='healthy'&&state==='good'))});
  const showcase=$('productShowcase');
  if(showcase)showcase.innerHTML=filtered.length?filtered.slice(0,6).map(p=>{const status=statusFor(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'Unassigned',inventoryValue=p.quantity*p.cost,marketValue=p.quantity*p.price,margin=marketValue-inventoryValue,marginRate=p.price?Math.round((p.price-p.cost)/p.price*100):0,details=authCanWrite()?`<button class="showcase-action" data-edit-product="${p.id}">View product details <span aria-hidden="true">→</span></button>`:'<span class="showcase-action readonly">Read-only product details</span>';return `<article class="product-showcase-card"><div class="product-showcase-top"><span class="catalogue-label">${escapeHtml(p.category)}</span><span class="badge ${status[1]}">${status[0]}</span></div><div class="product-showcase-main">${productVisual(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.sku)} · ${escapeHtml(supplier)}</p></div></div><div class="product-business-grid"><div><span>On hand</span><strong>${p.quantity.toLocaleString('en-IN')}</strong></div><div><span>Market value</span><strong>${rupees.format(marketValue)}</strong></div><div><span>Margin</span><strong>${marginRate}%</strong></div></div>${details}</article>`}).join(''):'<div class="empty">No product visuals match these filters.</div>';
  $('productsTable').innerHTML=filtered.length?filtered.map(p=>{const status=statusFor(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'--',margin=(p.price-p.cost)*p.quantity,actions=authCanWrite()?`<div class="actions"><button class="action-btn" data-edit-product="${p.id}" title="Edit product">Edit</button><button class="action-btn" data-move-product="${p.id}" title="Record stock movement">Stock</button><button class="action-btn" data-delete-product="${p.id}" title="Delete product">Delete</button></div>`:'<span class="readonly">Read only</span>';return `<tr><td><div class="product-cell">${productVisual(p,true)}<div><strong>${escapeHtml(p.name)}</strong><small class="table-subtext">${escapeHtml(p.category)}</small></div></div></td><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.category)}</td><td><strong>${p.quantity}</strong> units</td><td>${rupees.format(p.cost)}</td><td>${rupees.format(p.price)}</td><td>${rupees.format(p.cost*p.quantity)}</td><td>${rupees.format(margin)}</td><td>${escapeHtml(supplier)}</td><td><span class="badge ${status[1]}">${status[0]}</span></td><td>${actions}</td></tr>`}).join(''):'<tr><td colspan="11" class="empty">No products match these filters.</td></tr>';
  $('productCount').textContent=`Showing ${filtered.length} of ${db.products.length} products`;
  const selected=$('categoryFilter').value,categories=[...new Set(db.products.map(p=>p.category))].sort();$('categoryFilter').innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join('');
}

function suggestedReorderQty(p){return p.quantity<=p.reorder?Math.max(p.reorder*2-p.quantity,p.reorder-p.quantity):0}
function renderReorderPlan(){
  const items=db.products.filter(p=>p.quantity<=p.reorder).sort((a,b)=>a.quantity-b.quantity);
  const units=items.reduce((n,p)=>n+suggestedReorderQty(p),0),cost=items.reduce((n,p)=>n+suggestedReorderQty(p)*p.cost,0);
  $('reorderItems').textContent=items.length;$('reorderUnits').textContent=units.toLocaleString('en-IN');$('reorderCost').textContent=rupees.format(cost);
  $('reorderTable').innerHTML=items.length?items.map(p=>{const qty=suggestedReorderQty(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'--',status=statusFor(p);return `<tr><td><div class="product-cell"><span class="product-avatar">${initials(p.name)}</span><strong>${escapeHtml(p.name)}</strong></div></td><td>${p.quantity}</td><td>${p.reorder}</td><td><strong>${qty}</strong> units</td><td>${rupees.format(qty*p.cost)}</td><td>${escapeHtml(supplier)}</td><td><span class="badge ${status[1]}">${status[0]}</span></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">No reorder action is needed right now.</td></tr>';
}

function movementRow(m,full=true){const p=productFor(m.productId),sign=m.type==='out'?'-':m.type==='in'?'+':'=';return `<tr>${full?`<td>${shortDate.format(new Date(m.date))}</td>`:''}<td><strong>${escapeHtml(p?.name||'Deleted product')}</strong></td><td><span class="badge ${m.type}">${m.type==='in'?'Stock in':m.type==='out'?'Stock out':'Adjustment'}</span></td><td class="${m.type==='out'?'qty-negative':'qty-positive'}">${sign}${m.quantity}</td>${full?`<td>${m.balance}</td>`:`<td>${shortDate.format(new Date(m.date))}</td>`}<td>${escapeHtml(m.reference||'--')}</td>${full?`<td>${escapeHtml(m.notes||'--')}</td>`:''}</tr>`}
function renderMovements(){const rows=[...db.movements].sort((a,b)=>new Date(b.date)-new Date(a.date));$('movementsTable').innerHTML=rows.length?rows.map(m=>movementRow(m)).join(''):'<tr><td colspan="7" class="empty">No stock movements recorded.</td></tr>'}

function supplierImageIndex(supplier,index){return supplier.id==='s1'?0:supplier.id==='s2'?1:supplier.id==='s3'?2:index%3}
function supplierVisual(supplier,index){return `<span class="supplier-avatar" role="img" aria-label="${escapeHtml(supplier.contact||supplier.name)}"><img src="assets/suppliers/s${supplierImageIndex(supplier,index)+1}.png" alt=""></span>`}
function supplierStats(supplier){
  const items=db.products.filter(p=>p.supplierId===supplier.id),inventory=items.reduce((n,p)=>n+p.quantity*p.cost,0),market=items.reduce((n,p)=>n+p.quantity*p.price,0),low=items.filter(p=>p.quantity<=p.reorder).length;
  const city=String(supplier.address||'').split(',')[0].trim().toLowerCase(),related=(db.shipments||[]).filter(shipment=>[shipment.customer,shipment.origin?.label,shipment.destination?.label].some(value=>String(value||'').toLowerCase().includes(city))).length;
  return {items,inventory,market,margin:market-inventory,low,related};
}
function renderSuppliers(){
  const stats=db.suppliers.map((supplier,index)=>({...supplier,...supplierStats(supplier),index})),portfolio=stats.reduce((total,supplier)=>total+supplier.market,0),lines=stats.reduce((total,supplier)=>total+supplier.items.length,0),atRisk=stats.reduce((total,supplier)=>total+supplier.low,0);
  if($('supplierSummary'))$('supplierSummary').innerHTML=`<article><span>Partner network</span><strong>${stats.length}</strong><small>Active supplier records</small></article><article><span>Catalogue coverage</span><strong>${lines}</strong><small>Product lines linked to partners</small></article><article><span>Market value supported</span><strong>${rupees.format(portfolio)}</strong><small>Current selling value</small></article><article><span>Lines to watch</span><strong>${atRisk}</strong><small>At or below reorder level</small></article>`;
  $('supplierGrid').innerHTML=stats.length?stats.map(s=>{const share=portfolio?Math.round(s.market/portfolio*100):0,service=s.related?`${s.related} route${s.related===1?'':'s'} linked`:'Awaiting route activity',actions=authCanWrite()?`<div class="actions"><button class="action-btn" data-edit-supplier="${s.id}" title="Edit supplier">Edit</button><button class="action-btn" data-delete-supplier="${s.id}" title="Delete supplier">Delete</button></div>`:'<span class="readonly">Read only</span>';return `<article class="supplier-card"><div class="supplier-card-head"><div class="supplier-profile">${supplierVisual(s,s.index)}<div><span class="supplier-tier">PARTNER ${String(s.index+1).padStart(2,'0')}</span><h3>${escapeHtml(s.name)}</h3></div></div>${actions}</div><p class="contact">${escapeHtml(s.contact||'No contact person')} · ${escapeHtml(String(s.address||'').split(',')[0]||'Remote partner')}</p><div class="supplier-details"><a href="tel:${escapeHtml(s.phone)}">Phone: ${escapeHtml(s.phone||'No phone')}</a><a href="mailto:${escapeHtml(s.email)}">Email: ${escapeHtml(s.email||'No email')}</a><span>Address: ${escapeHtml(s.address||'No address')}</span></div><div class="supplier-business-grid"><div><span>Product lines</span><strong>${s.items.length}</strong></div><div><span>Market value</span><strong>${rupees.format(s.market)}</strong></div><div><span>Share</span><strong>${share}%</strong></div></div><div class="supplier-share"><span style="width:${share}%"></span></div><div class="supplier-meta"><span>${service}</span><span class="${s.low?'risk-copy':'healthy-copy'}">${s.low?`${s.low} line${s.low===1?'':'s'} at risk`:'Supply health stable'}</span></div></article>`}).join(''):'<div class="panel empty">No suppliers added yet.</div>';
}
function renderAnalytics(){
  const products=db.products,market=products.reduce((n,p)=>n+p.quantity*p.price,0),cost=products.reduce((n,p)=>n+p.quantity*p.cost,0),margin=market-cost,low=products.filter(p=>p.quantity<=p.reorder).length;
  $('analyticsSummary').innerHTML=[['Market value',rupees.format(market),'Estimated current selling value'],['Gross opportunity',rupees.format(margin),'Potential margin on available stock'],['Supply risk',`${low} lines`,'Products at or below reorder level'],['Suppliers',db.suppliers.length,'Active supplier and distributor records'],['Visitors',Number(visitorMetrics.totalVisitors||0).toLocaleString('en-IN'),`${Number(visitorMetrics.todayVisitors||0).toLocaleString('en-IN')} today · ${Number(visitorMetrics.weekVisitors||0).toLocaleString('en-IN')} this week`]].map(([label,value,detail])=>`<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  const byCategory=Object.entries(products.reduce((result,p)=>{result[p.category]=(result[p.category]||0)+p.quantity*p.price;return result},{})).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...byCategory.map(([,n])=>n));
  $('categoryValueChart').innerHTML=byCategory.length?byCategory.map(([category,total])=>`<div class="insight-row"><div><strong>${escapeHtml(category)}</strong><span>${rupees.format(total)}</span></div><i><b style="width:${total/max*100}%"></b></i></div>`).join(''):'<div class="empty">Add products to view category value.</div>';
  const stats=db.suppliers.map(s=>{const items=products.filter(p=>p.supplierId===s.id);return {name:s.name,items,units:items.reduce((n,p)=>n+p.quantity,0),cost:items.reduce((n,p)=>n+p.quantity*p.cost,0),market:items.reduce((n,p)=>n+p.quantity*p.price,0),low:items.filter(p=>p.quantity<=p.reorder).length}}).sort((a,b)=>b.market-a.market);
  const maxSupplier=Math.max(1,...stats.map(s=>s.market));
  $('supplierContribution').innerHTML=stats.length?stats.map((s,index)=>`<div class="supplier-bar"><span class="supplier-rank">0${index+1}</span><div><strong>${escapeHtml(s.name)}</strong><small>${s.items.length} products · ${s.low} risk lines</small><i><b style="width:${s.market/maxSupplier*100}%"></b></i></div><em>${rupees.format(s.market)}</em></div>`).join(''):'<div class="empty">Add suppliers to see contribution.</div>';
  $('supplierPerformance').innerHTML=stats.length?stats.map(s=>`<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${s.items.length}</td><td>${s.units.toLocaleString('en-IN')}</td><td>${rupees.format(s.cost)}</td><td>${rupees.format(s.market)}</td><td><span class="badge ${s.low?'low':'good'}">${s.low||'Healthy'}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No supplier data yet.</td></tr>';
  renderDistributionNetwork();
}
function renderDistributionNetwork(){
  const regions=db.regions||[],shipments=db.shipments||[];
  if(!distributionGlobe)distributionGlobe=new window.EarthGlobe($('globeStage'));
  const selected=regions.find(region=>region.id===selectedRegionId)||regions[0];
  selectedRegionId=selected?.id||'';
  distributionGlobe.update(regions,shipments,selectedRegionId);
  const totalSales=regions.reduce((sum,region)=>sum+region.sales,0);
  const totalUnits=regions.reduce((sum,region)=>sum+region.units,0);
  const routeCount=shipments.filter(shipment=>shipment.status!=='delivered').length;
  $('distributionStats').innerHTML=[
    ['Territory sales',rupees.format(totalSales),'Demo sales across all destinations'],
    ['Units dispatched',totalUnits.toLocaleString('en-IN'),regions.length+' sales destinations'],
    ['Open shipments',routeCount,shipments.length+' shipment routes in total'],
    ['Market coverage',new Set(regions.map(region=>region.country)).size,'Countries with recorded sales']
  ].map(([label,value,detail])=>`<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  $('regionFeed').innerHTML=regions.length?regions.map(region=>{
    const routes=shipments.filter(s=>s.destination?.label?.includes(region.city)||s.origin?.label?.includes(region.city)).length;
    return `<button class="region-item ${region.id===selectedRegionId?'active':''}" type="button" aria-pressed="${region.id===selectedRegionId}" data-region-id="${escapeHtml(region.id)}"><div><strong>${escapeHtml(region.city)}</strong><small>${escapeHtml(region.country)} · ${region.units} units</small></div><b>${rupees.format(region.sales)}<small>${routes} route${routes===1?'':'s'}</small></b></button>`;
  }).join(''):'<p class="empty">No sales destinations recorded.</p>';
}
function selectDistributionRegion(id){
  selectedRegionId=id;
  renderDistributionNetwork();
  distributionGlobe.focus((db.regions||[]).find(region=>region.id===id));
}
const shipmentStatusMeta={pending:['Pending','pending'], 'in-transit':['In transit','in-transit'], delivered:['Delivered','delivered'], delayed:['Delayed','delayed']};
function shipmentFor(id){return (db.shipments||[]).find(shipment=>shipment.id===id)}
function shipmentStatus(status){return shipmentStatusMeta[status]||[status,'pending']}
function shipmentCoordinates(label){
  const value=String(label||'').toLowerCase();
  const known=[['mumbai',{label:'Mumbai, India',latitude:19.076,longitude:72.877}],['bengaluru',{label:'Bengaluru, India',latitude:12.972,longitude:77.594}],['bangalore',{label:'Bengaluru, India',latitude:12.972,longitude:77.594}],['delhi',{label:'Delhi, India',latitude:28.614,longitude:77.209}],['kochi',{label:'Kochi, India',latitude:9.931,longitude:76.267}],['dubai',{label:'Dubai, UAE',latitude:25.205,longitude:55.271}],['singapore',{label:'Singapore',latitude:1.352,longitude:103.82}],['london',{label:'London, United Kingdom',latitude:51.507,longitude:-0.128}]];
  return known.find(([name])=>value.includes(name))?.[1]||{label:String(label||'Unknown location'),latitude:20,longitude:78};
}
function renderShipmentMap(shipment){
  const map=$('shipmentMap');if(!map)return;
  if(!shipment){map.innerHTML='<div class="empty">Select a shipment to view its route.</div>';return}
  const point=(place)=>({x:24+(place.longitude+180)/360*552,y:22+(90-place.latitude)/180*216});
  const origin=point(shipment.origin),destination=point(shipment.destination),controlX=(origin.x+destination.x)/2,controlY=Math.min(origin.y,destination.y)-42;
  map.innerHTML=`<svg viewBox="0 0 600 260" role="img" aria-label="Route from ${escapeHtml(shipment.origin.label)} to ${escapeHtml(shipment.destination.label)}"><defs><linearGradient id="routeGradient" x1="0" x2="1"><stop offset="0" stop-color="#18c8d8"/><stop offset="1" stop-color="#ff6b7a"/></linearGradient><pattern id="mapGrid" width="34" height="26" patternUnits="userSpaceOnUse"><path d="M34 0H0V26" fill="none" stroke="#93a0ce" stroke-opacity=".12"/></pattern></defs><rect width="600" height="260" fill="url(#mapGrid)"/><path class="map-land" d="M75 66l38-20 45 16 15 36-28 20-27-8-24 18-35-22zm186 10l48-22 52 14 22 31-28 25-44-5-28 20-34-17zm160 82l45-19 56 16 22 28-42 24-53-8-37-18z"/><path class="shipment-route" d="M${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${destination.x.toFixed(1)} ${destination.y.toFixed(1)}"/><circle class="map-origin" cx="${origin.x.toFixed(1)}" cy="${origin.y.toFixed(1)}" r="6"/><circle class="map-destination" cx="${destination.x.toFixed(1)}" cy="${destination.y.toFixed(1)}" r="6"/><text x="${Math.min(origin.x+10,520).toFixed(1)}" y="${Math.max(origin.y-11,16).toFixed(1)}">ORIGIN</text><text x="${Math.min(destination.x+10,520).toFixed(1)}" y="${Math.max(destination.y-11,16).toFixed(1)}">DESTINATION</text></svg>`;
  $('shipmentMapCaption').textContent=`${shipment.origin.label} → ${shipment.destination.label} · ${shipment.carrier}`;
}
function renderShipmentTracking(shipment){
  if(!shipment){$('trackingPanelTitle').textContent='Select a shipment';$('trackingPanelSubtitle').textContent='Choose a row below to inspect the live route.';$('trackingRoute').innerHTML='';$('shipmentTimeline').innerHTML='<div class="empty">Shipment events will appear here.</div>';$('advanceShipmentBtn').hidden=true;renderShipmentMap();return}
  const status=shipmentStatus(shipment.status);$('trackingPanelTitle').textContent=shipment.tracking;$('trackingPanelSubtitle').textContent=`${shipment.customer} · ${shipment.carrier}`;$('advanceShipmentBtn').hidden=shipment.status==='delivered';$('advanceShipmentBtn').dataset.advanceShipment=shipment.id;
  $('trackingRoute').innerHTML=`<div><span>FROM</span><strong>${escapeHtml(shipment.origin.label)}</strong></div><b class="route-arrow">→</b><div><span>TO</span><strong>${escapeHtml(shipment.destination.label)}</strong></div><span class="badge ${status[1]}">${status[0]}</span>`;
  const events=[...(shipment.events||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));$('shipmentTimeline').innerHTML=events.length?events.map((event,index)=>`<div class="timeline-item ${index===0?'current':''}"><span class="timeline-dot"></span><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.detail)}</p><small>${escapeHtml(event.location)} · ${shortDate.format(new Date(event.date))}</small></div></div>`).join(''):'<div class="empty">No shipment events recorded.</div>';
  renderShipmentMap(shipment);
}
function renderShipmentHeatmap(shipments){
  const today=new Date('2026-09-17T12:00:00Z'),days=Array.from({length:35},(_,i)=>{const date=new Date(today);date.setUTCDate(today.getUTCDate()-34+i);return date});
  const cells=days.map(date=>{const key=date.toISOString().slice(0,10),count=shipments.reduce((total,shipment)=>total+(shipment.events||[]).filter(event=>event.date.slice(0,10)===key).length,0),fallback=(date.getUTCDate()*7+date.getUTCMonth())%4,level=count?Math.min(4,count):fallback===0?0:Math.min(3,fallback);return `<i class="heat-cell level-${level}" title="${count} shipment events on ${key}"></i>`}).join('');$('shipmentHeatmap').innerHTML=`<div class="heatmap-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="heatmap-cells">${cells}</div>`;
}
function renderLogistics(){
  const shipments=Array.isArray(db.shipments)?db.shipments:[],query=($('shipmentSearch')?.value||'').trim().toLowerCase(),filter=$('shipmentStatusFilter')?.value||'';
  const active=shipments.filter(shipment=>shipment.status==='in-transit'||shipment.status==='pending'||shipment.status==='delayed').length,delivered=shipments.filter(shipment=>shipment.status==='delivered').length,delayed=shipments.filter(shipment=>shipment.status==='delayed').length,value=shipments.reduce((total,shipment)=>total+shipment.value,0),filtered=shipments.filter(shipment=>{const matches=!query||[shipment.tracking,shipment.customer,shipment.destination.label,shipment.carrier].some(value=>value.toLowerCase().includes(query));return matches&&(!filter||shipment.status===filter)}).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  $('shipmentKpis').innerHTML=[['Total shipments',shipments.length,'All delivery records','total'],['Active tracking',active,'Pending, moving, or delayed','active'],['Delivered',delivered,shipments.length?`${Math.round(delivered/shipments.length*100)}% of all shipments`:'No deliveries yet','delivered'],['At risk',delayed,'Delayed shipments','risk'],['Shipment value',rupees.format(value),'Declared order value','value']].map(([label,number,detail,tone])=>`<article class="shipment-kpi ${tone}"><span>${label}</span><strong>${number}</strong><small>${detail}</small></article>`).join('');
  renderShipmentHeatmap(shipments);
  const selected=filtered.find(shipment=>shipment.id===selectedShipmentId)||filtered[0]||shipments[0];if(selected)selectedShipmentId=selected.id;renderShipmentTracking(selected);
  $('shipmentCount').textContent=`Showing ${filtered.length} of ${shipments.length} shipments`;
  $('shipmentsTable').innerHTML=filtered.length?filtered.map(shipment=>{const status=shipmentStatus(shipment.status),eta=new Date(`${shipment.eta}T00:00:00`),advance=shipment.status==='delivered'?'<span class="table-check">✓</span>':authCanWrite()?`<button class="action-btn" data-advance-shipment="${shipment.id}" title="Advance shipment status">Update</button>`:'<span class="readonly">Read only</span>';return `<tr class="shipment-row ${shipment.id===selected?.id?'selected':''}" data-select-shipment="${shipment.id}"><td><strong>${escapeHtml(shipment.tracking)}</strong><small class="table-subtext">${shipment.weight.toLocaleString('en-IN')} kg</small></td><td>${escapeHtml(shipment.customer)}</td><td><span class="route-cell">${escapeHtml(shipment.origin.label)} <b>→</b> ${escapeHtml(shipment.destination.label)}</span></td><td>${escapeHtml(shipment.carrier)}</td><td>${shortDate.format(eta)}</td><td>${rupees.format(shipment.value)}</td><td><span class="badge ${status[1]}">${status[0]}</span></td><td>${advance}</td></tr>`}).join(''):'<tr><td colspan="8" class="empty">No shipments match these filters.</td></tr>';
}
function openShipment(){
  $('shipmentForm').reset();$('shipmentError').textContent='';$('shipmentOrigin').value='Mumbai, India';const eta=new Date();eta.setDate(eta.getDate()+5);$('shipmentEta').value=eta.toISOString().slice(0,10);$('shipmentDialog').showModal();
}
function advanceShipment(id){
  const shipment=shipmentFor(id);if(!shipment||shipment.status==='delivered')return;const next=shipment.status==='pending'||shipment.status==='delayed'?'in-transit':'delivered',label=next==='delivered'?'Delivered':'In transit',location=next==='delivered'?shipment.destination.label:shipment.origin.label;shipment.status=next;shipment.updatedAt=new Date().toISOString();shipment.events=shipment.events||[];shipment.events.unshift({id:uid('she'),status:next,title:label,detail:next==='delivered'?'Delivery confirmed by the receiving team.':'Carrier has accepted the shipment and it is moving to its destination.',location,date:shipment.updatedAt});selectedShipmentId=shipment.id;save();toast(`${shipment.tracking} marked ${label.toLowerCase()}.`);
}
function renderAll(){renderDashboard();renderProducts();renderReorderPlan();renderMovements();renderSuppliers();renderLogistics();renderAnalytics();fillSelects()}
function fillSelects(){
  const supplierValue=$('productSupplier').value;$('productSupplier').innerHTML='<option value="">No supplier</option>'+db.suppliers.map(s=>`<option value="${s.id}" ${s.id===supplierValue?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
  const productValue=$('movementProduct').value;$('movementProduct').innerHTML='<option value="">Select a product</option>'+db.products.map(p=>`<option value="${p.id}" ${p.id===productValue?'selected':''}>${escapeHtml(p.name)} (${p.quantity} units)</option>`).join('');
}

function openProduct(id=''){
  const p=productFor(id);$('productForm').reset();$('productId').value=id;$('productDialogTitle').textContent=p?'Edit product':'Add product';
  if(p){$('productName').value=p.name;$('productSku').value=p.sku;$('productCategory').value=p.category;$('productQuantity').value=p.quantity;$('productReorder').value=p.reorder;$('productCost').value=p.cost;$('productPrice').value=p.price;$('productSupplier').value=p.supplierId||''}
  $('productQuantity').disabled=Boolean(p);$('productDialog').showModal();
}
function openMovement(productId=''){$('movementForm').reset();$('movementError').textContent='';fillSelects();$('movementProduct').value=productId;$('movementDialog').showModal()}
function openSupplier(id=''){const s=db.suppliers.find(x=>x.id===id);$('supplierForm').reset();$('supplierId').value=id;$('supplierDialogTitle').textContent=s?'Edit supplier':'Add supplier';if(s){$('supplierName').value=s.name;$('supplierContact').value=s.contact;$('supplierPhone').value=s.phone;$('supplierEmail').value=s.email;$('supplierAddress').value=s.address}$('supplierDialog').showModal()}

$('productForm').addEventListener('submit',e=>{e.preventDefault();const id=$('productId').value,sku=$('productSku').value.trim();if(db.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==id)){toast('That SKU is already in use.');return}const old=productFor(id),product={id:id||uid('p'),name:$('productName').value.trim(),sku,category:$('productCategory').value.trim(),quantity:old?.quantity??Number($('productQuantity').value),reorder:Number($('productReorder').value),cost:Number($('productCost').value),price:Number($('productPrice').value),supplierId:$('productSupplier').value};if(old)Object.assign(old,product);else{db.products.unshift(product);if(product.quantity>0)db.movements.unshift({id:uid('m'),productId:product.id,type:'in',quantity:product.quantity,balance:product.quantity,reference:'OPENING',notes:'Opening stock',date:new Date().toISOString()})}save();$('productDialog').close();toast(old?'Product updated.':'Product added.')});
$('movementForm').addEventListener('submit',e=>{e.preventDefault();const p=productFor($('movementProduct').value),type=$('movementType').value,qty=Number($('movementQuantity').value);if(!p){$('movementError').textContent='Choose a product.';return}if(type==='out'&&qty>p.quantity){$('movementError').textContent=`Only ${p.quantity} units are currently available.`;return}if(qty<0){$('movementError').textContent='Quantity cannot be negative.';return}p.quantity=type==='in'?p.quantity+qty:type==='out'?p.quantity-qty:qty;db.movements.unshift({id:uid('m'),productId:p.id,type,quantity:qty,balance:p.quantity,reference:$('movementReference').value.trim(),notes:$('movementNotes').value.trim(),date:new Date().toISOString()});save();$('movementDialog').close();toast('Stock movement recorded.')});
$('supplierForm').addEventListener('submit',e=>{e.preventDefault();const id=$('supplierId').value,old=db.suppliers.find(s=>s.id===id),supplier={id:id||uid('s'),name:$('supplierName').value.trim(),contact:$('supplierContact').value.trim(),phone:$('supplierPhone').value.trim(),email:$('supplierEmail').value.trim(),address:$('supplierAddress').value.trim()};if(old)Object.assign(old,supplier);else db.suppliers.push(supplier);save();$('supplierDialog').close();toast(old?'Supplier updated.':'Supplier added.')});
 $('shipmentForm').addEventListener('submit',e=>{e.preventDefault();const customer=$('shipmentCustomer').value.trim(),carrier=$('shipmentCarrier').value.trim(),originLabel=$('shipmentOrigin').value.trim(),destinationLabel=$('shipmentDestination').value.trim(),origin=shipmentCoordinates(originLabel),destination=shipmentCoordinates(destinationLabel);if(!customer||!carrier||!originLabel||!destinationLabel||!$('shipmentEta').value){$('shipmentError').textContent='Customer, route, carrier, and ETA are required.';return}let tracking;do{tracking=`IT-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`}while((db.shipments||[]).some(shipment=>shipment.tracking===tracking));const now=new Date().toISOString(),shipment={id:uid('sh'),tracking,customer,origin,destination,carrier,status:$('shipmentStatus').value,weight:Number($('shipmentWeight').value),value:Number($('shipmentValue').value),eta:$('shipmentEta').value,createdAt:now,updatedAt:now,events:[{id:uid('she'),status:$('shipmentStatus').value,title:$('shipmentStatus').value==='pending'?'Ready for pickup':'Shipment booked',detail:'Shipment record created in the InvenTrack logistics center.',location:origin.label,date:now}]};if(!Number.isFinite(shipment.weight)||shipment.weight<0||!Number.isFinite(shipment.value)||shipment.value<0){$('shipmentError').textContent='Weight and value must be zero or greater.';return}(db.shipments||(db.shipments=[])).unshift(shipment);selectedShipmentId=shipment.id;save();$('shipmentDialog').close();showView('logistics');toast(`${tracking} created.`)});

document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close-dialog]');if(close)close.closest('dialog').close();
  const nav=e.target.closest('[data-view]'),go=e.target.closest('[data-go]');if(nav)showView(nav.dataset.view);if(go)showView(go.dataset.go);
  const editP=e.target.closest('[data-edit-product]'),moveP=e.target.closest('[data-move-product]'),deleteP=e.target.closest('[data-delete-product]'),editS=e.target.closest('[data-edit-supplier]'),deleteS=e.target.closest('[data-delete-supplier]'),selectShipment=e.target.closest('[data-select-shipment]'),advance=e.target.closest('[data-advance-shipment]');
  if(editP)openProduct(editP.dataset.editProduct);if(moveP)openMovement(moveP.dataset.moveProduct);
  if(deleteP){const id=deleteP.dataset.deleteProduct,p=productFor(id);if(confirm(`Delete ${p.name}? Its movement history will remain.`)){db.products=db.products.filter(x=>x.id!==id);save();toast('Product deleted.')}}
  if(editS)openSupplier(editS.dataset.editSupplier);if(deleteS){const id=deleteS.dataset.deleteSupplier,s=db.suppliers.find(x=>x.id===id);if(confirm(`Delete supplier ${s.name}?`)){db.suppliers=db.suppliers.filter(x=>x.id!==id);db.products.forEach(p=>{if(p.supplierId===id)p.supplierId=''});save();toast('Supplier deleted.')}}
  if(selectShipment){selectedShipmentId=selectShipment.dataset.selectShipment;renderLogistics()}
  if(advance){advanceShipment(advance.dataset.advanceShipment)}
});
$('quickAddBtn').onclick=$('addProductBtn').onclick=()=>openProduct();$('addMovementBtn').onclick=()=>openMovement();$('addSupplierBtn').onclick=()=>openSupplier();$('addShipmentBtn').onclick=openShipment;$('advanceShipmentBtn').onclick=()=>advanceShipment($('advanceShipmentBtn').dataset.advanceShipment);$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');$('productSearch').oninput=renderProducts;$('categoryFilter').onchange=renderProducts;$('stockFilter').onchange=renderProducts;$('shipmentSearch').oninput=renderLogistics;$('shipmentStatusFilter').onchange=renderLogistics;$('clearShipmentFilter').onclick=()=>{$('shipmentSearch').value='';$('shipmentStatusFilter').value='';renderLogistics()};
$('dashboardDate').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
$('dashboardSearchForm').addEventListener('submit',event=>{event.preventDefault();const query=$('dashboardSearch').value.trim();$('productSearch').value=query;showView('products');renderProducts();if(query)toast(`Showing products matching “${query}”.`)});
$('resetDataBtn').onclick=()=>{if(confirm('Reset all records to the original demo data?')){db=structuredClone(seed);save();toast('Demo data restored.')}};
$('exportBtn').onclick=()=>{const headers=['Name','SKU','Category','Quantity','Reorder Level','Cost Price','Selling Price','Inventory Value','Gross Margin','Supplier','Status'];const rows=db.products.map(p=>[p.name,p.sku,p.category,p.quantity,p.reorder,p.cost,p.price,p.quantity*p.cost,p.quantity*(p.price-p.cost),db.suppliers.find(s=>s.id===p.supplierId)?.name||'',statusFor(p)[0]]);const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`inventrack-inventory-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);toast('Inventory exported.')};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{importProductsFromCsv(reader.result)}catch(error){toast(error.message)}finally{e.target.value=''}};reader.readAsText(file)};
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(viewMeta[v])showView(v)});

/* Workspace enhancements are kept beside the original inventory model so existing
   catalogue, movement, import, and export workflows remain backwards compatible. */
const WORKSPACE_KEY='inventrack_workspace_v1';
const roleDetails={
  retailer:{label:'Retailer',description:'Focus on daily sales, stock levels, and fast-moving products.'},
  wholesaler:{label:'Wholesaler',description:'Coordinate suppliers, bulk orders, and replenishment planning.'},
  admin:{label:'Administrator',description:'Oversee operations, audit activity, and configure the workspace.'}
};
let workspace=(()=>{try{return JSON.parse(localStorage.getItem(WORKSPACE_KEY))||{}}catch(error){return {}}})();
workspace.role=roleDetails[workspace.role]?workspace.role:'';
workspace.theme=workspace.theme==='dark'?'dark':'light';
workspace.activity=Array.isArray(workspace.activity)?workspace.activity:[];
function persistWorkspace(){localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace))}
function logActivity(action,detail=''){
  workspace.activity.unshift({id:uid('a'),action,detail,date:new Date().toISOString(),role:workspace.role||'admin'});
  workspace.activity=workspace.activity.slice(0,100);
  persistWorkspace();
}
const baseSave=save;
save=function(){
  const pending=baseSave();
  renderNotifications();
  if($('logbookView')?.classList.contains('active'))renderLogbook();
  return pending;
};
function renderLogbook(){
  $('releaseLog').innerHTML=releases.length?releases.map(item=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail)}</p><small>${shortDate.format(new Date(item.date))} · Product release</small></div></div>`).join(''):'<p>Connect to the database to load product updates.</p>';
  const items=workspace.activity;
  $('logbookSummary').textContent=`${items.length} ${items.length===1?'event':'events'} recorded in this workspace`;
  $('activityList').innerHTML=items.length?items.map(item=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail)}</p><small>${shortDate.format(new Date(item.date))} · ${escapeHtml(roleDetails[item.role]?.label||'Administrator')}</small></div></div>`).join(''):'<div class="empty">No activity has been recorded yet.</div>';
}
function applyTheme(){
  document.documentElement.dataset.theme=workspace.theme;
  $('themeToggle').textContent=workspace.theme==='dark'?'☀':'☾';
  $('themeToggle').title=workspace.theme==='dark'?'Switch to light mode':'Switch to dark mode';
}
function setRole(role){
  if(authState.required&&authState.authenticated&&role!==authState.user.role){toast(`Your account is assigned to the ${roleDetails[authState.user.role].label} role.`);return;}
  workspace.role=roleDetails[role]?role:'admin';persistWorkspace();
  $('roleChip').textContent=`${roleDetails[workspace.role].label} workspace`;
  $('welcomeDialog').close();
  logActivity('Workspace role selected',roleDetails[workspace.role].description);
  toast(`${roleDetails[workspace.role].label} workspace ready.`);
}
function notifications(){
  return db.products.filter(p=>p.quantity<=p.reorder).map(p=>({id:p.id,title:`${p.name} needs attention`,detail:p.quantity===0?'Out of stock':`${p.quantity} units left; reorder at ${p.reorder}.`}));
}
function renderNotifications(){
  const items=notifications(),count=$('notificationCount');
  count.textContent=items.length;count.hidden=!items.length;
  const panel=$('notificationPanel');if(!panel)return;
  if(items.length){
    panel.innerHTML='<strong>Notifications</strong>'+items.map(item=>`<div class="notification-item"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span></div>`).join('');
  }else{
    panel.innerHTML='<strong>Notifications</strong><div class="empty">You are all caught up.</div>';
  }
}
function ensureNotificationPanel(){
  if($('notificationPanel'))return;
  const panel=document.createElement('div');panel.id='notificationPanel';panel.className='notification-panel';$('notificationBtn').after(panel);renderNotifications();
}
function renderEnhanced(){
  renderLogbook();renderNotifications();
  $('roleChip').textContent=`${roleDetails[workspace.role||'admin'].label} workspace`;
  applyTheme();
  renderAuthState();
}
document.addEventListener('click',event=>{
  const role=event.target.closest('[data-role]');
  if(role)setRole(role.dataset.role);
  if(event.target.closest('#skipWelcomeBtn'))setRole('admin');
  if(event.target.closest('#roleChip'))$('welcomeDialog').showModal();
  if(event.target.closest('#themeToggle')){workspace.theme=workspace.theme==='dark'?'light':'dark';persistWorkspace();applyTheme();}
  if(event.target.closest('#notificationBtn')){$('notificationPanel')?.classList.toggle('open');}
  else if(!event.target.closest('#notificationPanel')){$('notificationPanel')?.classList.remove('open');}
  if(event.target.closest('#clearLogBtn')){workspace.activity=[];persistWorkspace();renderLogbook();toast('Activity log cleared.');}
  const nav=event.target.closest('[data-view]');if(nav&&nav.dataset.view==='logbook')renderLogbook();
});
$('authForm').addEventListener('submit',submitLogin);
$('authButton').addEventListener('click',()=>authState.authenticated?signOut():openAuthDialog());
renderAll();
ensureNotificationPanel();
renderEnhanced();
showView(viewMeta[location.hash.slice(1)]?location.hash.slice(1):'dashboard');
if(!workspace.role)$('welcomeDialog').showModal();
loadFromServer();
registerVisitor();
$('connectionStatus').onclick=()=>{if(confirm('Reload the latest database records? Export CSV first if you have unsaved changes.'))loadFromServer();};

/* Data-aware inventory assistant. It answers from the live database without sending
   company data to a third-party AI service. */
function assistantReply(question){
  const text=question.toLowerCase(),products=db.products,low=products.filter(p=>p.quantity<=p.reorder),cost=products.reduce((n,p)=>n+p.quantity*p.cost,0),market=products.reduce((n,p)=>n+p.quantity*p.price,0),margin=market-cost;
  const suppliers=db.suppliers.map(s=>({name:s.name,items:products.filter(p=>p.supplierId===s.id)})).map(s=>({...s,value:s.items.reduce((n,p)=>n+p.quantity*p.price,0)})).sort((a,b)=>b.value-a.value);
  if(/hello|hi |welcome/.test(text))return `Hello! I can help you review ${products.length} products, stock risk, values, and supplier performance.`;
  if(/reorder|low.stock|risk|shortage/.test(text))return low.length?`${low.length} product line${low.length===1?' is':'s are'} at or below reorder level: ${low.map(p=>`${p.name} (${p.quantity} left)`).join(', ')}. The estimated reorder budget is ${rupees.format(low.reduce((n,p)=>n+suggestedReorderQty(p)*p.cost,0))}.`:'Great news: every product is currently above its reorder level.';
  if(/market|selling|revenue/.test(text))return `Your available inventory has an estimated market value of ${rupees.format(market)}. This is based on current selling prices, not completed sales.`;
  if(/profit|margin|gross/.test(text))return `The potential gross margin on current stock is ${rupees.format(margin)} (${market?Math.round(margin/market*100):0}% of market value).`;
  if(/supplier|distributor|vendor/.test(text)){const top=suppliers[0];return top?`${top.name} currently has the largest catalogue contribution at ${rupees.format(top.value)} across ${top.items.length} product line${top.items.length===1?'':'s'}.`:'No supplier records are available yet.'}
  if(/shipment|shipping|delivery|track|logistics/.test(text)){const shipments=db.shipments||[],active=shipments.filter(shipment=>shipment.status==='in-transit'||shipment.status==='pending').length,delayed=shipments.filter(shipment=>shipment.status==='delayed').length;return shipments.length?`There are ${active} active shipment${active===1?'':'s'}, ${shipments.filter(shipment=>shipment.status==='delivered').length} delivered, and ${delayed} delayed. Open Shipping & tracking to inspect routes and shipment events.`:'No shipment records are available yet.'}
  if(/value|worth|cost/.test(text))return `Current inventory cost value is ${rupees.format(cost)} and its estimated market value is ${rupees.format(market)}.`;
  if(/stock|product|unit/.test(text))return `You have ${products.reduce((n,p)=>n+p.quantity,0).toLocaleString('en-IN')} units across ${products.length} products. ${low.length?`${low.length} product lines need attention.`:'Stock health is good.'}`;
  return 'Try asking about reorder risks, stock value, market value, gross margin, or your top supplier.';
}
function addAssistantMessage(message,from='assistant'){
  const messages=$('assistantMessages');
  messages.insertAdjacentHTML('beforeend',`<div class="assistant-message ${from}">${escapeHtml(message)}</div>`);
  messages.scrollTop=messages.scrollHeight;
}
function openAssistant(){
  const panel=$('assistantPanel');panel.hidden=false;panel.classList.add('open');
  if(!$('assistantMessages').children.length)addAssistantMessage('Welcome back. Ask me about today’s stock, inventory value, supplier performance, or reorder risks.');
  setTimeout(()=>$('assistantInput').focus(),80);
}
function askAssistant(question){
  const prompt=question.trim();if(!prompt)return;
  addAssistantMessage(prompt,'user');
  setTimeout(()=>addAssistantMessage(assistantReply(prompt)),180);
}
$('assistantToggle').onclick=openAssistant;
$('assistantClose').onclick=()=>{$('assistantPanel').classList.remove('open');$('assistantPanel').hidden=true};
$('assistantForm').addEventListener('submit',event=>{event.preventDefault();askAssistant($('assistantInput').value);$('assistantInput').value=''});
document.addEventListener('click',event=>{const suggestion=event.target.closest('[data-assistant-question]');if(suggestion)askAssistant(suggestion.dataset.assistantQuestion)});
document.addEventListener('click',event=>{const region=event.target.closest('[data-region-id]');if(region)selectDistributionRegion(region.dataset.regionId);});
document.addEventListener('keydown',event=>{const region=event.target.closest?.('.earth-node');if(region&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectDistributionRegion(region.dataset.regionId);}});
