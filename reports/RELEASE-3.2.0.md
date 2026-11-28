# InvenTrack 3.2.0

Verified on 28 November 2026. Release source is tagged `v3.2.0`.

## Connected Windows workspace

- **Online workspace** opens the official HTTPS service in a sandboxed desktop window. Website and Windows users sign in to the same hosted accounts and inventory.
- Dedicated persistent online session, with separate local accounts and databases. Local records are not automatically uploaded or merged.
- The two existing modes are labeled **Local Windows app** and **Local browser**. Local backup remains available as **Back up local workspace**.
- Switching online/local replaces the workspace window, retains each session, and scopes navigation, CSV downloads, and prompted camera access to the active window and origin.
- Packaging excludes project reports, presentation files, preview artifacts, databases, environment files, and development folders.

## Verification

- `npm test` passed all 50 tests plus backend and authentication integration checks.
- `python -m unittest discover -s tests -p report_tool.py` passed both reporting-tool tests.
- New launcher regression checks cover online launch without starting a local server, mode switching, session isolation, navigation restrictions, online CSV downloads, and camera permission scope.
- Hidden Electron verification exercised real launcher IPC, local registration, authenticated dashboard, local backup availability, and browser handoff.
- A disposable account registered through the live website signed into the Windows online window. A desktop-created product appeared to an independent website session, and a website stock movement appeared to the desktop client.
- A real online CSV export completed in Electron and contained the verified product. Online and local sign-ins survived switching between workspaces. Online content had no Node.js or launcher bridge access.
- `npm run desktop:make -- --arch=x64` generated the installer and portable ZIP. `node tests/package.cjs` verified exact runtime sources, metadata, dependencies, artwork, and an allowlist of runtime package roots. Unrelated report and presentation folders are excluded.
- The packaged application's main entry passed the local launcher and account flow. The online connection flow also passed against the packaged desktop entry.

## Distribution

The installer and portable ZIP are available from the [3.2.0 release page](https://github.com/sgshiv001/inventrack-inventory-management/releases/tag/v3.2.0). Compare downloads with [SHA256SUMS.txt](../downloads/windows/SHA256SUMS.txt).

The builds are unsigned. Clean-account installation, upgrade, uninstall/data retention, and physical camera decoding still require target-machine verification. The free online host may take about a minute to wake after inactivity. Appearance preferences are stored separately by browser or desktop session. Inventory refreshes when loaded or after an action; there is no live push subscription or offline synchronization queue.

## Artifact checksums

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `InvenTrack-3.2.0-Setup.exe` | 163046400 | `94BFFAAB7146333195E8DB3F16004DE51D2A56DA01C18D4D49E0954F86F0C87C` |
| `InvenTrack-win32-x64-3.2.0.zip` | 168089054 | `13E82EB1261C3B70505D935583477B17E2C9524F42AEEE0106EA63ADB71890CD` |
