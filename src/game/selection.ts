import type { Country } from "../lib/geo";
import type { GuessRecord, Passport } from "../lib/storage";

/**
 * The round planner — "where in the world should we go next?"
 *
 * A uniform shuffle wastes most of a round: it re-asks Brazil while the
 * player still can't find Benin, and it drops a novice straight onto
 * Vanuatu. This planner replays the player's whole history into a model of
 * what they know, then builds a round that is *just* hard enough to be worth
 * playing, with enough surprise that it never feels like homework.
 *
 * Five vectors shape it, each with evidence behind it:
 *
 *  1. Spaced repetition. Each country carries a memory state — stability,
 *     difficulty, retrievability — updated by an FSRS-style model (see
 *     `memory.ts`). A country is worth asking when it is *about* to be
 *     forgotten: retrieval that takes effort is what makes memories stick,
 *     while asking about something still fresh teaches nothing.
 *  2. Desirable difficulty. Unseen countries are matched to the player's
 *     ability — tracked as an Elo rating against a difficulty prior read off
 *     the map itself — rather than drawn at random. A beginner meets Brazil
 *     and Egypt; a veteran meets Comoros.
 *  3. Interleaving. Mixing continents within a round beats blocking them:
 *     jumping between regions forces the player to *discriminate* rather than
 *     coast on context. The sequencer enforces the hop.
 *  4. Exploration. A standing bonus for countries rarely asked about, so an
 *     adaptive scheduler never quietly narrows to the same two dozen places.
 *  5. Curiosity and variable reward. A round that is purely optimal is also
 *     predictable. One slot may be spent on a curio — a speck of an island, a
 *     country the player has never once seen — because the surprise is what
 *     brings people back tomorrow, and tomorrow is where the learning is.
 *
 * On top of that sits the signal only this game has: *what the player pinned
 * instead*. Aiming at Slovenia when asked for Slovakia is not a generic
 * failure, it is a specific confusion — so the planner schedules the
 * impostor too, spaced a few prompts away, and lets the contrast do the
 * teaching.
 *
 * The shape of the whole thing follows Papoušek, Pelánek & Stanislav's
 * adaptive map quiz (EDM 2014, and UMUAI 2016), which is the closest
 * published relative of this game: separate the estimate of what a player
 * knows from the choice of what to ask, and score candidates by a weighted
 * sum rather than a rule. Where they tune difficulty by varying the number of
 * multiple-choice options, this game has only the map — so the difficulty
 * dial here is *which country*, which puts more weight on getting the pick
 * right.
 */

import {
  buildMemories,
  gradeOf,
  outcomeValue,
  retrievability,
  type Memory,
} from "./memory";

// ---------------------------------------------------------------- tuning

/**
 * Retention the review schedule aims at — the FSRS/Anki default. This is a
 * *scheduling* threshold: how far a memory may decay before it is worth
 * spending a prompt on.
 */
const TARGET_RETENTION = 0.9;
/**
 * Success rate new material is aimed at. Wilson et al.'s "85% rule" is the
 * theoretical optimum for learning *rate*; Papoušek & Pelánek, running an
 * adaptive map quiz over millions of real answers, settled nearer 0.75 for
 * motivation's sake and found easier questions win short-term engagement
 * while harder ones win long-term learning. 0.8 splits them, and a wrong tap
 * here is cheap — the answer lights up immediately — so this can sit on the
 * demanding side of comfortable.
 */
const TARGET_NEW_SUCCESS = 0.8;
/**
 * Fit to that target, as Papoušek's tent: a candidate scores 1 when its
 * expected success sits exactly on target and falls linearly to 0 at both
 * impossible and trivial. Raised to a power so the channel is tighter than
 * theirs — this game has a single map-tap answer rather than a variable
 * number of multiple-choice options to tune difficulty with.
 */
const FLOW_SHARPNESS = 2.5;
/** Weight kept by a country far outside the channel — never quite zero. */
const FLOW_FLOOR = 0.02;

/** How fast urgency falls away for a country that is still fresh. */
const FRESH_TOLERANCE = 0.08;
/** Urgency retained by something forgotten long ago. */
const OVERDUE_FLOOR = 0.6;
/** Extra pull per lapse, so repeat offenders come back sooner. */
const LAPSE_LIFT = 0.12;
const LAPSE_LIFT_CAP = 4;

