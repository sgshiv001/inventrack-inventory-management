# InvenTrack 3.0.3 verification report

Date: 1 October 2026. Platform: Windows 11 Home Single Language, x64, build 26200.

## Outcome

The application runs as a Windows desktop app and an authenticated web app. Installer and portable ZIP builds are available. Core inventory, persistence, stock transactions, receipts, shipment updates, exports and backup recovery passed the checks below.

This is an operational single-organization inventory workspace, not a completed public SaaS service. Public hosting, code signing and physical barcode decoding are not certified by these results. Test records exist only in separate verification databases; new operational workspaces are empty.

## Changes delivered

- Optional product-model viewer, uploads, read endpoints, and dependency removed in 3.0.1. Recorded-delivery globe retained.
- Existing databases and legacy model attachments preserved. Backup/restore still retains referenced legacy files.
- Installer package ID changed to `inventrack_desktop`, avoiding the standalone web database directory. Earlier installer builds must not be installed over existing web workspaces.
- CSV exports use an authenticated attachment endpoint reading committed organization-scoped records, with Unicode, CSV quoting, and spreadsheet text-formula neutralization.
- Camera barcode scanning now has a locally bundled ZXing fallback on Windows, where native BarcodeDetector is unavailable.
- Operational demo seeding, fake inventory/activity and reset functionality removed. Existing stored records are not erased.
- Windows launcher provides desktop/browser choice and native backup. Both modes use one local server/database.
- Mandatory login, roles, organization scoping, HTTP-only sessions, account administration and throttling retained.
- Transactional stock movements, audit ledger, purchase orders/partial receipts, revision conflict protection and confirmed-save/error recovery retained.

Squirrel's install-directory lifecycle informed the collision fix. [Install process](https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/install-process.md), [implementation](https://raw.githubusercontent.com/Squirrel/Squirrel.Windows/develop/src/Update/Program.cs). Decoder integration follows the [ZXing browser API](https://github.com/zxing-js/browser).

## Automated results

| Check | Result |
| --- | --- |
| `npm test` unit checks | PASS: 32 tests, zero failures |
| Backend integration | PASS: persistence, stock validation/transactions, barcodes, orders/receipts, audit history, retired routes, legacy attachment retention |
| Authentication integration | PASS: passwords, mandatory login, roles, account disabling, throttling, logout, organization isolation including CSV exports |
| Python database-report tests | PASS: 2 tests |
| JavaScript syntax and `git diff --check` | PASS; normal Git LF/CRLF conversion warnings |
| `npm audit --omit=dev` | Zero reported production vulnerabilities at verification time; not a security certification |
| Windows package inspection | PASS: runtime files match source; decoder/licenses and globe assets included; private/development files and old viewer excluded |
| Update manifest | PASS: RELEASES filename, size and SHA-1 match the final nupkg |
| Installed/portable payload comparison | PASS: app.asar SHA-256 values match the final packaged archive |

The decoder test reads an actual generated QR raster. Scanner tests separately cover fallback selection, unknown codes, camera denial, cancellation during permission requests and stream cleanup. These are not represented as a physical-camera decode.

## Browser verification

Tested the Node server on localhost with a separate database and test-only account.

- Signed in and loaded saved inventory. No product-model viewer or upload control is present.
- Edited the product in final 3.0.3 and waited for confirmed save. Reload retained `Final verified web item 3.0.3`.
- Candidate UI testing rejected excessive stock-out, recorded a valid stock-out and created a six-unit purchase order. Final-build testing received another unit, retained `3/6 units received` after reload and showed seven units on hand.
- Advanced the recorded shipment from in transit to delivered in 3.0.3. Reload retained status and delivery event.
- Opened the retained globe, verified the recorded Chennai destination/route, and exercised zoom, route visibility and reset. This is manually recorded delivery data, not live carrier telemetry.
- Downloaded an actual CSV through final UI. Its saved contents matched the final product name, SKU `VERIFY-001` and quantity `7`. No browser warning/error console entries were reported during final checks.
- Decoder fallback loaded instead of the old unsupported-decoder error. The in-app browser remained at its camera-access request, so it did not provide a physical scan result.

Evidence: [web catalogue](web-verification-3.0.3.jpg), [delivery globe](globe-verification-3.0.3.jpg).

## Windows and installer verification

All mutations used a disposable database outside the installation directory. No existing registered InvenTrack installation was present before testing.

