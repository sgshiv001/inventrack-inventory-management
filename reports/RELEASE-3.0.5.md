# InvenTrack 3.0.5 — local workspace cleanup

Date: 8 October 2026.

## Changes

- Removed the floating chat panel, its reply logic, event handlers, and styles from the operational frontend and matching static bundle.
- Removed the issue-summary workflow and obsolete hosting manifest. The normal test workflow remains.
- Retired screenshots of the old interface and hosting-folder listing; previous test reports retain their historical results without broken screenshot links.
- Identified the repository owner, Shivanshu Gupta, in the project introduction and Windows package author metadata. Required third-party license notices remain intact.
- Kept Windows and local browser modes, inventory operations, authentication, database backups, and the recorded-delivery globe.
- Replaced named development-folder packaging exclusions with a general hidden-file exclusion and excluded the download-documentation folder from the runtime.

## Verification

- `npm test`: PASS, 42 tests plus backend and authentication integration checks.
- `python -m unittest discover -s tests -p report_tool.py`: PASS, 2 tests.
- Frontend source and static copies match; retired chat controls and handlers are absent.
- GitHub repository website field is empty. The obsolete hosted site was already restricted to its owner, with no other viewers or editors and no schedules; no public deployment was performed.
- Removed obsolete live-demo links from the 2.2.0, 2.3.0, 2.4.0, and 2.5.0 release notes while preserving their other notes, assets, and tags. Release-note scanning found no removed-provider references afterward.

- `npm run desktop:make`: PASS, Windows x64 installer and portable ZIP generated.
- `node tests/package.cjs`: PASS, packaged runtime matches source and metadata, includes required runtime dependencies and license notices, and excludes private/development files and download documentation.
- Tracked first-party text scan found no removed provider names or hosted-demo links. The operational runtime has no chat controls or handlers.
- [GitHub test workflow](https://github.com/sgshiv001/inventrack-inventory-management/actions/runs/37759632980) for source commit `0025524887d49253773f33421a23f1c3105e6b21`: PASS.
- Version 3.0.5 installer, portable ZIP, and checksum file were published as GitHub Release assets. Server-reported sizes and SHA-256 digests match local files; public download links return HTTP 200. The `v3.0.5` tag points to the source commit above.

The earlier release reports remain historical evidence, not fresh 3.0.5 UI tests. This release does not claim a new installed-window or portable-window end-to-end UI test.

## Windows artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `InvenTrack-3.0.5-Setup.exe` | 162816000 | `63077E92C979FC843E28BF5CBE68D2F5351F59156DFF59D96E369455E688FB91` |
| `InvenTrack-win32-x64-3.0.5.zip` | 167859874 | `76948B8811505925F2F064BBDECDDD493327147F8FA9A5520DA7986FBDDD5FE8` |
| `app.asar` | 20868391 | `BEC66260AF46E546F076B722B442A7A83A6EF6C3DA2D31187C2F8E9F229A0A15` |

## Boundaries

The app remains local-only and starts with an empty workspace. Existing databases were not modified. Builds remain unsigned. Clean-machine compatibility and physical camera barcode decoding are not newly verified. Shipment routes are manual records, not live carrier tracking. Git history and previous release tags have not been rewritten.
