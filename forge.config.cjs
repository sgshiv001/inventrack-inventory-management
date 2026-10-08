module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'InvenTrack',
    ignore: [
      /^\/\.[^/]+(?:\/|$)/,
      /^\/tools\/inventory_report\.py$/,
      /\/__pycache__(?:\/|$)/,
      /^\/assets\/(?:products|suppliers)(?:\/|$)/,
      /^\/assets\/(?:product-catalog|supplier-team)\.png$/,
      /^\/data(?:\/|$)/,
      /^\/dist(?:\/|$)/,
      /^\/reports(?:\/|$)/,
      /^\/tests(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/downloads(?:\/|$)/,
      /^\/out(?:\/|$)/,
      /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/i,
    ],
  },
  makers: [
    // Keep Squirrel's install/uninstall directory separate from the web database.
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { name: 'inventrack_desktop', authors: 'Shivanshu Gupta' } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
};