/** A never-once-seen country is this much more tempting than a mere review. */
const DISCOVERY_LIFT = 1.5;
/** Lift for a country stamped in the passport but aged out of history. */
const FADED_LIFT = 1.25;
/**
 * Exploration bonus, 1/sqrt(1+n) over the times a country has been asked
 * (Papoušek's S_count). Without it an adaptive scheduler converges on the
 * same two dozen countries and quietly stops teaching the world; with it,
 * rarely-visited places keep a standing claim that decays smoothly rather
 * than switching off the moment they're first seen.
 */
const EXPLORE_LIFT = 0.9;

/** Lift for the country a player wrongly pinned — the impostor. */
const CONFUSION_LIFT = 2.2;
/** Half-life, in days, of a recorded confusion. */
const CONFUSION_HALFLIFE = 14;
/** Below this the mix-up is stale — still a nudge, no longer the reason. */
const CONFUSION_LIVE = 0.45;

/** Prompts before a repeat is fully undamped again. */
const LAG_PROMPTS = 24;
/** Weight multiplier for something asked in the immediately previous round. */
const LAG_DAMP = 0.22;
/** Anything asked within this many minutes is damped hard regardless of lag. */
const SESSION_MINUTES = 20;
const SESSION_DAMP = 0.12;

/** Chance a round spends one slot on a curio instead of the optimal pick. */
const CURIO_CHANCE = 0.35;
/** How odd a country has to be to qualify as one. */
const CURIO_THRESHOLD = 0.4;
/**
 * Prompts a player must have behind them first. A curio is a reward for
 * someone who already has their bearings; served to a beginner it is just a
 * country they have never heard of, which is not a delight, it is a wall.
 */
const CURIO_MIN_HISTORY = 30;

/** Share of a round given to new material, from struggling to cruising. */
const NEW_SHARE_MIN = 0.25;
const NEW_SHARE_SPAN = 0.45;

/**
 * Ability moves this fast at first, settling as evidence accumulates:
 * K(n) = a/(1 + b·n). Pelánek & Papoušek grid-searched a = 1, b = 0.05 on
 * real map-quiz data and found a single online pass matches full maximum-
 * likelihood fitting at r = 0.97 — which is what makes it affordable to run
 * in the browser at the start of every round.
 */
const ELO_A = 1;
const ELO_B = 0.05;
/** Never freeze completely: people do keep getting better. */
const ELO_K_MIN = 0.08;
/** Where a player with no history is assumed to start — a beginner, not an average. */
const NOVICE_ABILITY = -0.6;
/** Logits per point of FSRS difficulty (1..10) — sets the ability scale. */
const LOGIT_PER_DIFFICULTY = 0.58;
/** How loudly a live memory speaks over the ability estimate. */
const RECALL_KAPPA = 0.8;
/** Log-odds cap on the recall term, so a fresh memory can't swamp the rest. */
const RECALL_CLAMP = 3;
/**
 * How far the flow channel tempers a review. Below 1 because for a country
 * already met, *when* to ask is mostly a scheduling question — the channel is
 * a veto on the hopeless, not the deciding vote.
 */
const REVIEW_FLOW_WEIGHT = 0.5;

/** Sequencing: penalty for following a country from the same continent. */
const SAME_CONTINENT_PENALTY = 0.9;
/** The same penalty two slots back, as a fraction — a softer echo. */
const SAME_CONTINENT_GAP2 = 0.4;
/** Prompts of experience at which interleaving is enforced in full. */
const INTERLEAVE_FULL_AT = 80;
/** Confusion partners want air between them; closer than this is penalised. */
const CONFUSION_MIN_GAP = 3;
const CONFUSION_GAP_PENALTY = 1.1;
/** Random jitter in sequencing, so the arc is never mechanical. */
const SEQUENCE_JITTER = 0.18;

// ------------------------------------------------------------ public API

/** Why the planner reached for a country — surfaced in the round summary. */
export type PickReason =
  | "discovery" // never seen before
  | "faded" // met long ago, out of living memory
  | "review" // due for retrieval practice
  | "shaky" // missed recently, needs another look
  | "confusion" // the impostor from a recent mix-up
  | "curio"; // the surprise slot

export interface Pick {
  id: number;
  iso: string;
  reason: PickReason;
  /** Modelled chance the player finds it, 0..1. */
  expected: number;
}

