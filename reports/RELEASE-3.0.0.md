# InvenTrack 3.0.0 completion report

Historical report: superseded by [3.0.3](RELEASE-3.0.3.md). The product viewer was removed in 3.0.1; 3.0.2 also separates the installer from data storage. Do not install the earlier builds linked below. Their screenshot and results describe the earlier release, not the current application.

Date: 1 October 2026 · Windows x64 release

## Outcome

The requested Windows/web conversion and both 3D experiences are implemented. The Windows launcher offers a dedicated application window or a browser connected to the same local database. A standalone Node.js deployment serves the web application.

The core application is ready for local evaluation with real inventory. This report does **not** certify “100% production readiness”: clean-machine installer lifecycle tests, target-hardware checks, signing, and public web deployment remain separate release gates.

## Delivered

| Area | Implemented behavior |
| --- | --- |
| Windows and web | Electron application with first-run organization/admin setup, desktop/browser chooser, single-instance handling, bundled runtime, installer and portable ZIP |
| Real workspaces | Empty new databases; no inventory seed, reset endpoint, simulated role selector, synthetic shipping activity, or offline sample inventory fallback |
| Inventory operations | Products, suppliers, SKU/barcode lookup, CSV import/export, opening stock, append-only stock movements, low-stock planning, supplier purchase orders, partial receipts |
| Delivery globe | WebGL sphere with rotation/zoom, geographic texture/boundaries, recorded shipment routes and destination selection; explicit user-entered coordinates |
| Product models | Authenticated self-contained GLB uploads up to 20 MB; product-bound persistence and interactive model viewing; no invented product or supplier photographs |
| Access controls | Mandatory sign-in, scrypt password hashing, expiring HTTP-only sessions, role checks, organization-scoped records, login throttling, admin-created accounts and session-revoking account disabling |
| Save reliability | Success messages follow commits; revision conflicts are rejected; failed snapshot saves restore the last confirmed view and require reload before editing |
| Recovery | WAL-aware, integrity-checked SQLite snapshots; referenced GLB attachments included; restore to a new path with overwrite protection; launcher backup action |
| Reporting and documentation | Database-backed read-only Python report tool; operational README, launch/recovery guide, architecture and deployment checklist; dependency installation added to CI |

The business-app/testing checklists informed the role, error-path, empty-state, and recovery coverage. No replacement platform or no-code migration was needed.

## Release files

- [Windows installer](<C:/Users/shivu/OneDrive/Documents/GitHub/inventrack-inventory-management/out/make/squirrel.windows/x64/InvenTrack-3.0.0 Setup.exe>)
- [Portable Windows ZIP](C:/Users/shivu/OneDrive/Documents/GitHub/inventrack-inventory-management/out/make/zip/win32/x64/InvenTrack-win32-x64-3.0.0.zip)
- [Unpacked Windows executable](C:/Users/shivu/OneDrive/Documents/GitHub/inventrack-inventory-management/out/InvenTrack-win32-x64/InvenTrack.exe)

Use the installer for normal ongoing use. Use the ZIP to try the application without installing it: extract the entire ZIP before running `InvenTrack.exe`. Both formats include their runtime; installed users do not need Node.js or Python. The portable version still stores inventory in a per-user data folder, rather than inside its extracted application directory.

### Final package checksums

Both the portable archive and the installer `.nupkg` payload contain the verified final application archive. Build-only package metadata is pruned by the packaging tool; runtime name, version, entry point and production dependencies were checked separately.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| InvenTrack-3.0.0 Setup.exe | 170645504 | `40A9D8A92A0803FD36A4E52C9A7963C2A1638F70BAD4AB9A4C321FE90693EE9F` |
| InvenTrack-win32-x64-3.0.0.zip | 175675562 | `FB320DC070AFA56F73480A99F2A6AE2BD4E45AC17C09D2C07A3336DB992DA691` |

## Verification results

