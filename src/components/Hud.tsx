import { useEffect, useRef, useState, type CSSProperties } from "react";
import { STR } from "../content/strings";
import type { GameState } from "../game/reducer";
import { comboMultiplier, formatPoints } from "../game/scoring";
import type { World } from "../lib/geo";
import { IconBulb, IconMinus, IconPause, IconPlus, IconSliders } from "./icons";

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
  /** 1→0 while auto-advance countdown runs; null when cancelled. */
  revealRemain: number | null;
  onPause: () => void;
  onSettings: () => void;
  onHint: () => void;
  onSkip: () => void;
  onAdvance: () => void;
  onZoom: (factor: number) => void;
}

export function Hud({
  gs,
  world,
  hintText,
  hintsAllowed,
  revealRemain,
  onPause,
  onSettings,
  onHint,
  onSkip,
  onAdvance,
  onZoom,
}: HudProps): JSX.Element {
  const target = world.countries[gs.pool[gs.index]];
  const score = useCountUp(gs.score);
  const mult = comboMultiplier(gs.streak);
  const o = gs.outcome;
  const outcomeCountry = o ? world.countries[o.countryId] : null;
  const isReveal = o !== null && o.kind !== "correct";
  const showingReveal = isReveal && gs.phase === "feedback";

  return (
    <>
      <div className="hud-top">
        <button className="icon-btn hud-pause" onClick={onPause} aria-label={STR.game.pause}>
          <IconPause />
        </button>

        <div className="hud-mission">
          <div className="prompt-card" key={gs.index}>
            <div className="find">{STR.game.find}</div>
            <div className="target">{target.props.name}</div>
            <div className="voyage">
              <div
                className="voyage-track"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={gs.pool.length}
                aria-valuenow={gs.index + 1}
                aria-label={STR.game.progressAria(gs.index + 1, gs.pool.length)}
              >
                {gs.pool.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < gs.index ? "seg is-done" : i === gs.index ? "seg is-now" : "seg"
                    }
                  />
                ))}
              </div>
              <span className="voyage-count" aria-hidden="true">
                {STR.game.progressShort(gs.index + 1, gs.pool.length)}
              </span>
            </div>
          </div>

          <div
            className={`hud-scoreboard ${
              gs.streak >= 6 ? "is-blazing" : gs.streak >= 3 ? "is-hot" : ""
            }`}
            aria-label={`${STR.game.score}: ${formatPoints(gs.score)}, ${STR.game.streakChip(mult)}`}
          >
            <span className="score-num">{formatPoints(score)}</span>
            <span className="streak-chip" key={mult}>
              ×{mult.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          className="icon-btn hud-settings"
          onClick={onSettings}
          aria-label={STR.menu.settings}
        >
          <IconSliders />
        </button>
      </div>

      {hintText && gs.phase === "prompt" && <div className="hint-note">{hintText}</div>}

      {o && gs.phase === "feedback" && (
        <div
          className={`feedback ${
            o.kind === "correct"
              ? o.discovery
                ? "is-discovery"
                : "is-correct"
              : "is-miss is-reveal"
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
              <div
                className={`feedback-next-shell${revealRemain !== null ? " is-counting" : ""}`}
                style={
                  revealRemain !== null
                    ? ({ "--cd": revealRemain } as CSSProperties)
                    : undefined
                }
              >
                <button className="btn btn-primary feedback-next" onClick={onAdvance}>
                  {STR.game.next}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!showingReveal && (
        <div className="hud-bottom">
          <div className="hud-actions">
            {hintsAllowed && (
              <button
                className="btn btn-ghost hint-btn"
                onClick={onHint}
                disabled={gs.phase !== "prompt" || gs.hintsUsed >= 3}
                aria-label={STR.game.hintsAria(3 - gs.hintsUsed)}
              >
                <IconBulb />
                {STR.game.hint}
                <span className="hint-pips" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i < 3 - gs.hintsUsed ? "pip is-left" : "pip"} />
                  ))}
                </span>
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={onSkip}
              disabled={gs.phase !== "prompt"}
            >
              {STR.game.skip}
            </button>
          </div>

          <div className="zoom-capsule">
            <button onClick={() => onZoom(1.5)} aria-label={STR.game.zoomIn}>
              <IconPlus />
            </button>
            <button onClick={() => onZoom(1 / 1.5)} aria-label={STR.game.zoomOut}>
              <IconMinus />
            </button>
          </div>
        </div>
      )}

      {showingReveal && (
        <div className="zoom-capsule zoom-capsule-reveal">
          <button onClick={() => onZoom(1.5)} aria-label={STR.game.zoomIn}>
            <IconPlus />
          </button>
          <button onClick={() => onZoom(1 / 1.5)} aria-label={STR.game.zoomOut}>
            <IconMinus />
          </button>
        </div>
      )}
    </>
  );
}
