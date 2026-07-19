# Learning Globe — Decision Log

## Technical stack (decided 2026-07-19, committed — do not re-litigate)

- **Vite + React 18 + TypeScript (strict)** — fast dev loop, component model for the many UI surfaces (HUD, settings, passport, leaderboard), TS for safety across the geo math.
- **d3-geo + HTML canvas** for all map/globe rendering. Chosen over MapLibre/Globe.gl/three.js because:
  - One projection API covers the 3D globe (orthographic) *and* multiple flat projections (Natural Earth, Equal Earth, Mercator) — switching is a settings toggle, no dual engines.
  - `geoContains` gives point-in-country hit-testing with no tile server, no API key, no network.
  - Canvas 2D easily hits 60fps for 177 generalized country polygons on mobile.
- **Natural Earth 1:110m admin-0 countries** (vendored at `public/data/world.json`, prepared by `scripts/prepare-data.mjs`). Generalized borders deliberately satisfy the "borders should not be represented precisely" requirement. We follow Natural Earth's de-facto standard for what is a country; entities without an ISO code (N. Cyprus, Somaliland) render as land but are excluded from the quiz pool to stay neutral. Antarctica renders but is not quizzed.
- **Capitals** merged at build time from restcountries.com into the same vendored file. No runtime network calls anywhere.
- **WebAudio-synthesized SFX** (no audio assets), **localStorage** persistence (settings, passport, leaderboard, lifetime stats), **@fontsource** bundled fonts (no CDN fonts).
- No state library — React `useReducer` + context is enough.

## Design language

- Palette is the user-supplied "Deep Blue Sea" scheme (see design.md): Prussian Blue `#0b132b` ocean/app bg, Space Indigo `#1c2541` panels, Dusk Blue `#3a506b` land, Tropical Teal `#5bc0be` primary accent, Aquamarine `#6fffe9` success/glow, silver-white text. Two semantic additions: coral `#ff7a6b` for misses (the one warm counterpoint, still ocean-vocabulary) and sand-gold `#ffd97a` reserved for discoveries only.
- Type: **Baloo 2** (chunky, rounded display — legible for young players) + **Nunito** (body/UI). All display text lives in `src/content/strings.ts`; all colors/spacing in CSS custom properties in `src/styles/theme.css`.
- **Signature interaction: sonar ping.** Every pin drop ripples like sonar — aquamarine rings for a correct guess, coral for a miss. The map is dark ocean; feedback is light.

## Game design

- Core loop: prompt shows a country name → player drops a pin → anywhere inside the country counts as correct (forgiving, per spec). Proximity to the country's centroid scales the final 10% of the score.
- Scoring (cookie-clicker curve, per spec): base 1,000 × streak multiplier `2^min(streak,11)` × accuracy (0.90–1.00) × speed bonus (×1.5 under 4s, ×1.25 under 9s) × attempt penalty (½ per retry) × hint penalty (×0.7 each). Perfect runs reach the millions.
- 3 attempts per country (configurable 1–3); misses show great-circle distance + compass direction ("warmer/colder"); exhausting attempts reveals the country and resets the streak.
- **Discoveries**: first-ever correct guess of a country stamps it into the persistent Passport (+50,000 bonus, gold fanfare). Collection meta-game drives long-term retention.
- Hints (3 tiers, each ×0.7 score): continent → flag + capital → brief flash of the country.
- Modes: Quiz (region-filtered: World or per-continent pools) and **Explore** (tap any country, learn its name/flag/capital — no scoring).
- Leaderboard: local top-10 per region. Tutorial: non-invasive first-run offer, 3 steps.

## Accessibility commitments

- Full keyboard play: arrows rotate/pan, +/− zoom, Enter drops the pin at a center crosshair, H for hint. Complete mouse-only play too.
- `aria-live` announcer for prompts/results, visible focus rings, ≥44px touch targets, `prefers-reduced-motion` honored (ripples/confetti become fades), high-contrast toggle.

## Build log

- 2026-07-19: v0.1 complete and verified. Data pipeline (`npm run data`) vendors 177 features / 174 quizable countries with capitals into `public/data/world.json` (~178 KB). Note: restcountries.com v3.1 API is deprecated — capitals now come from the mledoze/countries GitHub dataset.
- Typecheck and production build clean (74 KB gzipped JS). Verified end-to-end in headless Chrome (playwright-core driving the system Chrome binary — the scripts live in the session scratchpad, easily recreated): menu → tutorial → quiz (miss feedback with distance/direction, hints, skip/reveal with flyTo, correct with discovery bonus + confetti), results → leaderboard save → passport progress, projection switching (all four), high contrast, keyboard crosshair play. Scoring math confirmed in-game: 1,000 base ×2^streak × accuracy × 1.5 speed + 50,000 discovery.
- Dev-only test hook: `window.__lgEngine` exposes the MapEngine in dev builds (see MapView.tsx) so E2E scripts can aim the camera precisely.
- Known trade-offs, deliberate: Mercator ocean is a full-canvas fill (the sphere is unbounded under Mercator); flat-map vertical position is a pan offset, not center latitude; disputed entities without ISO codes render but are never quizzed; accuracy stat counts pins dropped, so skips don't hurt it.

## Ideas for v0.2 (not started)

- Topographic relief layer with visible height scale (from CLAUDE.md future intentions).
- States/provinces mode (needs NE 10m admin-1 data — bigger download, lazy-load per country).
- Daily challenge (seeded shuffle by date) and shareable result cards.
- i18n: strings.ts is ready; country names need a translated dataset (mledoze/countries has `translations`).
