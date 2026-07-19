# 🌍 Learning Globe

A free, gamified world map that teaches geography. Spin a 3D globe (or flat map),
read a country name, and pin your guess — anywhere inside the country counts.
Streaks double your points, first-ever finds stamp your Passport, and scores
snowball into the millions.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run data     # (only if you want to regenerate public/data/world.json)
```

No API keys, no backend, no runtime network calls — the map data is vendored.

## How to play

- **Drag** to spin, **pinch / scroll / + −** to zoom, **tap** to pin your guess.
- Fully keyboard playable: **arrows** aim the crosshair, **+/−** zoom, **Enter**
  drops the pin, **H** hint, **S** skip, **Esc** pause.
- Correct anywhere inside the country wins; pinning near its heart earns the
  final 10%. Streaks double the multiplier (up to ×2048). First-ever finds are
  **discoveries** (+50,000) and stamp your Passport.
- **Explore mode** removes scoring: tap any country to learn its name, flag,
  capital, and population.

## Stack

- Vite + React 18 + TypeScript
- d3-geo rendering to canvas — orthographic globe plus Natural Earth,
  Equal Earth, and Mercator flat projections
- Natural Earth 1:110m borders (deliberately generalized), capitals merged from
  mledoze/countries at build time
- WebAudio-synthesized sound effects, localStorage persistence

Design decisions and their reasoning live in `memory.md`.