export interface RoundPlan {
  ids: number[];
  picks: Pick[];
  /** Player ability in logits, for debugging and future UI. */
  ability: number;
}

export interface PlanOptions {
  candidates: Country[];
  history: GuessRecord[];
  passport?: Passport;
  count: number;
  now?: number;
  rng?: () => number;
}

/** Build the next round: which countries, in which order, and why. */
export function planRound(opts: PlanOptions): RoundPlan {
  const {
    candidates,
    history,
    passport = {},
    count,
    now = Date.now(),
    rng = Math.random,
  } = opts;

  const playable = candidates.filter((c) => c.props.iso);
  if (playable.length === 0 || count <= 0) return { ids: [], picks: [], ability: 0 };

  const priors = priorDifficulties(playable);
  const memories = buildMemories(history, priors);
  const ability = estimateAbility(history, priors, memories);
  const confusion = confusionWeights(history, now);
  const lag = lagIndex(history);

  const scored = playable.map((c) =>
    scoreCandidate(c, {
      memories,
      priors,
      passport,
      confusion,
      lag,
      ability,
      now,
    })
  );

  const seen = scored.filter((s) => s.memory);
  const fresh = scored.filter((s) => !s.memory);

  // Split the round between new ground and revision. A player who is
  // struggling gets more revision; a player cruising gets more world.
  const share = newShare(history, fresh.length, seen.length);
  let wantNew = Math.round(count * share);
  wantNew = Math.min(wantNew, fresh.length);
  let wantSeen = Math.min(count - wantNew, seen.length);
  wantNew = Math.min(fresh.length, count - wantSeen);

  const chosen = [
    ...sampleWeighted(fresh, wantNew, rng),
    ...sampleWeighted(seen, wantSeen, rng),
  ];

  // Top up from whatever is left if either pool ran dry.
  if (chosen.length < count) {
    const taken = new Set(chosen.map((s) => s.id));
    const rest = scored.filter((s) => !taken.has(s.id));
    chosen.push(...sampleWeighted(rest, count - chosen.length, rng));
  }

  if (history.length >= CURIO_MIN_HISTORY) spendCurioSlot(chosen, scored, rng);

  const ordered = sequence(chosen, confusion, history.length, rng);
  return { ids: ordered.map((s) => s.id), picks: ordered.map(toPick), ability };
}

// -------------------------------------------------------------- scoring

interface Scored {
  id: number;
  iso: string;
  continent: string;
  weight: number;
  /** Modelled chance of a correct find, 0..1. */
  expected: number;
  reason: PickReason;
  memory: Memory | undefined;
  curiosity: number;
}

interface ScoreContext {
  memories: Map<string, Memory>;
  priors: Map<string, number>;
  passport: Passport;
  confusion: Map<string, number>;
  lag: Map<string, number>;
  ability: number;
  now: number;
}

function scoreCandidate(c: Country, ctx: ScoreContext): Scored {
  const iso = c.props.iso as string;
  const memory = ctx.memories.get(iso);
  const priorD = ctx.priors.get(iso) ?? 5.5;

  let weight: number;
  let expected: number;
  let reason: PickReason;

  if (memory) {
    // Known country: the schedule leads. Urgency peaks at the moment recall
    // is about to fail, which is the moment practising it pays most — but
    // temper it by whether the player stands a chance at all, so an overdue
    // country far beyond them doesn't monopolise every round.
    const r = retrievability(memory, ctx.now);
    expected = successChance(ctx.ability, priorD, r);
    weight = urgency(r) * Math.pow(flowFit(expected), REVIEW_FLOW_WEIGHT);
    weight *= 1 + LAPSE_LIFT * Math.min(memory.lapses, LAPSE_LIFT_CAP);
    reason = memory.lapses > 0 && r < TARGET_RETENTION ? "shaky" : "review";
  } else {
    // Unknown country: aim for the flow channel — hard enough to teach,
    // easy enough to land.
    expected = successChance(ctx.ability, priorD);
    weight = flowFit(expected);
    const met = Boolean(ctx.passport[iso]);
    weight *= met ? FADED_LIFT : DISCOVERY_LIFT;
    reason = met ? "faded" : "discovery";
  }

  weight *= 1 + EXPLORE_LIFT / Math.sqrt(1 + (memory?.reps ?? 0));

  const impostor = ctx.confusion.get(iso) ?? 0;
  if (impostor > 0) {
    weight *= 1 + (CONFUSION_LIFT - 1) * impostor;
    if (impostor >= CONFUSION_LIVE) reason = "confusion";
  }

  weight *= lagDamp(ctx.lag.get(iso));
  if (memory && ctx.now - memory.last < SESSION_MINUTES * 60_000) weight *= SESSION_DAMP;

  return {
    id: c.id,
    iso,
    continent: c.props.continent,
    weight: Math.max(weight, 1e-6),
    expected,
    reason,
    memory,
    curiosity: curiosityOf(c, ctx.priors),
  };
}

