import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AccountSheet } from "./components/AccountSheet";
import { ExploreCard } from "./components/ExploreCard";
import { Hud } from "./components/Hud";
import { LeaderboardSheet } from "./components/LeaderboardSheet";
import { MapView } from "./components/MapView";
import { Menu } from "./components/Menu";
import { PassportSheet } from "./components/PassportSheet";
import { PinSheet } from "./components/PinSheet";
import { Results } from "./components/Results";
import { SettingsSheet } from "./components/SettingsSheet";
import { Sheet } from "./components/Sheet";
import { SiteFooter } from "./components/SiteFooter";
import { IconMinus, IconPlus } from "./components/icons";
import { ThemeSheet } from "./components/ThemeSheet";
import { Tutorial } from "./components/Tutorial";
import { STR } from "./content/strings";
import { IDLE_GAME, gameReducer, type GuessOutcome } from "./game/reducer";
import { DISCOVERY_BONUS, formatPoints, scoreGuess } from "./game/scoring";
import { planRound } from "./game/selection";
import type { Account } from "./lib/account";
import * as sfx from "./lib/audio";
import {
  bootMemberSync,
  pushSettings,
  submitRun,
  type BoardRanks,
  type RunGuess,
} from "./lib/cloud";
import {
  compassDirection,
  continentRegion,
  distanceKm,
  formatKm,
  formatPopulation,
  hitTest,
  loadWorld,
  proximity,
  REGION_FOCUS,
  regionPool,
  type Country,
  type LonLat,
  type Region,
  type World,
} from "./lib/geo";
import {
  adoptCloudSettings,
  loadHistory,
  loadLeaderboard,
  mergeCloudStats,
  mergePassport,
  loadPassport,
  loadSettings,
  loadStats,
  markTutorialSeen,
  recordGuess,
  recordRun,
  saveLeaderboardEntry,
  saveSettings,
  settingsSavedAt,
  stampPassport,
  tutorialSeen,
  type GuessRecord,
  type LeaderboardEntry,
  type Settings,
} from "./lib/storage";
import type { ArrowDir, ZoomDir } from "./map/InteractionController";
import type { MapEngine } from "./map/MapEngine";
import type { PinId } from "./map/pins";
import { applyThemeToDom, resolveThemeColors, type ThemeId } from "./styles/themes";

type ScreenId = "menu" | "game" | "results" | "explore";
type OverlayId = null | "settings" | "passport" | "leaderboard" | "theme" | "pin" | "account";

const ARROW_KEYS: Record<string, ArrowDir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const ZOOM_KEYS: Record<string, ZoomDir> = {
  "+": "in",
  "=": "in",
  "-": "out",
  _: "out",
};

/** Settings that reshape the current match if changed mid-round. */
type MatchRules = Pick<
  Settings,
  "region" | "roundLength" | "attempts" | "hintsEnabled" | "speedBonus"
>;

const pickMatchRules = (s: Settings): MatchRules => ({
  region: s.region,
  roundLength: s.roundLength,
  attempts: s.attempts,
  hintsEnabled: s.hintsEnabled,
  speedBonus: s.speedBonus,
});

const matchRulesEqual = (a: MatchRules, b: MatchRules): boolean =>
  a.region === b.region &&
  a.roundLength === b.roundLength &&
  a.attempts === b.attempts &&
  a.hintsEnabled === b.hintsEnabled &&
  a.speedBonus === b.speedBonus;

const FEEDBACK_MS = 1900;
const REVEAL_MS = 3000;
/**
 * Camera framing. On the menu the globe is fitted into the clear band between
 * the title and Play; starting a round hands it the whole screen and closes in
 * a little, so play opens with the world arriving rather than sitting still.
 */
const FRAME_MS = 900;
/** Band-only re-frames (window resize, URL bar settling) glide, not pop. */
const BAND_EASE_MS = 320;
const PLAY_ZOOM = 1.2;
/** Persistent glow while the player studies the revealed country. */
const REVEAL_FLASH_MS = Number.POSITIVE_INFINITY;

