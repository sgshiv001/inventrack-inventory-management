# InvenTrack: local operation and commercial launch

## Run on your computer

Install Node.js 24, open this folder in a terminal, and run `node server.js`. If you keep local settings in a `.env` file, use `node --env-file-if-exists=.env server.js`; hosting platforms should provide the same values through their environment configuration.
Open http://localhost:3000. SQLite uses `%LOCALAPPDATA%\InvenTrack\inventrack.db` on Windows, or `$XDG_DATA_HOME/InvenTrack/inventrack.db` (default `~/.local/share/InvenTrack/inventrack.db`) on Linux/macOS. The default keeps runtime data outside this synced repository. On first startup, an existing repository database is copied consistently to that location and checked; the original is retained. No separate database service is required.

For an unprotected academic demo, leave `AUTH_REQUIRED=false`. For a protected pilot, set `AUTH_REQUIRED=true`, `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (at least 12 characters). The first startup creates the bootstrap administrator. Authenticated sessions use HTTP-only cookies, inventory data is scoped to the user's organization, and only administrators or wholesalers can write inventory snapshots.

The Admin insights view records a daily unique visitor pulse through `/api/visits`. It uses a random browser ID, never stores IP addresses, and falls back to a device-local count in the static portfolio demo.

Set `DB_PATH` to an absolute file path on a persistent local disk to choose another database location. Set `PORT` to change the listening port. Runtime databases, WAL files, SHM files, and backups are ignored by Git; clean installations seed demo records automatically.

## Back up and restore

Run `npm run db:migrate` to preserve a legacy repository database in the default data directory. Migration never overwrites an existing destination. Keep the retained legacy copy until you have confirmed your records.

Run `npm run db:backup` to create a timestamped, integrity-checked SQLite snapshot in the data directory's `backups` folder. This uses `VACUUM INTO` and includes committed WAL data even when the database is live. To choose an output path, use `npm run db:backup -- C:/Backups/inventrack-2026-09-26.db`.

Restore to a new, unused file with `npm run db:restore -- <backup.db> <new-destination.db>`. The tool refuses to overwrite files. Check the restored records, stop the app server, and restart it with `DB_PATH` pointing to that restored file. Do not copy only the main database file while the app is running. Store a separate backup copy outside the machine for recovery from disk failure.

For a split frontend/API deployment, copy `.env.example`, set `CORS_ORIGIN` on the API, and set `window.INVENTRACK_API_BASE` in `runtime-config.js` to the API origin. Leave it blank when the frontend and API share one domain.

## Access from other places with a domain

A domain is the address; a hosted Node server runs the application when your PC is off. The hosted database is a separate database from your local development copy. The current version does not automatically synchronize them.

One deployment path is a Render Node Web Service:

1. Push the reviewed project to your Git repository and connect it to a new Node Web Service.
2. Use Node 24, build command `node --check server.js`, and start command `node server.js`.
3. Attach a persistent disk mounted at `/var/data` and set `DB_PATH=/var/data/inventrack.db`. SQLite requires persistent storage; the default ephemeral filesystem loses changes on redeploy/restart.
4. Set the health-check path to `/api/health`. Initially test with demo data only.
5. Buy a domain you choose. Add it under the hosting service's custom-domain settings and copy the requested DNS records into your domain registrar's DNS settings. Verify the domain and HTTPS before sharing it.
6. Set up database backups, restore tests, uptime monitoring and error alerts before accepting customer data.

Official instructions: [Node web services](https://render.com/docs/web-services), [persistent disks](https://render.com/docs/disks), [custom domains](https://render.com/docs/custom-domains).

No hosting account, paid service or domain has been purchased or deployed by this update.

## Before charging customers

This is a single-organization pilot foundation, not a finished self-service subscription service. Authentication and server-side role enforcement are available when enabled, but there is no user-management screen, password recovery, billing integration, or multi-organization onboarding. Do not put real customer data on a public deployment until the hosting, backup, privacy, and support controls below are in place.

Implement and test these before a broader launch:

- User registration, password recovery, account lockout/rate limiting, and a managed identity provider.
- A tested organization provisioning flow and ownership checks for every new endpoint.
- Expand the dedicated stock and purchase-order operations to partial receipts, returns, and shipment-linked fulfilment; move remaining catalogue and logistics writes away from whole-snapshot saves.
- Subscription checkout, verified payment webhooks, invoices, cancellation and access controls tied to billing state.
- Backups, monitoring, support procedures and a tested export/restore process.
- Your actual sales/delivery records. Globe regions are demo data; market value is quantity times asking price, not realized sales.

For a first commercial pilot, use one separately deployed instance per company with `AUTH_REQUIRED=true`. A shared subscription product should add a full organization provisioning and membership model and typically use hosted PostgreSQL. Those broader account and billing changes are future work.

## Ways to earn revenue

Offer a setup/onboarding service and a recurring support/hosting plan to a small number of local distributors. Agree on features and support hours, demonstrate with their sample catalogue, and validate willingness to pay before setting a price. Track hosting, backup, payment-processing and support costs. Build billing automation after the first pilots establish what customers actually need. Income is not guaranteed by deploying a website.
