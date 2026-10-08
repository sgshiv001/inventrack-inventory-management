# InvenTrack production checklist

InvenTrack 3.0.4 supports real single-organization inventory operations on Windows and through its local Node.js web server. The selected scope is local PC only, with no new public hosting. Passing automated tests is not a guarantee of deployment-specific readiness. See [the 3.0.3 verification report](../reports/RELEASE-3.0.3.md) for prior lifecycle evidence and [the 3.0.4 report](../reports/RELEASE-3.0.4.md) for the latest changes and checks.

## Already ready

- Responsive dashboard with products, suppliers, shipments, analytics, assistant, audit log, and interactive WebGL Earth.
- Node.js HTTP API with SQLite persistence, validation, transactions, revision conflict protection, dedicated stock movements and purchase orders, and a health endpoint.
- Mandatory scrypt-backed login, HTTP-only sessions, server-side role checks, organization-scoped records, login throttling, and administrator-managed accounts.
- Visitor pulse endpoint with daily de-duplication and no IP-address storage.
- Windows launcher with desktop/browser choice, installer and portable ZIP builds, and workspace backups that preserve legacy attachments. The optional product-model viewer is removed. New workspaces start empty; static frontend hosting requires the API.

## Required before a paid pilot

1. **Production database:** run the API on a host with persistent storage, or migrate the adapter to managed PostgreSQL. Enable daily backups and test a restore.
2. **Account administration:** built-in administrator-created accounts support a protected single-company deployment. Add recovery, invitations, and managed identity before self-service onboarding.
3. **Organization onboarding:** provide a tested company provisioning and membership flow; keep ownership checks on every new endpoint.
4. **API deployment:** deploy `server.js` with `HOST=0.0.0.0`, a persistent `DB_PATH` when using SQLite, and `CORS_ORIGIN` only when the frontend is on another origin. Keep `runtime-config.js` pointed at the API origin.
5. **Domain and HTTPS:** attach a domain in the hosting provider, configure DNS, and confirm HTTPS before sharing the app with customers.
6. **Privacy and support:** publish a privacy notice, retention policy, support email, export/delete process, and incident contact. The visitor counter should remain opt-in or be disclosed according to the chosen jurisdiction.
7. **Billing and operations:** add payment handling only after validating a pilot customer. Define backups, monitoring, error alerts, support hours, and an SLA.

## Suggested pilot path

Start with one distributor using a separate staging workspace. Import their catalogue, verify physical stock, reorder and shipment workflows, and test backup recovery before accepting live operations.

## Windows distribution

Test installer installation, shortcuts, upgrades, uninstall/data retention, portable extraction, graphics, exports, and camera/barcode support on clean target Windows machines. The current builds are unsigned; configure code signing before broad distribution. The portable build uses per-user data storage, not the ZIP directory.

## Split-host configuration

The browser reads `window.INVENTRACK_API_BASE` from `runtime-config.js`. Leave it blank for same-origin hosting. For a separate frontend and API, set it to the API origin and set the API's `CORS_ORIGIN` to the exact frontend origin. Do not place database passwords or API tokens in this file.
