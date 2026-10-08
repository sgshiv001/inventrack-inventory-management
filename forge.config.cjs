module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'InvenTrack',
    ignore: [
      /^\/\.git(?:\/|$)/,
      /^\/\.env(?:\.|$)/,
      /^\/\.(?:vscode|openai|codex)(?:\/|$)/,
      /^\/\.github(?:\/|$)/,
      /^\/tools\/inventory_report\.py$/,
      /\/__pycache__(?:\/|$)/,
      /^\/assets\/(?:products|suppliers)(?:\/|$)/,
      /^\/assets\/(?:product-catalog|supplier-team)\.png$/,
      /^\/data(?:\/|$)/,
      /^\/dist(?:\/|$)/,
      /^\/reports(?:\/|$)/,
      /^\/tests(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/out(?:\/|$)/,
      /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/i,
    ],
  },
  makers: [
    // Keep Squirrel's install/uninstall directory separate from the web database.
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { name: 'inventrack_desktop', authors: 'InvenTrack' } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
};
