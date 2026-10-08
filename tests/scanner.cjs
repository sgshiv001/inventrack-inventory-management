const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const scanner=source.slice(source.indexOf('function productByCode('),source.indexOf("$('barcodeDialog').addEventListener('close',stopBarcodeScanner);"));

function harness({cameraError=false,pendingCamera=false}={}){
  const elements=new Map(),stats={stopped:0,controlStopped:0,callback:null};
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',open:false,srcObject:null,focus(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},async play(){}});return elements.get(id);};
  const stream={getTracks:()=>[{stop(){stats.stopped++;}}]};
  let releaseCamera;
  class Reader{async decodeFromStream(s,video,callback){stats.callback=callback;return {stop(){stats.controlStopped++;}};}}
  const context=vm.createContext({$:element,db:{products:[{id:'p1',sku:'SKU-1',barcode:'1234567890123'}]},window:{ZXingBrowser:{BrowserMultiFormatReader:Reader}},navigator:{mediaDevices:{getUserMedia:()=>cameraError?Promise.reject(new Error('Permission denied')):pendingCamera?new Promise(resolve=>{releaseCamera=resolve;}):Promise.resolve(stream)}},setTimeout(){}});
  vm.runInContext(scanner,context);
  return {context,elements,stats,release:()=>releaseCamera(stream),run:code=>vm.runInContext(code,context)};
}
test('manual SKU and barcode lookup ignores case and surrounding spaces',()=>{
  const h=harness();assert.equal(h.run("productByCode(' sku-1 ').id"),'p1');assert.equal(h.run("productByCode('1234567890123').id"),'p1');assert.equal(h.run("productByCode('unknown')"),undefined);
});
test('Windows fallback decodes into product selection and releases camera on success',async()=>{
  const h=harness();await h.run("startBarcodeScanner({type:'product'})");
  assert.equal(h.run('scannerRunning'),true);assert.equal(typeof h.stats.callback,'function');
  h.stats.callback({getText:()=> '1234567890123'},null,{stop(){h.stats.controlStopped++;}});
  assert.equal(h.elements.get('movementProduct').value,'p1');assert.equal(h.elements.get('movementLookup').value,'1234567890123');
  assert.equal(h.elements.get('barcodeDialog').open,false);assert.equal(h.run('scannerRunning'),false);assert.ok(h.stats.stopped>0);assert.ok(h.stats.controlStopped>0);
});
test('unknown barcodes do not select a product or stop the scan',async()=>{
  const h=harness();await h.run("startBarcodeScanner({type:'product'})");h.stats.callback({getText:()=> 'not-in-catalogue'},null,{stop(){}});
  assert.equal(h.run('scannerRunning'),true);assert.match(h.elements.get('barcodeStatus').textContent,/No product matches/);h.run('stopBarcodeScanner()');
});
test('scanner can populate the product barcode field without changing stock',async()=>{
  const h=harness();await h.run("startBarcodeScanner({type:'field',id:'productBarcode'})");h.stats.callback({getText:()=> '987654321'},null,{stop(){}});
  assert.equal(h.elements.get('productBarcode').value,'987654321');assert.equal(h.elements.get('barcodeDialog').open,false);
});
test('camera denial gives an actionable error without retaining a stream',async()=>{
  const h=harness({cameraError:true});await h.run("startBarcodeScanner({type:'product'})");assert.match(h.elements.get('barcodeStatus').textContent,/Permission denied.*manually/);assert.equal(h.run('scannerStream'),null);assert.equal(h.run('scannerRunning'),false);
});
test('closing while camera permission is pending disposes the late stream',async()=>{
  const h=harness({pendingCamera:true});const pending=h.run("startBarcodeScanner({type:'product'})");h.elements.get('barcodeDialog').open=false;h.run('stopBarcodeScanner()');h.release();await pending;
  assert.ok(h.stats.stopped>0);assert.equal(h.run('scannerStream'),null);assert.equal(h.stats.callback,null);
});
test('installed ZXing decoder reads an actual generated QR raster',()=>{
  const {QRCodeWriter,BarcodeFormat,RGBLuminanceSource,HybridBinarizer,BinaryBitmap}=require('@zxing/library');
  const {BrowserMultiFormatReader}=require('@zxing/browser');
  const matrix=new QRCodeWriter().encode('VERIFY-001',BarcodeFormat.QR_CODE,256,256,new Map());
  const pixels=new Int32Array(256*256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)pixels[y*256+x]=matrix.get(x,y)?0:0xffffff;
  const result=new BrowserMultiFormatReader().decodeBitmap(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,256,256))));
  assert.equal(result.getText(),'VERIFY-001');
});