/**
 * How much a review is worth right now, given retrievability `r`.
 * Peaks at the target retention: still-fresh material is nearly worthless to
 * drill, while long-forgotten material stays in rotation on a floor rather
 * than crowding out everything else.
 */
function urgency(r: number): number {
  if (r >= TARGET_RETENTION) {
    const over = (r - TARGET_RETENTION) / FRESH_TOLERANCE;
    return Math.exp(-over * over);
  }
  return OVERDUE_FLOOR + (1 - OVERDUE_FLOOR) * Math.sqrt(r / TARGET_RETENTION);
}

/** How well a candidate's expected success sits in the flow channel. */
function flowFit(p: number): number {
  const tent =
    p <= TARGET_NEW_SUCCESS
      ? p / TARGET_NEW_SUCCESS
      : (1 - p) / (1 - TARGET_NEW_SUCCESS);
  return FLOW_FLOOR + (1 - FLOW_FLOOR) * Math.pow(Math.max(tent, 0), FLOW_SHARPNESS);
}

/**
 * Chance this player finds this country right now. Two sources of evidence:
 * how hard the country is against how good the player is (the Elo term), and
 * how fresh this particular memory is (the retrievability term, when there
 * is one). Combined in log-odds, which is where they are commensurable.
 */
function successChance(ability: number, difficulty: number, r?: number): number {
  const beta = (difficulty - 5.5) * LOGIT_PER_DIFFICULTY;
  let logit = ability - beta;
  if (r !== undefined) {
    const safe = Math.min(0.999, Math.max(0.001, r));
    const recall = Math.log(safe / (1 - safe));
    logit += RECALL_KAPPA * Math.min(RECALL_CLAMP, Math.max(-RECALL_CLAMP, recall));
  }
  return 1 / (1 + Math.exp(-logit));
}

// --------------------------------------------------------------- ability

/**
 * Player ability in logits, from an online 1-parameter (Elo-style) update
 * over the whole history: after each prompt the estimate moves by the gap
 * between what the model expected and what actually happened, with the step
 * shrinking as evidence accumulates.
 */
function estimateAbility(
  history: GuessRecord[],
  priors: Map<string, number>,
  memories: Map<string, Memory>
): number {
  let theta = NOVICE_ABILITY;
  let n = 0;
  for (const rec of history) {
    // The geography prior, not the memory model's difficulty: ability has to
    // be measured against a fixed yardstick, and FSRS difficulty drifts with
    // how the player has been doing on that very country.
    const d = priors.get(rec.iso) ?? memories.get(rec.iso)?.difficulty ?? 5.5;
    const expected = successChance(theta, d);
    const k = Math.max(ELO_K_MIN, ELO_A / (1 + ELO_B * n));
    theta += k * (outcomeValue(gradeOf(rec)) - expected);
    n++;
  }
  return theta;
}

/** Fraction of the round to spend on new ground rather than revision. */
function newShare(history: GuessRecord[], freshCount: number, seenCount: number): number {
  if (freshCount === 0) return 0;
  if (seenCount === 0) return 1;
  const window = history.slice(-20);
  const accuracy = window.length
    ? window.reduce((a, r) => a + outcomeValue(gradeOf(r)), 0) / window.length
    : 0.7;
  const share = NEW_SHARE_MIN + NEW_SHARE_SPAN * accuracy;
  // As the world fills in, tilt back towards keeping what's been learnt.
  const unexplored = freshCount / (freshCount + seenCount);
  return share * Math.min(1, Math.max(0.35, unexplored * 2));
}

// ------------------------------------------------------------- confusion

