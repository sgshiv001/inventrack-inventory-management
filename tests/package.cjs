// Inspect a finished Windows package; run after npm run desktop:make.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const asar = await import('@electron/asar');
  const root = path.resolve(__dirname, '..');
  const archive = path.join(root, 'out', 'InvenTrack-win32-x64', 'resources', 'app.asar');
  const entries = asar.listPackage(archive).map(entry => entry.replaceAll('\\', '/'));
  const files = [
    'index.html', 'app.js', 'globe.js', 'styles.css', 'workspace.css',
    'server.js', 'runtime-config.js', 'README.md', 'LAUNCH.md',
    'desktop/main.cjs', 'desktop/downloads.cjs', 'desktop/preload.cjs', 'desktop/launcher.html',
    'desktop/launcher.js', 'desktop/launcher.css', 'tools/database.cjs',
    'vendor/zxing-browser.min.js', 'vendor/ZXING-BROWSER-LICENSE', 'vendor/ZXING-LIBRARY-LICENSE',
  ];
  for (const file of files) {
    assert.deepEqual(asar.extractFile(archive, file), fs.readFileSync(path.join(root, file)), file);
  }
  const source = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  for (const key of ['name', 'productName', 'version', 'main', 'dependencies']) {
    assert.deepEqual(packaged[key], source[key], `runtime package field: ${key}`);
  }
  assert.ok(entries.includes('/node_modules/electron-squirrel-startup/index.js'));
  assert.ok(entries.includes('/assets/earth-daymap.jpg'));
  assert.ok(!entries.some(entry => /model-viewer/i.test(entry)), 'retired viewer must not ship');
  assert.ok(!entries.some(entry => /^\/(?:data|tests|reports|dist|docs|\.git|\.github|\.codex|\.openai)(?:\/|$)/i.test(entry)), 'private/development folders must not ship');
  assert.ok(!entries.some(entry => /(?:^|\/)\.env(?:\.|$)|\.(?:db|sqlite|sqlite3)(?:-wal|-shm)?$/i.test(entry)), 'databases and environment files must not ship');
  assert.ok(!entries.some(entry => /\.(?:glb|gltf)$/i.test(entry)), 'no product-model assets');
  console.log(`PASS: Windows ${packaged.version} runtime sources, metadata, dependency, globe asset, viewer removal, and private-file exclusion.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
