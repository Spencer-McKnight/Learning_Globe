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

- Palette is the user-supplied "Deep Blue Sea" scheme (see design.md), revised 2026-07-19 into a **tonal depth scale** at the user's request: abyss `#060a18` (space/app bg) < ocean `#102043` < land `#41608a` < light hairline borders `rgba(180,205,230,0.5)`. Verified contrast: land/ocean 2.49:1 (was 1.78:1), coastline stroke/ocean 3.5:1, globe no longer shares the page hex (was 1.00:1). Panels stay Space Indigo `#1c2541`; Tropical Teal `#5bc0be` = interactive, Aquamarine `#6fffe9` = success/streak heat, coral `#ff7a6b` = misses, sand-gold `#ffd97a` = discoveries *and* hint cost. A seeded canvas starfield fills the abyss (disabled in high contrast).
- Type: **Baloo 2** (chunky, rounded display — legible for young players) + **Nunito** (body/UI). All display text lives in `src/content/strings.ts`; all colors/spacing in CSS custom properties in `src/styles/theme.css`.
- **Signature interaction: sonar ping.** Every pin drop ripples like sonar — aquamarine rings for a correct guess, coral for a miss. The map is dark ocean; feedback is light.

## Game design

- Core loop: prompt shows a country name → player drops a pin → anywhere inside the country counts as correct (forgiving, per spec). Proximity to the country's centroid scales the final 10% of the score.
- Scoring (cookie-clicker curve, per spec): base 1,000 × streak multiplier `2^min(streak,11)` × accuracy (0.90–1.00) × speed bonus (×1.5 under 4s, ×1.25 under 9s) × attempt penalty (½ per retry) × hint penalty (×0.7 each). Perfect runs reach the millions.
- 3 attempts per country (configurable 1–3); misses stamp stylized distance captions under each pin on the map (prior tries stay visible for the turn) plus a thin aquamarine glow ring snapped to an 8-wind compass direction — never an exact bearing. Exhausting attempts reveals the country and resets the streak.
- **Discoveries**: first-ever correct guess of a country stamps it into the persistent Passport (+50,000 bonus, gold fanfare). Collection meta-game drives long-term retention.
- Hints (3 tiers, each ×0.7 score): continent → flag + capital → population (no map giveaway).
- Modes: Quiz (region-filtered: World or per-continent pools) and **Explore** (tap any country, learn its name/flag/capital — no scoring).
- Leaderboard: local top-10 per region. Tutorial: non-invasive first-run offer, 3 steps.

## Accessibility commitments

- Full keyboard play: hold arrows to glide (velocity + coast via InteractionController), +/− zoom, Enter drops the pin at a center crosshair, H for hint. Complete mouse-only play too.
- `aria-live` announcer for prompts/results, visible focus rings, ≥44px touch targets, `prefers-reduced-motion` honored (ripples/confetti become fades), high-contrast toggle.

## Build log

- 2026-07-19: v0.1 complete and verified. Data pipeline (`npm run data`) vendors 177 features / 174 quizable countries with capitals into `public/data/world.json` (~178 KB). Note: restcountries.com v3.1 API is deprecated — capitals now come from the mledoze/countries GitHub dataset.
- Typecheck and production build clean (74 KB gzipped JS). Verified end-to-end in headless Chrome (playwright-core driving the system Chrome binary — the scripts live in the session scratchpad, easily recreated): menu → tutorial → quiz (miss feedback with distance/direction, hints, skip/reveal with flyTo, correct with discovery bonus + confetti), results → leaderboard save → passport progress, projection switching (all four), high contrast, keyboard crosshair play. Scoring math confirmed in-game: 1,000 base ×2^streak × accuracy × 1.5 speed + 50,000 discovery.
- Dev-only test hook: `window.__lgEngine` exposes the MapEngine in dev builds (see MapView.tsx) so E2E scripts can aim the camera precisely.
- Known trade-offs, deliberate: Mercator ocean is a full-canvas fill (the sphere is unbounded under Mercator); flat-map vertical position is a pan offset, not center latitude; disputed entities without ISO codes render but are never quizzed; accuracy stat counts pins dropped, so skips don't hurt it.

