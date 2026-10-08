const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const prefix=source.slice(0,source.indexOf("document.addEventListener('submit',event=>"));
function workspace(response){
  const elements=new Map(),notifications=[];
  const context=vm.createContext({window:{},structuredClone,Intl,AbortSignal,setTimeout:()=>{},fetch:async()=>response,document:{getElementById:id=>{
    if(!elements.has(id))elements.set(id,{dataset:{},value:'',open:false,showModal(){this.open=true;}});return elements.get(id);
  }},renderAll(){},renderEnhanced(){},logActivity(){},renderLogbook(){},toast:message=>notifications.push(message)});
  vm.runInContext(prefix,context);
  vm.runInContext("databaseReady=true;authState={required:true,authenticated:true,user:{email:'test@example.test',role:'admin'}};db.products=[{id:'p1',name:'Confirmed product',quantity:5}];confirmedInventory=structuredClone(db);db.products[0].name='Edited product';",context);
  return {context,elements,notifications};
}
test('frontend confirms writes only after the server returns the committed snapshot',async()=>{
  const snapshot={revision:1,products:[{id:'p1',name:'Edited product',quantity:5}],suppliers:[],movements:[],regions:[],shipments:[],purchaseOrders:[]};
  const {context,elements}=workspace({ok:true,status:200,json:async()=>snapshot});
  assert.equal(await vm.runInContext('save()',context),true);
  assert.equal(vm.runInContext('db.revision',context),1);
  assert.equal(vm.runInContext('confirmedInventory.products[0].name',context),'Edited product');
  assert.equal(elements.get('connectionStatus').dataset.state,'ready');
  assert.equal(vm.runInContext('writeBusy',context),false);
});
test('frontend rejects stale saves, restores the last confirmed view, and blocks further writes',async()=>{
  const {context,elements,notifications}=workspace({ok:false,status:409,json:async()=>({error:'Inventory changed in another session.'})});
  assert.equal(await vm.runInContext('save()',context),false);
  assert.equal(vm.runInContext('db.products[0].name',context),'Confirmed product');
  assert.equal(vm.runInContext('databaseReady',context),false);
  assert.equal(elements.get('connectionStatus').dataset.state,'error');
  assert.match(notifications[0],/not confirmed/);
});
test('expired sessions clear inventory instead of retaining private records',async()=>{
  const {context}=workspace({ok:false,status:401,json:async()=>({error:'Authentication required.'})});
  assert.equal(await vm.runInContext('save()',context),false);
  assert.equal(vm.runInContext('db.products.length',context),0);
  assert.equal(vm.runInContext('authState.authenticated',context),false);
});
