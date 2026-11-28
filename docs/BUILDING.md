# Languages, runtime, and builds

InvenTrack uses the same inventory interface and Node.js API for its local Windows workspace and hosted website. The Windows **Online workspace** opens the hosted service with a separate desktop sign-in session.

## Technology map

| Part | Technology | Main files |
| --- | --- | --- |
| Welcome, accounts, and inventory interface | HTML, CSS, vanilla JavaScript | `index.html`, `app.js`, `styles.css`, `workspace.css`, `cinematic.css` |
| Delivery globe | JavaScript and WebGL | `globe.js`, `globe-math.js`, `globe.css` |
| Inventory and authentication API | Node.js HTTP server | `server.js` |
| Local and hosted database | SQLite through Node's built-in `node:sqlite` | `server.js`, `tools/database.cjs` |
| Windows app and launcher | Electron, CommonJS JavaScript | `desktop/` |
| Installer and portable ZIP | Electron Forge with Squirrel and ZIP makers | `forge.config.cjs` |
| Camera barcode fallback | Locally bundled ZXing browser decoder | `vendor/`, `tests/scanner.cjs` |
| Optional reporting | Python standard library | `tools/inventory_report.py` |
| Hosted startup and encrypted persistence | Node.js, AES-256-GCM, storage Worker | `cloud-start.cjs`, `tools/hosted-store.cjs`, `hosting/state-store/` |

## Source setup

Use Node.js 24 for development, Git, and npm. The package engine permits Node.js 22.5 or newer because the API uses built-in SQLite. Python 3.10 or newer is needed only for reporting and its tests. Windows packaging is configured for Windows x64.

From the repository root, install the locked dependencies and open the launcher.

```powershell
npm ci
npm run desktop
```

For the standalone local browser service, run `npm start` and open `http://localhost:3000`. Create a workspace from the welcome page. See [LAUNCH.md](../LAUNCH.md) for database paths and optional administrator bootstrap settings.

## Validation

```powershell
npm test
python -m unittest discover -s tests -p report_tool.py
```

The JavaScript suite covers persistence, account and role boundaries, stock operations, barcode decoding, exports, launcher modes, and frontend behavior. The Python suite covers the reporting tool. These checks use disposable test data.

`npm run build:web` generates the public browser bundle in `dist/` from the source files and required assets. `npm test` runs this build automatically before the tests. The generated directory is excluded from Git and can be recreated after extracting a source ZIP. The bundle requires a running API with authentication.

## Windows distribution

Build on Windows after finishing the source changes.

```powershell
npm run desktop:make -- --arch=x64
node tests/package.cjs
```

Forge writes the installer to `out/make/squirrel.windows/x64/` and the portable ZIP to `out/make/zip/win32/x64/`. The executable name is `InvenTrack.exe`. Extract the entire portable ZIP before running it.

The package check compares runtime files with the current source and verifies that databases, environment files, project reports, and development folders are excluded. Run it against a fresh build of the same checkout. Existing published binaries belong to their release tag, even when later documentation or source changes appear on `main`.

Release assets are uploaded to GitHub Releases, with SHA-256 hashes in `downloads/windows/SHA256SUMS.txt`. Update the application version before publishing new binaries. The current Windows builds are unsigned. Target-machine installation, upgrade, data retention, and physical camera checks are recorded separately from automated validation.

## Hosted operation

The root `Dockerfile` builds the Node.js service and starts `cloud-start.cjs`. Hosted configuration and encrypted storage credentials are managed on the services. Deployment is manual, as described in [HOSTING.md](HOSTING.md). Pushing a commit runs GitHub checks without redeploying the website.

## Source ZIP below 5 MB

From a Git checkout with all intended changes committed, run `npm run source:zip`. It exports the current commit into an archive beside the repository, checks for private or generated files, and enforces a limit strictly below 5,000,000 bytes. Existing output files are preserved. To choose a destination, use `npm run source:zip -- C:/Uploads/InvenTrack-Source.zip`.

The archive contains the application source, required artwork, locally bundled barcode decoder, tests, and documentation. Dependencies and Windows installers are downloaded or rebuilt when needed. Extract it, run `npm ci`, and then use `npm start` for the local browser app or `npm run desktop` for the Windows launcher. Run `npm run build:web` when a `dist/` bundle is needed.
