import { useEffect, useRef, useState } from "react";
import { STR } from "../content/strings";
import type { GameState } from "../game/reducer";
import { comboMultiplier, formatPoints } from "../game/scoring";
import type { World } from "../lib/geo";
import { formatKm } from "../lib/geo";

/** Cookie-clicker style score ticker: counts up toward the real value. */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const t0 = performance.now();
    const dur = 600;
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return shown;
}

interface HudProps {
  gs: GameState;
  world: World;
  hintText: string | null;
  hintsAllowed: boolean;
  onPause: () => void;
  onHint: () => void;
  onSkip: () => void;
  onZoom: (factor: number) => void;
}

export function Hud({
  gs,
  world,
  hintText,
  hintsAllowed,
  onPause,
  onHint,
  onSkip,
  onZoom,
}: HudProps): JSX.Element {
  const target = world.countries[gs.pool[gs.index]];
  const score = useCountUp(gs.score);
  const mult = comboMultiplier(gs.streak);
  const o = gs.outcome;
  const outcomeCountry = o ? world.countries[o.countryId] : null;

  return (
    <>
      <div className="hud-top">
        <button className="icon-btn" onClick={onPause} aria-label={STR.game.pause}>
          ⏸
        </button>
        <div className="prompt-card" key={gs.index}>
          <div className="find">{STR.game.find}</div>
          <div className="target">{target.props.name}</div>
          <div className="progress">{STR.game.progress(gs.index + 1, gs.pool.length)}</div>
        </div>
        <div className="hud-score">
          <div className="score-chip" aria-label={`${STR.game.score}: ${formatPoints(gs.score)}`}>
            {formatPoints(score)}
          </div>
          <div className={`streak-chip ${gs.streak >= 3 ? "is-hot" : ""}`}>
            {STR.game.streakChip(mult)}
          </div>
        </div>
      </div>

      {hintText && gs.phase === "prompt" && <div className="hint-note">{hintText}</div>}

      {gs.missInfo && gs.phase === "prompt" && (
        <div className="toast" role="status">
          {STR.game.miss(
            formatKm(gs.missInfo.distanceKm),
            STR.compass[gs.missInfo.direction] ?? gs.missInfo.direction
          )}
          {" · "}
          {STR.game.attemptsLeft(gs.missInfo.attemptsLeft)}
        </div>
      )}

      {o && gs.phase === "feedback" && (
        <div
          className={`feedback ${
            o.kind === "correct" ? (o.discovery ? "is-discovery" : "is-correct") : "is-miss"
          }`}
        >
          {o.kind === "correct" ? (
            <>
              <div className="headline">
                {o.discovery
                  ? STR.game.discovery
                  : o.bullseye
                    ? STR.game.bullseye
                    : STR.game.correct[o.points % STR.game.correct.length]}
              </div>
              <div className="points">+{formatPoints(o.points)}</div>
              <div className="detail">
                {STR.game.accuracy(Math.round(o.proximity * 100))}
                {o.fast === "fast" && ` · ${STR.game.speedFast}`}
                {o.fast === "quick" && ` · ${STR.game.speedQuick}`}
                {o.streakAfter >= 2 && ` · ×${formatPoints(comboMultiplier(o.streakAfter))} next`}
              </div>
            </>
          ) : (
            <>
              <div className="headline">
                {o.kind === "skip"
                  ? STR.game.skipped(outcomeCountry!.props.name)
                  : STR.game.reveal(outcomeCountry!.props.name)}
              </div>
              <div className="detail">{STR.game.revealSub}</div>
            </>
          )}
        </div>
      )}

      <div className="hud-bottom">
        {hintsAllowed && (
          <button
            className="btn btn-ghost"
            onClick={onHint}
            disabled={gs.phase !== "prompt" || gs.hintsUsed >= 3}
          >
            💡 {STR.game.hint}
          </button>
        )}
        <button className="btn-quiet" onClick={onSkip} disabled={gs.phase !== "prompt"}>
          {STR.game.skip}
        </button>
      </div>

      <div className="zoom-stack">
        <button className="icon-btn" onClick={() => onZoom(1.5)} aria-label={STR.game.zoomIn}>
          +
        </button>
        <button className="icon-btn" onClick={() => onZoom(1 / 1.5)} aria-label={STR.game.zoomOut}>
          −
        </button>
      </div>
    </>
  );
}
