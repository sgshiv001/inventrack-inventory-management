const API_BASE = String(window.INVENTRACK_API_BASE || '').replace(/\/$/,'');
const api = (path,options={}) => fetch(`${API_BASE}${path}`,{credentials:'include',...options});
const rupees = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
const shortDate = new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'});

let db = {revision:0,suppliers:[],products:[],movements:[],regions:[],shipments:[],purchaseOrders:[]};
let selectedRegionId='';
let selectedShipmentId='';
let databaseReady=false, writeBusy=false, saveQueue=Promise.resolve(), releases=[], teamUsers=[], confirmedInventory=structuredClone(db);
let authState={required:true,authenticated:false,user:null};
const VISITOR_ID_KEY='inventrack_visitor_id_v1';
let visitorMetrics={totalVisitors:0,todayVisitors:0,weekVisitors:0},visitorMetricsReady=false;
let distributionGlobe=null;
function connection(message,state){const el=document.getElementById('connectionStatus');el.textContent=message;el.dataset.state=state;}
const $ = id => document.getElementById(id);
const uid = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function authCanWrite(){return authState.authenticated&&['admin','wholesaler'].includes(authState.user?.role);}
function renderAuthState(){
  const button=$('authButton');
  if(button){button.hidden=!authState.required;button.textContent=authState.authenticated?'Sign out':'Sign in';button.title=authState.authenticated?`Sign out ${authState.user.email}`:'Sign in to the organization workspace';}
  if(authState.authenticated&&authState.user?.role&&typeof roleDetails!=='undefined'){
    workspace.role=authState.user.role;persistWorkspace();
    if($('roleChip'))$('roleChip').textContent=`${roleDetails[authState.user.role].label} workspace`;
  }else if($('roleChip'))$('roleChip').textContent='Sign in required';
  const writeControls=['importBtn','quickAddBtn','addProductBtn','addMovementBtn','addSupplierBtn','addShipmentBtn','advanceShipmentBtn','createPurchaseOrdersBtn'];
  for(const id of writeControls){const el=$(id);if(el)el.hidden=!authCanWrite();}
  if($('userManagement'))$('userManagement').hidden=authState.user?.role!=='admin';
}
function openAuthDialog(message=''){
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
  clearSessionInventory();openAuthDialog('You have been signed out.');
}

