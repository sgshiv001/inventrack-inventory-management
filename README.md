# InvenTrack

A project by [Shivanshu Gupta](https://github.com/sgshiv001).

InvenTrack is an inventory workspace for small retailers, wholesalers, and distributors. It runs as a Windows application or a Node.js web application. The Windows launcher lets you open the same local workspace in its dedicated desktop window or your default browser.

Products, suppliers, stock movements, purchase orders, receipts, shipments, accounts, and sessions are stored in SQLite. New workspaces start empty. No sample inventory, fabricated activity, or reset button is included in the operational application.

## Download the Windows app

The packaged Windows app includes its runtime; you do not need Node.js to run it.

- [Download the Windows installer (.exe)](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.0.5/InvenTrack-3.0.5-Setup.exe): install, then open **InvenTrack** from the Start menu.
- [Download the portable Windows app (.zip)](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.0.5/InvenTrack-win32-x64-3.0.5.zip): extract the entire ZIP, then run `InvenTrack.exe` inside the extracted folder. Keep its support files together.

Both builds are unsigned, start with your own workspace, and offer **Windows app** or **Web browser** mode. First-time setup requires an organization, administrator email, and password of at least 12 characters. See [Windows download and demonstration instructions](downloads/windows/README.md) and the [release verification report](reports/RELEASE-3.0.5.md) for checks and remaining limitations.

## Run or build from source on Windows

Install Node.js 24 and run:

```powershell
npm install
npm run desktop
```

On first launch, enter your organization, administrator email, and a strong password. Choose **Windows app** for a desktop window or **Web browser** for the same local database in your default browser. Keep the launcher open in browser mode; it runs the local server. Subsequent launches use the account you created.

To build both Windows distribution formats:

```powershell
npm run desktop:make
```

Electron Forge produces an installer (`Setup.exe`) and a portable ZIP under `out/make/`. These builds are unsigned; Windows may display a publisher warning until a code-signing certificate is configured. Test both builds on a clean Windows account before distributing them.

Release 3.0.2 separates the installer directory (`%LOCALAPPDATA%\inventrack_desktop`) from workspace storage. Do not use earlier installer builds that share the standalone web database directory.

The desktop database is in Electron's per-user `InvenTrack/workspace/inventrack.db` data folder, not inside the application or this repository. The launcher displays its full path and offers **Back up workspace**. Set `INVENTRACK_DESKTOP_DB` to an explicit database path for a separate workspace. Uninstalling the application does not intentionally delete data. See [LAUNCH.md](LAUNCH.md) for recovery guidance.

## Run the standalone web server from source

For browser mode in the packaged app, choose **Web browser** in the Windows launcher; the source setup below is not required.

Install Node.js 24, copy `.env.example` to `.env`, and set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ORGANIZATION_NAME` before the first start. Keep `.env` private.

```powershell
npm install
node --env-file=.env server.js
```

Open `http://localhost:3000`. Authentication is always required. Version 3.0.4 defaults to local-only access (`127.0.0.1`); no online hosting is needed. Keep `HOST=127.0.0.1` in any existing `.env` file. The standalone web server and the Windows launcher use different default database locations; set `DB_PATH` to an explicit path if they should use the same database, and never run two unsupervised copies against it. The Windows launcher itself uses one local server for both of its modes.

## Working features

- Product catalogue with SKU/barcode lookup, CSV import/export, pricing, supplier assignment, and low-stock alerts. CSV exports download committed, organization-scoped database records; Unicode and quoted fields are preserved, and formula-like text cells are neutralized for spreadsheet safety. Desktop exports preserve earlier files with numbered filenames and show the saved path after completion.
- Camera barcode scanning uses the native decoder when supported and a locally bundled ZXing decoder otherwise, including Windows browsers. Camera permission, a working camera, and HTTPS or localhost are required; manual entry and keyboard-style USB scanners remain available.
- Atomic stock movements with an append-only movement ledger, supplier purchase orders, and partial receipts.
- Shipment records and event history, including an interactive WebGL 3D delivery globe based on recorded coordinates and routes. Shipment coordinates must be entered accurately; InvenTrack does not claim live carrier tracking.
- Product cards use neutral initials, not invented product photographs. The optional product-model viewer and upload controls were removed in 3.0.1; the delivery globe remains available.
- Administrator-managed team accounts with admin, wholesaler, and read-only retailer roles, expiring HTTP-only sessions, and organization-scoped records.
- Integrity-checked SQLite backup and restore commands. Legacy model attachments from older releases are preserved during upgrades and backups, although they are no longer viewable or uploadable in the application.

An optional Python 3.10+ reporting tool reads an existing database without changing it: `python tools/inventory_report.py --db <database.db>`. It exports CSV and Markdown summaries from actual records; there is no built-in sample catalogue. Prefer running it against a verified backup. Use `--organization <id>` when the database contains multiple organizations.

## Validation

```powershell
npm test
```

The tests cover database snapshots, empty first-run setup, authentication and role boundaries, inventory writes, stock movements, barcodes, purchase orders, retired-viewer removal, legacy attachment retention, and 3D globe math. The Windows installer and portable ZIP still need hands-on validation on the target machine, including camera permissions and printing/export workflows.

## Important boundaries

This is a functional single-organization inventory application, not a finished multi-tenant subscription platform. It does not include live carrier integrations, realized-sales accounting, invoices, billing, automatic geocoding, password recovery, or managed cloud backups. Inventory value is an estimate from current quantities and prices. Do not onboard customer data to a public deployment until the operational controls in [LAUNCH.md](LAUNCH.md) are in place.

Existing local databases are preserved; removing sample-data seeding does not erase records already stored in them. The repository's old database files remain available in Git history, even though they are no longer tracked in the current version. Review that history if it ever held sensitive data.