export default function App({ account }: { account: Account }): JSX.Element {
  // Supplied by the auth root (main.tsx); every guest/member branch keys off this.
  const [world, setWorld] = useState<World | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [history, setHistory] = useState<GuessRecord[]>(loadHistory);
  const [runRules, setRunRules] = useState<MatchRules>(() => pickMatchRules(loadSettings()));
  const [screen, setScreen] = useState<ScreenId>("menu");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [settingsApplyPrompt, setSettingsApplyPrompt] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [passport, setPassport] = useState(loadPassport);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard);
  const [exploreSel, setExploreSel] = useState<Country | null>(null);
  /** Menu only: the region under the cursor, previewed before it's picked. */
  const [hoverRegion, setHoverRegion] = useState<Region | null>(null);
  /** Counts commitments, so the plate stamps on a pick and not on re-hover. */
  const [pickSeq, setPickSeq] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [savedScore, setSavedScore] = useState(false);
  const [personalBest, setPersonalBest] = useState(false);
  /** Global board placement returned by the cloud after a member's run. */
  const [runRanks, setRunRanks] = useState<BoardRanks | null>(null);
  /** Bumped whenever MapView hands us a freshly built engine to configure. */
  const [engineEpoch, setEngineEpoch] = useState(0);
  /** Clear band on the menu (title above, Play below), measured by Menu. */
  const [menuBand, setMenuBand] = useState<{ top: number; bottom: number } | null>(null);
  const [osReducedMotion, setOsReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [gs, dispatch] = useReducer(gameReducer, IDLE_GAME);

  const engineRef = useRef<MapEngine | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const revealRaf = useRef<number | null>(null);
  const revealCounting = useRef(false);
  const pendingPlay = useRef(false);
  const recorded = useRef(true);
  /** Client-side run identity + per-prompt log, for the one submit_run RPC. */
  const runId = useRef("");
  const runLog = useRef<RunGuess[]>([]);
  /** Countries wrongly pinned during the current prompt — the confusion signal. */
  const misfires = useRef<string[]>([]);
  /** 1 → 0 while the reveal auto-advance countdown is running; null when paused/idle. */
  const [revealRemain, setRevealRemain] = useState<number | null>(null);

  const reduceMotion =
    settings.reduceMotion === "on" || (settings.reduceMotion === "auto" && osReducedMotion);

  // ---------------- world colours ----------------

  const themeColors = useMemo(
    () => resolveThemeColors(settings.theme, settings.customColor),
    [settings.theme, settings.customColor]
  );

  useEffect(() => {
    applyThemeToDom(themeColors);
  }, [themeColors]);

  const selectTheme = (theme: ThemeId): void => {
    sfx.sfxTap();
    setSettings((s) => ({ ...s, theme }));
    setAnnounce(STR.themes.applied(STR.themes.names[theme]));
  };

  const selectPin = (pin: PinId): void => {
    sfx.sfxTap();
    setSettings((s) => ({ ...s, pin }));
    setAnnounce(STR.pins.applied(STR.pins.names[pin]));
  };

  // ---------------- boot ----------------

  useEffect(() => {
    loadWorld().then(setWorld, () => setLoadError(true));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = (e: MediaQueryListEvent): void => setOsReducedMotion(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Persist settings only after a real change — the initial render must not
  // advance the local last-write-wins clock, or cloud settings from another
  // device would never be adopted.
  const settingsBooted = useRef(false);
  useEffect(() => {
    sfx.setSound(settings.sound);
    sfx.setHaptics(settings.haptics);
    document.body.classList.toggle("hc", settings.highContrast);
    if (!settingsBooted.current) {
      settingsBooted.current = true;
      return;
    }
    saveSettings(settings);
    if (account.kind === "member") {
      const t = window.setTimeout(() => void pushSettings(settings), 1500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Member boot: replay the guest bucket once, flush runs queued offline,
  // then fold the cloud snapshot into this device's bucket.
  useEffect(() => {
    if (account.kind !== "member") return;
    let cancelled = false;
    void bootMemberSync().then((snap) => {
      if (!snap || cancelled) return;
      setPassport(mergePassport(snap.passport));
      if (snap.stats) mergeCloudStats(snap.stats);
      if (snap.settings && snap.settingsUpdatedAt > settingsSavedAt()) {
        adoptCloudSettings(snap.settings, snap.settingsUpdatedAt);
        setSettings(loadSettings()); // re-read: merges cloud JSON over defaults
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  // ---------------- engine mode sync ----------------

  // The menu globe is live too: hover lights continents, taps pick regions.
  const menuLive = screen === "menu" && !overlay && !tutorialActive;
  const interactive =
    (screen === "game" && !paused && !overlay && !settingsApplyPrompt) ||
    screen === "explore" ||
    menuLive;
  // Idle drift pauses during the tour so its staged scenes hold still.
  const ambient = (screen === "menu" && !tutorialActive) || screen === "results";

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setDiscoveredTint(
      screen === "explore" ? new Set(Object.keys(passport)) : null
    );
    if (screen !== "explore") {
      e.setSelected(null);
    }
  }, [screen, passport, world, engineEpoch]);

  useEffect(() => {
    engineRef.current?.setCrosshair(keyboardNav && (screen === "game" || screen === "explore"));
  }, [keyboardNav, screen, engineEpoch]);

  // On the menu the wheel does not zoom — the home screen is for spinning and
  // picking a region. Every other screen owns every gesture, including zoom.
  useEffect(() => {
    engineRef.current?.setWheelZoom(screen !== "menu");
  }, [screen, engineEpoch]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setRegionPick(screen === "menu" && !tutorialActive);
    e.setPickedContinent(
      screen === "menu" && !tutorialActive && settings.region !== "World"
        ? settings.region
        : null
    );
  }, [screen, settings.region, world, engineEpoch, tutorialActive]);

  const onMenuBand = useCallback((band: { top: number; bottom: number }) => {
    setMenuBand((prev) =>
      prev && Math.abs(prev.top - band.top) < 1 && Math.abs(prev.bottom - band.bottom) < 1
        ? prev
        : band
    );
  }, []);

  /**
   * Where the map is framed. On the menu it fits the band between the title and
   * Play; every other screen hands it the whole canvas. A change of framing
   * eases — that ease is half of the "pan in" when a round starts — while a
   * band change within one framing glides briefly: it comes from a window
   * resize or the mobile URL bar re-expanding at rest, and a short ease turns
   * what would be a visible pop into a settle. Only the very first framing
   * lands instantly, so boot doesn't open on an animation.
   */
  const framing = screen === "menu" && menuBand && !tutorialActive ? "menu" : "full";
  const lastFraming = useRef<string | null>(null);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const first = lastFraming.current === null;
    const changed = !first && lastFraming.current !== framing;
    lastFraming.current = framing;
    const dur = changed ? FRAME_MS : first ? 0 : BAND_EASE_MS;
    e.setViewInsets(framing === "menu" && menuBand ? menuBand : {}, dur);
  }, [framing, menuBand, engineEpoch]);

  useEffect(() => {
    const cancel = (): void => {
      setKeyboardNav(false);
      engineRef.current?.clearNavKeys();
    };
    window.addEventListener("pointerdown", cancel);
    return () => window.removeEventListener("pointerdown", cancel);
  }, []);

  // Stop keyboard glide when play is interrupted.
  useEffect(() => {
    if (overlay || settingsApplyPrompt || tutorialActive || paused || !interactive) {
      engineRef.current?.clearNavKeys();
    }
  }, [overlay, settingsApplyPrompt, tutorialActive, paused, interactive]);

  // ---------------- game flow ----------------

  const updateSettings = (patch: Partial<Settings>): void =>
    setSettings((s) => ({ ...s, ...patch }));

  const clearAdvance = (): void => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const clearRevealAnim = (): void => {
    if (revealRaf.current !== null) {
      cancelAnimationFrame(revealRaf.current);
      revealRaf.current = null;
    }
  };

  const stopRevealCountdown = (): void => {
    revealCounting.current = false;
    clearAdvance();
    clearRevealAnim();
    setRevealRemain(null);
  };

  /** User panned/zoomed — keep the corrector up, but cancel auto-advance. */
  const onMapInteract = (): void => {
    if (!revealCounting.current) return;
    stopRevealCountdown();
  };

  const advance = (): void => {
    stopRevealCountdown();
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    dispatch({ type: "next", now: performance.now() });
  };

  const scheduleAdvance = (ms: number): void => {
    clearAdvance();
    advanceTimer.current = window.setTimeout(advance, ms);
  };

  const startRevealCountdown = (): void => {
    stopRevealCountdown();
    revealCounting.current = true;
    const t0 = performance.now();
    setRevealRemain(1);
    scheduleAdvance(REVEAL_MS);
    const tick = (now: number): void => {
      if (!revealCounting.current) return;
      const remain = Math.max(0, 1 - (now - t0) / REVEAL_MS);
      setRevealRemain(remain);
      if (remain > 0) revealRaf.current = requestAnimationFrame(tick);
    };
    revealRaf.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      clearAdvance();
      clearRevealAnim();
    },
    []
  );

  const beginRun = (): void => {
    if (!world) return;
    stopRevealCountdown();
    const rules = pickMatchRules(settings);
    const plan = planRound({
      candidates: regionPool(world, rules.region),
      history,
      passport,
      count: rules.roundLength,
    });
    const pool = plan.ids;
    if (pool.length === 0) return;
    recorded.current = false;
    runId.current = crypto.randomUUID();
    runLog.current = [];
    misfires.current = [];
    setRunRanks(null);
    setSavedScore(false);
    setPersonalBest(false);
    setPaused(false);
    setSettingsApplyPrompt(false);
    setRunRules(rules);
    setScreen("game");
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    // The camera keeps its bearing: you framed a continent on the menu, so the
    // round starts on that same view instead of snapping back to a default the
    // player never asked for. What does change is the framing — the menu band
    // opens out to the whole screen (the insets effect above) while the view
    // closes in to a playable zoom. Together that reads as flying in. It also
    // absorbs a deep close-up left over from a reveal, easing back out.
    e?.zoomTo(PLAY_ZOOM, FRAME_MS);
    dispatch({ type: "start", pool, maxAttempts: rules.attempts, now: performance.now() });
  };

  const openSettings = (): void => {
    setOverlay("settings");
  };

  const closeSettings = (): void => {
    setOverlay(null);
    if (screen === "game" && !matchRulesEqual(pickMatchRules(settings), runRules)) {
      setSettingsApplyPrompt(true);
    }
  };

  const applySettingsRestart = (): void => {
    setSettingsApplyPrompt(false);
    beginRun();
  };

  const applySettingsNextMatch = (): void => {
    setSettingsApplyPrompt(false);
  };

  /** Menu region pick — the ambient globe glides to the chosen continent. */
  const selectRegion = (region: Region): void => {
    sfx.unlockAudio();
    sfx.sfxTap();
    updateSettings({ region });
    setPickSeq((n) => n + 1);
    setAnnounce(
      region === "World" ? STR.menu.regionCleared : STR.menu.regionChosen(STR.regions[region])
    );
    // World has no heart to fly to — stay wherever the player is looking.
    if (region !== "World") engineRef.current?.flyTo(REGION_FOCUS[region], { dur: 1100 });
  };

  const onPlay = (): void => {
    sfx.unlockAudio();
    sfx.sfxTap();
    if (!tutorialSeen()) {
      pendingPlay.current = true;
      setTutorialActive(true);
      return;
    }
    beginRun();
  };

  const onTutorialDone = (): void => {
    markTutorialSeen();
    setTutorialActive(false);
    // Strike the tour's demo set — pins, flashes, ring — before play or menu.
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    if (pendingPlay.current) {
      pendingPlay.current = false;
      beginRun();
    } else {
      e?.resetView();
    }
  };

  // announce each new prompt
  useEffect(() => {
    if (screen === "game" && gs.phase === "prompt" && world && gs.pool.length) {
      const target = world.countries[gs.pool[gs.index]];
      setAnnounce(STR.a11y.announcePrompt(target.props.name, gs.index + 1, gs.pool.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gs.index, gs.phase === "prompt", world]);

  // journal each finished prompt into the profile of past guesses
  const journaled = useRef<GuessOutcome | null>(null);
  useEffect(() => {
    if (!world || !gs.outcome || gs.outcome === journaled.current) return;
    journaled.current = gs.outcome;
    const miss = misfires.current;
    misfires.current = [];
    const iso = world.countries[gs.outcome.countryId].props.iso;
    if (!iso) return;
    const res = gs.outcome.kind === "correct" ? "hit" : gs.outcome.kind;
    const ms = Math.round(performance.now() - gs.promptStart);
    runLog.current.push({
      iso,
      res,
      tries: gs.attempt,
      hints: gs.hintsUsed,
      points: gs.outcome.points,
    });
    setHistory(
      recordGuess({
        iso,
        res,
        tries: gs.attempt,
        hints: gs.hintsUsed,
        t: Date.now(),
        ms,
        ...(miss.length ? { miss } : {}),
      })
    );
  }, [gs, world]);

  // end of round
  useEffect(() => {
    if (gs.phase === "over" && gs.pool.length > 0 && !recorded.current) {
      recorded.current = true;
      const prevBest = loadStats().bestScore;
      recordRun(gs.score, gs.correctCount, gs.guessCount, gs.bestStreak);
      setPersonalBest(gs.score > prevBest && gs.score > 0);
      // Members: one atomic RPC per run; the server re-validates the score,
      // maintains all aggregates, and returns the global board placement.
      if (account.kind === "member" && runLog.current.length > 0) {
        void submitRun({
          run_id: runId.current,
          region: runRules.region,
          score: gs.score,
          correct: gs.correctCount,
          best_streak: gs.bestStreak,
          guesses: runLog.current,
        }).then((ranks) => setRunRanks(ranks));
      }
      sfx.sfxGameOver(gs.correctCount >= gs.pool.length / 2);
      setScreen("results");
      setAnnounce(STR.a11y.announceGameOver(formatPoints(gs.score)));
    }
  }, [gs]);

  /** `hit` is the country under the pin — never null; water never gets here. */
  const evaluateGuess = (
    lonlat: LonLat,
    screenPx: [number, number],
    hit: Country
  ): void => {
    if (!world) return;
    const e = engineRef.current;
    const target = world.countries[gs.pool[gs.index]];

    if (hit.id === target.id) {
      const prox = proximity(target, lonlat);
      const elapsed = performance.now() - gs.promptStart;
      const result = scoreGuess({
        streakBefore: gs.streak,
        proximity: prox,
        elapsedMs: elapsed,
        attempt: gs.attempt,
        hintsUsed: gs.hintsUsed,
        speedBonusEnabled: runRules.speedBonus,
      });
      const iso = target.props.iso;
      const discovery = Boolean(iso && !passport[iso]);
      const points = result.points + (discovery ? DISCOVERY_BONUS : 0);
      const streakAfter = gs.streak + 1;

      e?.addPin(lonlat, "correct");
      e?.clearDirectionHint();
      e?.ripple(lonlat, discovery ? "gold" : "correct");
      e?.flash(target.id, discovery ? "gold" : "correct");
      if (discovery) {
        e?.confettiBurst(screenPx, "discovery");
        sfx.sfxDiscovery();
        if (iso) setPassport(stampPassport(iso));
      } else {
        e?.confettiBurst(screenPx, "correct");
        sfx.sfxCorrect(gs.streak);
      }
      if (streakAfter > 0 && streakAfter % 5 === 0) {
        sfx.sfxMilestone();
        e?.confettiBurst(screenPx, "milestone");
      }

      setAnnounce(
        (discovery ? STR.a11y.announceDiscovery(target.props.name) + " " : "") +
          STR.a11y.announceCorrect(target.props.name, formatPoints(points), streakAfter)
      );
      dispatch({
        type: "correct",
        points,
        discovery,
        iso,
        proximity: prox,
        fast: result.fast,
        bullseye: result.bullseye,
        elapsedMs: elapsed,
      });
      scheduleAdvance(FEEDBACK_MS);
      return;
    }

    // miss — caption stays under this pin so earlier tries remain visible
    if (hit.props.iso) misfires.current.push(hit.props.iso);
    const dist = distanceKm(lonlat, target.centroid);
    const dir = compassDirection(lonlat, target.centroid);
    const willReveal = gs.attempt >= gs.maxAttempts;
    const attemptsLeft = gs.maxAttempts - gs.attempt;
    const pinLines = willReveal
      ? [STR.game.miss(formatKm(dist))]
      : [STR.game.miss(formatKm(dist)), STR.game.attemptsLeft(attemptsLeft)];
    e?.addPin(lonlat, "miss", pinLines);
    e?.ripple(lonlat, "miss");

    if (willReveal) {
      e?.clearDirectionHint();
      sfx.sfxReveal();
      e?.flash(target.id, "reveal", REVEAL_FLASH_MS);
      e?.flyTo(target.centroid, { dur: 900 });
      setAnnounce(STR.a11y.announceReveal(target.props.name));
      dispatch({ type: "miss", distanceKm: dist, direction: dir });
      startRevealCountdown();
    } else {
      e?.showDirectionHint(lonlat, dir);
      sfx.sfxMiss();
      setAnnounce(
        STR.a11y.announceMiss(formatKm(dist), STR.compass[dir], attemptsLeft)
      );
      dispatch({ type: "miss", distanceKm: dist, direction: dir });
    }
  };

  /**
   * Every tap has to land on a country. Water carries no answer and no
   * region, so treating an ocean tap as a choice only ever punishes a
   * misjudged thumb — here it costs nothing and changes nothing.
   */
  const onMapTap = (lonlat: LonLat, screenPx: [number, number]): void => {
    sfx.unlockAudio();
    const hit = hitTest(world!, lonlat);

    if (screen === "menu") {
      const region = hit ? continentRegion(hit.props.continent) : null;
      if (!region) return; // ocean, ice, or land with no round of its own
      // Tapping the continent you already chose hands the world back — the
      // only way to reach "World" now that water is inert.
      selectRegion(region === settings.region ? "World" : region);
      return;
    }
    if (screen === "explore") {
      if (!hit) return;
      setExploreSel(hit);
      engineRef.current?.setSelected(hit.id);
      engineRef.current?.ripple(lonlat, "neutral");
      sfx.sfxTap();
      setAnnounce(hit.props.name);
      return;
    }
    if (screen !== "game" || paused || overlay || settingsApplyPrompt) return;
    // Correct feedback: tap to skip ahead. Reveal/skip: let them pan first; Next dismisses.
    if (gs.phase === "feedback") {
      if (gs.outcome?.kind === "correct") advance();
      return;
    }
    if (gs.phase !== "prompt") return;
    if (!hit) {
      // Not a try, not a miss — just a nudge back toward land.
      engineRef.current?.ripple(lonlat, "neutral");
      setAnnounce(STR.game.tapLand);
      return;
    }
    engineRef.current && sfx.sfxPin();
    evaluateGuess(lonlat, screenPx, hit);
  };

  const onHint = (): void => {
    if (!world || gs.phase !== "prompt" || gs.hintsUsed >= 3 || !runRules.hintsEnabled) return;
    sfx.sfxTap();
    dispatch({ type: "hint" });
  };

  const onSkip = (): void => {
    if (!world || gs.phase !== "prompt") return;
    const target = world.countries[gs.pool[gs.index]];
    sfx.sfxReveal();
    engineRef.current?.flash(target.id, "reveal", REVEAL_FLASH_MS);
    engineRef.current?.flyTo(target.centroid, { dur: 900 });
    setAnnounce(STR.game.skipped(target.props.name));
    dispatch({ type: "skip" });
    startRevealCountdown();
  };

  const backToMenu = (): void => {
    stopRevealCountdown();
    setPaused(false);
    setExploreSel(null);
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    e?.setSelected(null);
    // Recompose the menu view on the player's chosen region — as a flight, not
    // a cut, so leaving a round never teleports the world out from under you.
    e?.flyTo(REGION_FOCUS[settings.region], { dur: 900, zoom: 1 });
    setScreen("menu");
  };

  /** Pause-menu escape hatch: replay the tour on the menu globe, then a fresh run. */
  const tutorialRestart = (): void => {
    backToMenu();
    pendingPlay.current = true;
    setTutorialActive(true);
  };

  const onSaveScore = (name: string): void => {
    const entry: LeaderboardEntry = {
      name: name || STR.results.namePlaceholder,
      score: gs.score,
      region: settings.region,
      correct: gs.correctCount,
      total: gs.pool.length,
      bestStreak: gs.bestStreak,
      date: new Date().toISOString(),
    };
    setLeaderboard(saveLeaderboardEntry(entry));
    updateSettings({ playerName: name });
    setSavedScore(true);
  };

  // ---------------- keyboard ----------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    const eng = engineRef.current;

    if (e.key === "Escape") {
      if (settingsApplyPrompt) {
        applySettingsNextMatch();
      } else if (overlay === "settings") {
        closeSettings();
      } else if (overlay) {
        setOverlay(null);
      } else if (screen === "game") setPaused((p) => !p);
      else if (screen === "explore") backToMenu();
      return;
    }
    if (overlay || settingsApplyPrompt || tutorialActive || paused) return;
    if (screen !== "game" && screen !== "explore") return;
    if (!eng) return;

    const arrow = ARROW_KEYS[e.key];
    if (arrow) {
      e.preventDefault();
      if (e.repeat) return; // controller already tracks held state
      if (!keyboardNav) {
        setKeyboardNav(true);
        setAnnounce(STR.a11y.crosshairOn);
      }
      eng.setNavKey(arrow, true);
      return;
    }

    const zoom = ZOOM_KEYS[e.key];
    if (zoom) {
      e.preventDefault();
      if (e.repeat) return;
      eng.setZoomKey(zoom, true);
      return;
    }

    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        if (screen === "game" && gs.phase === "feedback" && gs.outcome?.kind !== "correct") {
          advance();
          break;
        }
        setKeyboardNav(true);
        const center = eng.centerLonLat();
        if (center) {
          onMapTap(center, [window.innerWidth / 2, window.innerHeight / 2]);
        }
        break;
      }
      case "h":
      case "H":
        if (screen === "game") onHint();
        break;
      case "s":
      case "S":
        if (screen === "game") onSkip();
        break;
    }
  };

  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => keyRef.current(e);
    const onUp = (e: KeyboardEvent): void => {
      const arrow = ARROW_KEYS[e.key];
      if (arrow) {
        engineRef.current?.setNavKey(arrow, false);
        return;
      }
      const zoom = ZOOM_KEYS[e.key];
      if (zoom) engineRef.current?.setZoomKey(zoom, false);
    };
    const onBlur = (): void => engineRef.current?.clearNavKeys();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // ---------------- render ----------------

  if (loadError) {
    return (
      <div className="app">
        <div className="screen menu">
          <p className="empty-note">{STR.loadError}</p>
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="app">
        <div className="screen menu" style={{ justifyContent: "center" }}>
          <header className="wordmark">
            <p className="eyebrow">{STR.eyebrow}</p>
            <h1>{STR.wordmark}</h1>
            <p className="tagline">{STR.loading}</p>
          </header>
        </div>
      </div>
    );
  }

  // A name plate rides the continent you're about to pick, then stamps itself
  // onto the one you chose. Hover wins while it lasts — you're reading ahead,
  // and the picked continent keeps its tint meanwhile. World needs no plate:
  // the whole globe is the answer.
  const plateRegion =
    hoverRegion && hoverRegion !== settings.region
      ? hoverRegion
      : settings.region !== "World"
        ? settings.region
        : null;
  const regionLabel =
    screen === "menu" && !tutorialActive && plateRegion
      ? {
          id: plateRegion === settings.region ? `${plateRegion}#${pickSeq}` : plateRegion,
          eyebrow: STR.menu.regionPlateEyebrow,
          name: STR.regions[plateRegion] ?? plateRegion,
          sub: STR.menu.regionPlateSub(regionPool(world, plateRegion).length),
          at: REGION_FOCUS[plateRegion],
          chosen: plateRegion === settings.region,
          chosenLabel: STR.menu.regionPlateChosen,
        }
      : null;

  const target = gs.pool.length ? world.countries[gs.pool[gs.index]] : null;
  // Hints climb: the vaguest clue first, the one that all but hands you the
  // map last — so spending a third hint always feels like the bigger step.
  const hintText =
    target && gs.hintsUsed > 0 && gs.phase === "prompt"
      ? [
          STR.game.hintPopulation(formatPopulation(target.props.pop)),
          STR.game.hintCapitalFlag(target.flag ?? "", target.props.capital ?? ""),
          STR.game.hintContinent(STR.regions[target.props.continent] ?? target.props.continent),
        ][gs.hintsUsed - 1]
      : null;

  return (
    <div className="app">
      <MapView
        world={world}
        engineRef={engineRef}
        projection={settings.projection}
        graticule={settings.graticule}
        themeColors={themeColors}
        pin={settings.pin}
        pinThemed={settings.pinThemed}
        highContrast={settings.highContrast}
        reduceMotion={reduceMotion}
        interactive={interactive}
        ambient={ambient}
        regionLabel={regionLabel}
        onRegionHover={setHoverRegion}
        onEngineReady={() => setEngineEpoch((n) => n + 1)}
        onTap={onMapTap}
        onInteract={onMapInteract}
      />

      {screen === "menu" && !tutorialActive && (
        <Menu
          world={world}
          account={account}
          passport={passport}
          region={settings.region}
          themeColors={themeColors}
          pin={settings.pin}
          pinThemed={settings.pinThemed}
          onRegion={selectRegion}
          onThemes={() => setOverlay("theme")}
          onPins={() => setOverlay("pin")}
          onPlay={onPlay}
          onExplore={() => {
            sfx.unlockAudio();
            setScreen("explore");
            setAnnounce(STR.explore.hint);
          }}
          onPassport={() => setOverlay("passport")}
          onLeaderboard={() => setOverlay("leaderboard")}
          onSettings={openSettings}
          onAccount={() => setOverlay("account")}
          onBand={onMenuBand}
        />
      )}

      {screen === "menu" && !tutorialActive && <SiteFooter onSettings={openSettings} />}

      {tutorialActive && (
        <Tutorial
          onDone={onTutorialDone}
          engineRef={engineRef}
          world={world}
          reduceMotion={reduceMotion}
        />
      )}

      {screen === "game" && target && (
        <Hud
          gs={gs}
          world={world}
          hintText={hintText}
          hintsAllowed={runRules.hintsEnabled}
          onPause={() => setPaused(true)}
          onSettings={openSettings}
          onHint={onHint}
          onSkip={onSkip}
          onAdvance={advance}
          revealRemain={revealRemain}
          onZoom={(f) => engineRef.current?.zoomBy(f)}
        />
      )}

      {screen === "explore" && (
        <>
          <div className="explore-hint">{STR.explore.hint}</div>
          <div className="hud-bottom">
            <div className="hud-actions">
              <button className="btn btn-ghost" onClick={backToMenu}>
                ← {STR.explore.back}
              </button>
            </div>
            {/* Same capsule, same corner as the game's — the map controls
                must not move when you switch between exploring and playing. */}
            <div className="zoom-capsule">
              <button
                onClick={() => engineRef.current?.zoomBy(1.5)}
                aria-label={STR.game.zoomIn}
              >
                <IconPlus />
              </button>
              <button
                onClick={() => engineRef.current?.zoomBy(1 / 1.5)}
                aria-label={STR.game.zoomOut}
              >
                <IconMinus />
              </button>
            </div>
          </div>
          {exploreSel && (
            <ExploreCard
              country={exploreSel}
              discovered={Boolean(exploreSel.props.iso && passport[exploreSel.props.iso])}
            />
          )}
        </>
      )}

      {screen === "results" && (
        <Results
          gs={gs}
          world={world}
          account={account}
          ranks={runRanks}
          isPersonalBest={personalBest}
          defaultName={settings.playerName}
          onSave={onSaveScore}
          saved={savedScore}
          onSignIn={() => setOverlay("account")}
          onPlayAgain={beginRun}
          onMenu={backToMenu}
        />
      )}

      {paused && (
        <Sheet title={STR.pause.title} onClose={() => setPaused(false)}>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => setPaused(false)}>
              {STR.game.resume}
            </button>
            <button className="btn btn-ghost" onClick={openSettings}>
              {STR.pause.settings}
            </button>
            <button className="btn btn-ghost" onClick={beginRun}>
              {STR.pause.restart}
            </button>
            <button className="btn btn-ghost" onClick={tutorialRestart}>
              {STR.pause.tutorial}
            </button>
            <button className="btn btn-ghost" onClick={backToMenu}>
              {STR.game.quit}
            </button>
          </div>
        </Sheet>
      )}

      {overlay === "settings" && (
        <SettingsSheet
          settings={settings}
          themeColors={themeColors}
          onChange={updateSettings}
          onClose={closeSettings}
          onOpenThemes={() => setOverlay("theme")}
          onOpenPins={() => setOverlay("pin")}
          onReplayTutorial={() => {
            setOverlay(null);
            pendingPlay.current = false;
            setTutorialActive(true);
          }}
        />
      )}
      {settingsApplyPrompt && (
        <Sheet title={STR.settings.applyTitle} onClose={applySettingsNextMatch}>
          <p className="set-apply-body">{STR.settings.applyBody}</p>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={applySettingsRestart}>
              {STR.settings.applyRestart}
            </button>
            <button className="btn btn-ghost" onClick={applySettingsNextMatch}>
              {STR.settings.applyNext}
            </button>
          </div>
        </Sheet>
      )}
      {overlay === "theme" && (
        <ThemeSheet
          themeId={settings.theme}
          customColor={settings.customColor}
          onSelect={selectTheme}
          onCustomColor={(customColor) => updateSettings({ customColor })}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === "pin" && (
        <PinSheet
          pinId={settings.pin}
          themed={settings.pinThemed}
          colors={themeColors}
          onSelect={selectPin}
          onThemed={(pinThemed) => updateSettings({ pinThemed })}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === "passport" && (
        <PassportSheet
          world={world}
          passport={passport}
          history={history}
          onClose={() => setOverlay(null)}
        />
      )}
      {/* The rail asks for the world's board; the device list is a tab away. */}
      {overlay === "leaderboard" && (
        <LeaderboardSheet
          entries={leaderboard}
          region={settings.region}
          account={account}
          initialTab="global"
          onSignIn={() => setOverlay("account")}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === "account" && (
        <AccountSheet account={account} onClose={() => setOverlay(null)} />
      )}

      <div className="sr-only" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
