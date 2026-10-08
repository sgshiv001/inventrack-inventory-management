const fs = require('node:fs');
const path = require('node:path');

function reserveCsvPath(directory, filename) {
  if (!path.isAbsolute(directory) || !/^inventrack-inventory-\d{4}-\d{2}-\d{2}\.csv$/.test(filename)) {
    throw new Error('Invalid CSV download destination.');
  }
  const stem = filename.slice(0, -4);
  for (let number = 0; number < 10000; number++) {
    const destination = path.join(directory, `${stem}${number ? ` (${number})` : ''}.csv`);
    try {
      // Reserve exclusively: two rapid exports cannot choose the same path.
      const descriptor = fs.openSync(destination, 'wx', 0o600);
      fs.closeSync(descriptor);
      return destination;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Too many exports with this filename. Choose another download folder.');
}

function attachCsvDownloads(targetSession, options) {
  targetSession.on('will-download', (event, item, webContents) => {
    const workspace = options.getWorkspace();
    const serverUrl = options.getServerUrl();
    if (!workspace || workspace.isDestroyed() || webContents !== workspace.webContents ||
        !serverUrl || item.getURL() !== `${serverUrl}/api/inventory.csv` || item.getMimeType() !== 'text/csv') {
      event.preventDefault();
      return;
    }
    let destination;
    try {
      destination = reserveCsvPath(options.getDirectory(), item.getFilename());
      item.setSavePath(destination);
      item.once('done', (_event, state) => {
        if (state === 'completed') options.onComplete(destination);
        else options.onError(`Export ${state}. A partial or empty file may remain at:\n${destination}`);
      });
    } catch (error) {
      event.preventDefault();
      options.onError(`CSV could not be saved: ${error.message}${destination ? `\nAn empty reservation may remain at:\n${destination}` : ''}`);
    }
  });
}

module.exports = { reserveCsvPath, attachCsvDownloads };
