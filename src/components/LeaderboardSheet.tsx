import { STR } from "../content/strings";
import type { LeaderboardEntry } from "../lib/storage";
import { formatPoints } from "../game/scoring";
import { Sheet } from "./Sheet";

interface LeaderboardSheetProps {
  entries: LeaderboardEntry[];
  onClose: () => void;
}

export function LeaderboardSheet({ entries, onClose }: LeaderboardSheetProps): JSX.Element {
  const top = entries.slice(0, 10);
  return (
    <Sheet title={STR.leaderboard.title} onClose={onClose}>
      {top.length === 0 ? (
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
      )}
    </Sheet>
  );
}
