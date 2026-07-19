import { useEffect, useReducer, useRef, useState } from "react";
import { ExploreCard } from "./components/ExploreCard";
import { Hud } from "./components/Hud";
import { LeaderboardSheet } from "./components/LeaderboardSheet";
import { MapView } from "./components/MapView";
import { Menu } from "./components/Menu";
import { PassportSheet } from "./components/PassportSheet";
import { Results } from "./components/Results";
import { SettingsSheet } from "./components/SettingsSheet";
import { Sheet } from "./components/Sheet";
import { Tutorial } from "./components/Tutorial";
import { STR } from "./content/strings";
import { IDLE_GAME, gameReducer, shuffle } from "./game/reducer";
import { DISCOVERY_BONUS, formatPoints, scoreGuess } from "./game/scoring";
import * as sfx from "./lib/audio";
import {
  compassDirection,
  distanceKm,
  formatKm,
  hitTest,
  loadWorld,
  proximity,
  regionPool,
  type Country,
  type LonLat,
  type Region,
  type World,
} from "./lib/geo";
import {
  loadLeaderboard,
  loadPassport,
  loadSettings,
  loadStats,
  markTutorialSeen,
  recordRun,
  saveLeaderboardEntry,
  saveSettings,
  stampPassport,
  tutorialSeen,
  type LeaderboardEntry,
  type Settings,
} from "./lib/storage";
import type { MapEngine } from "./map/MapEngine";

type ScreenId = "menu" | "game" | "results" | "explore";
type OverlayId = null | "settings" | "passport" | "leaderboard";

const FEEDBACK_MS = 1900;
const REVEAL_MS = 3000;

