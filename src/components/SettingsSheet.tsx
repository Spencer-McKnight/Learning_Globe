import { STR } from "../content/strings";
import type { MotionPref, ProjectionId, Settings } from "../lib/storage";
import { Sheet } from "./Sheet";

interface SettingsSheetProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onReplayTutorial: () => void;
}

function Toggle({
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

function Seg<T extends string | number>({
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
  onChange,
  onClose,
  onReplayTutorial,
}: SettingsSheetProps): JSX.Element {
  const S = STR.settings;
  return (
    <Sheet title={S.title} onClose={onClose}>
      <section className="set-group">
        <h3>{S.groupView}</h3>
        <Seg<ProjectionId>
          label={S.projection}
          value={settings.projection}
          options={(["globe", "naturalEarth", "equalEarth", "mercator"] as ProjectionId[]).map(
            (v) => ({ v, label: S.projections[v] })
          )}
          columns={2}
          onChange={(projection) => onChange({ projection })}
        />
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
      </section>

      <section className="set-group">
        <h3>{S.groupGame}</h3>
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
      </section>

      <section className="set-group">
        <h3>{S.groupFeel}</h3>
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
      </section>

      <section className="set-group">
        <h3>{S.groupHelp}</h3>
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
      </section>
    </Sheet>
  );
}
