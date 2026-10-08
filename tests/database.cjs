const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { snapshot, check, backupWorkspace, restoreWorkspace } = require('../tools/database.cjs');

test('backup captures committed WAL data, restores it, and refuses overwrite', () => {
  const folder = mkdtempSync(join(tmpdir(), 'inventrack-backup-'));
  const source = join(folder, 'source.db'), backup = join(folder, 'backup.db'), restored = join(folder, 'restored.db');
  const db = new DatabaseSync(source);
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value TEXT); INSERT INTO records VALUES('preserved stock');");
    snapshot(source, backup); snapshot(backup, restored); check(restored);
    const result = new DatabaseSync(restored, { readOnly: true });
    try { assert.equal(result.prepare('SELECT value FROM records').get().value, 'preserved stock'); }
    finally { result.close(); }
    assert.throws(() => snapshot(source, restored), /already exists/);
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});
test('workspace backups preserve referenced GLB attachments and restore without overwriting',()=>{
  const folder=mkdtempSync(join(tmpdir(),'inventrack-model-backup-'));
  const source=join(folder,'live','inventory.db'),backup=join(folder,'backup','inventory.db'),restored=join(folder,'restore','inventory.db');
  mkdirSync(join(folder,'live','models','org_real'),{recursive:true});
  const db=new DatabaseSync(source);
  try{
    db.exec("CREATE TABLE products(organization_id TEXT,model_file TEXT); INSERT INTO products VALUES('org_real','product-model.glb');");
    writeFileSync(join(folder,'live','models','org_real','product-model.glb'),'model-content');
    backupWorkspace(source,backup);restoreWorkspace(backup,restored);
    assert.equal(readFileSync(join(folder,'restore','models','org_real','product-model.glb'),'utf8'),'model-content');
    assert.throws(()=>restoreWorkspace(backup,restored),/new workspace|already exists/);
    rmSync(join(`${backup}.models`,'org_real','product-model.glb'));
    assert.throws(()=>restoreWorkspace(backup,join(folder,'another-restore','inventory.db')),/missing or incomplete/);
  }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});
