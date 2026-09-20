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
