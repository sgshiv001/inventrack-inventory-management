const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { snapshot, check } = require('../tools/database.cjs');

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
