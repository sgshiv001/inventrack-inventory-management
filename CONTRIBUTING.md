# Contributing to InvenTrack

Use [the build guide](docs/BUILDING.md) to install locked dependencies and choose the Windows launcher or local server. The repository contains the runtime source, tests, release notes, and hosting configuration. Published Windows downloads are attached to release tags.

## Working on a change

1. Start from an updated checkout and create a branch for one concrete change.
2. Reproduce the problem with a disposable workspace and record the affected mode: website, Windows online, local Windows, or local browser.
3. Keep the change focused. Include a regression check when behavior, data integrity, or account boundaries change. For documentation-only work, verify commands and links against the owning files.
4. Update related documentation when setup, user-visible behavior, or deployment requirements change.

The API requires authentication. New welcome-page registrations create separate workspaces. Use test accounts and a separate database when developing. Set `DB_PATH` for a standalone server or `INVENTRACK_DESKTOP_DB` for the launcher to choose a disposable local database. Existing user databases should remain intact.

## Checks before a pull request

```powershell
npm test
python -m unittest discover -s tests -p report_tool.py
git diff --check
```

Explain which checks you ran and their results. Desktop window behavior also needs launcher verification. A new Windows distribution needs a fresh Forge build followed by `node tests/package.cjs`; see [the release checks](docs/BUILDING.md#windows-distribution).

When editing browser source or bundled assets, run `npm run build:web` to regenerate `dist/`. The test command also builds it automatically, and static checks compare the result with its source. Changes to authentication, roles, or inventory writes should preserve organization boundaries and revision conflict handling.

## What belongs in a commit

Commit source, relevant tests, documentation, and intentional public assets. Keep runtime databases, snapshots, `.env` values, API keys, session cookies, generated installers, and unrelated local reports out of Git. Inspect `git diff --cached` before committing. Release assets belong in GitHub Releases.

Describe the concrete problem and resulting behavior in the pull request. Include short reproduction steps or screenshots when they help a reviewer, using disposable data. Record target-machine checks that remain outstanding.

## Deployment and releases

GitHub checks validate pushes and pull requests. Website deployment remains manual through Render. A source commit does not update an existing Windows installation; versioned installer and portable assets must be built and published for a Windows release.

See [HOSTING.md](docs/HOSTING.md) for the website and storage workflow, [LAUNCH.md](LAUNCH.md) for backups and recovery, and [the Windows download guide](downloads/windows/README.md) for distribution instructions.
