import { STR } from "../content/strings";
import type { Country, World } from "../lib/geo";
import type { Passport } from "../lib/storage";
import { Sheet } from "./Sheet";

interface PassportSheetProps {
  world: World;
  passport: Passport;
  onClose: () => void;
}

const CONTINENT_ORDER = [
  "Europe",
  "Asia",
  "Africa",
  "North America",
  "South America",
  "Oceania",
  "Seven seas (open ocean)",
];

export function PassportSheet({ world, passport, onClose }: PassportSheetProps): JSX.Element {
  const found = world.quizable.filter((c) => c.props.iso && passport[c.props.iso]).length;
  const total = world.quizable.length;
  const pct = total ? Math.round((found / total) * 100) : 0;

  const byContinent = new Map<string, Country[]>();
  for (const c of world.quizable) {
    const key = CONTINENT_ORDER.includes(c.props.continent)
      ? c.props.continent
      : "Seven seas (open ocean)";
    byContinent.set(key, [...(byContinent.get(key) ?? []), c]);
  }

  return (
    <Sheet title={STR.passport.title} onClose={onClose}>
      <div className="passport-progress">
        <div
          className="bar"
          role="progressbar"
          aria-valuenow={found}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={STR.passport.progress(found, total)}
        >
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="caption">{STR.passport.progress(found, total)}</div>
      </div>
      {found === 0 && <p className="empty-note">{STR.passport.hintText}</p>}
      {CONTINENT_ORDER.filter((k) => byContinent.has(k)).map((cont) => (
        <section key={cont} className="passport-continent">
          <h3>{STR.regions[cont] ?? cont}</h3>
          <div className="stamp-grid">
            {byContinent
              .get(cont)!
              .map((c) => {
                const isFound = Boolean(c.props.iso && passport[c.props.iso]);
                return (
                  <div
                    key={c.id}
                    className={`stamp ${isFound ? "is-found" : "is-locked"}`}
                    aria-label={isFound ? c.props.name : STR.passport.locked}
                  >
                    <div className="flag" aria-hidden="true">
                      {isFound ? (c.flag ?? "🏳") : "❓"}
                    </div>
                    <div className="nm">{isFound ? c.props.name : "· · ·"}</div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </Sheet>
  );
}