function emptyInventory(){return {revision:0,suppliers:[],products:[],movements:[],regions:[],shipments:[],purchaseOrders:[]};}
function clearSessionInventory(){authState={required:true,authenticated:false,user:null};databaseReady=false;db=emptyInventory();confirmedInventory=structuredClone(db);teamUsers=[];renderAll();renderEnhanced();renderAuthState();connection('Sign in required','error');}
function save(){
  const snapshot=structuredClone(db);
  writeBusy=true;
  renderAll();
  connection('Saving changes…','pending');
  saveQueue=saveQueue.then(async()=>{
    if(!databaseReady)throw new Error('Database unavailable. Export your changes before reloading.');
    snapshot.revision=db.revision;
    const response=await api('/api/inventory',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if(response.status===401){clearSessionInventory();openAuthDialog('Your session has expired.');throw new Error('Authentication required.');}
    if(response.status===403)throw new Error(result.error||'Your account is read-only.');
    if(!response.ok)throw new Error(result.error||'Database update failed.');
    applyServerSnapshot(result);
    logActivity('Database save confirmed','Inventory changes were committed to SQLite.');renderLogbook();
    return true;
  }).catch(error=>{databaseReady=false;db=structuredClone(confirmedInventory);renderAll();renderEnhanced();connection('Not saved · reload required','error');toast(`${error.message} Changes were not confirmed; reload before editing.`);return false;}).finally(()=>{writeBusy=false;});
  return saveQueue;
}
function applyServerSnapshot(snapshot){db=snapshot;confirmedInventory=structuredClone(snapshot);databaseReady=true;connection('Database synced','ready');renderAll();renderEnhanced()}
async function postServerOperation(path,payload){
  await saveQueue;
  if(!databaseReady)throw new Error('Connect to the database before recording this operation.');
  if(writeBusy)throw new Error('Wait for the current operation to finish.');
  writeBusy=true;
  try{
  const response=await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)}),result=await response.json();
  if(response.status===401){clearSessionInventory();openAuthDialog('Your session has expired.');throw new Error('Authentication required.');}
  if(!response.ok)throw new Error(result.error||'Operation could not be saved.');
  applyServerSnapshot(result);return result;
  }finally{writeBusy=false;}
}
async function loadFromServer(){
  try{
    await loadAuthSession();
    if(authState.required&&!authState.authenticated){clearSessionInventory();openAuthDialog();return;}
    const response=await api('/api/inventory',{signal:AbortSignal.timeout(10000)});
    if(response.status===401){clearSessionInventory();openAuthDialog('Your session has expired.');return;}
    if(!response.ok)throw new Error('Could not load inventory.');
    db=await response.json();
    confirmedInventory=structuredClone(db);
    databaseReady=true;connection('Database connected','ready');
    renderAll();renderEnhanced();
    const releaseResponse=await api('/api/releases');
    if(releaseResponse.ok){releases=await releaseResponse.json();renderLogbook();}
    if(authState.user?.role==='admin')refreshTeamUsers().catch(error=>toast(error.message));
  }catch(error){databaseReady=false;db=emptyInventory();renderAll();connection('Database unavailable','error');toast(error.message||'Could not connect to the database.');}
}
document.addEventListener('submit',event=>{if((!databaseReady||writeBusy) && ['productForm','movementForm','supplierForm','shipmentForm'].includes(event.target.id)){event.preventDefault();event.stopImmediatePropagation();toast(writeBusy?'Wait for the current save to finish.':'Connect the database before editing inventory.');}},true);
document.addEventListener('click',event=>{
  const writeAction=event.target.closest('[data-delete-product],[data-delete-supplier],[data-advance-shipment],[data-receive-order],#advanceShipmentBtn,#createPurchaseOrdersBtn,#importBtn');
  if(((!databaseReady||writeBusy)&&writeAction)||(writeBusy&&event.target.closest('#authButton,#connectionStatus'))){event.preventDefault();event.stopImmediatePropagation();toast(writeBusy?'Wait for the current save to finish.':'Connect the database before editing inventory.');}
},true);
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function productFor(id){return db.products.find(p=>p.id===id)}
function statusFor(p){return p.quantity===0?['Out of stock','out']:p.quantity<=p.reorder?['Low stock','low']:['In stock','good']}
function visitorId(){try{let id=localStorage.getItem(VISITOR_ID_KEY);if(!id){id=crypto.randomUUID?.()||`visitor_${uid('v')}`;localStorage.setItem(VISITOR_ID_KEY,id)}return id}catch{return `visitor_${uid('v')}`}}
async function registerVisitor(){try{const response=await api('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:visitorId(),path:location.hash||'#dashboard'}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Visitor endpoint unavailable');visitorMetrics=await response.json();visitorMetricsReady=true;}catch{visitorMetricsReady=false;}renderAnalytics()}
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
async function importProductsFromCsv(text){
  if(!databaseReady||writeBusy)throw new Error('Wait for database synchronization before importing.');
  const rows=parseCsv(text),headers=rows.shift()?.map(h=>h.trim().toLowerCase())||[],required=['name','sku','category','quantity','reorder level','cost price','selling price'];
  const missing=required.filter(name=>!headers.includes(name));
  if(missing.length)throw new Error(`Missing columns: ${missing.join(', ')}`);
  const index=name=>headers.indexOf(name),seen=new Set(),seenBarcodes=new Set();
  const products=rows.map((row,line)=>{const number=(name)=>Number(row[index(name)]||0),sku=(row[index('sku')]||'').trim(),barcode=headers.includes('barcode')?(row[index('barcode')]||'').trim():'',name=(row[index('name')]||'').trim(),category=(row[index('category')]||'').trim();if(!name||!sku||!category)throw new Error(`Row ${line+2} needs name, SKU, and category.`);if(seen.has(sku.toLowerCase()))throw new Error(`Duplicate SKU in CSV: ${sku}`);seen.add(sku.toLowerCase());if(barcode){if(seenBarcodes.has(barcode.toLowerCase()))throw new Error(`Duplicate barcode in CSV: ${barcode}`);seenBarcodes.add(barcode.toLowerCase());}const quantity=number('quantity'),reorder=number('reorder level'),cost=number('cost price'),price=number('selling price');if(!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(reorder)||reorder<0||![cost,price].every(n=>Number.isFinite(n)&&n>=0))throw new Error(`Row ${line+2} has invalid numeric values.`);return {id:uid('p'),name,sku,barcode,category,quantity,reorder,cost,price,supplierId:''}});
  if(!products.length)throw new Error('No product rows found.');
  db.products=products;
  db.movements=products.filter(p=>p.quantity>0).map(p=>({id:uid('m'),productId:p.id,type:'in',quantity:p.quantity,balance:p.quantity,reference:'CSV IMPORT',notes:'Imported opening stock',date:new Date().toISOString()}));
  if(await save())toast(`Imported ${products.length} products.`);
}

const viewMeta={dashboard:['Dashboard','A clear view of your inventory today.'],products:['Products','Manage your product catalogue and stock levels.'],reorder:['Reorder Plan','Prioritize purchases before stock runs out.'],movements:['Stock Movements','Track every addition, sale, and adjustment.'],suppliers:['Suppliers','Manage the businesses that supply your stock.'],logistics:['Shipping & tracking','Follow routes, delivery commitments, and shipment activity.'],analytics:['Admin insights','Company, supplier, and stock intelligence for better decisions.'],logbook:['Log book','Your database-backed stock movement history.'],about:['About InvenTrack','Inventory operations for distributors, wholesalers, and stock teams.']};
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
  $('onboardingPanel').hidden=Boolean(db.products.length||db.suppliers.length);
  $('metricProducts').textContent=db.products.length;$('metricCategories').textContent=`${cats.length} ${cats.length===1?'category':'categories'}`;$('metricUnits').textContent=units.toLocaleString('en-IN');$('metricLow').textContent=low.length;$('metricValue').textContent=rupees.format(value);$('metricMargin').textContent=rupees.format(margin);$('metricMarket').textContent=rupees.format(market);
  const healthy=db.products.length-low.length,reorderBudget=low.reduce((n,p)=>n+suggestedReorderQty(p)*p.cost,0),supplierCounts=db.suppliers.map(s=>[s.name,db.products.filter(p=>p.supplierId===s.id).length]).sort((a,b)=>b[1]-a[1]);
  $('stockHealth').textContent=db.products.length?`${Math.round(healthy/db.products.length*100)}%`:'0%';$('reorderBudget').textContent=rupees.format(reorderBudget);$('topSupplier').textContent=supplierCounts[0]?.[1]?supplierCounts[0][0]:'--';
  const totals=Object.entries(db.products.reduce((a,p)=>{a[p.category]=(a[p.category]||0)+p.quantity;return a},{})).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...totals.map(x=>x[1]));
  $('categoryChart').innerHTML=totals.length?totals.map(([cat,n])=>`<div class="bar-row"><label title="${escapeHtml(cat)}">${escapeHtml(cat)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3,n/max*100)}%"></div></div><strong>${n}</strong></div>`).join(''):'<div class="empty">Add products to see category stock.</div>';
  $('lowStockList').innerHTML=low.length?low.slice(0,5).map(p=>`<div class="alert-item"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.sku)} - Reorder at ${p.reorder}</small></div><strong class="stock-number">${p.quantity} left</strong></div>`).join(''):`<div class="empty">${db.products.length?'Everything is well stocked.':'Add products to start tracking stock.'}</div>`;
  const recent=[...db.movements].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  $('recentTable').innerHTML=recent.length?recent.map(m=>movementRow(m,false)).join(''):'<tr><td colspan="5" class="empty">No stock activity yet.</td></tr>';
  const ratio=market?Math.round(margin/market*100):0,lowRatio=db.products.length?Math.round(low.length/db.products.length*100):0;
  $('valueComparison').innerHTML=`<div class="value-figures"><div><span>Cost value</span><strong>${rupees.format(value)}</strong></div><div><span>Market value</span><strong>${rupees.format(market)}</strong></div></div><div class="comparison-track"><span style="width:${market?value/market*100:0}%"></span></div><p><b>${rupees.format(margin)}</b> potential gross profit · ${ratio}% value uplift</p>`;
  const readyPercent=db.products.length?100-lowRatio:0;
  $('stockPulse').innerHTML=`<div class="pulse-ring" style="--pulse:${readyPercent}%"><strong>${readyPercent}%</strong><span>ready</span></div><div class="pulse-copy"><strong>${db.products.length-low.length} healthy lines</strong><span>${db.products.length?low.length?`${low.length} product lines need attention.`:'All product lines are above their reorder level.':'No products recorded yet.'}</span><button class="text-btn" data-go="analytics">Open admin insights</button></div>`;
}

function productVisual(product,compact=false){
  return `<span class="product-visual${compact?' compact':''}" aria-hidden="true">${escapeHtml(initials(product.name))}</span>`;
}
function renderProducts(){
  const search=$('productSearch').value.toLowerCase(),cat=$('categoryFilter').value,stock=$('stockFilter').value;
  const filtered=db.products.filter(p=>{const matches=!search||[p.name,p.sku,p.barcode||'',p.category].some(x=>x.toLowerCase().includes(search));const state=statusFor(p)[1];return matches&&(!cat||p.category===cat)&&(!stock||state===stock||(stock==='healthy'&&state==='good'))});
  const showcase=$('productShowcase');
  if(showcase)showcase.innerHTML=filtered.length?filtered.slice(0,6).map(p=>{const status=statusFor(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'Unassigned',inventoryValue=p.quantity*p.cost,marketValue=p.quantity*p.price,margin=marketValue-inventoryValue,marginRate=p.price?Math.round((p.price-p.cost)/p.price*100):0,details=authCanWrite()?`<button class="showcase-action" data-edit-product="${p.id}">View product details <span aria-hidden="true">→</span></button>`:'<span class="showcase-action readonly">Read-only product details</span>';return `<article class="product-showcase-card"><div class="product-showcase-top"><span class="catalogue-label">${escapeHtml(p.category)}</span><span class="badge ${status[1]}">${status[0]}</span></div><div class="product-showcase-main">${productVisual(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.sku)} · ${escapeHtml(supplier)}</p></div></div><div class="product-business-grid"><div><span>On hand</span><strong>${p.quantity.toLocaleString('en-IN')}</strong></div><div><span>Market value</span><strong>${rupees.format(marketValue)}</strong></div><div><span>Margin</span><strong>${marginRate}%</strong></div></div>${details}</article>`}).join(''):'<div class="empty">No product visuals match these filters.</div>';
  $('productsTable').innerHTML=filtered.length?filtered.map(p=>{const status=statusFor(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'--',margin=(p.price-p.cost)*p.quantity,actions=authCanWrite()?`<div class="actions"><button class="action-btn" data-edit-product="${p.id}" title="Edit product">Edit</button><button class="action-btn" data-move-product="${p.id}" title="Record stock movement">Stock</button><button class="action-btn" data-delete-product="${p.id}" title="Delete product">Delete</button></div>`:'<span class="readonly">Read only</span>';return `<tr><td><div class="product-cell">${productVisual(p,true)}<div><strong>${escapeHtml(p.name)}</strong><small class="table-subtext">${escapeHtml(p.category)}</small></div></div></td><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.category)}</td><td><strong>${p.quantity}</strong> units</td><td>${rupees.format(p.cost)}</td><td>${rupees.format(p.price)}</td><td>${rupees.format(p.cost*p.quantity)}</td><td>${rupees.format(margin)}</td><td>${escapeHtml(supplier)}</td><td><span class="badge ${status[1]}">${status[0]}</span></td><td>${actions}</td></tr>`}).join(''):'<tr><td colspan="11" class="empty">No products match these filters.</td></tr>';
  $('productCount').textContent=`Showing ${filtered.length} of ${db.products.length} products`;
  const selected=$('categoryFilter').value,categories=[...new Set(db.products.map(p=>p.category))].sort();$('categoryFilter').innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join('');
}

function suggestedReorderQty(p){return p.quantity<=p.reorder?Math.max(p.reorder*2-p.quantity,p.reorder-p.quantity):0}
function remainingReorderQty(p){
  const ordered=(db.purchaseOrders||[]).filter(order=>order.status!=='received').flatMap(order=>order.items).filter(item=>item.productId===p.id).reduce((total,item)=>total+item.quantity-(item.receivedQuantity||0),0);
  return Math.max(0,suggestedReorderQty(p)-ordered);
}
function renderReorderPlan(){
  const items=db.products.filter(p=>remainingReorderQty(p)>0).sort((a,b)=>a.quantity-b.quantity);
  const units=items.reduce((n,p)=>n+remainingReorderQty(p),0),cost=items.reduce((n,p)=>n+remainingReorderQty(p)*p.cost,0);
  $('reorderItems').textContent=items.length;$('reorderUnits').textContent=units.toLocaleString('en-IN');$('reorderCost').textContent=rupees.format(cost);
  $('reorderTable').innerHTML=items.length?items.map(p=>{const qty=remainingReorderQty(p),supplier=db.suppliers.find(s=>s.id===p.supplierId)?.name||'Assign supplier',status=statusFor(p);return `<tr><td><div class="product-cell"><span class="product-avatar">${initials(p.name)}</span><strong>${escapeHtml(p.name)}</strong></div></td><td>${p.quantity}</td><td>${p.reorder}</td><td><strong>${qty}</strong> units</td><td>${rupees.format(qty*p.cost)}</td><td>${escapeHtml(supplier)}</td><td><span class="badge ${status[1]}">${status[0]}</span></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">No reorder action is needed right now.</td></tr>';
  renderPurchaseOrders();
}
function renderPurchaseOrders(){
  const orders=db.purchaseOrders||[];
  $('purchaseOrdersTable').innerHTML=orders.length?orders.map(order=>`<tr><td><details class="purchase-order-details"><summary title="${escapeHtml(order.id)}">PO-${escapeHtml(order.id.slice(-8).toUpperCase())}</summary><ul>${order.items.map(item=>`<li>${escapeHtml(item.name)} · ${item.receivedQuantity||0}/${item.quantity} received · ${rupees.format(item.unitCost)} each</li>`).join('')}</ul></details></td><td>${escapeHtml(order.supplierName)}</td><td>${shortDate.format(new Date(order.createdAt))}</td><td>${order.items.reduce((n,item)=>n+(item.receivedQuantity||0),0)}/${order.items.reduce((n,item)=>n+item.quantity,0)} units received</td><td>${rupees.format(order.total||0)}</td><td><span class="badge ${order.status==='received'?'good':'low'}">${order.status==='received'?'Received':order.status==='partial'?'Partially received':'Ordered'}</span></td><td>${order.status==='received'?'--':authCanWrite()?`<button class="action-btn" data-receive-order="${escapeHtml(order.id)}">Receive</button>`:'Read only'}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No purchase orders yet. Create supplier orders from the suggested purchase list.</td></tr>';
}
async function createPurchaseOrders(){
  const grouped=new Map();
  for(const p of db.products.filter(product=>product.quantity<=product.reorder&&product.supplierId)){
    const quantity=remainingReorderQty(p);if(!quantity)continue;
    if(!grouped.has(p.supplierId))grouped.set(p.supplierId,[]);
    grouped.get(p.supplierId).push({productId:p.id,quantity});
  }
  if(!grouped.size){toast('No reorder items with an assigned supplier.');return;}
  const button=$('createPurchaseOrdersBtn');button.disabled=true;
  try{
    for(const [supplierId,items] of grouped)await postServerOperation('/api/purchase-orders',{supplierId,items});
    toast(`${grouped.size} purchase order${grouped.size===1?'':'s'} created.`);
  }catch(error){toast(error.message||'Could not create purchase orders.');}
  finally{button.disabled=false;}
}
function receivePurchaseOrder(orderId){
  const order=(db.purchaseOrders||[]).find(order=>order.id===orderId);if(!order||order.status==='received')return;
  $('receiptForm').dataset.orderId=orderId;$('receiptError').textContent='';
  $('receiptItems').innerHTML=order.items.filter(item=>item.quantity>(item.receivedQuantity||0)).map(item=>{const remaining=item.quantity-(item.receivedQuantity||0);return `<label class="wide">${escapeHtml(item.name)} · ${remaining} remaining<input type="number" data-receipt-product="${escapeHtml(item.productId)}" min="0" max="${remaining}" step="1" value="${remaining}" required></label>`;}).join('');
  $('receiptDialog').showModal();
}
$('receiptForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('receiptSubmit');button.disabled=true;$('receiptError').textContent='';
  const items=[...$('receiptItems').querySelectorAll('input')].map(input=>({productId:input.dataset.receiptProduct,quantity:Number(input.value)})).filter(item=>item.quantity>0);
  try{await postServerOperation(`/api/purchase-orders/${encodeURIComponent($('receiptForm').dataset.orderId)}/receive`,{items});$('receiptDialog').close();toast('Receipt recorded and stock updated.');}
  catch(error){$('receiptError').textContent=error.message||'Receipt could not be saved.';}finally{button.disabled=false;}
});

function movementRow(m,full=true){const p=productFor(m.productId),sign=m.type==='out'?'-':m.type==='in'?'+':'=';return `<tr>${full?`<td>${shortDate.format(new Date(m.date))}</td>`:''}<td><strong>${escapeHtml(p?.name||'Deleted product')}</strong></td><td><span class="badge ${m.type}">${m.type==='in'?'Stock in':m.type==='out'?'Stock out':'Adjustment'}</span></td><td class="${m.type==='out'?'qty-negative':'qty-positive'}">${sign}${m.quantity}</td>${full?`<td>${m.balance}</td>`:`<td>${shortDate.format(new Date(m.date))}</td>`}<td>${escapeHtml(m.reference||'--')}</td>${full?`<td>${escapeHtml(m.notes||'--')}</td>`:''}</tr>`}
function renderMovements(){const rows=[...db.movements].sort((a,b)=>new Date(b.date)-new Date(a.date));$('movementsTable').innerHTML=rows.length?rows.map(m=>movementRow(m)).join(''):'<tr><td colspan="7" class="empty">No stock movements recorded.</td></tr>'}

function supplierVisual(supplier){return `<span class="supplier-avatar" aria-hidden="true">${escapeHtml(initials(supplier.name))}</span>`}
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
  $('analyticsSummary').innerHTML=[['Market value',rupees.format(market),'Estimated current selling value'],['Gross opportunity',rupees.format(margin),'Potential margin on available stock'],['Supply risk',`${low} lines`,'Products at or below reorder level'],['Suppliers',db.suppliers.length,'Active supplier and distributor records'],['Visitors',visitorMetricsReady?Number(visitorMetrics.totalVisitors||0).toLocaleString('en-IN'):'Unavailable',visitorMetricsReady?`${Number(visitorMetrics.todayVisitors||0).toLocaleString('en-IN')} today · ${Number(visitorMetrics.weekVisitors||0).toLocaleString('en-IN')} this week`:'Database visitor metrics not connected']].map(([label,value,detail])=>`<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  const byCategory=Object.entries(products.reduce((result,p)=>{result[p.category]=(result[p.category]||0)+p.quantity*p.price;return result},{})).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...byCategory.map(([,n])=>n));
  $('categoryValueChart').innerHTML=byCategory.length?byCategory.map(([category,total])=>`<div class="insight-row"><div><strong>${escapeHtml(category)}</strong><span>${rupees.format(total)}</span></div><i><b style="width:${total/max*100}%"></b></i></div>`).join(''):'<div class="empty">Add products to view category value.</div>';
  const stats=db.suppliers.map(s=>{const items=products.filter(p=>p.supplierId===s.id);return {name:s.name,items,units:items.reduce((n,p)=>n+p.quantity,0),cost:items.reduce((n,p)=>n+p.quantity*p.cost,0),market:items.reduce((n,p)=>n+p.quantity*p.price,0),low:items.filter(p=>p.quantity<=p.reorder).length}}).sort((a,b)=>b.market-a.market);
  const maxSupplier=Math.max(1,...stats.map(s=>s.market));
  $('supplierContribution').innerHTML=stats.length?stats.map((s,index)=>`<div class="supplier-bar"><span class="supplier-rank">0${index+1}</span><div><strong>${escapeHtml(s.name)}</strong><small>${s.items.length} products · ${s.low} risk lines</small><i><b style="width:${s.market/maxSupplier*100}%"></b></i></div><em>${rupees.format(s.market)}</em></div>`).join(''):'<div class="empty">Add suppliers to see contribution.</div>';
  $('supplierPerformance').innerHTML=stats.length?stats.map(s=>`<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${s.items.length}</td><td>${s.units.toLocaleString('en-IN')}</td><td>${rupees.format(s.cost)}</td><td>${rupees.format(s.market)}</td><td><span class="badge ${s.low?'low':'good'}">${s.low||'Healthy'}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No supplier data yet.</td></tr>';
  renderDistributionNetwork();
}
function deliveryRegions(){
  const destinations=new Map();
  for(const shipment of (db.shipments||[])){
    const place=shipment.destination;if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))continue;
    const id=`${place.label}|${place.latitude}|${place.longitude}`;
    if(!destinations.has(id))destinations.set(id,{id,city:place.label,country:'',latitude:place.latitude,longitude:place.longitude,sales:0,units:0,status:'healthy'});
    const region=destinations.get(id);region.sales+=shipment.value;region.units++;if(shipment.status==='delayed')region.status='risk';
  }
  return [...destinations.values()].sort((a,b)=>b.sales-a.sales);
}
function renderDistributionNetwork(){
  const regions=deliveryRegions(),shipments=db.shipments||[];
  if(!distributionGlobe)distributionGlobe=new window.EarthGlobe($('globeStage'));
  const selected=regions.find(region=>region.id===selectedRegionId)||regions[0];
  selectedRegionId=selected?.id||'';
  distributionGlobe.update(regions,shipments,selectedRegionId);
  const totalSales=regions.reduce((sum,region)=>sum+region.sales,0);
  const totalUnits=regions.reduce((sum,region)=>sum+region.units,0);
  const routeCount=shipments.filter(shipment=>shipment.status!=='delivered').length;
  $('distributionStats').innerHTML=[
    ['Declared shipment value',rupees.format(totalSales),'Across recorded delivery destinations'],
    ['Shipments recorded',totalUnits.toLocaleString('en-IN'),regions.length+' delivery destinations'],
    ['Open shipments',routeCount,shipments.length+' shipment routes in total'],
    ['Destinations mapped',regions.length,'Locations with recorded coordinates']
  ].map(([label,value,detail])=>`<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  $('regionFeed').innerHTML=regions.length?regions.map(region=>{
    return `<button class="region-item ${region.id===selectedRegionId?'active':''}" type="button" aria-pressed="${region.id===selectedRegionId}" data-region-id="${escapeHtml(region.id)}"><div><strong>${escapeHtml(region.city)}</strong><small>${region.units} shipment${region.units===1?'':'s'}</small></div><b>${rupees.format(region.sales)}<small>Declared value</small></b></button>`;
  }).join(''):'<p class="empty">No delivery destinations recorded.</p>';
}
function selectDistributionRegion(id){
  selectedRegionId=id;
  renderDistributionNetwork();
  distributionGlobe.focus(deliveryRegions().find(region=>region.id===id));
}
const shipmentStatusMeta={pending:['Pending','pending'], 'in-transit':['In transit','in-transit'], delivered:['Delivered','delivered'], delayed:['Delayed','delayed']};
function shipmentFor(id){return (db.shipments||[]).find(shipment=>shipment.id===id)}
function shipmentStatus(status){return shipmentStatusMeta[status]||[status,'pending']}
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
  const today=new Date(),days=Array.from({length:35},(_,i)=>{const date=new Date(today);date.setUTCDate(today.getUTCDate()-34+i);return date});
  const cells=days.map(date=>{const key=date.toISOString().slice(0,10),count=shipments.reduce((total,shipment)=>total+(shipment.events||[]).filter(event=>event.date.slice(0,10)===key).length,0),level=Math.min(4,count);return `<i class="heat-cell level-${level}" title="${count} shipment events on ${key}"></i>`}).join('');$('shipmentHeatmap').innerHTML=`<div class="heatmap-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="heatmap-cells">${cells}</div>`;
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
  $('shipmentForm').reset();$('shipmentError').textContent='';const eta=new Date();eta.setDate(eta.getDate()+5);$('shipmentEta').value=eta.toISOString().slice(0,10);$('shipmentDialog').showModal();
}
async function advanceShipment(id){
  if(writeBusy||!databaseReady)return;
  const shipment=shipmentFor(id);if(!shipment||shipment.status==='delivered')return;const next=shipment.status==='pending'||shipment.status==='delayed'?'in-transit':'delivered',label=next==='delivered'?'Delivered':'In transit',location=next==='delivered'?shipment.destination.label:shipment.origin.label;shipment.status=next;shipment.updatedAt=new Date().toISOString();shipment.events=shipment.events||[];shipment.events.unshift({id:uid('she'),status:next,title:label,detail:next==='delivered'?'Delivery confirmed by the receiving team.':'Carrier has accepted the shipment and it is moving to its destination.',location,date:shipment.updatedAt});selectedShipmentId=shipment.id;if(await save())toast(`${shipment.tracking} marked ${label.toLowerCase()}.`);
}
function renderAll(){renderDashboard();renderProducts();renderReorderPlan();renderMovements();renderSuppliers();renderLogistics();renderAnalytics();renderTeamUsers();fillSelects()}
function renderTeamUsers(){
  const list=$('usersList');if(!list)return;
  list.innerHTML=teamUsers.length?teamUsers.map(user=>`<div class="user-row"><div><strong>${escapeHtml(user.email)}</strong><small>${escapeHtml(user.role)} · ${user.active?'Active':'Disabled'}</small></div>${user.active&&user.id!==authState.user?.id?`<button class="action-btn" data-disable-user="${escapeHtml(user.id)}">Disable</button>`:''}</div>`).join(''):'<p class="empty">No accounts loaded.</p>';
}
async function refreshTeamUsers(){
  const response=await api('/api/users',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Could not load team accounts.');
  teamUsers=await response.json();renderTeamUsers();
}
$('addUserBtn').addEventListener('click',()=>{$('userForm').reset();$('userError').textContent='';$('userDialog').showModal();});
$('userForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('userSubmit');button.disabled=true;$('userError').textContent='';
  try{
    const response=await api('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('userEmail').value.trim(),password:$('userPassword').value,role:$('userRole').value}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Account could not be created.');
    teamUsers=result;renderTeamUsers();$('userPassword').value='';$('userDialog').close();toast('Team account created.');
  }catch(error){$('userError').textContent=error.message||'Account could not be created.';}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-disable-user]');if(!button)return;
  const user=teamUsers.find(item=>item.id===button.dataset.disableUser);if(!user||!confirm(`Disable ${user.email}? Their active sessions will end.`))return;
  button.disabled=true;
  try{const response=await api(`/api/users/${encodeURIComponent(user.id)}/disable`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Account could not be disabled.');teamUsers=result;renderTeamUsers();toast('Account disabled.');}
  catch(error){toast(error.message||'Account could not be disabled.');button.disabled=false;}
});
function fillSelects(){
  const supplierValue=$('productSupplier').value;$('productSupplier').innerHTML='<option value="">No supplier</option>'+db.suppliers.map(s=>`<option value="${s.id}" ${s.id===supplierValue?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
  const productValue=$('movementProduct').value;$('movementProduct').innerHTML='<option value="">Select a product</option>'+db.products.map(p=>`<option value="${p.id}" ${p.id===productValue?'selected':''}>${escapeHtml(p.name)} (${p.quantity} units)</option>`).join('');
}

function openProduct(id=''){
  const p=productFor(id);$('productForm').reset();$('productId').value=id;$('productDialogTitle').textContent=p?'Edit product':'Add product';
  if(p){$('productName').value=p.name;$('productSku').value=p.sku;$('productBarcode').value=p.barcode||'';$('productCategory').value=p.category;$('productQuantity').value=p.quantity;$('productReorder').value=p.reorder;$('productCost').value=p.cost;$('productPrice').value=p.price;$('productSupplier').value=p.supplierId||''}
  $('productQuantity').disabled=Boolean(p);$('productDialog').showModal();
}
function openMovement(productId=''){$('movementForm').reset();$('movementError').textContent='';fillSelects();$('movementProduct').value=productId;$('movementDialog').showModal()}
function productByCode(value){const code=String(value||'').trim().toLowerCase();return code?db.products.find(item=>(item.barcode||'').toLowerCase()===code||item.sku.toLowerCase()===code):null}
$('movementLookup').addEventListener('input',event=>{const product=productByCode(event.target.value);if(product){$('movementProduct').value=product.id;$('movementError').textContent='';}});
$('movementLookup').addEventListener('change',event=>{if(event.target.value.trim()&&!productByCode(event.target.value))$('movementError').textContent='No product matches that SKU or barcode.';});
let scannerStream=null,scannerMode=null,scannerRunning=false,scannerControls=null,scannerGeneration=0;
async function startBarcodeScanner(mode){
  stopBarcodeScanner();const generation=++scannerGeneration;
  scannerMode=mode;$('barcodeStatus').textContent='Requesting camera access…';$('barcodeDialog').showModal();
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable. Use HTTPS or localhost and enter the code manually.');
    const formats=['code_128','ean_13','ean_8','upc_a','upc_e','qr_code','data_matrix','itf'];
    let detector=null;
    if('BarcodeDetector' in window){try{const supported=await BarcodeDetector.getSupportedFormats(),available=formats.filter(format=>supported.includes(format));if(available.length)detector=new BarcodeDetector({formats:available});}catch{}}
    if(!detector&&!window.ZXingBrowser?.BrowserMultiFormatReader)throw new Error('Barcode decoder could not load. Reload the app or enter the code manually.');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(generation!==scannerGeneration||!$('barcodeDialog').open){stream.getTracks().forEach(track=>track.stop());return;}
    scannerStream=stream;
    const video=$('barcodeVideo');video.srcObject=scannerStream;await video.play();
    if(generation!==scannerGeneration||!$('barcodeDialog').open){stream.getTracks().forEach(track=>track.stop());return;}
    scannerRunning=true;$('barcodeStatus').textContent='Point the camera at a product barcode.';
    if(detector){
      const scan=async()=>{if(!scannerRunning||generation!==scannerGeneration)return;try{const codes=await detector.detect(video);if(generation!==scannerGeneration)return;if(codes.length&&handleScannedCode(codes[0].rawValue))return;}catch{}if(scannerRunning&&generation===scannerGeneration)setTimeout(scan,180);};scan();
    }else{
      const reader=new window.ZXingBrowser.BrowserMultiFormatReader();
      const controls=await reader.decodeFromStream(stream,video,(result,error,control)=>{if(generation!==scannerGeneration||!scannerRunning){control.stop();return;}if(result&&handleScannedCode(result.getText()))control.stop();});
      if(generation!==scannerGeneration||!scannerRunning){controls.stop();return;}scannerControls=controls;
    }
  }catch(error){if(generation!==scannerGeneration)return;$('barcodeStatus').textContent=`${error.message||'Camera could not be started.'} Enter the code manually if camera scanning is unavailable.`;stopBarcodeScanner();}
}
function stopBarcodeScanner(){scannerGeneration++;scannerRunning=false;const controls=scannerControls;scannerControls=null;try{controls?.stop();}catch{}if(scannerStream){scannerStream.getTracks().forEach(track=>track.stop());scannerStream=null;}$('barcodeVideo').srcObject=null;}
function handleScannedCode(value){
  const code=String(value||'').trim();if(!code)return false;
  if(scannerMode?.type==='field'){$(scannerMode.id).value=code;stopBarcodeScanner();$('barcodeDialog').close();$(scannerMode.id).focus();return true;}
  const product=productByCode(code);
  if(product){$('movementLookup').value=code;$('movementProduct').value=product.id;stopBarcodeScanner();$('barcodeDialog').close();$('movementQuantity').focus();return true;}
  $('barcodeStatus').textContent=`No product matches “${code}”. Add it as a product barcode or scan again.`;return false;
}
$('barcodeDialog').addEventListener('close',stopBarcodeScanner);
function openSupplier(id=''){const s=db.suppliers.find(x=>x.id===id);$('supplierForm').reset();$('supplierId').value=id;$('supplierDialogTitle').textContent=s?'Edit supplier':'Add supplier';if(s){$('supplierName').value=s.name;$('supplierContact').value=s.contact;$('supplierPhone').value=s.phone;$('supplierEmail').value=s.email;$('supplierAddress').value=s.address}$('supplierDialog').showModal()}

$('productForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('productId').value,sku=$('productSku').value.trim(),barcode=$('productBarcode').value.trim();if(db.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==id)){toast('That SKU is already in use.');return}if(barcode&&db.products.some(p=>(p.barcode||'').toLowerCase()===barcode.toLowerCase()&&p.id!==id)){toast('That barcode is already assigned.');return}const old=productFor(id),product={id:id||uid('p'),name:$('productName').value.trim(),sku,barcode,category:$('productCategory').value.trim(),quantity:old?.quantity??Number($('productQuantity').value),reorder:Number($('productReorder').value),cost:Number($('productCost').value),price:Number($('productPrice').value),supplierId:$('productSupplier').value};if(old)Object.assign(old,product);else{db.products.unshift(product);if(product.quantity>0)db.movements.unshift({id:uid('m'),productId:product.id,type:'in',quantity:product.quantity,balance:product.quantity,reference:'OPENING',notes:'Opening stock',date:new Date().toISOString()})}if(await save()){$('productDialog').close();toast(old?'Product updated.':'Product added.')}});
$('movementForm').addEventListener('submit',async e=>{e.preventDefault();const productId=$('movementProduct').value,type=$('movementType').value,quantity=Number($('movementQuantity').value),button=$('movementForm').querySelector('[type="submit"]')||$('movementForm').querySelector('.btn.primary');$('movementError').textContent='';button.disabled=true;try{await postServerOperation('/api/stock-movements',{productId,type,quantity,reference:$('movementReference').value.trim(),notes:$('movementNotes').value.trim()});$('movementDialog').close();toast('Stock movement recorded.')}catch(error){$('movementError').textContent=error.message||'Stock movement could not be saved.';}finally{button.disabled=false;}});
$('supplierForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('supplierId').value,old=db.suppliers.find(s=>s.id===id),supplier={id:id||uid('s'),name:$('supplierName').value.trim(),contact:$('supplierContact').value.trim(),phone:$('supplierPhone').value.trim(),email:$('supplierEmail').value.trim(),address:$('supplierAddress').value.trim()};if(old)Object.assign(old,supplier);else db.suppliers.push(supplier);if(await save()){$('supplierDialog').close();toast(old?'Supplier updated.':'Supplier added.')}});
 $('shipmentForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const customer=$('shipmentCustomer').value.trim(),carrier=$('shipmentCarrier').value.trim();
  const origin={label:$('shipmentOrigin').value.trim(),latitude:Number($('shipmentOriginLatitude').value),longitude:Number($('shipmentOriginLongitude').value)};
  const destination={label:$('shipmentDestination').value.trim(),latitude:Number($('shipmentDestinationLatitude').value),longitude:Number($('shipmentDestinationLongitude').value)};
  if(!customer||!carrier||!origin.label||!destination.label||!$('shipmentEta').value||!Number.isFinite(origin.latitude)||!Number.isFinite(origin.longitude)||!Number.isFinite(destination.latitude)||!Number.isFinite(destination.longitude)||Math.abs(origin.latitude)>90||Math.abs(destination.latitude)>90||Math.abs(origin.longitude)>180||Math.abs(destination.longitude)>180){$('shipmentError').textContent='Enter a customer, carrier, route, valid coordinates, and ETA.';return}
  let tracking;do{tracking=`IT-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`}while((db.shipments||[]).some(shipment=>shipment.tracking===tracking));
  const now=new Date().toISOString(),shipment={id:uid('sh'),tracking,customer,origin,destination,carrier,status:$('shipmentStatus').value,weight:Number($('shipmentWeight').value),value:Number($('shipmentValue').value),eta:$('shipmentEta').value,createdAt:now,updatedAt:now,events:[{id:uid('she'),status:$('shipmentStatus').value,title:$('shipmentStatus').value==='pending'?'Ready for pickup':'Shipment booked',detail:'Shipment record created in InvenTrack.',location:origin.label,date:now}]};
  if(!Number.isFinite(shipment.weight)||shipment.weight<0||!Number.isFinite(shipment.value)||shipment.value<0){$('shipmentError').textContent='Weight and value must be zero or greater.';return}
  (db.shipments||(db.shipments=[])).unshift(shipment);selectedShipmentId=shipment.id;if(await save()){$('shipmentDialog').close();showView('logistics');toast(`${tracking} created.`);}
 });

document.addEventListener('click',async e=>{
  const close=e.target.closest('[data-close-dialog]');if(close)close.closest('dialog').close();
  const scanBarcode=e.target.closest('[data-scan-barcode]'),scanProduct=e.target.closest('[data-scan-product]'),receiveOrder=e.target.closest('[data-receive-order]');
  if(scanBarcode)startBarcodeScanner({type:'field',id:scanBarcode.dataset.scanBarcode});
  if(scanProduct)startBarcodeScanner({type:'product'});
  if(receiveOrder)receivePurchaseOrder(receiveOrder.dataset.receiveOrder);
  const nav=e.target.closest('[data-view]'),go=e.target.closest('[data-go]');if(nav)showView(nav.dataset.view);if(go)showView(go.dataset.go);
  const editP=e.target.closest('[data-edit-product]'),moveP=e.target.closest('[data-move-product]'),deleteP=e.target.closest('[data-delete-product]'),editS=e.target.closest('[data-edit-supplier]'),deleteS=e.target.closest('[data-delete-supplier]'),selectShipment=e.target.closest('[data-select-shipment]'),advance=e.target.closest('[data-advance-shipment]');
  if(editP)openProduct(editP.dataset.editProduct);if(moveP)openMovement(moveP.dataset.moveProduct);
  if(deleteP){const id=deleteP.dataset.deleteProduct,p=productFor(id);if(confirm(`Delete ${p.name}? Its movement history will remain.`)){db.products=db.products.filter(x=>x.id!==id);if(await save())toast('Product deleted.')}}
  if(editS)openSupplier(editS.dataset.editSupplier);if(deleteS){const id=deleteS.dataset.deleteSupplier,s=db.suppliers.find(x=>x.id===id);if(confirm(`Delete supplier ${s.name}?`)){db.suppliers=db.suppliers.filter(x=>x.id!==id);db.products.forEach(p=>{if(p.supplierId===id)p.supplierId=''});if(await save())toast('Supplier deleted.')}}
  if(selectShipment){selectedShipmentId=selectShipment.dataset.selectShipment;renderLogistics()}
  if(advance){advanceShipment(advance.dataset.advanceShipment)}
});
$('quickAddBtn').onclick=$('addProductBtn').onclick=()=>openProduct();$('addMovementBtn').onclick=()=>openMovement();$('addSupplierBtn').onclick=()=>openSupplier();$('addShipmentBtn').onclick=openShipment;$('advanceShipmentBtn').onclick=()=>advanceShipment($('advanceShipmentBtn').dataset.advanceShipment);$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');$('productSearch').oninput=renderProducts;$('categoryFilter').onchange=renderProducts;$('stockFilter').onchange=renderProducts;$('shipmentSearch').oninput=renderLogistics;$('shipmentStatusFilter').onchange=renderLogistics;$('clearShipmentFilter').onclick=()=>{$('shipmentSearch').value='';$('shipmentStatusFilter').value='';renderLogistics()};
$('createPurchaseOrdersBtn').onclick=createPurchaseOrders;
$('dashboardDate').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
$('dashboardSearchForm').addEventListener('submit',event=>{event.preventDefault();const query=$('dashboardSearch').value.trim();$('productSearch').value=query;showView('products');renderProducts();if(query)toast(`Showing products matching “${query}”.`)});
$('exportBtn').onclick=()=>{
  if(!authState.authenticated||!databaseReady){toast('Sign in and load the database before exporting.');return;}
  const link=document.createElement('a');link.href=`${API_BASE}/api/inventory.csv`;link.download=`inventrack-inventory-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);link.click();link.remove();toast('CSV download requested.');
};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{await importProductsFromCsv(reader.result)}catch(error){toast(error.message)}finally{e.target.value=''}};reader.readAsText(file)};
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
delete workspace.activity;
function persistWorkspace(){localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace))}
function logActivity(){}
const baseSave=save;
save=function(){
  const pending=baseSave();
  renderNotifications();
  if($('logbookView')?.classList.contains('active'))renderLogbook();
  return pending;
};
function renderLogbook(){
  $('releaseLog').innerHTML=releases.length?releases.map(item=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail)}</p><small>${shortDate.format(new Date(item.date))} · Product release</small></div></div>`).join(''):'<p>Connect to the database to load product updates.</p>';
  const items=[...db.movements].sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('logbookSummary').textContent=`${items.length} stock ${items.length===1?'movement':'movements'} recorded in the database`;
  $('activityList').innerHTML=items.length?items.map(item=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(productFor(item.productId)?.name||'Deleted product')} · ${escapeHtml(item.type)}</strong><p>${item.quantity} units · balance ${item.balance} · ${escapeHtml(item.reference||'No reference')}</p><small>${shortDate.format(new Date(item.date))}</small></div></div>`).join(''):'<div class="empty">No stock movements have been recorded yet.</div>';
}
function applyTheme(){
  document.documentElement.dataset.theme=workspace.theme;
  $('themeToggle').textContent=workspace.theme==='dark'?'☀':'☾';
  $('themeToggle').title=workspace.theme==='dark'?'Switch to light mode':'Switch to dark mode';
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
  $('roleChip').textContent=authState.authenticated?`${roleDetails[workspace.role||'admin'].label} workspace`:'Sign in required';
  applyTheme();
  renderAuthState();
}
document.addEventListener('click',event=>{
  if(event.target.closest('#roleChip'))toast(authState.authenticated?`${authState.user.email} · ${authState.user.role}`:'Sign in to see your account role.');
  if(event.target.closest('#themeToggle')){workspace.theme=workspace.theme==='dark'?'light':'dark';persistWorkspace();applyTheme();}
  if(event.target.closest('#notificationBtn')){$('notificationPanel')?.classList.toggle('open');}
  else if(!event.target.closest('#notificationPanel')){$('notificationPanel')?.classList.remove('open');}
  const nav=event.target.closest('[data-view]');if(nav&&nav.dataset.view==='logbook')renderLogbook();
});
$('authForm').addEventListener('submit',submitLogin);
$('authButton').addEventListener('click',()=>authState.authenticated?signOut():openAuthDialog());
renderAll();
ensureNotificationPanel();
renderEnhanced();
showView(viewMeta[location.hash.slice(1)]?location.hash.slice(1):'dashboard');
loadFromServer();
registerVisitor();
$('connectionStatus').onclick=()=>{if(confirm('Reload the latest database records? Export CSV first if you have unsaved changes.'))loadFromServer();};

document.addEventListener('click',event=>{const region=event.target.closest('[data-region-id]');if(region)selectDistributionRegion(region.dataset.regionId);});
document.addEventListener('keydown',event=>{const region=event.target.closest?.('.earth-node');if(region&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectDistributionRegion(region.dataset.regionId);}});
