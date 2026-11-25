# InvenTrack 3.1.0

Verified on 25 November 2026. The release source is tagged `v3.1.0`.

## Interface and account changes

- Cinematic welcome page with locally bundled warehouse artwork, animated entrances, and retail, wholesale, and operations introductions.
- Sign-in and two-step account creation with password visibility controls and validation. Each new owner receives administrator access to a separate workspace.
- Personalized dashboards for administrators, wholesalers, and read-only retailers, with role-specific priorities and shortcuts.
- Personal account page with workspace details and light or dark appearance preferences saved per user in the current browser.
- Responsive layouts, mobile navigation with a dismissible backdrop, keyboard focus indicators, and reduced-motion support.
- Windows launcher with the same visual direction and account creation through the welcome page in both desktop and browser modes.
- Migration of older SKU and shipment-tracking constraints to workspace-scoped uniqueness. Existing product records, legacy attachment references, and custom indexes are covered by regression checks.

## Verification

- `npm test` passed all 43 tests plus the backend and authentication integration checks.
- `python -m unittest discover -s tests -p report_tool.py` passed both reporting-tool tests.
- Registration checks cover organization isolation, duplicate-account rollback, request-origin restrictions, throttling, persisted profile details, and reuse of a SKU in separate workspaces.
- Disposable Electron UI checks exercised account creation, sign-in errors, inventory forms, a stock movement, persisted stock, all three account roles, appearance preferences, the account page, workspace navigation, and mobile layouts down to 320 pixels.
- The packaged application's main entry passed launcher IPC, first-account creation, authenticated dashboard loading, backup-button availability, and the shared browser URL check. The automated harness kept its windows hidden and captured the browser handoff URL.
- `npm run desktop:make -- --arch=x64` generated the installer and portable ZIP.
- `node tests/package.cjs` checked the packaged runtime, metadata, dependencies, artwork, license notices, and exclusion of runtime databases and development folders. The portable ZIP's application archive was compared with the verified package.

Screenshots in [docs/screenshots](../docs/screenshots/README.md) use disposable verification accounts and inventory. New user workspaces start empty.

## Windows distribution

The installer and portable ZIP are available from the [3.1.0 release page](https://github.com/sgshiv001/inventrack-inventory-management/releases/tag/v3.1.0). Compare downloaded files with [the recorded checksums](../downloads/windows/SHA256SUMS.txt).

The builds are unsigned. Clean-account installation, upgrade, uninstall/data retention, and physical camera decoding still need verification on target Windows machines. Shipment routes use manually entered records.

## Artifact checksums

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `InvenTrack-3.1.0-Setup.exe` | 163037184 | `5A1BA8139F3C235127F82AB7519D91A480E5C0601738A00E1098A767E3800F83` |
| `InvenTrack-win32-x64-3.1.0.zip` | 168087386 | `88106AF2103089F8657C6B8B15EB49024CD19034773732C1265FB1A7935C57DC` |
