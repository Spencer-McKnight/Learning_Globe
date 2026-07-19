import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from "d3-geo";

export type LonLat = [number, number];

export interface CountryProps {
  name: string;
  iso: string | null;
  continent: string;
  pop: number;
  capital: string | null;
}

export interface CountryFeature {
  type: "Feature";
  properties: CountryProps;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface Country {
  id: number;
  feature: CountryFeature;
  props: CountryProps;
  centroid: LonLat;
  /** Max angular distance (radians) from centroid to any border vertex. */
  radius: number;
  /** Spherical bbox [[west, south], [east, north]]; west > east across the antimeridian. */
  bounds: [[number, number], [number, number]];
  /** Steradians — proxy for how easy a country is to hit. */
  area: number;
  flag: string | null;
  quizable: boolean;
}

export interface World {
  countries: Country[];
  quizable: Country[];
}

export const EARTH_RADIUS_KM = 6371;

export function flagEmoji(iso: string | null): string | null {
  if (!iso) return null;
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function maxVertexDistance(centroid: LonLat, geom: CountryFeature["geometry"]): number {
  let max = 0;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const pt of ring) {
        const d = geoDistance(centroid, pt as LonLat);
        if (d > max) max = d;
      }
    }
  }
  return max;
}

export async function loadWorld(): Promise<World> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/world.json`);
  if (!res.ok) throw new Error(`world.json: ${res.status}`);
  const fc = (await res.json()) as { features: CountryFeature[] };

  const countries: Country[] = fc.features.map((feature, id) => {
    const props = feature.properties;
    const centroid = geoCentroid(feature as GeoJSON.Feature) as LonLat;
    return {
      id,
      feature,
      props,
      centroid,
      radius: maxVertexDistance(centroid, feature.geometry),
      bounds: geoBounds(feature as GeoJSON.Feature) as Country["bounds"],
      area: geoArea(feature as GeoJSON.Feature),
      flag: flagEmoji(props.iso),
      quizable: Boolean(props.iso) && props.continent !== "Antarctica",
    };
  });

  return { countries, quizable: countries.filter((c) => c.quizable) };
}

function inBounds(c: Country, [lon, lat]: LonLat): boolean {
  const [[w, s], [e, n]] = c.bounds;
  if (lat < s - 0.5 || lat > n + 0.5) return false;
  if (w <= e) return lon >= w - 0.5 && lon <= e + 0.5;
  return lon >= w - 0.5 || lon <= e + 0.5; // crosses the antimeridian
}

export function hitTest(world: World, p: LonLat): Country | null {
  for (const c of world.countries) {
    if (inBounds(c, p) && geoContains(c.feature as GeoJSON.Feature, p)) return c;
  }
  return null;
}

export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance(a, b) * EARTH_RADIUS_KM;
}

/** 0..1 — how close to the country's heart the pin landed (1 = dead center). */
export function proximity(c: Country, p: LonLat): number {
  if (c.radius <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - geoDistance(c.centroid, p) / c.radius));
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Initial great-circle bearing from a to b, as an 8-wind compass key. */
export function compassDirection(a: LonLat, b: LonLat): (typeof COMPASS)[number] {
  const toRad = Math.PI / 180;
  const [λ1, φ1] = [a[0] * toRad, a[1] * toRad];
  const [λ2, φ2] = [b[0] * toRad, b[1] * toRad];
  const dλ = λ2 - λ1;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

export function formatKm(km: number): string {
  const rounded = km >= 1000 ? Math.round(km / 100) * 100 : Math.round(km / 10) * 10;
  return `${rounded.toLocaleString()} km`;
}

export function formatPopulation(pop: number): string {
  if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)} billion`;
  if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)} million`;
  if (pop >= 1e3) return `${Math.round(pop / 1e3)} thousand`;
  return String(pop);
}

export type Region =
  | "World"
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania";

export const REGIONS: Region[] = [
  "World",
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

export function regionPool(world: World, region: Region): Country[] {
  if (region === "World") return world.quizable;
  return world.quizable.filter((c) => c.props.continent === region);
}
