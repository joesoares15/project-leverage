# Project Leverage

Project Leverage is a personal dynasty-fantasy research and decision platform. It combines Sleeper league analysis with transparent, versioned research into unconventional roster construction.

## Working model

GitHub is the permanent home for:

- Source code
- Research methods
- Historical versions
- Automated tests
- Data building
- Website hosting through GitHub Pages

After the one-time setup, approved changes committed to `main` are tested, rebuilt, and published automatically. See:

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — one-time click-by-click setup
- [OWNER_GUIDE.md](OWNER_GUIDE.md) — ongoing collaboration and release workflow
- [CHANGE_REQUEST_TEMPLATE.md](CHANGE_REQUEST_TEMPLATE.md) — optional structure for larger requests
- [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) — active work and research backlog

## Current release

### League dashboard

- Imports the seven configured Sleeper leagues in one refresh.
- Reads league settings, rosters, managers, traded picks, and available draft history.
- Treats DynastyProcess values as a market-price reference.
- Builds current-leaguemate profiles from startup and rookie drafts across shared league chains.
- Excludes managers who are no longer in any current shared league.

### PL-001 — AnyRBOnA53 weekly utility

PL-001 asks:

> How often do lower-ranked RBs create usable RB24+ weeks, how does that compare with lower-ranked WRs, and which pre-kickoff opportunity signals are associated with those weeks?

The study supports multiple season windows, scoring formats, RB cohorts, and WR comparison cohorts.

Signals currently include recent workload, workload acceleration, receiving involvement, teammate injury status, and role-weighted estimated vacated backfield opportunity.

The website reads a bundled `site/data/anyrbona53.json` generated before deployment. It does not fetch historical NFL data from the browser.

## Research boundaries

- Cohorts currently use **prior-season positional finish**, not historical preseason ADP.
- RB24+ and WR36+ are generic first-pass definitions of a usable week.
- Opportunity Delta is a transparent descriptive rules score, not yet a calibrated prediction.
- Results must pass season-based holdout tests before being treated as predictive.
- Methodology changes must be versioned rather than silently rewriting old studies.

## Repository layout

```text
site/index.html               GitHub Pages entry point
site/css/                     base, component, and feature styling
site/js/services/             external API access
site/js/domain/               league, player, portfolio, and manager logic
site/js/ui/                   DOM rendering
site/js/app.js                application orchestration
site/js/lab.js                PL-001 research UI
site/data/                    bundled research output
scripts/                      PL-001 data build and validation
notebooks/                    Colab fallback/debug path
docs/ARCHITECTURE.md          module boundaries and data flow
.github/workflows/            tests, data build, and Pages deployment
tests/                        offline unit tests
```

## Cost policy

The current system is designed for GitHub’s free repository, Pages, and Actions allowances, plus free Sleeper and nflverse data. No paid dependency should be introduced without explicit owner approval.

## Data sources and licensing

The data pipeline uses `nflreadpy` to load nflverse data. Preserve source attribution and applicable licenses when redistributing research outputs.
