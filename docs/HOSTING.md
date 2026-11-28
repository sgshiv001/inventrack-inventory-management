# Public web hosting

[Open InvenTrack online](https://inventrack-workspace.onrender.com). The welcome page is public. Registration creates a separate workspace, and inventory routes require a signed-in account with the appropriate role.

## Services

- The Node.js application runs on a Render Free Docker web service in Singapore. Render builds the root `Dockerfile` when `main` changes.
- The storage Worker in `hosting/state-store` uses Sites-managed R2 storage. Its `/state` endpoint requires a server-side bearer token. The database is encrypted with AES-256-GCM before upload.
- The Windows **Online workspace** mode loads the official HTTPS service and uses the same accounts, inventory, and role permissions as the website. It keeps a dedicated persistent desktop sign-in session. Local Windows and standalone-server workspaces use separate databases; local records are not automatically uploaded or merged.

Free-tier quotas apply. Render Free services sleep after inactivity and can take about a minute to wake. The [Render Free service documentation](https://render.com/docs/free) describes the current service limits.

## Runtime configuration

The Docker image runs `node cloud-start.cjs`. For a configured Node.js environment, the equivalent command is `npm run start:hosted`.

| Environment variable | Hosted setting |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `PORT` | Port assigned by the host, currently `10000` |
| `DB_PATH` | Dedicated temporary database path, currently `/tmp/inventrack-hosted/inventrack.db` |
| `STATE_STORAGE_URL` | Origin of the configured storage Worker |
| `STATE_STORAGE_TOKEN` | Secret shared by the Node.js service and the Worker's `STORAGE_TOKEN` |
| `STATE_ENCRYPTION_KEY` | Secret 32-byte AES key encoded as 64 hexadecimal characters |

Keep the encryption key in the deployment secret manager. Restoring an existing encrypted database requires the same key. Credential values are configured on the services.

## Persistence behavior

The hosted entry restores and integrity-checks the encrypted snapshot before opening the workspace. Successful API writes wait for a committed SQLite snapshot to be uploaded before sending their response. Each upload checks the previous storage ETag, which prevents an older deployment from replacing a newer snapshot.

If persistence fails, API requests receive a storage error and the process restarts to restore the last confirmed snapshot. Hosted snapshots are limited to 40 MiB. The desktop database backup and restore commands remain available for local workspaces.

The deployed storage Worker can be checked at `/health`. Database reads and writes at `/state` require the configured bearer token. The application's readiness endpoint is `/api/health`.

## Verification

- Automated checks cover encryption, committed WAL data, restore integrity, stale writers, response confirmation, failed remote saves, and storage endpoint authentication.
- Public-host checks cover the welcome page and bundled assets, account creation, secure session cookies, inventory and stock writes, read-only role enforcement, and workspace isolation.
- Redeploy verification checks an existing account, session, product, stock quantity, and a fresh sign-in after the new container restores its database.

The root `server.js` remains the entry point for local workspaces. Changes to the storage Worker should be published to the Sites project identified by `hosting/state-store/.openai/hosting.json`.