/**
 * How strongly each country is currently implicated as an *impostor* — a
 * place the player pinned when asked for somewhere else. Recent mix-ups
 * count most; the memory of one fades with a two-week half-life.
 */
function confusionWeights(history: GuessRecord[], now: number): Map<string, number> {
  const w = new Map<string, number>();
  for (const rec of history) {
    if (!rec.miss?.length) continue;
    const ageDays = (now - rec.t) / 86_400_000;
    const decay = Math.pow(0.5, ageDays / CONFUSION_HALFLIFE);
    for (const iso of rec.miss) {
      w.set(iso, Math.min(1, (w.get(iso) ?? 0) + decay));
    }
  }
  return w;
}

/** Prompts elapsed since each country was last asked. */
function lagIndex(history: GuessRecord[]): Map<string, number> {
  const lag = new Map<string, number>();
  for (let i = history.length - 1; i >= 0; i--) {
    if (!lag.has(history[i].iso)) lag.set(history[i].iso, history.length - 1 - i);
  }
  return lag;
}

/** Damp a country that was asked too recently, easing back to full weight. */
function lagDamp(prompts: number | undefined): number {
  if (prompts === undefined || prompts >= LAG_PROMPTS) return 1;
  const t = prompts / LAG_PROMPTS;
  return LAG_DAMP + (1 - LAG_DAMP) * t * t;
}

// ------------------------------------------------- geography as a prior

/**
 * A first guess at how hard a country is before the player has ever met it,
 * on the same 1..10 scale as the memory model's difficulty. Three things
 * make a country hard to place: it is small, it is rarely talked about, and
 * it sits in a crowd of similar-looking neighbours.
 */
const priorCache = new WeakMap<Country[], Map<string, number>>();

function priorDifficulties(candidates: Country[]): Map<string, number> {
  const cached = priorCache.get(candidates);
  if (cached) return cached;

  const crowd = crowding(candidates);
  const out = new Map<string, number>();
  for (const c of candidates) {
    if (!c.props.iso) continue;
    const smallness = norm(-Math.log10(Math.max(c.area, 1e-9)), 0.4, 6.3);
    const obscurity = norm(-Math.log10(Math.max(c.props.pop, 1)), -9.2, -4);
    const crowded = crowd.get(c.props.iso) ?? 0.5;
    // How often a country comes up in the world's conversation — which is
    // mostly how many people live there — is the strongest single clue.
    const hard = 0.32 * smallness + 0.5 * obscurity + 0.18 * crowded;
    out.set(c.props.iso, 1 + 9 * hard);
  }
  priorCache.set(candidates, out);
  return out;
}

/** 0 = alone on its own ocean, 1 = packed in among lookalikes. */
const CROWD_NEIGHBOURS = 3;
const CROWD_REFERENCE = 0.35; // radians (~2200 km) — beyond this, isolated

function crowding(candidates: Country[]): Map<string, number> {
  const pts = candidates.filter((c) => c.props.iso);
  const out = new Map<string, number>();
  for (const c of pts) {
    const dists: number[] = [];
    for (const o of pts) {
      if (o === c) continue;
      dists.push(angularDistance(c.centroid, o.centroid));
    }
    dists.sort((a, b) => a - b);
    const near = dists.slice(0, CROWD_NEIGHBOURS);
    const mean = near.length ? near.reduce((a, b) => a + b, 0) / near.length : CROWD_REFERENCE;
    out.set(c.props.iso as string, 1 - norm(mean, 0, CROWD_REFERENCE));
  }
  return out;
}

