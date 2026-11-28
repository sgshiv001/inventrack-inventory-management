const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { backupWorkspace } = require('../tools/database.cjs');
const { attachCsvDownloads } = require('./downloads.cjs');
const ONLINE_URL = 'https://inventrack-workspace.onrender.com';

app.setName('InvenTrack');
const squirrelStartup=require('electron-squirrel-startup');
if(squirrelStartup)app.quit();
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let launcher;
let workspace;
let server;
let serverUrl;
let starting;
let databaseFile;
let workspaceUrl;
let workspaceMode;

function defaultDatabaseFile() {
  return process.env.INVENTRACK_DESKTOP_DB ? path.resolve(process.env.INVENTRACK_DESKTOP_DB) : path.join(app.getPath('userData'), 'workspace', 'inventrack.db');
}

function hasAdminAccount(file) {
  if (!fs.existsSync(file)) return false;
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get() && database.prepare('SELECT 1 FROM users LIMIT 1').get());
  } finally {
    database.close();
  }
}

function launcherState() {
  return { configured: hasAdminAccount(databaseFile), running: Boolean(serverUrl), url: serverUrl, databaseFile, workspaceUrl, workspaceMode };
}

function senderIsLauncher(event) {
  return launcher && !launcher.isDestroyed() && event.sender.id === launcher.webContents.id && event.sender.getURL() === pathToFileURL(path.join(__dirname, 'launcher.html')).href;
}

function createLauncher() {
  launcher = new BrowserWindow({
    width: 690,
    height: 830,
    minWidth: 560,
    minHeight: 760,
    title: 'InvenTrack — choose how to work',
    backgroundColor: '#141612',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  launcher.removeMenu();
  launcher.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  launcher.webContents.on('will-navigate', event => event.preventDefault());
  launcher.loadFile(path.join(__dirname, 'launcher.html'));
}

async function ensureServer(setup) {
  if (serverUrl) return serverUrl;
  if (starting) return starting;
  starting = (async () => {
    if (!hasAdminAccount(databaseFile) && setup) {
      const email = String(setup?.email || '').trim().toLowerCase();
      const password = String(setup?.password || '');
      const organization = String(setup?.organization || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || !organization || organization.length > 100) {
        throw new Error('Enter your organization, a valid email, and a password of at least 12 characters.');
      }
      process.env.ADMIN_EMAIL = email;
      process.env.ADMIN_PASSWORD = password;
      process.env.ORGANIZATION_NAME = organization;
    }
    process.env.DB_PATH = databaseFile;
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '0';
    process.env.AUTH_REQUIRED = 'true';
    server = require('../server.js');
    if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    serverUrl = `http://127.0.0.1:${server.address().port}`;
    delete process.env.ADMIN_PASSWORD;
    return serverUrl;
  })();
  try { return await starting; } finally { starting = null; delete process.env.ADMIN_PASSWORD; }
}

async function createWorkspace(url, mode) {
  if (workspace && !workspace.isDestroyed() && workspaceUrl === url) { workspace.show(); workspace.focus(); return; }
  const previous = workspace;
  const next = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1050,
    minHeight: 680,
    title: 'InvenTrack',
    backgroundColor: '#f6f7f3',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      ...(mode === 'online' ? { partition: 'persist:inventrack-online' } : {}) },
  });
  workspace = next;
  workspaceUrl = url;
  workspaceMode = mode;
  next.removeMenu();
  next.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const restrictNavigation = (event, target) => {
    if (!target.startsWith(`${url}/`) && target !== url) event.preventDefault();
  };
  next.webContents.on('will-navigate', restrictNavigation);
  next.webContents.on('will-redirect', restrictNavigation);
  next.on('closed', () => {
    if (workspace === next) { workspace = null; workspaceUrl = null; workspaceMode = null; }
  });
  if (previous && !previous.isDestroyed()) previous.close();
  try { await next.loadURL(url); }
  catch (error) {
    if (!next.isDestroyed()) next.close();
    throw new Error(mode === 'online' ? 'Could not connect to the online workspace. Check your internet connection and try again. The free host may take about a minute to wake.' : error.message);
  }
}

if (singleInstance && !squirrelStartup) {
  app.on('second-instance', () => { if (launcher && !launcher.isDestroyed()) { launcher.show(); launcher.focus(); } });
  app.whenReady().then(() => {
    databaseFile = defaultDatabaseFile();
    const exportMessage = options => {
      const parent = workspace && !workspace.isDestroyed() ? workspace : launcher;
      dialog.showMessageBox(parent, options).catch(error => console.error('Export notification:', error.message));
    };
    const configureSession = targetSession => {
      attachCsvDownloads(targetSession, {
        getWorkspace: () => workspace,
        getServerUrl: () => workspaceUrl,
        getDirectory: () => app.getPath('downloads'),
        onComplete: destination => exportMessage({ type: 'info', title: 'CSV export saved', message: 'Inventory CSV saved.', detail: destination }),
        onError: message => exportMessage({ type: 'error', title: 'CSV export not completed', message }),
      });
      targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        if (permission !== 'media' || !workspace || workspace.isDestroyed() || webContents !== workspace.webContents ||
            !workspaceUrl || !details.requestingUrl.startsWith(`${workspaceUrl}/`) ||
            !details.mediaTypes?.length || details.mediaTypes.some(type => type !== 'video')) return callback(false);
        dialog.showMessageBox(launcher || workspace, { type: 'question', buttons: ['Allow camera', 'Deny'], defaultId: 1, message: 'Allow InvenTrack to use the camera for barcode scanning?' })
          .then(result => callback(result.response === 0)).catch(() => callback(false));
      });
    };
    configureSession(session.defaultSession);
    configureSession(session.fromPartition('persist:inventrack-online'));
    ipcMain.handle('launcher:state', event => senderIsLauncher(event) ? launcherState() : null);
    ipcMain.handle('launcher:backup', async event => {
      if(!senderIsLauncher(event))throw new Error('Invalid window.');
      if(!hasAdminAccount(databaseFile))throw new Error('Set up the workspace before backing it up.');
      const selection=await dialog.showSaveDialog(launcher,{title:'Back up inventory workspace',defaultPath:path.join(app.getPath('documents'),`inventrack-${new Date().toISOString().replace(/[:.]/g,'-')}.db`),filters:[{name:'SQLite workspace',extensions:['db']}]});
      if(selection.canceled)return null;
      return backupWorkspace(databaseFile,selection.filePath);
    });
    ipcMain.handle('launcher:open', async (event, options) => {
      if (!senderIsLauncher(event)) throw new Error('Invalid window.');
      const mode = options?.mode;
      if (mode === 'online') {
        await createWorkspace(ONLINE_URL, mode);
        return launcherState();
      }
      if (mode !== 'desktop' && mode !== 'browser') throw new Error('Choose Online workspace, Local Windows app, or Local browser.');
      const url = await ensureServer(options?.setup);
      if (mode === 'desktop') await createWorkspace(url, mode);
      else await shell.openExternal(url);
      return launcherState();
    });
    createLauncher();
  }).catch(error=>{dialog.showErrorBox('InvenTrack could not start',error.message);app.quit();});
  app.on('before-quit', () => { if (server?.listening) server.close(); });
  app.on('window-all-closed', () => app.quit());
}
