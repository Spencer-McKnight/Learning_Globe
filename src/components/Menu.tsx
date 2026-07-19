import { useMemo, useState } from "react";
import { STR } from "../content/strings";
import { formatPoints } from "../game/scoring";
import { REGIONS, regionPool, type Region, type World } from "../lib/geo";
import { loadStats, type Passport } from "../lib/storage";
import type { ThemeColors } from "../styles/themes";
import { IconCompass, IconPassport, IconSliders, IconTrophy } from "./icons";
import { ThemeOrb } from "./ThemeSheet";

interface MenuProps {
  world: World;
  passport: Passport;
  region: Region;
  roundLength: number;
  themeColors: ThemeColors;
  onRegion: (r: Region) => void;
  onPlay: () => void;
  onExplore: () => void;
  onPassport: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onThemes: () => void;
}

const CONTINENTS = REGIONS.filter((r) => r !== "World");

export function Menu(props: MenuProps): JSX.Element {
  // Fresh on every visit to the menu (the component remounts per screen change).
  const [stats] = useState(loadStats);

  const counts = useMemo(() => {
    const m = {} as Record<Region, number>;
    for (const r of REGIONS) m[r] = regionPool(props.world, r).length;
    return m;
  }, [props.world]);

  const discovered = Object.keys(props.passport).length;

  return (
    <div className="screen menu">
      <header className="menu-masthead">
        <div className="wordmark">
          <p className="eyebrow">{STR.eyebrow}</p>
          <h1>{STR.wordmark}</h1>
          <p className="tagline">{STR.tagline}</p>
        </div>

        <div className="menu-corner">
          <button
            className="icon-btn menu-settings"
            onClick={props.onSettings}
            aria-label={STR.menu.settings}
          >
            <IconSliders />
          </button>
          <button
            className="icon-btn menu-world"
            onClick={props.onThemes}
            aria-label={STR.themes.openLabel}
          >
            <ThemeOrb c={props.themeColors} size={30} spin />
          </button>
        </div>

        <div className="journey">
          <button
            className="journey-pill"
            onClick={props.onPassport}
            aria-label={STR.menu.journeyPassportLabel(discovered, counts.World)}
          >
            <IconPassport size={16} />
            <span>{STR.menu.journeyPassport(discovered, counts.World)}</span>
          </button>
          {stats.bestScore > 0 && (
            <button
              className="journey-pill"
              onClick={props.onLeaderboard}
              aria-label={STR.menu.journeyBestLabel(formatPoints(stats.bestScore))}
            >
              <IconTrophy size={16} />
              <span>{formatPoints(stats.bestScore)}</span>
            </button>
          )}
        </div>
      </header>

      <section className="dock" aria-label={STR.menu.startAria}>
        <span className="label" id="region-label">
          {STR.menu.regionLabel}
        </span>

        <div className="region-picker" role="group" aria-labelledby="region-label">
          <button
            className={`region-world ${props.region === "World" ? "is-active" : ""}`}
            aria-pressed={props.region === "World"}
            onClick={() => props.onRegion("World")}
          >
            <span className="rg-name">{STR.regions.World}</span>
            <span className="rg-count">{STR.menu.worldAll(counts.World)}</span>
          </button>
          <div className="region-grid">
            {CONTINENTS.map((r) => (
              <button
                key={r}
                className={`region-tile ${r === props.region ? "is-active" : ""}`}
                aria-pressed={r === props.region}
                aria-label={STR.menu.regionTile(STR.regions[r], counts[r])}
                onClick={() => props.onRegion(r)}
              >
                <span className="rg-name">{STR.regions[r]}</span>
                <span className="rg-count">{STR.menu.count(counts[r])}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary dock-play" onClick={props.onPlay}>
          <span className="play-main">{STR.menu.play}</span>
          <span className="play-context">
            {STR.menu.playContext(STR.regions[props.region], props.roundLength)}
          </span>
        </button>

        <button className="btn dock-explore" onClick={props.onExplore}>
          <IconCompass />
          {STR.menu.explore}
        </button>
      </section>
    </div>
  );
}
