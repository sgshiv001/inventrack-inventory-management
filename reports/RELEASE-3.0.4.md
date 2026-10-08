# InvenTrack 3.0.4 — local-PC release verification

Date: 1 October 2026. Scope: Windows application and browser access on this PC only. The request for public hosting was withdrawn; no hosting resources, charges, public access changes, or deployments were created in this turn. The pre-existing Sites frontend was inspected but left unchanged.

## Changes

- Standalone web server now defaults to `127.0.0.1`, matching the Windows launcher's existing loopback-only server. Updated `.env.example` and operating instructions. Existing environment settings still override the standalone default; set `HOST=127.0.0.1` in an older `.env` too.
- Desktop CSV downloads exclusively reserve a new filename in Downloads. Repeated exports use numbered suffixes, preserving previous exports and avoiding simultaneous filename selection. Only the active Windows workspace's local CSV endpoint is accepted.
- The desktop confirms the saved path only after Electron reports completion. Cancelled, interrupted, and failed exports report an error; a partial or empty file may remain and must not be treated as a completed export.
- The product-model viewer remains removed. The delivery globe, authentication, and inventory workflows remain present.

## Completed checks

| Check | Result |
| --- | --- |
| `npm test` | PASS: 40 unit tests, backend integration, authentication/role/organization integration |
| CSV collision, directory collision, unsafe filename, save error, completion/failure notification tests | PASS |
| Default server listening address | PASS: actual socket bound to `127.0.0.1`; anonymous inventory and CSV rejected |
| JavaScript syntax checks | PASS: changed runtime modules |
| Python reporting tests | PASS: 2 tests |
| Final packaged source/metadata/assets/private-file audit | PASS: `node tests/package.cjs` |
| Installer upgrade from 3.0.3 to 3.0.4 | PASS: exit zero, registered version 3.0.4, desktop/Start Menu shortcuts present |
| Installed API integration | PASS: login, inventory/CSV, globe/decoder, removed-viewer rejection, stock validation, committed movement, ledger, logout |
| Local-browser UI | PASS: login, catalogue, CSV download, authenticated reload, sign-out; no captured console errors |
| Repeated native Windows CSV exports | PASS, human-assisted: distinct `(5).csv` and `(6).csv`, correct SKU/quantity, matching contents; user confirmed the second saved filename |
| Earlier test CSVs | PASS: all four pre-existing exports' SHA-256 hashes unchanged after browser and native downloads |
| Standalone user database | PASS: unchanged SHA-256 before/after installation |
| Installer / portable / package runtime consistency | PASS: all three `app.asar` SHA-256 hashes match |
| Final portable 3.0.4 UI launch | PASS: Windows mode opened against the isolated database and retained the existing 17-unit balance |
| Portable stock UI validation and save | PASS: SKU lookup selected the product; 9,999-unit stock-out rejected without changing stock or adding a movement; one-unit stock-in saved once with reference `PORTABLE-3.0.4-UI`, balance 18 |
| Portable native CSV export | PASS: new `(7).csv`, quantity 18; native completion dialog displayed the actual saved path |
| Portable shipping / globe UI | PASS: saved Mumbai–Chennai shipment shown; globe rendered, drag rotated it, zoom enlarged it, Reset view restored it |
| Launcher's browser mode | PASS: opened Edge at the same local server; browser sign-in, 18-unit shared balance, empty search / SKU recovery, CSV `(8).csv`, and sign-out verified; no captured console warnings/errors |
| Portable restart / persistence | PASS: after closing and relaunching the app, dashboard showed 18 units and the saved `PORTABLE-3.0.4-UI` movement |
| Whitespace check | PASS: `git diff --check`; Git emitted line-ending normalization notices only |

Browser export: `C:\Users\shivu\Downloads\inventrack-inventory-2026-10-01 (4).csv`, containing verification SKU `VERIFY-001`, quantity `12`. [Browser evidence](web-verification-3.0.4.jpg).

Human-assisted native exports: `C:\Users\shivu\Downloads\inventrack-inventory-2026-10-01 (5).csv` and ` (6).csv`, saved five seconds apart. Both contain `Final verified Windows item`, SKU `VERIFY-001`, quantity `17`. Both have SHA-256 `06B89229C7846AADC861332470871FF10B041950F09EF95524018525978557CA`. The user confirmed the second filename; the agent verified both files and preservation of earlier hashes. A native success-dialog screenshot was not captured.

Installed API verification used only `C:\Users\shivu\AppData\Local\Temp\inventrack-release-pkUHrD\desktop\inventrack.db`. Its server listener was `127.0.0.1:58022` at verification time. API stock-in added one explicitly labelled test movement; this is verification data, not starter inventory.

### Resumed UI testing

