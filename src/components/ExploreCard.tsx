import { STR } from "../content/strings";
import type { Country } from "../lib/geo";
import { formatPopulation } from "../lib/geo";

interface ExploreCardProps {
  country: Country;
  discovered: boolean;
}

export function ExploreCard({ country, discovered }: ExploreCardProps): JSX.Element {
  const p = country.props;
  return (
    <div className="explore-card" role="status">
      {country.flag && (
        <div className="flag" aria-hidden="true">
          {country.flag}
        </div>
      )}
      <h3>{p.name}</h3>
      <div className="facts">
        {STR.regions[p.continent] ?? p.continent}
        {p.capital && <> · {STR.explore.capital(p.capital)}</>}
        {p.pop > 0 && <> · {STR.explore.population(formatPopulation(p.pop))}</>}
        {discovered && <> · ✓ {STR.explore.inPassport}</>}
      </div>
    </div>
  );
}
