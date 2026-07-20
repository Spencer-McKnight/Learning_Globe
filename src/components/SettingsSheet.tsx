import { useRef, useState } from "react";
import { STR } from "../content/strings";
import type { MotionPref, ProjectionId, Settings } from "../lib/storage";
import type { ThemeColors } from "../styles/themes";
import { PinBadge } from "./PinSheet";
import { Sheet } from "./Sheet";
import { ThemeOrb } from "./ThemeSheet";

const TABS = ["view", "game", "feel", "help"] as const;
type SettingsTab = (typeof TABS)[number];

interface SettingsSheetProps {
  settings: Settings;
  /** Resolved colours of the active world, for the live picker previews. */
  themeColors: ThemeColors;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onReplayTutorial: () => void;
  onOpenThemes: () => void;
  onOpenPins: () => void;
}

export function Toggle({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="set-row">
      <span className="set-label">
        {label}
        {sub && <span className="set-sub">{sub}</span>}
      </span>
      <button
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  /** Equal-width CSS grid; stacks the label above so long options breathe on mobile. */
  columns?: 2;
}): JSX.Element {
  const stacked = columns != null;
  return (
    <div className={stacked ? "set-row set-row--stack" : "set-row"}>
      <span className="set-label">{label}</span>
      <div
        className={stacked ? `seg seg--grid seg--cols-${columns}` : "seg"}
        role="group"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={String(o.v)}
            className={o.v === value ? "is-active" : ""}
            aria-pressed={o.v === value}
            onClick={() => onChange(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsSheet({
  settings,
  themeColors,
  onChange,
  onClose,
  onReplayTutorial,
  onOpenThemes,
  onOpenPins,
}: SettingsSheetProps): JSX.Element {
  const S = STR.settings;
  const [tab, setTab] = useState<SettingsTab>("view");
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  // Roving tabindex per WAI-ARIA tabs: arrows move focus and select together.
  const onTabKeyDown = (e: React.KeyboardEvent): void => {
    const i = TABS.indexOf(tab);
    let next: SettingsTab | undefined;
    if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
    else if (e.key === "ArrowLeft") next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === "Home") next = TABS[0];
    else if (e.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Sheet title={S.title} onClose={onClose}>
      <div className="set-tabs" role="tablist" aria-label={S.tabsLabel} onKeyDown={onTabKeyDown}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[t] = el;
            }}
            role="tab"
            id={`set-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`set-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {S.tabs[t]}
          </button>
        ))}
      </div>

      <section
        className="set-group set-panel"
        role="tabpanel"
        id={`set-panel-${tab}`}
        aria-labelledby={`set-tab-${tab}`}
      >
        {tab === "view" && (
          <>
            <Seg<ProjectionId>
              label={S.projection}
              value={settings.projection}
              options={(["globe", "naturalEarth", "equalEarth", "mercator"] as ProjectionId[]).map(
                (v) => ({ v, label: S.projections[v] })
              )}
              columns={2}
              onChange={(projection) => onChange({ projection })}
            />
            {/* The same round previews the home rail uses: you pick the world
                and the pin by looking at them, not by reading their names. */}
            <div className="set-row">
              <span className="set-label">{STR.themes.settingsRow}</span>
              <button className="set-picker" onClick={onOpenThemes}>
                {STR.themes.names[settings.theme] ?? STR.themes.names.custom}
                <span className="set-picker-face">
                  <ThemeOrb c={themeColors} size={30} />
                </span>
              </button>
            </div>
            <div className="set-row">
              <span className="set-label">{STR.pins.settingsRow}</span>
              <button className="set-picker" onClick={onOpenPins}>
                {STR.pins.names[settings.pin] ?? STR.pins.names.classic}
                <span className="set-picker-face">
                  <PinBadge
                    id={settings.pin}
                    themed={settings.pinThemed}
                    colors={themeColors}
                    size={32}
                  />
                </span>
              </button>
            </div>
            <Toggle
              label={S.graticule}
              sub={S.graticuleSub}
              checked={settings.graticule}
              onChange={(graticule) => onChange({ graticule })}
            />
            <Toggle
              label={S.highContrast}
              sub={S.highContrastSub}
              checked={settings.highContrast}
              onChange={(highContrast) => onChange({ highContrast })}
            />
            <Seg<MotionPref>
              label={S.reduceMotion}
              value={settings.reduceMotion}
              options={[
                { v: "auto", label: S.motionAuto },
                { v: "on", label: S.motionOn },
                { v: "off", label: S.motionOff },
              ]}
              onChange={(reduceMotion) => onChange({ reduceMotion })}
            />
          </>
        )}

        {tab === "game" && (
          <>
            <Seg<5 | 10 | 20>
              label={S.roundLength}
              value={settings.roundLength}
              options={[
                { v: 5, label: "5" },
                { v: 10, label: "10" },
                { v: 20, label: "20" },
              ]}
              onChange={(roundLength) => onChange({ roundLength })}
            />
            <Seg<1 | 2 | 3>
              label={S.attempts}
              value={settings.attempts}
              options={[
                { v: 1, label: "1" },
                { v: 2, label: "2" },
                { v: 3, label: "3" },
              ]}
              onChange={(attempts) => onChange({ attempts })}
            />
            <Toggle
              label={S.hintsEnabled}
              checked={settings.hintsEnabled}
              onChange={(hintsEnabled) => onChange({ hintsEnabled })}
            />
            <Toggle
              label={S.speedBonus}
              sub={S.speedBonusSub}
              checked={settings.speedBonus}
              onChange={(speedBonus) => onChange({ speedBonus })}
            />
          </>
        )}

        {tab === "feel" && (
          <>
            <Toggle
              label={S.sound}
              checked={settings.sound}
              onChange={(sound) => onChange({ sound })}
            />
            <Toggle
              label={S.haptics}
              sub={S.hapticsSub}
              checked={settings.haptics}
              onChange={(haptics) => onChange({ haptics })}
            />
          </>
        )}

        {tab === "help" && (
          <>
            <div className="set-row">
              <span className="set-label">
                {S.keyboardTitle}
                <span className="set-sub">{S.keyboardHelp}</span>
              </span>
            </div>
            <div className="set-row">
              <button className="btn btn-ghost" onClick={onReplayTutorial}>
                {S.replayTutorial}
              </button>
            </div>
          </>
        )}
      </section>
    </Sheet>
  );
}
