const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const browserFiles = [
  'index.html',
  'app.js',
  'styles.css',
  'workspace.css',
  'globe.css',
  'globe.js',
  'globe-math.js',
  'runtime-config.js',
];

const browserAssets = [
  'vendor/zxing-browser.min.js',
  'assets/earth-daymap.jpg',
  'assets/countries-110m.json',
  'assets/earth-globe.png',
  'assets/earth-texture.png',
  'assets/product-catalog.png',
  'assets/supplier-team.png',
  ...Array.from({ length: 6 }, (_, index) => `assets/products/p${index + 1}.png`),
  ...Array.from({ length: 3 }, (_, index) => `assets/suppliers/s${index + 1}.png`),
];

for (const file of browserFiles) {
  test(`static bundle matches source ${file}`, () => {
    assert.equal(
      readFileSync(path.join(dist, file), 'utf8'),
      readFileSync(path.join(root, file), 'utf8'),
    );
  });
}

test('static bundle includes every browser asset', () => {
  for (const asset of browserAssets) assert.ok(existsSync(path.join(dist, asset)), `Missing dist asset: ${asset}`);
});
test('optional product viewer is removed while the delivery globe remains',()=>{
  assert.equal(existsSync(path.join(dist,'vendor/model-viewer.js')),false);
  assert.doesNotMatch(readFileSync(path.join(root,'index.html'),'utf8'),/model-viewer|modelDialog|openModelsBtn/);
  assert.doesNotMatch(readFileSync(path.join(root,'app.js'),'utf8'),/modelUploadForm|displayProductModel|openProductModels/);
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).dependencies,'@google/model-viewer'),false);
  assert.match(readFileSync(path.join(root,'index.html'),'utf8'),/globe\.js/);
});
test('Windows installer directory is separate from inventory data',()=>{
  const forge=require('../forge.config.cjs');
  const installer=forge.makers.find(maker=>maker.name==='@electron-forge/maker-squirrel');
  assert.equal(installer.config.name,'inventrack_desktop');
  assert.notEqual(installer.config.name.toLowerCase(),'inventrack');
});

test('operations workspace has no retired chat controls or handlers',()=>{
  for(const file of ['index.html','app.js','styles.css','workspace.css']){
    assert.doesNotMatch(readFileSync(path.join(root,file),'utf8'),/assistant(?:-|Reply|Toggle|Panel|Form|Messages|Input)|data-assistant-question/i);
  }
});

test('release contains only the normal test workflow and no hosting manifest',()=>{
  const {readdirSync}=require('node:fs');
  assert.deepEqual(readdirSync(path.join(root,'.github','workflows')),['test.yml']);
  for(const directory of readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&entry.name.startsWith('.')&&!['.git','.github','.vscode'].includes(entry.name))){
    assert.equal(existsSync(path.join(root,directory.name,'hosting.json')),false);
  }
});
test('Windows-compatible barcode decoder is locally bundled',()=>{
  const file='vendor/zxing-browser.min.js';
  assert.deepEqual(readFileSync(path.join(root,file)),readFileSync(path.join(root,'node_modules/@zxing/browser/umd/zxing-browser.min.js')));
  assert.deepEqual(readFileSync(path.join(root,file)),readFileSync(path.join(dist,file)));
  assert.match(readFileSync(path.join(root,'index.html'),'utf8'),/vendor\/zxing-browser\.min\.js/);
});
