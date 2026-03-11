# Upstream Tracking

Tracks divergence from upstream `fluxerapp/fluxer` to ensure critical fixes are not missed.

## Upstream Remote

- Repository: `fluxerapp/fluxer`
- Branch tracked: `refactor`
- Our branch: `migrate`

## Last Checked

- **Date**: 2026-02-27
- **Upstream HEAD at check**: (record commit hash after check)

## Ported Fixes

| Upstream Commit | Description | Ported In | Status |
|---|---|---|---|
| (refactor branch) | DoS hardening for REQUEST_GUILD_MEMBERS gateway opcode | migrate branch, 2026-02-27 | Ported |
| (refactor branch) | Memory leak fixes: ClamAV timeout, GatewayService pending request timeout, Redis listener cleanup, ReportService interval, graceful shutdown | migrate branch, 2026-02-27 | Ported |

## Skipped / Not Applicable

| Upstream Commit | Description | Reason |
|---|---|---|
| (none yet) | | |

## How to Check for New Upstream Changes

1. Add upstream remote if not already added:
   ```bash
   git remote add upstream https://github.com/fluxerapp/fluxer.git
   ```

2. Fetch latest:
   ```bash
   git fetch upstream
   ```

3. Compare branches:
   ```bash
   git log upstream/refactor --oneline --not migrate
   ```

4. For each new commit, review the diff and decide:
   - **Port**: Apply the fix to our codebase
   - **Skip**: Document why in the "Skipped" table above

5. Update this file with the results.

## Key Differences from Upstream

- Our project uses `backend/` path (upstream uses `fluxer_api/`)
- Gateway uses `#state` record (upstream uses maps)
- Branding: Floodilka vs Fluxer (code paths, config, domains)
