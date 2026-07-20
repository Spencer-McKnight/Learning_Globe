import { useId, useMemo } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { STR } from "../content/strings";
import { withAlpha } from "../styles/palette";
import {
  deriveCustomTheme,
  THEME_ORDER,
  THEMES,
  type ThemeColors,
  type ThemeId,
} from "../styles/themes";
import { Sheet } from "./Sheet";

/**
 * A world's colours as a plain sphere — ocean gradient lit from the top left,
 * the land colour rising from the lower right like a second light, and an
 * accent rim. No continents or wireframe; just the palette.
 */
export function ThemeOrb({ c, size = 52 }: { c: ThemeColors; size?: number }): JSX.Element {
  const uid = useId();
  const seaId = `orb-sea-${uid}`;
  const landId = `orb-land-${uid}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="theme-orb">
      <defs>
        <radialGradient id={seaId} cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor={c.oceanCenter} />
          <stop offset="100%" stopColor={c.ocean} />
        </radialGradient>
        <radialGradient id={landId} cx="72%" cy="80%" r="70%">
          <stop offset="0%" stopColor={withAlpha(c.land, 0.85)} />
          <stop offset="100%" stopColor={withAlpha(c.land, 0)} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke={withAlpha(c.accent, 0.9)} strokeWidth="2" />
      <circle cx="32" cy="32" r="28" fill={`url(#${seaId})`} />
      <circle cx="32" cy="32" r="28" fill={`url(#${landId})`} />
    </svg>
  );
}

interface ThemeSheetProps {
  themeId: ThemeId;
  customColor: string;
  onSelect: (id: ThemeId) => void;
  onCustomColor: (hex: string) => void;
  onClose: () => void;
}

export function ThemeSheet({
  themeId,
  customColor,
  onSelect,
  onCustomColor,
  onClose,
}: ThemeSheetProps): JSX.Element {
  const T = STR.themes;
  const customColors = useMemo(() => deriveCustomTheme(customColor), [customColor]);

  const card = (id: ThemeId, colors: ThemeColors): JSX.Element => (
    <button
      key={id}
      role="radio"
      aria-checked={themeId === id}
      className={`theme-card ${themeId === id ? "is-active" : ""}`}
      onClick={() => onSelect(id)}
    >
      <ThemeOrb c={colors} />
      <span className="tc-name">{T.names[id]}</span>
    </button>
  );

  return (
    <Sheet title={T.title} onClose={onClose}>
      <p className="theme-intro">{T.intro}</p>
      <div className="theme-grid" role="radiogroup" aria-label={T.groupLabel}>
        {THEME_ORDER.map((id) => card(id, THEMES[id]))}
        {card("custom", customColors)}
      </div>
      <p className="theme-desc" aria-live="polite">
        {T.descriptions[themeId]}
      </p>
      {themeId === "custom" && (
        <div className="theme-custom">
          <p className="theme-custom-hint">{T.customHint}</p>
          <HexColorPicker color={customColor} onChange={onCustomColor} />
          <label className="theme-hex">
            <span aria-hidden="true">#</span>
            <HexColorInput
              color={customColor}
              onChange={onCustomColor}
              aria-label={T.customSwatchAria(customColor)}
            />
          </label>
        </div>
      )}
    </Sheet>
  );
}
