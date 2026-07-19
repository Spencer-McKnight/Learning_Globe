/**
 * One-time data preparation. Downloads Natural Earth 1:110m admin-0 countries
 * (the de-facto standard generalized world map) plus capital cities from
 * restcountries.com, and vendors a single trimmed GeoJSON into
 * public/data/world.json so the app runs with zero network dependencies.
 *
 * Run with: npm run data
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data", "world.json");

const NE_URLS = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
];
const CAPITALS_URL =
  "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

async function fetchJson(urls) {
  let lastErr;
  for (const url of [urls].flat()) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(`Fetch failed (${err.message}), trying next source...`);
    }
  }
  throw lastErr;
}

const round = (n) => Math.round(n * 100) / 100; // ~1.1 km — plenty for 1:110m

function trimRing(ring) {
  const out = [];
  let prev;
  for (const [x, y] of ring) {
    const p = [round(x), round(y)];
    if (!prev || p[0] !== prev[0] || p[1] !== prev[1]) out.push(p);
    prev = p;
  }
  // A valid ring needs 4+ points; keep degenerate ones out entirely.
  return out.length >= 4 ? out : null;
}

function trimGeometry(geom) {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates.map(trimRing).filter(Boolean);
    return rings.length ? { type: "Polygon", coordinates: rings } : null;
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates
      .map((poly) => poly.map(trimRing).filter(Boolean))
      .filter((poly) => poly.length);
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return null;
}

console.log("Downloading Natural Earth 110m countries...");
const ne = await fetchJson(NE_URLS);

console.log("Downloading capitals...");
let capitalsByIso = {};
try {
  const rc = await fetchJson(CAPITALS_URL);
  for (const c of rc) {
    if (c.cca2 && c.capital?.length) capitalsByIso[c.cca2] = c.capital[0];
  }
  console.log(`Got ${Object.keys(capitalsByIso).length} capitals.`);
} catch (err) {
  console.warn(`Capitals unavailable (${err.message}); hints will omit them.`);
}

const prop = (p, ...keys) => {
  for (const k of keys) {
    const v = p[k] ?? p[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== -99 && v !== "-99") return v;
  }
  return undefined;
};

const features = [];
for (const f of ne.features) {
  const p = f.properties ?? {};
  const geometry = trimGeometry(f.geometry);
  if (!geometry) continue;
  const name = prop(p, "NAME_EN", "NAME", "ADMIN", "NAME_LONG");
  const iso = prop(p, "ISO_A2_EH", "ISO_A2", "WB_A2");
  const continent = prop(p, "CONTINENT") ?? "";
  const pop = Number(prop(p, "POP_EST") ?? 0);
  if (!name) continue;
  features.push({
    type: "Feature",
    properties: {
      name,
      // No ISO code (disputed / non-standard entities) => rendered as land
      // but excluded from the quiz pool, following the Natural Earth standard.
      iso: typeof iso === "string" && /^[A-Z]{2}$/.test(iso) ? iso : null,
      continent,
      pop,
      capital: (typeof iso === "string" && capitalsByIso[iso]) || null,
    },
    geometry,
  });
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

await mkdir(dirname(OUT), { recursive: true });
const json = JSON.stringify({ type: "FeatureCollection", features });
await writeFile(OUT, json);

const quizable = features.filter(
  (f) => f.properties.iso && f.properties.continent !== "Antarctica"
).length;
console.log(
  `Wrote ${OUT}: ${features.length} features (${quizable} quizable), ${(
    json.length / 1024
  ).toFixed(0)} KB.`
);
