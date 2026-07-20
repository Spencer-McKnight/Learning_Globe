import { useMemo, useState } from "react";
import { STR } from "../content/strings";
import { formatPoints } from "../game/scoring";
import { REGIONS, regionPool, type Region, type World } from "../lib/geo";
import { loadStats, type Passport } from "../lib/storage";
import type { Account } from "../lib/account";
import type { PinId } from "../map/pins";
import type { ThemeColors } from "../styles/themes";
import { AccountBadge } from "./AccountBadge";
import { IconCompass, IconLeaderboard, IconSliders, IconTrophy } from "./icons";
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

/**
 * Home: title at the top, the world in the middle, Play at the bottom, and
 * every other control as a plain circle on one of the two rails — dressing
 * (left) and progress (right). Nothing sits over the middle of the globe,
 * which is the thing you actually play on.
 */
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
      </header>

      <nav className="menu-rail menu-rail--left" aria-label={STR.menu.railLeftLabel}>
        <button
          className="icon-btn rail-btn menu-world"
          onClick={props.onThemes}
          aria-label={STR.themes.openLabel}
        >
          <ThemeOrb c={props.themeColors} size={30} />
        </button>
        <button
          className="icon-btn rail-btn menu-pin"
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
        <button
          className="icon-btn rail-btn menu-settings"
          onClick={props.onSettings}
          aria-label={STR.menu.settings}
        >
          <IconSliders size={20} />
        </button>
      </nav>

      <nav className="menu-rail menu-rail--right" aria-label={STR.menu.railRightLabel}>
        <button
          className="icon-btn rail-btn"
          onClick={props.onPassport}
          aria-label={STR.menu.journeyPassportLabel(discovered, counts.World)}
        >
          <IconTrophy size={20} />
          {discovered > 0 && (
            <span className="rail-badge" aria-hidden="true">
              {discovered}
            </span>
          )}
        </button>
        <button
          className="icon-btn rail-btn"
          onClick={props.onLeaderboard}
          aria-label={
            stats.bestScore > 0
              ? STR.menu.journeyBestLabel(formatPoints(stats.bestScore))
              : STR.leaderboard.openLabel
          }
        >
          <IconLeaderboard size={20} />
        </button>
        <AccountBadge account={props.account} onOpen={props.onAccount} />
      </nav>

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
