// Disposable workspace for hands-on release verification; never packaged.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'inventrack-release-'));
process.env.DB_PATH=path.join(folder,'workspace','inventrack.db');
process.env.ADMIN_EMAIL='release@example.test';
process.env.ADMIN_PASSWORD='temporary release test password';
process.env.ORGANIZATION_NAME='Release verification workspace';
process.env.HOST='127.0.0.1';process.env.PORT='0';
const server=require('../server.js');
server.once('listening',async()=>{
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const headers={Cookie:cookie,'Content-Type':'application/json'};
    const now=new Date().toISOString();
    const state={revision:0,suppliers:[{id:'release_supplier',name:'Verification supplier',contact:'Stock team'}],products:[{id:'release_product',name:'Verification stock item',sku:'VERIFY-001',barcode:'1234567890123',category:'Equipment',quantity:12,reorder:5,cost:100,price:150,supplierId:'release_supplier'}],movements:[{id:'release_opening',productId:'release_product',type:'in',quantity:12,balance:12,reference:'OPENING',notes:'Disposable verification inventory',date:now}],regions:[],shipments:[{id:'release_shipment',tracking:'VERIFY-ROUTE-001',customer:'Verification receiving team',origin:{label:'Mumbai',latitude:19.076,longitude:72.8777},destination:{label:'Chennai',latitude:13.0827,longitude:80.2707},carrier:'Manually recorded carrier',status:'in-transit',weight:4,value:1800,eta:'2026-10-05',createdAt:now,updatedAt:now,events:[{id:'release_event',status:'in-transit',title:'Dispatched',detail:'Disposable verification shipment',location:'Mumbai',date:now}]}]};
    const saved=await fetch(`${base}/api/inventory`,{method:'PUT',headers,body:JSON.stringify(state)});if(!saved.ok)throw new Error(await saved.text());
    console.log(JSON.stringify({url:base,database:process.env.DB_PATH,folder}));
  }catch(error){console.error(error);server.close();process.exitCode=1;}
});
