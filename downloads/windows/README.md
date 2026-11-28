# InvenTrack Windows downloads

InvenTrack 3.2.0 for Windows x64 includes its desktop runtime. Node.js is needed for source development and the standalone web server.

## Download

- [Windows installer](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.2.0/InvenTrack-3.2.0-Setup.exe)
- [Portable ZIP](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.2.0/InvenTrack-win32-x64-3.2.0.zip)
- [Download checksums](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.2.0/SHA256SUMS.txt), also recorded in [SHA256SUMS.txt](SHA256SUMS.txt)
- [Release page](https://github.com/sgshiv001/inventrack-inventory-management/releases/tag/v3.2.0)

The executables are distributed as GitHub Release assets because their sizes exceed GitHub's ordinary Git file limit. This folder contains the download links and integrity information, not an incomplete standalone launcher executable. **Code > Download ZIP** downloads source code, not the packaged Windows app.

## Run and demonstrate

1. Install using the installer, then open **InvenTrack** from the Start menu. Alternatively, extract the entire portable ZIP to a writable local folder and run `InvenTrack.exe` there; do not copy only the executable.
2. Choose **Online workspace** to share the website's accounts and inventory across devices. Choose **Local Windows app** or **Local browser** for a separate workspace on this computer. All modes open the welcome page.
3. Sign in to an existing account or choose **Create your workspace**. Enter your name, email, a password of at least 12 characters, workspace name, and retail, wholesale, or operations business type. New workspace owners have administrator access. Team members use administrator-created accounts with assigned roles. Keep your credentials safe.
4. New workspaces are empty. Add a supplier and product through the normal forms or import your own CSV, then demonstrate stock movements, the ledger, reorder planning, and CSV export. No demonstration records are preloaded.
5. Keep the launcher open while using local browser mode. It runs the local server on this PC only. Use **Back up local workspace** before relying on the app for important records.

The builds are unsigned. Windows may show a publisher warning. Automated checks, responsive UI checks, and the packaged launcher flow are recorded in the [3.2.0 verification report](../../reports/RELEASE-3.2.0.md). Clean-account installation, upgrade, uninstall, and physical camera decoding still need target-machine verification. Shipment routes reflect manually entered records.

## Integrity

The Windows binaries correspond to application version 3.2.0 and the `v3.2.0` release tag. Published checksums cover the installer and portable ZIP.

Use PowerShell to calculate the downloaded file's hash, then compare it with [SHA256SUMS.txt](SHA256SUMS.txt):

```powershell
Get-FileHash -LiteralPath '.\InvenTrack-3.2.0-Setup.exe' -Algorithm SHA256
```
