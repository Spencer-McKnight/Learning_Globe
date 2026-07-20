import type { Country } from "../lib/geo";
import type { GuessRecord } from "../lib/storage";

/**
 * Adaptive round builder — replaces the uniform shuffle with weighted
 * sampling over the candidate pool, using the rolling guess history:
 *
 *  - countries never prompted before get a discovery boost, so the world
 *    keeps opening up;
 *  - countries the player recently fumbled (reveals, skips, hint-heavy or
 *    multi-pin hits) come back sooner; clean hits cool off but never
 *    disappear from the pool;
 *  - a continent the player struggles in gets a mild lift for *all* its
 *    countries, training recognition of the area rather than one border;
 *  - anything prompted in the previous round is damped so back-to-back
 *    rounds still hop around the world.
 *
 * Sampling is Efraimidis–Spirakis (each candidate keyed by
 * `-ln(U)/weight`, take the n smallest): weighted, without replacement,
 * and genuinely random — a struggling country is likelier, never certain.
 */

/** How much each of a country's most recent prompts counts, newest first. */
const RECENCY = [1, 0.65, 0.45, 0.3, 0.2];
/** Weight for a country the player has never been asked to find. */
const UNSEEN_BOOST = 2.6;
/** Weight multiplier for countries prompted within the last round. */
const LAST_ROUND_DAMP = 0.4;
/** Max extra lift for every country of a struggling continent. */
const AREA_LIFT = 0.6;
/** Continent lift needs at least this many records to mean anything. */
const AREA_MIN_RECORDS = 4;

/** 1 = knew it cold, 0 = had to be shown. */
function familiarity(r: GuessRecord): number {
  if (r.res === "reveal") return 0;
  if (r.res === "skip") return 0.15;
  return Math.max(0.35, 1 - 0.22 * (r.tries - 1) - 0.15 * r.hints);
}

/** Pick `n` country ids from `candidates`, in play order. */
export function pickRunPool(
  candidates: Country[],
  history: GuessRecord[],
  n: number
): number[] {
  const isoToContinent = new Map<string, string>();
  for (const c of candidates) {
    if (c.props.iso) isoToContinent.set(c.props.iso, c.props.continent);
  }

  // Per-country skill: recency-weighted familiarity over its last few prompts.
  const recent = new Map<string, GuessRecord[]>();
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    const list = recent.get(r.iso) ?? [];
    if (list.length < RECENCY.length) {
      list.push(r);
      recent.set(r.iso, list);
    }
  }
  const skill = new Map<string, number>();
  for (const [iso, recs] of recent) {
    let num = 0;
    let den = 0;
    recs.forEach((r, i) => {
      num += familiarity(r) * RECENCY[i];
      den += RECENCY[i];
    });
    skill.set(iso, num / den);
  }

  // Continent skill across the whole window (only continents in this pool).
  const area = new Map<string, { sum: number; count: number }>();
  for (const r of history) {
    const cont = isoToContinent.get(r.iso);
    if (!cont) continue;
    const a = area.get(cont) ?? { sum: 0, count: 0 };
    a.sum += familiarity(r);
    a.count += 1;
    area.set(cont, a);
  }
  const areaLift = (cont: string): number => {
    const a = area.get(cont);
    if (!a || a.count < AREA_MIN_RECORDS) return 1;
    return 1 + AREA_LIFT * (1 - a.sum / a.count);
  };

  const lastRound = new Set(history.slice(-n).map((r) => r.iso));

  const keyed = candidates.map((c) => {
    const iso = c.props.iso ?? "";
    const s = skill.get(iso);
    let w = s === undefined ? UNSEEN_BOOST : 0.55 + 1.9 * (1 - s);
    w *= areaLift(c.props.continent);
    if (lastRound.has(iso)) w *= LAST_ROUND_DAMP;
    return { id: c.id, key: -Math.log(Math.max(Math.random(), 1e-12)) / w };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, n).map((k) => k.id);
}
