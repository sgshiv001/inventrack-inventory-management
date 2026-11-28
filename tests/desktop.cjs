const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

const onlineUrl = 'https://inventrack-workspace.onrender.com';
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventrack-launcher-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const windows = [], handlers = new Map(), sessions = new Map();
  let serverStarts = 0;
  const sessionFor = name => {
    if (!sessions.has(name)) {
      const session = new EventEmitter();
      session.setPermissionRequestHandler = handler => { session.permission = handler; };
      sessions.set(name, session);
    }
    return sessions.get(name);
  };
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; windows.push(this);
      this.webContents = Object.assign(new EventEmitter(), {
        id: windows.length, getURL: () => this.url,
        setWindowOpenHandler: handler => { this.popup = handler; },
      });
    }
    removeMenu() {}
    focus() {}
    show() {}
    isDestroyed() { return Boolean(this.destroyed); }
    close() { this.destroyed = true; this.emit('closed'); }
    async loadFile(file) { this.url = pathToFileURL(file).href; }
    async loadURL(url) { this.url = url; }
  }
  const app = Object.assign(new EventEmitter(), {
    setName() {}, requestSingleInstanceLock: () => true, quit() {},
    whenReady: () => Promise.resolve(), getPath: () => directory,
  });
  const fakeServer = { listening: true, address: () => ({ port: 32000 }) };
  const filename = path.resolve(__dirname, '../desktop/main.cjs');
  const nativeRequire = createRequire(filename);
  const electron = {
    app, BrowserWindow: Window, ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    session: { defaultSession: sessionFor('local'), fromPartition: sessionFor },
    shell: { openExternal: async () => {} },
    dialog: { showMessageBox: async () => ({ response: 0 }), showErrorBox: assert.fail },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    __dirname: path.dirname(filename), console,
    process: { env: { INVENTRACK_DESKTOP_DB: path.join(directory, 'local.db') } },
    require: name => name === 'electron' ? electron : name === 'electron-squirrel-startup' ? false :
      name === '../server.js' ? (serverStarts++, fakeServer) : nativeRequire(name),
  }, { filename });
  await new Promise(resolve => setImmediate(resolve));
  const event = { sender: windows[0].webContents };
  return { windows, sessions, directory, event, serverStarts: () => serverStarts,
    open: mode => handlers.get('launcher:open')(event, { mode }),
    state: () => handlers.get('launcher:state')(event), handlers };
}

test('online launcher uses the fixed HTTPS service without starting or uploading the local database', async t => {
  const f = await fixture(t);
  const state = await f.open('online');
  assert.equal(f.serverStarts(), 0);
  assert.equal(fs.existsSync(path.join(f.directory, 'local.db')), false);
  assert.equal(state.workspaceUrl, onlineUrl);
  assert.equal(state.workspaceMode, 'online');
  assert.equal(state.running, false);
  const window = f.windows.at(-1);
  assert.equal(window.url, onlineUrl);
  assert.equal(window.options.webPreferences.partition, 'persist:inventrack-online');
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.popup().action, 'deny');
  for (const type of ['will-navigate', 'will-redirect']) {
    for (const url of [onlineUrl + '/#inventory', 'https://untrusted.example', onlineUrl + '.evil.example/']) {
      let prevented = false;
      window.webContents.emit(type, { preventDefault() { prevented = true; } }, url);
      assert.equal(prevented, !url.startsWith(onlineUrl + '/'));
    }
  }
  await assert.rejects(f.handlers.get('launcher:open')({ sender: window.webContents }, { mode: 'online' }), /Invalid window/);
});

test('switching online and local replaces the window and preserves each session scope', async t => {
  const f = await fixture(t);
  await f.open('online');
  const online = f.windows.at(-1);
  await f.open('online');
  assert.equal(f.windows.length, 2);
  await f.open('desktop');
  const local = f.windows.at(-1);
  assert.equal(online.isDestroyed(), true);
  assert.equal(local.url, 'http://127.0.0.1:32000');
  assert.equal(local.options.webPreferences.partition, undefined);
  assert.equal(f.serverStarts(), 1);
  await f.open('online');
  assert.equal(local.isDestroyed(), true);
  assert.equal(f.state().workspaceUrl, onlineUrl);
  f.windows.at(-1).close();
  assert.equal(f.state().workspaceUrl, null);
});

test('online CSV downloads accept only the current workspace and official CSV endpoint', async t => {
  const f = await fixture(t);
  await f.open('online');
  const window = f.windows.at(-1);
  const session = f.sessions.get('persist:inventrack-online');
  for (const url of [onlineUrl + '/api/inventory.csv', 'http://127.0.0.1:32000/api/inventory.csv', onlineUrl + '/other.csv']) {
    const item = Object.assign(new EventEmitter(), {
      getURL: () => url, getMimeType: () => 'text/csv', getFilename: () => 'inventrack-inventory-2026-11-28.csv',
      setSavePath: file => { item.file = file; },
    });
    let prevented = false;
    session.emit('will-download', { preventDefault() { prevented = true; } }, item, window.webContents);
    assert.equal(prevented, url !== onlineUrl + '/api/inventory.csv');
    assert.equal(Boolean(item.file), !prevented);
  }
});

test('camera prompts require video from the current workspace window and origin', async t => {
  const f = await fixture(t);
  await f.open('online');
  const permission = f.sessions.get('persist:inventrack-online').permission;
  const window = f.windows.at(-1);
  const request = (sender, kind, url, mediaTypes) => new Promise(resolve => permission(sender, kind, resolve, { requestingUrl: url, mediaTypes }));
  assert.equal(await request(window.webContents, 'media', onlineUrl + '/', ['video']), true);
  assert.equal(await request(window.webContents, 'media', onlineUrl + '/', ['audio']), false);
  assert.equal(await request(window.webContents, 'media', onlineUrl + '/', undefined), false);
  assert.equal(await request(window.webContents, 'media', onlineUrl + '.evil.example/', ['video']), false);
  assert.equal(await request(f.event.sender, 'media', onlineUrl + '/', ['video']), false);
  assert.equal(await request(window.webContents, 'notifications', onlineUrl + '/', []), false);
});
