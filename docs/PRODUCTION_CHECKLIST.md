# InvenTrack production checklist

InvenTrack 3.2.0 supports online and local inventory operations with separate organization-scoped workspaces on Windows and through its Node.js web server. The [3.2.0 verification report](../reports/RELEASE-3.2.0.md) records the current checks and target-machine verification still needed. Earlier reports retain the results from those releases.

## Already ready

- Responsive dashboard with products, suppliers, shipments, analytics, audit log, and interactive WebGL Earth.
- Node.js HTTP API with SQLite persistence, validation, transactions, revision conflict protection, dedicated stock movements and purchase orders, and a health endpoint.
- Mandatory scrypt-backed login, HTTP-only sessions, server-side role checks, organization-scoped records, login throttling, and administrator-managed accounts.
- Welcome-page workspace creation, retail/wholesale/operations business types, role-specific dashboards, and personal account appearance preferences.
- Visitor pulse endpoint with daily de-duplication and no IP-address storage.
- Windows launcher with online, local desktop, and local browser choices, installer and portable ZIP builds, and workspace backups that preserve legacy attachments. The optional product-model viewer is removed. New workspaces start empty; static frontend hosting requires the API.

## Required before a paid pilot

1. **Production database:** run the API on a host with persistent storage, or migrate the adapter to managed PostgreSQL. Enable daily backups and test a restore.
2. **Account administration:** workspace owners create team accounts and assign roles. Customer deployments also need account recovery, invitations, and managed identity appropriate to their access model.
3. **Organization onboarding:** test workspace provisioning and administrator-managed membership with the target users. Preserve organization boundaries on every new endpoint.
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