| Verification | Result / evidence |
| --- | --- |
| `npm test` | PASS: 23 unit checks, plus passing backend and authentication integration scripts |
| Stock/order integration | PASS: committed persistence across restart, quantity protection, stock movements, barcodes, partial receipt accounting, over-receipt rejection, retained movement history |
| Authentication integration | PASS: mandatory auth even with the old disabling flag set, password verification, distinct organization data, read-only enforcement, admin account management, revoked sessions, login throttling and logout |
| Models and input validation | PASS: invalid GLB rejection, authenticated upload/download, byte-preserving retrieval, model link retention after catalogue saves, invalid shipment coordinate rejection |
| Backup/restore | PASS: committed WAL data preserved, GLB attachments preserved, existing destination refused, missing backup attachments rejected |
| Frontend save/session checks | PASS: committed snapshots confirmed, conflicts restore the confirmed view, expired sessions clear inventory |
| Browser visual check | PASS: disposable account signed in, catalogue displayed, uploaded 3D crate rendered; no model-viewer browser errors observed |
| Packaged Windows UI | PASS: launcher and dedicated application sign-in screen rendered; browser mode opened the shared local URL in the default browser |
| Python reporting | PASS: 2 tests; actual database rows exported, organization selection enforced, missing databases not created |
| Build/package checks | PASS: installer and ZIP produced; packaged application code checked against source; runtime dependencies present; application databases, environment files, Git content and test fixtures excluded |
| Runtime/security diagnostics | Bundled Electron 44.5.1 / Node 24.21.0 successfully exercised SQLite. Production dependency audit reported 0 known vulnerabilities at verification time |
| Remaining UI checks | Windows UI automation was stopped with Escape. Native backup destination selection, installer install/upgrade/uninstall, camera scanning and native export interactions were not completed |

The browser and Windows UI smoke checks preceded the final minor wording/package-exclusion changes. Final sources and packaged archive contents were checked separately; the whole final GUI was not re-tested after those changes. Automated fixtures are kept under `tests/` and excluded from the application package; they are not operational demo data.

### Model-viewer evidence

This screenshot uses a disposable verification model and temporary inventory, not customer records or a model shipped as sample inventory.

![GLB model rendering during verification](C:/Users/shivu/OneDrive/Documents/GitHub/inventrack-inventory-management/reports/product-model-verification.jpg)

## Data protection and changes

- Existing databases and inventory records were preserved. Removing seeding does not delete records already present in an old database.
- Desktop and standalone web defaults remain separate. Both modes inside the Windows launcher share one desktop database. The launcher displays its exact location; `INVENTRACK_DESKTOP_DB` can select a different desktop workspace.
- Old sample `reports/inventory.csv` and `reports/summary.md` were removed; tracked originals remain recoverable through Git history. Archived image assets remain in the repository but are not used as real product/supplier photos and are excluded from the Windows package.
- Temporary verification workspaces were isolated under the OS temporary directory, not the live database. The test server and packaged test application are no longer running.
- Changes and build files are local. This release has not been committed, pushed, published, or deployed publicly.

## Remaining release gates and boundaries

1. Test both distribution formats on a clean Windows account. Verify install, shortcuts, upgrade, uninstall/data retention, ZIP extraction, graphics, downloads and camera support. The installer was built and its payload checked, not installed/uninstalled in this session.
2. Configure Windows code signing for broader distribution. The current builds are unsigned; publisher/reputation warnings may occur. Do not disable security protections to run them.
3. For public web access, choose a host/domain, configure HTTPS and persistent storage, and test the deployment. Use same-origin UI/API hosting where possible. No public hosted URL was created.
4. Establish encrypted off-machine backups and rehearse a restore. Keep a backup database and its matching `.models` directory together. Set up monitoring, support, privacy/retention and administrator recovery procedures.

Shipment statuses are manually recorded; there are no live carrier feeds, vehicle positions or automatic geocoding. Product models must be supplied by the operator; they are not automatically generated from inventory names. Inventory margins are estimates, not realized-sales accounting. Password recovery, invoicing, billing, managed cloud backups and self-service multi-company provisioning are not implemented.

## Start using it

For Windows, install or extract one of the packages, launch InvenTrack, create the first administrator, choose a mode, and sign in. Start by adding suppliers and products or importing a catalogue, then reconcile opening stock with physical inventory.

For standalone web use, follow [LAUNCH.md](C:/Users/shivu/OneDrive/Documents/GitHub/inventrack-inventory-management/LAUNCH.md): configure bootstrap credentials privately, install dependencies, and run `node --env-file=.env server.js`.
