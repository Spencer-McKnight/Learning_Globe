import { useEffect, useRef } from "react";
import { STR } from "../content/strings";
import {
  buildPinInk,
  DEFAULT_PIN_ID,
  PIN_DESIGNS,
  PIN_ORDER,
  type PinId,
} from "../map/pins";
import type { ThemeColors } from "../styles/themes";
import { Sheet } from "./Sheet";

const BADGE_SIZE = 56;
const BADGE_SCALE = 1.9;

/**
 * Canvas twin of ThemeOrb: runs the exact draw routine the map engine uses,
 * so every card previews precisely the pin that will land on the globe.
 */
export function PinBadge({
  id,
  themed,
  colors,
  size = BADGE_SIZE,
}: {
  id: PinId;
  /** "Match world colours" — the badge previews exactly what the map draws. */
  themed: boolean;
  colors: ThemeColors;
  size?: number;
}): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size - 6);
    const s = (size / BADGE_SIZE) * BADGE_SCALE;
    ctx.scale(s, s);
    (PIN_DESIGNS[id] ?? PIN_DESIGNS[DEFAULT_PIN_ID]).draw(
      ctx,
      buildPinInk(id, "correct", themed, colors)
    );
  }, [id, themed, colors, size]);

  return (
    <canvas
      ref={ref}
      className="pin-badge"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

interface PinSheetProps {
  pinId: PinId;
  themed: boolean;
  colors: ThemeColors;
  onSelect: (id: PinId) => void;
  onThemed: (v: boolean) => void;
  onClose: () => void;
}

export function PinSheet({
  pinId,
  themed,
  colors,
  onSelect,
  onThemed,
  onClose,
}: PinSheetProps): JSX.Element {
  const P = STR.pins;

  return (
    <Sheet title={P.title} onClose={onClose}>
      <p className="theme-intro">{P.intro}</p>
      <div className="theme-grid" role="radiogroup" aria-label={P.groupLabel}>
        {PIN_ORDER.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={pinId === id}
            className={`theme-card ${pinId === id ? "is-active" : ""}`}
            onClick={() => onSelect(id)}
          >
            <PinBadge id={id} themed={themed} colors={colors} />
            <span className="tc-name">{P.names[id]}</span>
          </button>
        ))}
      </div>
      <p className="theme-desc" aria-live="polite">
        {P.descriptions[pinId]}
      </p>
      <div className="set-row pin-themed">
        <span className="set-label">
          {P.themedLabel}
          <span className="set-sub">{P.themedSub}</span>
        </span>
        <button
          className="switch"
          role="switch"
          aria-checked={themed}
          aria-label={P.themedLabel}
          onClick={() => onThemed(!themed)}
        />
      </div>
    </Sheet>
  );
}
