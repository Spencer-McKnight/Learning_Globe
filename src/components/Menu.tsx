import { useMemo, useState } from "react";
import { STR } from "../content/strings";
import { formatPoints } from "../game/scoring";
import type { Account } from "../lib/account";
import { REGIONS, regionPool, type Region, type World } from "../lib/geo";
import { loadStats, type Passport } from "../lib/storage";
import type { PinId } from "../map/pins";
import type { ThemeColors } from "../styles/themes";
import { AccountBadge } from "./AccountBadge";
import { IconCompass, IconPassport, IconSliders, IconTrophy } from "./icons";
import { PinBadge } from "./PinSheet";
import { ThemeOrb } from "./ThemeSheet";

interface MenuProps {
  world: World;
  account: Account;
  passport: Passport;
  region: Region;
  themeColors: ThemeColors;
  pin: PinId;
  pinThemed: boolean;
  onRegion: (r: Region) => void;
  onPlay: () => void;
  onExplore: () => void;
  onPassport: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onThemes: () => void;
  onPins: () => void;
  onAccount: () => void;
}

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
            <ThemeOrb c={props.themeColors} size={30} />
          </button>
          <button
            className="icon-btn menu-pin"
            onClick={props.onPins}
            aria-label={STR.pins.openLabel}
          >
            <PinBadge
              id={props.pin}
              themed={props.pinThemed}
              colors={props.themeColors}
              size={32}
            />
          </button>
        </div>

        <div className="journey">
          <AccountBadge account={props.account} onOpen={props.onAccount} />
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
        {/* Pointer users pick a continent on the globe itself; this hidden
            select is the keyboard / screen-reader path to the same choice. */}
        <label className="sr-only" htmlFor="region-select">
          {STR.menu.regionLabel}
        </label>
        <select
          id="region-select"
          className="region-select"
          value={props.region}
          onChange={(e) => props.onRegion(e.target.value as Region)}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {STR.menu.regionTile(STR.regions[r], counts[r])}
            </option>
          ))}
        </select>

        <div className="dock-actions">
          <button className="btn btn-primary dock-play" onClick={props.onPlay}>
            <span className="play-main">{STR.menu.play}</span>
            <span className="play-context">
              {STR.menu.playContext(STR.regions[props.region])}
            </span>
          </button>

          <button className="btn dock-explore" onClick={props.onExplore}>
            <IconCompass />
            {STR.menu.explore}
          </button>
        </div>
      </section>
    </div>
  );
}