/** Great-circle angle in radians — local so this module stays dependency-free. */
function angularDistance(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const [λ1, φ1] = [a[0] * rad, a[1] * rad];
  const [λ2, φ2] = [b[0] * rad, b[1] * rad];
  const dφ = Math.sin((φ2 - φ1) / 2);
  const dλ = Math.sin((λ2 - λ1) / 2);
  const h = dφ * dφ + Math.cos(φ1) * Math.cos(φ2) * dλ * dλ;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function norm(v: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
}

/** How delightfully odd a country is — the raw material of the curio slot. */
function curiosityOf(c: Country, priors: Map<string, number>): number {
  const tiny = norm(-Math.log10(Math.max(c.area, 1e-9)), 3.5, 6.3);
  const obscure = norm(-Math.log10(Math.max(c.props.pop, 1)), -6.5, -2.5);
  const exotic = norm(priors.get(c.props.iso as string) ?? 5.5, 6, 10);
  return Math.max(tiny, obscure, exotic);
}

// -------------------------------------------------------------- sampling

/**
 * Weighted sampling without replacement (Efraimidis–Spirakis): key each
 * candidate by -ln(U)/w and take the smallest. Genuinely random, so a
 * struggling country is likelier but never certain — two rounds in a row
 * never feel the same.
 */
function sampleWeighted(pool: Scored[], n: number, rng: () => number): Scored[] {
  if (n <= 0) return [];
  return pool
    .map((s) => ({ s, key: -Math.log(Math.max(rng(), 1e-12)) / s.weight }))
    .sort((a, b) => a.key - b.key)
    .slice(0, n)
    .map((k) => k.s);
}

/**
 * Occasionally trade the least urgent pick for a curio — a speck in the
 * Pacific, somewhere the player has never once been asked about. Strictly
 * worse for retention this round, and exactly why anyone comes back for the
 * next one.
 */
function spendCurioSlot(chosen: Scored[], all: Scored[], rng: () => number): void {
  if (chosen.length < 3 || rng() > CURIO_CHANCE) return;
  const taken = new Set(chosen.map((s) => s.id));
  const pool = all
    .filter((s) => !taken.has(s.id) && s.curiosity > CURIO_THRESHOLD)
    .map((s) => ({ ...s, weight: s.curiosity }));
  const [curio] = sampleWeighted(pool, 1, rng);
  if (!curio) return;
  // Spend the least urgent slot — never one that is repairing a mix-up.
  let worst = -1;
  for (let i = 0; i < chosen.length; i++) {
    if (chosen[i].reason === "confusion") continue;
    if (worst < 0 || chosen[i].weight < chosen[worst].weight) worst = i;
  }
  if (worst >= 0) chosen[worst] = { ...curio, reason: "curio" };
}

// ------------------------------------------------------------ sequencing

/**
 * Order the round. Three things matter beyond the picks themselves:
 * interleaving (never linger on one continent, so the player has to
 * discriminate), the arc (open on a win, close on something memorable), and
 * spacing confusion partners far enough apart that the contrast teaches
 * instead of gives the answer away.
 *
 * Interleaving is worth insisting on even though it makes the round *feel*
 * harder: across 59 studies it beats blocked practice by g = 0.42, and the
 * gap is widest exactly where this game lives — categories that resemble each
 * other. The catch is that it costs more than it pays before the learner has
 * any category to discriminate with, so a beginner is allowed to linger in a
 * continent for a moment; a veteran is not.
 */
function sequence(
  picks: Scored[],
  confusion: Map<string, number>,
  experience: number,
  rng: () => number
): Scored[] {
  const remaining = [...picks];
  const order: Scored[] = [];
  const n = remaining.length;
  if (n <= 1) return remaining;

  const hop = SAME_CONTINENT_PENALTY * Math.min(1, experience / INTERLEAVE_FULL_AT);

  // Open on the most confident find — momentum before challenge.
  let first = 0;
  for (let i = 1; i < remaining.length; i++) {
    if (remaining[i].expected > remaining[first].expected) first = i;
  }
  order.push(...remaining.splice(first, 1));

  while (remaining.length > 0) {
    const slot = order.length;
    // Challenge ramps through the round and eases just before the finale.
    const target = 0.2 + 0.6 * (slot / Math.max(1, n - 1));
    let best = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let cost = Math.abs(1 - cand.expected - target);
      if (order[slot - 1]?.continent === cand.continent) cost += hop;
      if (order[slot - 2]?.continent === cand.continent) cost += hop * SAME_CONTINENT_GAP2;
      if ((confusion.get(cand.iso) ?? 0) > 0) {
        for (let k = Math.max(0, slot - CONFUSION_MIN_GAP); k < slot; k++) {
          if ((confusion.get(order[k].iso) ?? 0) > 0) cost += CONFUSION_GAP_PENALTY;
        }
      }
      cost += rng() * SEQUENCE_JITTER;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    order.push(...remaining.splice(best, 1));
  }
  return order;
}

function toPick(s: Scored): Pick {
  return { id: s.id, iso: s.iso, reason: s.reason, expected: s.expected };
}
