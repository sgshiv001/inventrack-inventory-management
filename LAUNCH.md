# InvenTrack: local operation and commercial launch

## Run on your computer

Install Node.js 24, open this folder in a terminal, and run `node server.js`. If you keep local settings in a `.env` file, use `node --env-file-if-exists=.env server.js`; hosting platforms should provide the same values through their environment configuration.
Open http://localhost:3000. SQLite creates and uses `data/inventrack.db` on this computer. No separate database service is required. The header reports whether the database is connected or whether changes were saved. Product updates are stored in `release_log`; browser workspace activity remains local to that browser.

For an unprotected academic demo, leave `AUTH_REQUIRED=false`. For a protected pilot, set `AUTH_REQUIRED=true`, `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (at least 12 characters). The first startup creates the bootstrap administrator. Authenticated sessions use HTTP-only cookies, inventory data is scoped to the user's organization, and only administrators or wholesalers can write inventory snapshots.

The Admin insights view records a daily unique visitor pulse through `/api/visits`. It uses a random browser ID, never stores IP addresses, and falls back to a device-local count in the static portfolio demo.

Set `DB_PATH` to an absolute file path to choose a different database location. Set `PORT` to change the listening port. Use a local disk, not a network-synced folder. For a simple backup, stop the server cleanly and copy the entire `data` directory to a dated backup folder. Test restoring a copy before relying on backups. Never commit a customer database to Git.

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
- Server-side operations for stock-in/out and immutable audit records instead of replacing the entire inventory snapshot.
- Subscription checkout, verified payment webhooks, invoices, cancellation and access controls tied to billing state.
- Backups, monitoring, support procedures and a tested export/restore process.
- Your actual sales/delivery records. Globe regions are demo data; market value is quantity times asking price, not realized sales.

For a first commercial pilot, use one separately deployed instance per company with `AUTH_REQUIRED=true`. A shared subscription product should add a full organization provisioning and membership model and typically use hosted PostgreSQL. Those broader account and billing changes are future work.

## Ways to earn revenue

Offer a setup/onboarding service and a recurring support/hosting plan to a small number of local distributors. Agree on features and support hours, demonstrate with their sample catalogue, and validate willingness to pay before setting a price. Track hosting, backup, payment-processing and support costs. Build billing automation after the first pilots establish what customers actually need. Income is not guaranteed by deploying a website.