1. Installed 3.0.2 candidate silently. Exit code zero; registered location and desktop/Start Menu shortcuts verified.
2. Took an integrity-checked snapshot, then upgraded to 3.0.3 from the local release directory. Exit code zero; registered version 3.0.3; product records/quantities matched the pre-upgrade snapshot.
3. Launched installed 3.0.3. Human-assisted native sign-in succeeded. Edited the product through native UI and confirmed `Product updated` / `Database synced`.
4. Exported from Windows UI. Saved CSV contained `Final verified Windows item`, SKU `VERIFY-001`, quantity `13`.
5. Opened native backup picker. Saved backup passed SQLite integrity checking and contained latest committed product/stock. Restored to a new path; products, suppliers, movements, shipments/events and accounts matched the backup.
6. Selected launcher browser mode. Microsoft Edge opened the same local-server address with expected sign-in screen. The modes share data, not authentication cookies.
7. Uninstalled only the temporary registered test installation. Exit code zero; executable, registry entry and both shortcuts removed. Disposable database and backup remained. Existing standalone web database SHA-256 was unchanged.
8. Extracted final portable ZIP into a fresh directory and launched its executable. It reopened the retained edited inventory and ledger after the installed app had been removed.
9. Tested SKU lookup and recorded stock-in through portable native UI. Ledger showed `PORTABLE-NATIVE-UI` and balance `15`. Installed and portable servers separately passed login, assets, CSV, retired-viewer rejection, stock validation/commit, ledger and logout checks.

10. Fresh-installed the final 3.0.3 Setup after the uninstall test. Exit code zero; registered version 3.0.3, both shortcuts restored, and installed app.asar matched the final package. The existing web database hash remained unchanged. The final version is installed on this computer; the earlier test uninstall is recoverable by this installer. Closed the isolated test launcher and launched the installed application without the test database override for normal use. The resulting launcher was present but minimized at final observation; no operational account was created by the agent.

Evidence: [installed catalogue](windows-verification-3.0.3.png), [portable native ledger](portable-verification-3.0.3.png).

## Camera and remaining boundaries

- Windows camera preview displayed live video. Accessibility reported “Unable to play media” despite the visible live preview; that label alone is not a playback failure.
- A successful physical barcode/QR decode was not observed. The user was asked to present a clear code. Scanning does not automatically record stock; no camera image was saved as a report artifact. An additional human test stock entry was preserved in the isolated verification database.
- Builds are unsigned (`NotSigned`). Signing requires a publisher certificate/account; none was fabricated or bypassed.
- Lifecycle and graphics were tested on this host, not a clean VM or every Windows configuration. Clean-machine SmartScreen behavior remains unverified.
- Public HTTPS hosting, domain/DNS, remote-user deployment, monitoring, off-machine backups and a real-stock business pilot require deployment-specific setup. No public deployment was made.
- Live carrier APIs, invoices/billing, realized-sales accounting, automatic geocoding, password recovery, managed cloud backups and self-service multi-company onboarding are not implemented. See [production checklist](../docs/PRODUCTION_CHECKLIST.md).

The testing skill informed happy-path, rejection, persistence, isolation and recovery coverage. Windows computer-use required human handoff for native authentication and camera/security permission decisions.

## Artifacts and checksums

Only use 3.0.3 artifacts below; older files under `out/` are historical candidates.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `out/make/squirrel.windows/x64/InvenTrack-3.0.3 Setup.exe` | 162816000 | `809916920852A2DCCABBC2ECE25ECFF4F9659A0323E02B49033645DCA9B8E430` |
| `out/make/zip/win32/x64/InvenTrack-win32-x64-3.0.3.zip` | 167861117 | `C15E82363BD7B5F1A8FFFE876D42480D8740158185B8E80A48D120F2EC9E3FA0` |
| `out/make/squirrel.windows/x64/inventrack_desktop-3.0.3-full.nupkg` | 162142458 | `B735877812E162D539D86D8A7938BB4608245AC87587D031DFCA9A396A4CAFBC` |

Final app.asar SHA-256: `8F7163BC7AB0E9C80BF21BB2032EBF2BA6487AA6910DC2C2443D15BF5EE998D2`.

Verification data remains under `C:\Users\shivu\AppData\Local\Temp\inventrack-release-pkUHrD`. Native test backup: `C:\Users\shivu\OneDrive\Documents\inventrack-2026-10-01T09-36-59-448Z.db`. Test exports remain in Downloads. They are evidence, not operational starter inventory, and are excluded from distribution packages. Existing databases and legacy attachments were not deleted.

Source changes and reports are local; no commit, push or public release was performed in this verification turn.
