const { HostedStore, attachHostedStorage } = require('./tools/hosted-store.cjs');

async function start() {
  const store = new HostedStore({
    databaseFile: process.env.DB_PATH,
    storageUrl: process.env.STATE_STORAGE_URL,
    token: process.env.STATE_STORAGE_TOKEN,
    encryptionKey: process.env.STATE_ENCRYPTION_KEY,
  });
  await store.restore();
  process.env.HOST = '0.0.0.0';
  const server = require('./server.js');
  attachHostedStorage(server, store, error => {
    console.error('Hosted database save failed:', error.message);
    // A fresh process restores the last confirmed snapshot before serving data.
    setTimeout(() => process.exit(1), 250);
  });
}

start().catch(error => {
  console.error('Could not start the hosted workspace:', error.message);
  process.exitCode = 1;
});
