# Architecture

The website is a static GitHub Pages application. No JavaScript build step is required.

## Data flow

```text
Sleeper API + DynastyProcess values
        ↓
service modules (`site/js/services`)
        ↓
domain modules (`site/js/domain`)
        ↓
normalized league, player, portfolio, and manager objects
        ↓
UI modules (`site/js/ui`)
```

PL-001 is built separately by Python during GitHub Actions. The browser reads the bundled `site/data/anyrbona53.json` file through `site/js/lab.js`.

## Responsibilities

- `config.js`: user-specific identifiers, URLs, and cache version.
- `state.js`: current in-browser application state.
- `services/`: external data access only.
- `domain/`: calculations and normalized internal models; no DOM access.
- `ui/`: HTML rendering and event-facing presentation.
- `lab.js`: PL-001 dataset loading and research rendering.
- `app.js`: orchestration, caching, refresh, and event wiring.

## Guardrails

- Raw Sleeper responses should not be rendered directly.
- Domain modules should not access the DOM.
- UI modules should not fetch remote data.
- New research studies should use bundled, versioned datasets.
- Current-market values remain market references, not intrinsic roster truth.
