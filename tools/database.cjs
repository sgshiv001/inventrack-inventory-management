const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

function databasePath(root) {
  const base = process.platform === 'win32' ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')) : (process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'));
  return path.resolve(process.env.DB_PATH || path.join(base, 'InvenTrack', 'inventrack.db'));
}
function check(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Database integrity check failed.'); }
  finally { db.close(); }
}
function snapshot(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (!fs.existsSync(source)) throw new Error(`Source database does not exist: ${source}`);
  if (fs.existsSync(destination)) throw new Error('Destination already exists. Choose a new path; existing data will not be overwritten.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try { db.exec('PRAGMA busy_timeout=5000'); db.prepare('VACUUM INTO ?').run(destination); }
  finally { db.close(); }
  check(destination);
  return destination;
}
function prepareDatabase(root) {
  const target = databasePath(root), legacy = path.join(root, 'data', 'inventrack.db');
  if (!process.env.DB_PATH && !fs.existsSync(target) && fs.existsSync(legacy)) {
    snapshot(legacy, target);
    console.log(`Preserved database migrated to ${target}. Original files remain in ${path.dirname(legacy)}.`);
  }
  return target;
}
module.exports = { databasePath, prepareDatabase, snapshot, check };

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..'), [command, input, output] = process.argv.slice(2);
    if (command === 'migrate') console.log(prepareDatabase(root));
    else if (command === 'backup') {
      const source = prepareDatabase(root);
      const destination = input || path.join(path.dirname(source), 'backups', `inventrack-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      console.log(`Verified backup: ${snapshot(source, destination)}`);
    } else if (command === 'restore') {
      if (!input || !output) throw new Error('Usage: npm run db:restore -- <backup.db> <new-destination.db>');
      console.log(`Verified restore: ${snapshot(input, output)}\nStart the server with DB_PATH pointing to this restored file.`);
    } else throw new Error('Use migrate, backup, or restore.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