- 2026-07-19: **Start-page redesign.** The centered stack (wordmark / chip row / Play / four equal ghost buttons) read as a template and let UI collide with whatever landmass drifted behind it. New structure:
  - **Masthead** top-left (eyebrow / wordmark / tagline) with settings demoted to a corner icon button, and **journey pills** — live passport count (always) and personal best (appears after the first run) — that open their sheets. Progress is now visible at the root.
  - **Dock**: one grounded glass console at the bottom holding everything that starts a game. Region picker encodes containment — a full-width World row above a 3×2 continent grid, every option showing its country count. Play carries its context ("WORLD · 10 COUNTRIES") inside the button; Explore sits beneath as a quiet compass-marked action.
  - **Signature interaction: the region picker steers the planet.** Picking a continent flies the ambient globe there (`REGION_FOCUS` in geo.ts, ~1.1s flyTo; drift resumes after). `backToMenu` recomposes the camera on the chosen region so the menu never opens on a stale game view.
  - New components: `icons.tsx` (inline stroke icons: compass, sliders, passport, trophy). Menu.tsx rewritten; old `.chip`/`.menu-secondary` CSS removed. `@media (max-height: 720px)` compacts the dock for short phones.
  - Verification gotcha: macOS headless Chrome `--screenshot` clamps the window to ≥500px wide and crops the PNG — phone-width shots silently lie. Use playwright-core (scratchpad-installed) with `viewport` emulation against the system Chrome binary instead.

- 2026-07-19: **Game HUD + palette rework** (user-requested; supersedes "palette committed"). Diagnosis: monochrome navy-on-navy — app bg and globe ocean were the same hex, land/ocean only 1.78:1, and the HUD's own game state (progress, streak, hint cost) was nearly invisible. Changes:
  - Tonal depth palette (see Design language above) in palette.ts + theme.css `--abyss`; MapEngine gains a seeded LCG starfield drawn before the ocean (skipped for mercator and in high-contrast mode via `MapPalette.starAlpha`).
  - **Prompt card v2**: country name gets `text-wrap: balance` + clamp sizing; "1 of 20" text replaced by the **voyage bar** — one segment per country (round length caps at 20), done = teal, current = pulsing aqua beacon (`role="progressbar"` with aria values), plus a tiny `1/10` tabular counter.
  - **Scoreboard capsule**: score + streak chip in one glass pill (was free-floating "0 ×1" superscript). Streak heat tiers: teal chip → aqua at streak 3 (`is-hot`) → gold at streak 6 (`is-blazing`), border/glow follows.
  - **Hint shows its price**: gold bulb icon + three gold pips that deplete per hint (`hintsAria` label); gold now means "costs or rewards".
  - **Zoom capsule**: one bordered vertical pill (also in Explore), replacing two floating circles; `⏸ ⚙ 💡 + −` text glyphs all replaced with stroke SVGs in icons.tsx (IconPause/IconBulb/IconPlus/IconMinus).
  - Contrast math checked with a node script (scratchpad `contrast.mjs`); text tones were already ≥5.9:1 on panels, untouched. Verified via playwright screenshots: menu, game phone/desktop, hint-used state.

