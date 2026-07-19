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
 * A miniature planet painted in a world's colours — ocean gradient, two
 * continents, one accent-selected island, and a correct-pin dot, so every
 * swatch previews exactly what the real globe will look like.
 */
export function ThemeOrb({
  c,
  size = 52,
  spin = false,
}: {
  c: ThemeColors;
  size?: number;
  spin?: boolean;
}): JSX.Element {
  const uid = useId();
  const gradId = `orb-sea-${uid}`;
  const clipId = `orb-clip-${uid}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={spin ? "theme-orb theme-orb--spin" : "theme-orb"}
    >
      <defs>
        <radialGradient id={gradId} cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor={c.oceanCenter} />
          <stop offset="100%" stopColor={c.ocean} />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke={withAlpha(c.success, 0.45)} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="29" fill={`url(#${gradId})`} />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M8 31 Q11 17 25 19 Q37 21 34 31 Q31 43 19 43 Q8 42 8 31 Z"
          fill={c.land}
          stroke={c.landBorder}
          strokeWidth="1"
        />
        <path
          d="M40 12 Q52 10 54 21 Q55 31 45 29 Q37 27 40 12 Z"
          fill={c.land}
          stroke={c.landBorder}
          strokeWidth="1"
        />
        <ellipse cx="45" cy="47" rx="8" ry="5.5" fill={c.landSelected} stroke={c.landBorder} strokeWidth="1" />
        <path
          d="M4 40 Q32 48 60 40"
          fill="none"
          stroke={c.graticule}
          strokeWidth="1"
        />
      </g>
      <circle cx="24" cy="29" r="3" fill={c.success} stroke={c.text} strokeWidth="1.2" />
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
