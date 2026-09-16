# Portfolio demonstration guide

## What to show in two minutes

1. Start on **Dashboard** and point out stock health, cost value, market value, and low-stock alerts.
2. Open **Shipping & tracking**. Select `IT-2026-1042` to show the route map and event timeline.
3. Use **Advance status** to move a shipment from pending or in transit to its next state.
4. Open **Admin insights** to connect shipment destinations with the sales-region globe.
5. Ask the assistant: `Which shipments are active?` or `What needs reordering?`
6. Open **Log book** to show the release history and workspace activity.

## Why this is a good MCA project

- It demonstrates a complete information-system flow: catalogue, stock ledger, partner records, shipping activity, analytics, and audit history.
- It makes the database visible through a clear relational schema and transactional save path.
- It shows practical safeguards such as duplicate-SKU validation, overdraft protection, stale-write detection, and safe static-file serving.
- The interface is intentionally readable and responsive instead of being a collection of disconnected charts.

## What is intentionally out of scope

This is a portfolio and academic demonstration, not a production SaaS product. The role selector is a workspace simulation, customer authentication is not enabled, and the local Node.js server uses SQLite. Those constraints are documented honestly so the next production steps are easy to discuss.

## Suggested GitHub presentation

- Put the live demo link near the top of the repository description.
- Keep the two interface previews visible in the README.
- Pin this repository and add the technology stack to your profile README.
- Use the architecture page during a viva or interview to explain the request, validation, transaction, and response flow.
- Mention that shipment records and events are seeded for a repeatable demo; they are not real customer or carrier data.