- 2026-07-19: **Semantic colour tokens** (user-requested, groundwork for a palette-switching feature). All colour names are now use-case based, never hue based; renames done with global perl substitutions + grep validation, zero call-site literals left behind.
  - CSS (`theme.css`): `--abyss/--ink/--deep/--dusk/--surf/--glow/--foam/--coral/--gold/--muted/--panel/--line` → `--color-bg / -surface-sunken / -surface / -inactive / -accent / -success / -text / -danger / -reward / -text-muted / -panel / -border`. Two tiers in `:root`: a base tier (the only raw values in the app) and a derived tier (`--color-text-inverse`, `--color-focus`, `--color-panel`, `--color-panel-solid`, `--color-border`, `--color-scrim`).
  - Every hardcoded `rgba()` shade (28 of them) became `color-mix(in srgb, var(--color-*) N%, transparent)` via a mapping script, so alpha variants track the base palette automatically. `body.hc` is a sanctioned palette-variant block and may hold raw values.
  - TS (`palette.ts`): `COLORS` keys renamed to match (`bg, surfaceSunken, surface, inactive, accent, success, text, danger, reward`); `withAlpha()` moved here (now accepts rgba input) as the canvas twin of `color-mix`; one-off confetti hexes named under `CELEBRATION_TINTS`; MapEngine's stray literals routed through new `MapPalette` fields (`discoveredFill`, `pinCore`, `hintArc`, `hintRing`, `star`).
  - Rule for future work: a palette swap touches only the `:root` base tier, `body.hc`, `COLORS`/`MAP_PALETTE`, and the `theme-color` meta in index.html (mirrors `--color-surface-sunken`; can't read CSS vars).

- 2026-07-20: **Worlds — the theme switcher** (user-requested). Nine complete colour themes + a derive-your-own mode, all riding on the semantic-token system.
  - `src/styles/themes.ts` is the single source of colour values now (with the theme.css `:root` base tier as the pre-JS Deep Blue Sea default, and index.html's theme-color meta). Each `ThemeColors` covers the UI tier (10 base tokens) *and* the map tier (ocean/land/borders/graticule). `palette.ts` shrank to pure colour math (mix/tint/shade/hsl/luminance/contrast/withAlpha) + the `MapPalette`/`ConfettiSet` types.
  - Worlds: Deep Blue Sea (default), Paper Atlas (light + calm), Terra Firma (earthy), Spring Meadow (light spring), Beacon (Okabe-Ito blue/orange, deuteranopia/protanopia-safe), Chalkboard (pure luminance — safe for all CVD incl. achromatopsia), Ember Dusk, Aurora Night, Candy Pop, plus **Your world**: react-colorful seed → `deriveCustomTheme()` grows a full dark world from one hue (danger/reward stay coral/gold so miss/discovery feedback never changes meaning; contrast-lifting loops guarantee the gates below at any seed).
  - **Contrast gates, machine-checked** (scratchpad `validate_themes.mjs` runs against the esbuild-bundled real themes.ts): text/surface ≥ 7, muted/surface ≥ 4.5, danger+reward/surface ≥ 4.5, accent+success ≥ 4.0, inverse-on-fills ≥ 4.5, land/ocean ≥ 2.0, HC land/ocean ≥ 3.5. 9 themes + 9 HC variants + 216 custom-seed sweeps: 0 failures. Rerun before touching any value.
  - High contrast is now a theme-agnostic *transform*: `buildMapPalette(c, true)` pushes whichever of land/ocean is darker toward black and the lighter toward white (works for light themes where land > ocean); `body.hc` in CSS derives from tokens instead of raw navy values.
  - Confetti is theme-derived (`buildConfetti`) — celebrations always match the world.
  - **Instant load, no flash**: `applyThemeToDom()` sets the base-tier vars on documentElement, updates the theme-color meta + `color-scheme`, and snapshots resolved vars to `localStorage["lg:theme-css"]`; an inline script in index.html re-applies that snapshot before first paint. Verified by E2E: accent var already correct on the first read after reload.
  - UI: planet-orb button (live mini planet of the current theme, slow 40s spin, reduce-motion aware) under the settings icon in the menu corner → **Worlds sheet**: 3-col radiogroup of mini-planet swatches (SVG `ThemeOrb` — ocean gradient, land blobs, selected island, correct-pin dot), one-line description of the selected world, and the custom picker (react-colorful + hex input). Settings sheet links to it ("World colours" row showing the current name). Selection applies live behind the translucent sheet and announces via aria-live.
  - Engine: `MapEngine.setTheme(colors)` + `setHighContrast` both funnel through `refreshPalette()`. Settings gained `theme: ThemeId` + `customColor` (old saves merge defaults).

## Ideas for v0.2 (not started)

- Topographic relief layer with visible height scale (from CLAUDE.md future intentions).
- States/provinces mode (needs NE 10m admin-1 data — bigger download, lazy-load per country).
- Daily challenge (seeded shuffle by date) and shareable result cards.
- i18n: strings.ts is ready; country names need a translated dataset (mledoze/countries has `translations`).
