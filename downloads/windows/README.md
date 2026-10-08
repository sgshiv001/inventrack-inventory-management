# InvenTrack Windows downloads

Version: 3.0.4. Platform: Windows x64. The desktop runtime is included; Node.js is only needed for source development or the standalone web server.

## Download

- [Installer: InvenTrack-3.0.4-Setup.exe](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.0.4/InvenTrack-3.0.4-Setup.exe)
- [Portable: InvenTrack-win32-x64-3.0.4.zip](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.0.4/InvenTrack-win32-x64-3.0.4.zip)
- [Download checksums](https://github.com/sgshiv001/inventrack-inventory-management/releases/download/v3.0.4/SHA256SUMS.txt), also recorded in [SHA256SUMS.txt](SHA256SUMS.txt)
- [Release page](https://github.com/sgshiv001/inventrack-inventory-management/releases/tag/v3.0.4)

The executables are distributed as GitHub Release assets because their sizes exceed GitHub's ordinary Git file limit. This folder contains the download links and integrity information, not an incomplete standalone launcher executable. **Code > Download ZIP** downloads source code, not the packaged Windows app.

## Run and demonstrate

1. Install using the installer, then open **InvenTrack** from the Start menu. Alternatively, extract the entire portable ZIP to a writable local folder and run `InvenTrack.exe` there; do not copy only the executable.
2. On first use, enter your organization, administrator email, and a password of at least 12 characters. Keep these credentials safe; password recovery is not included.
3. Choose **Windows app** for the dedicated application window, or **Web browser** for the same local workspace in your browser. Sign in with the account you created.
4. New workspaces are empty. Add a supplier and product through the normal forms or import your own CSV, then demonstrate stock movements, the ledger, reorder planning, and CSV export. No demonstration records are preloaded.
5. Keep the launcher open while using browser mode. It runs the local server on this PC only. Use **Back up workspace** before relying on the app for important records.

These builds are unsigned. Windows may warn about an unverified publisher; no code-signing identity or clean-machine compatibility claim is made. Installer and portable UI checks on the development PC are documented in the [verification report](../../reports/RELEASE-3.0.4.md). Physical camera barcode decoding and clean-machine behavior remain unverified. Recorded shipment routes are manual records, not live carrier tracking.

## Integrity

The Windows binaries were built from application source commit `5f9d699461dade78338ff421198640f088addf2d`. Later documentation-only commits add these download instructions without changing that application runtime.

Use PowerShell to calculate the downloaded file's hash, then compare it with [SHA256SUMS.txt](SHA256SUMS.txt):

```powershell
Get-FileHash -LiteralPath '.\InvenTrack-3.0.4-Setup.exe' -Algorithm SHA256
```
