import { STR } from "../content/strings";
import { REGIONS, type Region } from "../lib/geo";

interface MenuProps {
  region: Region;
  onRegion: (r: Region) => void;
  onPlay: () => void;
  onExplore: () => void;
  onPassport: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}

export function Menu(props: MenuProps): JSX.Element {
  return (
    <div className="screen menu">
      <header className="wordmark">
        <p className="eyebrow">{STR.eyebrow}</p>
        <h1>{STR.wordmark}</h1>
        <p className="tagline">{STR.tagline}</p>
      </header>

      <div className="menu-region">
        <span className="label" id="region-label">
          {STR.menu.regionLabel}
        </span>
        <div className="chip-row" role="group" aria-labelledby="region-label">
          {REGIONS.map((r) => (
            <button
              key={r}
              className={`chip ${r === props.region ? "is-active" : ""}`}
              aria-pressed={r === props.region}
              onClick={() => props.onRegion(r)}
            >
              {STR.regions[r]}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary menu-play" onClick={props.onPlay}>
        {STR.menu.play}
      </button>

      <div className="menu-secondary">
        <button className="btn btn-ghost" onClick={props.onExplore}>
          {STR.menu.explore}
        </button>
        <button className="btn btn-ghost" onClick={props.onPassport}>
          {STR.menu.passport}
        </button>
        <button className="btn btn-ghost" onClick={props.onLeaderboard}>
          {STR.menu.leaderboard}
        </button>
        <button className="btn btn-ghost" onClick={props.onSettings}>
          {STR.menu.settings}
        </button>
      </div>
    </div>
  );
}
