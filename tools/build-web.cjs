const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.resolve(root, 'dist');
const files = [
  'index.html', 'app.js', 'styles.css', 'workspace.css', 'cinematic.css',
  'globe.css', 'globe.js', 'globe-math.js', 'runtime-config.js',
  'assets/earth-daymap.jpg', 'assets/countries-110m.json', 'assets/welcome-warehouse.jpg',
  'vendor/zxing-browser.min.js', 'vendor/ZXING-BROWSER-LICENSE', 'vendor/ZXING-LIBRARY-LICENSE',
];

// Validate inputs before replacing the generated bundle.
for (const file of files) {
  if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing browser source: ${file}`);
}
if (path.dirname(destination) !== root ||
    (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink())) {
  throw new Error('The browser build must use the project dist directory.');
}
fs.rmSync(destination, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
console.log(`Built ${files.length} browser files in ${destination}`);
