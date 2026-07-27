# Portfolio Engine v1 — implementation notes

## Scope

This change implements a league-first portfolio model. Each league is analyzed independently; a small cross-league summary is derived only after the league portfolios exist.

## Included

- Pure `PortfolioEngine` with no network or DOM dependencies.
- League roster summary:
  - player count
  - average age
  - position counts and market-value allocation
  - NFL-team counts
  - top-three and top-five market-value concentration
- Individual future-pick ledger derived from Sleeper traded-pick ownership.
- Draft-capital matrix by league and year.
  - `3 (1)` means three picks owned, including one original pick.
- Expandable pick details showing pick and original owner.
- Cross-league player exposure formatted as `3 of 7`.
- Data-quality warnings for missing ages and unmatched market values.
- JavaScript unit and syntax tests in GitHub Actions.

## Explicitly deferred

- Asset timeline visualization.
- Pick waterfall visualization.
- Trade-flexibility score.
- Intrinsic player valuation.
- Portfolio-wide recommendations.

## Data rule

Analyze locally, summarize globally.

## Manual acceptance test

1. Refresh all Sleeper data.
2. Open each league.
3. Confirm a League portfolio panel appears.
4. Confirm each draft-capital cell uses `total (original)`.
5. Click a non-zero cell and confirm original owners are listed.
6. Verify a traded-away original pick is not counted as owned.
7. Verify an acquired pick is counted but not included in the parenthetical number.