Following the user's request to continue UI testing, the installed verification instance was closed and the final extracted 3.0.4 portable executable was launched using the same isolated database. The installed reload-warning cancellation also left its displayed inventory unchanged; acceptance of that native reload warning was not tested in this continuation.

The portable stock-out validation retained quantity 17 and six ledger entries. A valid stock-in then produced quantity 18 and exactly one new movement with reference `PORTABLE-3.0.4-UI`, independently confirmed in SQLite and the visible ledger. [Portable stock evidence](portable-verification-3.0.4.png).

Native export `C:\Users\shivu\Downloads\inventrack-inventory-2026-10-01 (7).csv` and launcher-opened Edge export ` (8).csv` both contain SKU `VERIFY-001`, quantity `18`, and SHA-256 `FD73D5632FE66D5DB9E3F9C589D81C96AEDA1E42E0A32647D0CF412A773AE3AF`. The native success dialog confirmed `(7).csv` after completion. The four original exports and `(5).csv`/`(6).csv` retained their previous hashes. [Native export evidence](export-verification-3.0.4.png), [browser-mode evidence](browser-mode-verification-3.0.4.png).

The portable server was bound to `127.0.0.1:64654`. Clicking **Web browser** opened Edge at that exact server, and the browser showed the same 18-unit inventory. Signing out cleared the displayed inventory and returned the authentication dialog. No captured console warnings or errors were reported during this browser check.

Shipping displayed the recorded `VERIFY-ROUTE-001` route from Mumbai to Chennai with manually recorded carrier and in-transit status. The delivery globe responded visibly to drag, zoom-in and reset. No shipment status was changed. [Globe evidence](globe-verification-3.0.4.png).

After a normal close and relaunch, the portable server used `127.0.0.1:59950`; the dashboard retained 18 units and the labelled movement. One hidden-launch test-harness attempt exposed no targetable window; that isolated idle process was stopped, and the visible launch/restart check passed. [Restart evidence](restart-verification-3.0.4.png).

The existing standalone database `C:\Users\shivu\AppData\Local\InvenTrack\inventrack.db` retained SHA-256 `5BF65035D53463F2B528FE0215C641FF7A2D61BCC6B46172445EF94F5AB47A2E`.

## Hands-on checks still pending

- Physical camera barcode decode, clean-machine compatibility and SmartScreen behavior remain unverified. Live camera preview and the decoder raster test are documented in the prior report.
- Windows binaries are unsigned (`NotSigned`). A signing certificate is not needed to develop/use the app locally, but publisher trust for wider distribution is not verified.

The existing [3.0.3 report](RELEASE-3.0.3.md) records install, upgrade, uninstall/data retention, portable launch, stock workflows, and native backup/restore. These earlier results have not been relabelled as fresh 3.0.4 UI checks.

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `out/make/squirrel.windows/x64/InvenTrack-3.0.4 Setup.exe` | 162813952 | `4DFC6495808AA76EEE46113706B25E3EA991AB41B7CB4FBAD5F0FDA5E24206B1` |
| `out/make/zip/win32/x64/InvenTrack-win32-x64-3.0.4.zip` | 167862357 | `FD234240CCCBAB7923241DB85B2DF5022A6A7E552D964E336903057838AB31BB` |
| `out/make/squirrel.windows/x64/inventrack_desktop-3.0.4-full.nupkg` | 162139751 | `F4A684A2B99A26129ACA24779968E97AAAE525FD54D553DC5D22103DFF0B2BD2` |

Final `app.asar`: `4B39202C12BC15C3FAC080A44E4E9A28299816C2D73DE18E7E0834F0E07D8341`.

Portable extraction: `C:\Users\shivu\AppData\Local\Temp\inventrack-local-304-43978a844f1c4522ab2ab89b3142f7b2\portable`. Browser verification workspace: `C:\Users\shivu\AppData\Local\Temp\inventrack-release-YyeBzS`; its test server was stopped and its tab closed after testing. Fixtures and test exports remain available as evidence and are excluded from the packaged app. No existing databases or attachments were removed.

In the preceding verification turn, the user stopped Windows automation with the physical Escape key, and automation stopped then. The user's subsequent request to continue UI testing resumed testing. After this continuation, the isolated portable inventory window and launcher were closed, its browser test tab was closed, and no portable processes or listeners on the two verification ports remained. Open the installed InvenTrack desktop shortcut to use the normal per-user workspace. No operational administrator account was created by the agent.

Testing skill guidance informed happy/error-path, file preservation, authentication and persistence checks. Computer-use safety required a human handoff for native authentication and the obscured Windows UI. The Sites hosting review identified that the existing static publication was not a working API-backed release; publication was then cancelled following the user's local-only instruction.

Source changes and reports are local. No commit, push, online deployment, paid service or account change was performed.
