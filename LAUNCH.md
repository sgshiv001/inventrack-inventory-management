# Operating and deploying InvenTrack

## Windows desktop and local browser

Run `npm install` and `npm run desktop` to develop locally. The launcher creates an empty workspace under Electron's per-user app data folder and asks for an organization, administrator email, and 12-character-or-longer password. **Windows app** opens a dedicated window; **Web browser** opens the same authenticated local server in your default browser. Keep the launcher running while the browser is in use.

Build the installer and portable ZIP with `npm run desktop:make`. They are generated in `out/make/` and are not committed to Git. The installer is not code-signed by this project. Before distributing, test install, launch, upgrade, uninstall, data retention, camera scanning, and ZIP extraction on a clean Windows account. Code signing is recommended for a trusted Windows release.

Use release 3.0.2 or later for installer testing. Its Squirrel installation directory is `%LOCALAPPDATA%\inventrack_desktop`, separate from both the standalone web database and the desktop workspace. Earlier unreleased installer builds used a conflicting directory and must not be installed over a web workspace.

The default Windows launcher database is separate from the standalone web server's default `%LOCALAPPDATA%\InvenTrack\inventrack.db`. Both desktop modes share the launcher database. Its full path is displayed in the launcher. Set `INVENTRACK_DESKTOP_DB` to an explicit absolute path to choose a different desktop database. An existing database is never deleted or reset automatically. To use an older database, first create and verify a SQLite snapshot, then point `DB_PATH` at it for the standalone server or `INVENTRACK_DESKTOP_DB` for desktop. Do not copy only the main `.db` file while it is running; committed WAL data might be omitted.

## Standalone web server

Install Node.js 24 and dependencies. Copy `.env.example` to `.env`, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ORGANIZATION_NAME`, then run `node --env-file=.env server.js`. The first start creates the administrator and an empty organization. Later starts use the stored password hash; do not keep the bootstrap password in your deployment environment after setup if not needed. Authentication cannot be disabled in this release.

Set `DB_PATH` to an absolute location on persistent storage. The default server path is `%LOCALAPPDATA%\InvenTrack\inventrack.db` on Windows or `$XDG_DATA_HOME/InvenTrack/inventrack.db` (usually `~/.local/share/InvenTrack/inventrack.db`) on Linux/macOS. Since 3.0.4 the server binds `127.0.0.1` by default for use only on this PC. The Windows launcher also always binds loopback. Do not set `HOST=0.0.0.0`, configure port forwarding, or create a public tunnel for local-only use. An existing `.env` file can override the default; set its `HOST=127.0.0.1` too. The health check is `/api/health`.

Desktop CSV exports are saved to your Downloads folder without replacing earlier exports. Repeated exports add a numbered suffix, such as ` (1)`. The app confirms the saved path only when the download finishes. If an export is interrupted or fails, it reports the failure; a partial or empty file may remain and is not a completed backup. Browser-mode exports use your browser's normal download controls.

For split frontend/API hosting, set `CORS_ORIGIN` to the exact frontend origin and set `window.INVENTRACK_API_BASE` in `runtime-config.js` to the API origin. Same-origin hosting is simpler and preferred. The `dist/` directory is the API-dependent frontend bundle, not an offline standalone demo.

## Backup and recovery

Use `npm run db:backup` to create an integrity-checked, timestamped SQLite snapshot in the server database's `backups` folder. The command uses `VACUUM INTO` and includes committed WAL data. Use `npm run db:backup -- C:/Backups/inventrack-date.db` for a chosen destination. Keep a separate encrypted off-machine copy; a backup on the same disk does not cover disk failure or theft.

The Windows launcher has a **Back up workspace** button with a native destination picker. For workspaces upgraded from releases with product models, both backup paths preserve referenced legacy files in a matching `<backup.db>.models` folder. Keep this folder with the backup database; restoring a backup with missing referenced files is rejected. The product viewer and upload routes were removed in 3.0.1; existing attachments are not deleted. For desktop backups through the CLI, set `DB_PATH` to the desktop database shown in the launcher.

Restore to a new path with `npm run db:restore -- <backup.db> <new-destination.db>`. The tool refuses to overwrite an existing file. Check the restored records, stop the server, set `DB_PATH` to the restored file, and restart. Test this process periodically on a non-production copy.

`npm run db:migrate` copies an older repository-local database to the standalone server default path only if that destination does not exist. It never deletes the original. The desktop launcher does not import old records automatically because doing so could silently populate a new live workspace with historical sample data.

## Before a public customer deployment

- Decide who owns the deployment, backups, restore tests, support, and incident response.
- Use HTTPS, a persistent volume, monitoring, error alerts, and a tested off-machine backup routine.
- Test admin, wholesaler, and retailer accounts; account disabling; session expiry; and recovery from a lost administrator password. Password recovery is not built in.
- Review the old Git history for sensitive database content. Removing a file from the current tree does not remove historical commits.
- Validate exports, stock receipts, barcode camera access, and shipment coordinates with real user data in a staging workspace.
- Treat shipment status as a manually recorded operational status until a carrier integration is implemented. The globe visualizes recorded routes; it does not geocode addresses or report live vehicle positions.

The current architecture is designed for a single organization. Multi-company self-service hosting requires stronger provisioning, tenant isolation audits, managed identity and recovery, a production database/backup plan, and deployment-specific security review. Billing, invoices, and payment processing are not present.
