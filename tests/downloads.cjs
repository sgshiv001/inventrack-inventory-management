const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { reserveCsvPath, attachCsvDownloads } = require('../desktop/downloads.cjs');

const filename = 'inventrack-inventory-2026-10-01.csv';
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-download-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}

test('CSV exports preserve existing files and reserve distinct destinations', t => {
  const folder = fixture(t);
  fs.writeFileSync(path.join(folder, filename), 'Earlier export');
  const first = reserveCsvPath(folder, filename);
  const second = reserveCsvPath(folder, filename);
  assert.equal(path.basename(first), 'inventrack-inventory-2026-10-01 (1).csv');
  assert.equal(path.basename(second), 'inventrack-inventory-2026-10-01 (2).csv');
  assert.equal(fs.readFileSync(path.join(folder, filename), 'utf8'), 'Earlier export');
  assert.equal(fs.statSync(first).size, 0);
});

test('CSV destination collisions with directories are skipped', t => {
  const folder = fixture(t);
  fs.mkdirSync(path.join(folder, filename));
  assert.equal(path.basename(reserveCsvPath(folder, filename)), 'inventrack-inventory-2026-10-01 (1).csv');
});

test('CSV reservation rejects unsafe paths and reports unwritable destinations', t => {
  const folder = fixture(t);
  for (const name of ['../escape.csv', 'report.csv', 'inventrack-inventory-2026-10-01.csv/escape', '..\\escape.csv']) {
    assert.throws(() => reserveCsvPath(folder, name), /Invalid CSV/);
  }
  assert.throws(() => reserveCsvPath('relative', filename), /Invalid CSV/);
  assert.throws(() => reserveCsvPath(path.join(folder, 'missing'), filename), { code: 'ENOENT' });
});

function downloads(t, overrides = {}) {
  const session = new EventEmitter();
  const workspace = { webContents: {}, isDestroyed: () => false };
  const folder = fixture(t);
  const completed = [], errors = [];
  attachCsvDownloads(session, { getWorkspace: () => workspace, getServerUrl: () => 'http://127.0.0.1:32000',
    getDirectory: () => folder, onComplete: value => completed.push(value), onError: value => errors.push(value), ...overrides });
  const item = new EventEmitter();
  Object.assign(item, { getURL: () => 'http://127.0.0.1:32000/api/inventory.csv', getMimeType: () => 'text/csv',
    getFilename: () => filename, setSavePath: value => { item.destination = value; } });
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  return { session, workspace, folder, item, event, completed, errors };
}

test('desktop confirms the CSV only after Electron completes the download', t => {
  const f = downloads(t);
  f.session.emit('will-download', f.event, f.item, f.workspace.webContents);
  assert.equal(f.event.prevented, false);
  assert.equal(f.completed.length, 0);
  fs.writeFileSync(f.item.destination, 'Verified CSV');
  f.item.emit('done', {}, 'completed');
  assert.deepEqual(f.completed, [f.item.destination]);
  assert.deepEqual(f.errors, []);
});

test('interrupted/cancelled exports report failure instead of success', t => {
  for (const state of ['interrupted', 'cancelled']) {
    const f = downloads(t);
    f.session.emit('will-download', f.event, f.item, f.workspace.webContents);
    f.item.emit('done', {}, state);
    assert.deepEqual(f.completed, []);
    assert.match(f.errors[0], new RegExp(`Export ${state}`));
    assert.match(f.errors[0], /partial or empty/);
  }
});

test('downloads outside the active workspace CSV endpoint are rejected', t => {
  for (const change of [
    f => { f.item.getURL = () => 'https://other.example/api/inventory.csv'; },
    f => { f.item.getURL = () => 'http://127.0.0.1:32000/api/inventory.csv?other=1'; },
    f => { f.item.getMimeType = () => 'text/html'; },
    f => { f.workspace.isDestroyed = () => true; },
    f => { f.sender = {}; },
  ]) {
    const f = downloads(t); change(f);
    f.session.emit('will-download', f.event, f.item, f.sender || f.workspace.webContents);
    assert.equal(f.event.prevented, true);
    assert.equal(f.item.destination, undefined);
  }
});

test('save errors cancel the export and preserve earlier files', t => {
  const f = downloads(t, { getDirectory: () => 'relative' });
  f.session.emit('will-download', f.event, f.item, f.workspace.webContents);
  assert.equal(f.event.prevented, true);
  assert.deepEqual(f.completed, []);
  assert.match(f.errors[0], /CSV could not be saved/);
});
