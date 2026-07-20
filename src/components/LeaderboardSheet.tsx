import { useEffect, useState } from "react";
import { STR } from "../content/strings";
import { formatPoints } from "../game/scoring";
import { isMember, type Account } from "../lib/account";
import { fetchLeaderboard, type Board, type BoardPeriod } from "../lib/cloud";
import type { Region } from "../lib/geo";
import type { LeaderboardEntry } from "../lib/storage";
import { Sheet } from "./Sheet";

interface LeaderboardSheetProps {
  entries: LeaderboardEntry[];
  region: Region;
  account: Account;
  onClose: () => void;
}

type Tab = "device" | "global";

export function LeaderboardSheet({
  entries,
  region,
  account,
  onClose,
}: LeaderboardSheetProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("device");
  const [period, setPeriod] = useState<BoardPeriod>("thisweek");
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (tab !== "global") return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setBoard(null);
    void fetchLeaderboard(period, region).then((b) => {
      if (cancelled) return;
      setLoading(false);
      if (b) setBoard(b);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, period, region]);

  const top = entries.slice(0, 10);

  return (
    <Sheet title={STR.leaderboard.title} onClose={onClose}>
      <div className="set-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "device"}
          onClick={() => setTab("device")}
        >
          {STR.leaderboard.tabDevice}
        </button>
        <button
          role="tab"
          aria-selected={tab === "global"}
          onClick={() => setTab("global")}
        >
          {STR.leaderboard.tabGlobal}
        </button>
      </div>

      {tab === "device" ? (
        top.length === 0 ? (
          <p className="empty-note">{STR.leaderboard.empty}</p>
        ) : (
          <ol className="lb-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {top.map((e, i) => (
              <li key={`${e.date}-${i}`} className="lb-row">
                <span className="rank">{i + 1}</span>
                <span className="who">
                  {e.name || STR.results.namePlaceholder}
                  <span className="meta">
                    {STR.leaderboard.meta(
                      STR.regions[e.region] ?? e.region,
                      new Date(e.date).toLocaleDateString()
                    )}
                  </span>
                </span>
                <span className="pts">{formatPoints(e.score)}</span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <>
          <div className="set-tabs" role="tablist" aria-label={STR.leaderboard.tabGlobal}>
            <button
              role="tab"
              aria-selected={period === "thisweek"}
              onClick={() => setPeriod("thisweek")}
            >
              {STR.leaderboard.boardWeekly}
            </button>
            <button
              role="tab"
              aria-selected={period === "alltime"}
              onClick={() => setPeriod("alltime")}
            >
              {STR.leaderboard.boardAlltime}
            </button>
          </div>

          {loading && <p className="empty-note">{STR.leaderboard.loading}</p>}
          {failed && <p className="empty-note">{STR.leaderboard.loadError}</p>}
          {board &&
            (board.entries.length === 0 ? (
              <p className="empty-note">{STR.leaderboard.globalEmpty}</p>
            ) : (
              <ol className="lb-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {board.entries.map((e) => (
                  <li key={`${e.rank}-${e.name}`} className="lb-row">
                    <span className="rank">{e.rank}</span>
                    <span className="who">
                      {e.name || STR.results.namePlaceholder}
                      <span className="meta">
                        {STR.leaderboard.meta(
                          STR.regions[region] ?? region,
                          STR.leaderboard.globalMeta(e.correct, e.rounds)
                        )}
                      </span>
                    </span>
                    <span className="pts">{formatPoints(e.score)}</span>
                  </li>
                ))}
              </ol>
            ))}
          {board?.me && (
            <p className="empty-note" role="status">
              {STR.leaderboard.yourRank(board.me.rank.toLocaleString())}
            </p>
          )}
          {board && !isMember(account) && (
            <p className="empty-note">{STR.leaderboard.signInPrompt}</p>
          )}
        </>
      )}
    </Sheet>
  );
}
