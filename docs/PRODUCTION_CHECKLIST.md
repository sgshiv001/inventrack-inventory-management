# InvenTrack production checklist

This project is a strong MCA portfolio release and a working local management system. Use this checklist before putting real company data into a commercial deployment.

## Already ready

- Responsive dashboard with products, suppliers, shipments, analytics, assistant, audit log, and interactive WebGL Earth.
- Node.js HTTP API with SQLite persistence, validation, transactions, revision conflict protection, and a health endpoint.
- Visitor pulse endpoint with daily de-duplication and no IP-address storage.
- Static portfolio deployment with seeded demo data, GitHub releases, architecture notes, and automated backend tests.

## Required before a paid pilot

1. **Production database:** run the API on a host with persistent storage, or migrate the adapter to managed PostgreSQL. Enable daily backups and test a restore.
2. **Authentication:** add a confirmed identity provider and enforce roles on the server. The current role selector is a presentation preference, not security.
3. **Organization isolation:** add an organization/company ID to every business table and verify ownership in every read and write endpoint.
4. **API deployment:** deploy `server.js` with `HOST=0.0.0.0`, a persistent `DB_PATH` when using SQLite, and `CORS_ORIGIN` only when the frontend is on another origin. Keep `runtime-config.js` pointed at the API origin.
5. **Domain and HTTPS:** attach a domain in the hosting provider, configure DNS, and confirm HTTPS before sharing the app with customers.
6. **Privacy and support:** publish a privacy notice, retention policy, support email, export/delete process, and incident contact. The visitor counter should remain opt-in or be disclosed according to the chosen jurisdiction.
7. **Billing and operations:** add payment handling only after validating a pilot customer. Define backups, monitoring, error alerts, support hours, and an SLA.

## Suggested pilot path

Start with one distributor using a separate deployment and demo dataset. Import their catalogue, verify reorder and shipment workflows, collect feedback for two weeks, and only then decide whether a shared multi-tenant subscription is justified.

## Split-host configuration

The browser reads `window.INVENTRACK_API_BASE` from `runtime-config.js`. Leave it blank for same-origin hosting. For a separate frontend and API, set it to the API origin and set the API's `CORS_ORIGIN` to the exact frontend origin. Do not place database passwords or API tokens in this file.
