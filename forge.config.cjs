module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'InvenTrack',
    ignore: [
      // Copy only runtime roots, so unrelated documents and preview folders never enter a build.
      /^\/(?=[^/])(?!(?:assets|desktop|tools|vendor|node_modules)(?:\/|$)|(?:package\.json|server\.js|runtime-config\.js|index\.html|app\.js|styles\.css|workspace\.css|cinematic\.css|globe\.css|globe\.js|globe-math\.js|README\.md|LAUNCH\.md)$)/,
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
      /^\/hosting(?:\/|$)/,
      /^\/(?:Dockerfile|cloud-start\.cjs)$/,
      /^\/tools\/hosted-store\.cjs$/,
      /\.(?:docx|pptx|pdf|ndjson)$/i,
      /^\/(?:build_inventrack_[^/]+|dashboard-slide\.jpg|presentation_preview|template_media)(?:\/|$)/,
      /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/i,
    ],
  },
  makers: [
    // Keep Squirrel's install/uninstall directory separate from the web database.
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { name: 'inventrack_desktop', authors: 'Shivanshu Gupta' } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
};
