import { useState } from "react";
import { STR } from "../content/strings";
import type { GameState } from "../game/reducer";
import { formatPoints } from "../game/scoring";
import type { Account } from "../lib/account";
import type { BoardRanks } from "../lib/cloud";
import type { World } from "../lib/geo";
import { flagEmoji } from "../lib/geo";

interface ResultsProps {
  gs: GameState;
  world: World;
  account: Account;
  /** Global board placement, once the cloud confirms the run. */
  ranks: BoardRanks | null;
  isPersonalBest: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  saved: boolean;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export function Results({
  gs,
  account,
  ranks,
  isPersonalBest,
  defaultName,
  onSave,
  saved,
  onPlayAgain,
  onMenu,
}: ResultsProps): JSX.Element {
  const [name, setName] = useState(defaultName);
  const accuracy = gs.guessCount ? Math.round((gs.correctCount / gs.guessCount) * 100) : 0;

  return (
    <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={STR.results.title}>
        <div className="sheet-head">
          <h2>{STR.results.title}</h2>
        </div>
        <div className="sheet-body">
          <div className="results-hero">
            <div className="label">
              {isPersonalBest ? STR.results.newBest : STR.results.finalScore}
            </div>
            <div className="big-score">{formatPoints(gs.score)}</div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="v">
                {gs.correctCount}/{gs.pool.length}
              </div>
              <div className="k">{STR.results.correct}</div>
            </div>
            <div className="stat">
              <div className="v">{gs.bestStreak}</div>
              <div className="k">{STR.results.bestStreak}</div>
            </div>
            <div className="stat">
              <div className="v">{accuracy}%</div>
              <div className="k">{STR.results.accuracy}</div>
            </div>
            <div className="stat">
              <div className="v">
                {gs.fastestMs !== null ? `${(gs.fastestMs / 1000).toFixed(1)}s` : "—"}
              </div>
              <div className="k">{STR.results.fastest}</div>
            </div>
          </div>

          {gs.discoveries.length > 0 && (
            <div className="discovery-strip">
              <div className="flags" aria-hidden="true">
                {gs.discoveries.map((iso) => flagEmoji(iso)).join(" ")}
              </div>
              <div className="label">{STR.results.discoveries}</div>
            </div>
          )}

          {!saved ? (
            <>
              <div className="name-row">
                <input
                  value={name}
                  maxLength={20}
                  placeholder={STR.results.namePlaceholder}
                  aria-label={STR.results.savePrompt}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="btn btn-ghost" onClick={() => onSave(name.trim())}>
                  {STR.results.save}
                </button>
              </div>
              {account.kind === "guest" ? (
                <p className="save-note">{STR.account.guestScoreNote}</p>
              ) : (
                <p className="save-note" role="status">
                  {ranks?.weekly
                    ? STR.results.globalWeekly(ranks.weekly.toLocaleString())
                    : STR.results.syncedNote}
                </p>
              )}
            </>
          ) : (
            <p className="empty-note" style={{ padding: "0 0 12px" }} role="status">
              {STR.results.saved}
            </p>
          )}

          <div className="results-actions">
            <button className="btn btn-primary" autoFocus onClick={onPlayAgain}>
              {STR.results.playAgain}
            </button>
            <button className="btn btn-ghost" onClick={onMenu}>
              {STR.results.backToMenu}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
