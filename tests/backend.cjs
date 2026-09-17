const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const folder=mkdtempSync(join(tmpdir(),'inventrack-test-'));
const port=31873;
let child;
async function start(){
 child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_PATH:join(folder,'test.db')},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error(`Server exited ${code}`)));});
}
async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
const get=async path=>fetch(`http://localhost:${port}${path}`);
const put=async data=>fetch(`http://localhost:${port}/api/inventory`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{try{
 await start();const initial=await (await get('/api/inventory')).json();
 assert.equal(initial.shipments.length,6);
 const changed=structuredClone(initial);changed.products[0].name='Persistence verification';
 changed.shipments[0].status='delivered';
 assert.equal((await put(changed)).status,200);
 assert.equal((await put(initial)).status,409);
 const latest=await (await get('/api/inventory')).json();const invalid=structuredClone(latest);invalid.products[0].quantity=-1;
 assert.equal((await put(invalid)).status,400);
 const invalidShipment=structuredClone(latest);invalidShipment.shipments[0].status='unknown';
 assert.equal((await put(invalidShipment)).status,400);
 assert.equal((await (await get('/api/inventory')).json()).products.find(p=>p.name==='Persistence verification').quantity,changed.products[0].quantity);
 assert.equal((await (await get('/api/inventory')).json()).shipments[0].status,'delivered');
 for(const url of ['/server.js','/data/inventrack.db','/.git/config'])assert.equal((await get(url)).status,404);
 for(const url of ['/assets/earth-texture.png','/assets/products/p1.png','/assets/suppliers/s1.png'])assert.equal((await get(url)).status,200);
 assert.equal((await get('/workspace.css')).status,200);
 assert.ok((await (await get('/api/releases')).json()).length);
 await stop();await start();assert.ok((await (await get('/api/inventory')).json()).products.some(p=>p.name==='Persistence verification'));
 console.log('PASS: persistence, shipment validation, conflict protection, validation rollback, private files and release log.');
 }finally{if(child&&child.exitCode===null)await stop();rmSync(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
