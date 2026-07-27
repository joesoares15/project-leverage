# Sprint 1 cleanup summary

## What changed

- Split the single browser script into service, domain, UI, research, state, configuration, and orchestration modules.
- Split the single stylesheet into base, reusable component, and feature stylesheets.
- Added a first-pass portfolio engine and cross-league exposure panel.
- Removed the unused strategy selector, which previously changed no calculations.
- Renamed league-detail language from definitive contender status to provisional roster assessment.
- Escaped external manager, player, team, and league names before inserting them into generated HTML.
- Versioned the browser cache and service-worker cache to prevent stale prototype code from loading.
- Added service-worker cleanup for previous cache versions.
- Added JavaScript syntax checks to both GitHub Actions workflows.
- Added an architecture document and repository `.gitignore`.

## Behavior intentionally preserved

- Sleeper import and the seven configured league IDs.
- DynastyProcess as the current market-value reference.
- Existing provisional team assessment formula.
- Existing provisional trade-idea algorithm.
- Current-leaguemate filtering in manager profiles.
- PL-001 bundled-data research controls and results.

## Validation completed

- Python compilation succeeded.
- Existing Python unit tests passed: 3/3.
- Every JavaScript module passed `node --check`.
- All HTML stylesheet/script references and JavaScript relative imports resolve to files in the package.

The placeholder `site/data/anyrbona53.json` intentionally contains no studies in the downloaded repository. The GitHub deployment workflow rebuilds it from nflverse before publishing the site.