export default function App(): JSX.Element {
  const [world, setWorld] = useState<World | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<ScreenId>("menu");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [paused, setPaused] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [passport, setPassport] = useState(loadPassport);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard);
  const [exploreSel, setExploreSel] = useState<Country | null>(null);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [savedScore, setSavedScore] = useState(false);
  const [personalBest, setPersonalBest] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [gs, dispatch] = useReducer(gameReducer, IDLE_GAME);

  const engineRef = useRef<MapEngine | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const pendingPlay = useRef(false);
  const recorded = useRef(true);

  const reduceMotion =
    settings.reduceMotion === "on" || (settings.reduceMotion === "auto" && osReducedMotion);

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

  useEffect(() => {
    saveSettings(settings);
    sfx.setSound(settings.sound);
    sfx.setHaptics(settings.haptics);
    document.body.classList.toggle("hc", settings.highContrast);
  }, [settings]);

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  // ---------------- engine mode sync ----------------

  const interactive = (screen === "game" && !paused) || screen === "explore";
  const ambient = screen === "menu" || screen === "results";

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setDiscoveredTint(
      screen === "explore" ? new Set(Object.keys(passport)) : null
    );
    if (screen !== "explore") {
      e.setSelected(null);
    }
  }, [screen, passport, world]);

  useEffect(() => {
    engineRef.current?.setCrosshair(keyboardNav && (screen === "game" || screen === "explore"));
  }, [keyboardNav, screen]);

  useEffect(() => {
    const cancel = (): void => setKeyboardNav(false);
    window.addEventListener("pointerdown", cancel);
    return () => window.removeEventListener("pointerdown", cancel);
  }, []);

  // ---------------- game flow ----------------

  const updateSettings = (patch: Partial<Settings>): void =>
    setSettings((s) => ({ ...s, ...patch }));

  const clearAdvance = (): void => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const advance = (): void => {
    clearAdvance();
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    dispatch({ type: "next", now: performance.now() });
  };

  const scheduleAdvance = (ms: number): void => {
    clearAdvance();
    advanceTimer.current = window.setTimeout(advance, ms);
  };

  useEffect(() => clearAdvance, []);

  const beginRun = (): void => {
    if (!world) return;
    const pool = shuffle(regionPool(world, settings.region))
      .slice(0, settings.roundLength)
      .map((c) => c.id);
    if (pool.length === 0) return;
    recorded.current = false;
    setSavedScore(false);
    setPersonalBest(false);
    setPaused(false);
    setScreen("game");
    const e = engineRef.current;
    e?.clearPins();
    e?.clearFlashes();
    e?.resetView();
    dispatch({ type: "start", pool, maxAttempts: settings.attempts, now: performance.now() });
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
    if (pendingPlay.current) {
      pendingPlay.current = false;
      beginRun();
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

  // end of round
  useEffect(() => {
    if (gs.phase === "over" && gs.pool.length > 0 && !recorded.current) {
      recorded.current = true;
      const prevBest = loadStats().bestScore;
      recordRun(gs.score, gs.correctCount, gs.guessCount, gs.bestStreak);
      setPersonalBest(gs.score > prevBest && gs.score > 0);
      sfx.sfxGameOver(gs.correctCount >= gs.pool.length / 2);
      setScreen("results");
      setAnnounce(STR.a11y.announceGameOver(formatPoints(gs.score)));
    }
  }, [gs]);

  const evaluateGuess = (lonlat: LonLat, screenPx: [number, number]): void => {
    if (!world) return;
    const e = engineRef.current;
    const target = world.countries[gs.pool[gs.index]];
    const hit = hitTest(world, lonlat);

    if (hit && hit.id === target.id) {
      const prox = proximity(target, lonlat);
      const elapsed = performance.now() - gs.promptStart;
      const result = scoreGuess({
        streakBefore: gs.streak,
        proximity: prox,
        elapsedMs: elapsed,
        attempt: gs.attempt,
        hintsUsed: gs.hintsUsed,
        speedBonusEnabled: settings.speedBonus,
      });
      const iso = target.props.iso;
      const discovery = Boolean(iso && !passport[iso]);
      const points = result.points + (discovery ? DISCOVERY_BONUS : 0);
      const streakAfter = gs.streak + 1;

      e?.addPin(lonlat, "correct");
      e?.ripple(lonlat, discovery ? "gold" : "correct");
      e?.flash(target.id, discovery ? "gold" : "correct");
      if (discovery) {
        e?.confettiBurst(screenPx);
        sfx.sfxDiscovery();
        if (iso) setPassport(stampPassport(iso));
      } else {
        sfx.sfxCorrect(gs.streak);
      }
      if (streakAfter > 0 && streakAfter % 5 === 0) {
        sfx.sfxMilestone();
        e?.confettiBurst(screenPx);
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

    // miss
    const dist = distanceKm(lonlat, target.centroid);
    const dir = compassDirection(lonlat, target.centroid);
    const willReveal = gs.attempt >= gs.maxAttempts;
    e?.addPin(lonlat, "miss");
    e?.ripple(lonlat, "miss");

    if (willReveal) {
      sfx.sfxReveal();
      e?.flash(target.id, "reveal", 2800);
      e?.flyTo(target.centroid, { dur: 900 });
      setAnnounce(STR.a11y.announceReveal(target.props.name));
      dispatch({ type: "miss", distanceKm: dist, direction: dir });
      scheduleAdvance(REVEAL_MS);
    } else {
      sfx.sfxMiss();
      setAnnounce(
        STR.a11y.announceMiss(
          formatKm(dist),
          STR.compass[dir],
          gs.maxAttempts - gs.attempt
        )
      );
      dispatch({ type: "miss", distanceKm: dist, direction: dir });
    }
  };

  const onMapTap = (lonlat: LonLat, screenPx: [number, number]): void => {
    sfx.unlockAudio();
    if (screen === "explore") {
      const hit = hitTest(world!, lonlat);
      setExploreSel(hit);
      engineRef.current?.setSelected(hit ? hit.id : null);
      if (hit) {
        engineRef.current?.ripple(lonlat, "neutral");
        sfx.sfxTap();
        setAnnounce(hit.props.name);
      }
      return;
    }
    if (screen !== "game" || paused) return;
    if (gs.phase === "feedback") {
      advance();
      return;
    }
    if (gs.phase !== "prompt") return;
    engineRef.current && sfx.sfxPin();
    evaluateGuess(lonlat, screenPx);
  };

  const onHint = (): void => {
    if (!world || gs.phase !== "prompt" || gs.hintsUsed >= 3 || !settings.hintsEnabled) return;
    const target = world.countries[gs.pool[gs.index]];
    const level = gs.hintsUsed + 1;
    if (level === 3) {
      engineRef.current?.flash(target.id, "hint", 1600);
      engineRef.current?.ripple(target.centroid, "neutral");
    }
    sfx.sfxTap();
    dispatch({ type: "hint" });
  };

  const onSkip = (): void => {
    if (!world || gs.phase !== "prompt") return;
    const target = world.countries[gs.pool[gs.index]];
    sfx.sfxReveal();
    engineRef.current?.flash(target.id, "reveal", 2800);
    engineRef.current?.flyTo(target.centroid, { dur: 900 });
    setAnnounce(STR.game.skipped(target.props.name));
    dispatch({ type: "skip" });
    scheduleAdvance(REVEAL_MS);
  };

  const backToMenu = (): void => {
    clearAdvance();
    setPaused(false);
    setExploreSel(null);
    engineRef.current?.clearPins();
    engineRef.current?.clearFlashes();
    engineRef.current?.setSelected(null);
    setScreen("menu");
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
      if (overlay) setOverlay(null);
      else if (screen === "game") setPaused((p) => !p);
      else if (screen === "explore") backToMenu();
      return;
    }
    if (overlay || tutorialActive || paused) return;
    if (screen !== "game" && screen !== "explore") return;
    if (!eng) return;

    const nav = (dx: number, dy: number): void => {
      e.preventDefault();
      if (!keyboardNav) {
        setKeyboardNav(true);
        setAnnounce(STR.a11y.crosshairOn);
      }
      eng.nudge(dx, dy);
    };

    switch (e.key) {
      case "ArrowLeft":
        nav(-1, 0);
        break;
      case "ArrowRight":
        nav(1, 0);
        break;
      case "ArrowUp":
        nav(0, -1);
        break;
      case "ArrowDown":
        nav(0, 1);
        break;
      case "+":
      case "=":
        eng.zoomBy(1.4);
        break;
      case "-":
      case "_":
        eng.zoomBy(1 / 1.4);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
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
    const fn = (e: KeyboardEvent): void => keyRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
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

  const target = gs.pool.length ? world.countries[gs.pool[gs.index]] : null;
  const hintText =
    target && gs.hintsUsed > 0 && gs.phase === "prompt"
      ? [
          STR.game.hintContinent(STR.regions[target.props.continent] ?? target.props.continent),
          STR.game.hintCapitalFlag(target.flag ?? "", target.props.capital ?? ""),
          STR.game.hintFlash,
        ][gs.hintsUsed - 1]
      : null;

  return (
    <div className="app">
      <MapView
        world={world}
        engineRef={engineRef}
        projection={settings.projection}
        graticule={settings.graticule}
        highContrast={settings.highContrast}
        reduceMotion={reduceMotion}
        interactive={interactive}
        ambient={ambient}
        onTap={onMapTap}
      />

      {screen === "menu" && !tutorialActive && (
        <Menu
          region={settings.region}
          onRegion={(region: Region) => updateSettings({ region })}
          onPlay={onPlay}
          onExplore={() => {
            sfx.unlockAudio();
            setScreen("explore");
            setAnnounce(STR.explore.hint);
          }}
          onPassport={() => setOverlay("passport")}
          onLeaderboard={() => setOverlay("leaderboard")}
          onSettings={() => setOverlay("settings")}
        />
      )}

      {tutorialActive && <Tutorial onDone={onTutorialDone} />}

      {screen === "game" && target && (
        <Hud
          gs={gs}
          world={world}
          hintText={hintText}
          hintsAllowed={settings.hintsEnabled}
          onPause={() => setPaused(true)}
          onHint={onHint}
          onSkip={onSkip}
          onZoom={(f) => engineRef.current?.zoomBy(f)}
        />
      )}

      {screen === "explore" && (
        <>
          <div className="explore-hint">{STR.explore.hint}</div>
          <div className="hud-bottom">
            <button className="btn btn-ghost" onClick={backToMenu}>
              ← {STR.explore.back}
            </button>
          </div>
          <div className="zoom-stack">
            <button
              className="icon-btn"
              onClick={() => engineRef.current?.zoomBy(1.5)}
              aria-label={STR.game.zoomIn}
            >
              +
            </button>
            <button
              className="icon-btn"
              onClick={() => engineRef.current?.zoomBy(1 / 1.5)}
              aria-label={STR.game.zoomOut}
            >
              −
            </button>
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
          isPersonalBest={personalBest}
          defaultName={settings.playerName}
          onSave={onSaveScore}
          saved={savedScore}
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
            <button className="btn btn-ghost" onClick={backToMenu}>
              {STR.game.quit}
            </button>
          </div>
        </Sheet>
      )}

      {overlay === "settings" && (
        <SettingsSheet
          settings={settings}
          onChange={updateSettings}
          onClose={() => setOverlay(null)}
          onReplayTutorial={() => {
            setOverlay(null);
            pendingPlay.current = false;
            setTutorialActive(true);
          }}
        />
      )}
      {overlay === "passport" && (
        <PassportSheet world={world} passport={passport} onClose={() => setOverlay(null)} />
      )}
      {overlay === "leaderboard" && (
        <LeaderboardSheet entries={leaderboard} onClose={() => setOverlay(null)} />
      )}

      <div className="sr-only" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
