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
  return databasePath(root);
}
function modelReferences(file) {
  const db=new DatabaseSync(file,{readOnly:true});
  try {
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='products'").get()||!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='model_file'))return [];
    return db.prepare("SELECT organization_id AS organizationId, model_file AS fileName FROM products WHERE model_file<>''").all().map(item=>{
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(item.organizationId)||!/^[a-zA-Z0-9_-]+\.glb$/.test(item.fileName))throw new Error('Invalid stored model path.');
      return item;
    });
  }finally{db.close();}
}
function copyReferencedModels(references, sourceFolder, destinationFolder) {
  for(const item of references){
    const source=path.join(sourceFolder,item.organizationId,item.fileName),destination=path.join(destinationFolder,item.organizationId,item.fileName);
    if(!fs.existsSync(source))throw new Error(`Referenced 3D model is missing: ${source}`);
    if(fs.existsSync(destination))throw new Error(`Model destination already exists: ${destination}`);
  }
  for(const item of references){
    const destination=path.join(destinationFolder,item.organizationId,item.fileName);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(sourceFolder,item.organizationId,item.fileName),destination,fs.constants.COPYFILE_EXCL);
  }
}
function backupWorkspace(source,destination) {
  source=path.resolve(source);destination=path.resolve(destination);
  if(fs.existsSync(`${destination}.models`))throw new Error('Backup model folder already exists. Choose a new destination.');
  snapshot(source,destination);
  copyReferencedModels(modelReferences(destination),path.join(path.dirname(source),'models'),`${destination}.models`);
  return destination;
}
function restoreWorkspace(source,destination) {
  source=path.resolve(source);destination=path.resolve(destination);
  const references=modelReferences(source);
  // Validate all attachment paths before creating the new database.
  for(const item of references){
    if(!fs.existsSync(path.join(`${source}.models`,item.organizationId,item.fileName)))throw new Error('Backup model folder is missing or incomplete. Keep the .db and .db.models together.');
    if(fs.existsSync(path.join(path.dirname(destination),'models',item.organizationId,item.fileName)))throw new Error('Restore models into a new workspace directory.');
  }
  snapshot(source,destination);
  copyReferencedModels(references,`${source}.models`,path.join(path.dirname(destination),'models'));
  return destination;
}
function migrateLegacy(root) {
  const target = databasePath(root), legacy = path.join(root, 'data', 'inventrack.db');
  if (!fs.existsSync(legacy)) throw new Error('No repository-local legacy database exists.');
  return snapshot(legacy, target);
}
module.exports = { databasePath, prepareDatabase, migrateLegacy, snapshot, check, backupWorkspace, restoreWorkspace };

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..'), [command, input, output] = process.argv.slice(2);
    if (command === 'migrate') console.log(`Verified migration: ${migrateLegacy(root)}. Original files remain in ${path.join(root, 'data')}.`);
    else if (command === 'backup') {
      const source = prepareDatabase(root);
      const destination = input || path.join(path.dirname(source), 'backups', `inventrack-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      console.log(`Verified workspace backup: ${backupWorkspace(source, destination)}\nKeep its .models folder with the database when present.`);
    } else if (command === 'restore') {
      if (!input || !output) throw new Error('Usage: npm run db:restore -- <backup.db> <new-destination.db>');
      console.log(`Verified workspace restore: ${restoreWorkspace(input, output)}\nStart the server with DB_PATH pointing to this restored file.`);
    } else throw new Error('Use migrate, backup, or restore.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
