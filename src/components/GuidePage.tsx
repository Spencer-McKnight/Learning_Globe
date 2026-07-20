import { useEffect, useRef, useState } from "react";
import { STR } from "../content/strings";
import type { Account } from "../lib/account";
import { pushSettings } from "../lib/cloud";
import { loadSettings, saveSettings, type MotionPref, type Settings } from "../lib/storage";
import { InfoBlock, InfoList, InfoPage } from "./InfoPage";
import { Seg, Toggle } from "./SettingsSheet";
import {
  IconBulb,
  IconCompass,
  IconEye,
  IconKeyboard,
  IconMouse,
  IconPassport,
  IconSliders,
  IconSpeaker,
  IconTouch,
  IconTrophy,
} from "./icons";

/**
 * /guide — how to play and how to make it fit you. The accessibility panel
 * at the bottom is not documentation, it is the real settings store: it
 * reads and writes the same bucket the game uses (and syncs for members),
 * so "high contrast" flips this very page as proof.
 */
export function GuidePage({ account }: { account: Account }): JSX.Element {
  const G = STR.guidePage;
  const S = STR.settings;

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const booted = useRef(false);

  useEffect(() => {
    document.body.classList.toggle("hc", settings.highContrast);
    const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.toggle(
      "reduce-motion",
      settings.reduceMotion === "on" || (settings.reduceMotion === "auto" && osReduce)
    );
    // First render only reflects what is already saved; writing it back
    // would advance the last-write-wins clock and shadow cloud settings.
    if (!booted.current) {
      booted.current = true;
      return;
    }
    saveSettings(settings);
    if (account.kind === "member") {
      const t = window.setTimeout(() => void pushSettings(settings), 1500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const update = (patch: Partial<Settings>): void =>
    setSettings((s) => ({ ...s, ...patch }));

  return (
    <InfoPage
      docTitle={G.docTitle}
      title={G.title}
      lede={G.intro}
      crossHref="/privacy"
      crossLabel={STR.pages.toPrivacy}
    >
      <InfoBlock title={G.round.title} tone="accent" icon={<IconCompass />} wide>
        <InfoList items={G.round.points} />
      </InfoBlock>

      <InfoBlock title={G.touch.title} tone="accent" icon={<IconTouch />}>
        <InfoList items={G.touch.points} />
      </InfoBlock>

      <InfoBlock title={G.mouse.title} tone="accent" icon={<IconMouse />}>
        <InfoList items={G.mouse.points} />
      </InfoBlock>

      <InfoBlock title={G.keyboard.title} tone="accent" icon={<IconKeyboard />}>
        <p>{G.keyboard.intro}</p>
        <ul className="info-keys">
          {G.keyboard.keys.map((row) => (
            <li key={row.k}>
              <kbd>{row.k}</kbd>
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </InfoBlock>

      <InfoBlock title={G.scoring.title} tone="reward" icon={<IconTrophy />}>
        <InfoList items={G.scoring.points} />
      </InfoBlock>

      <InfoBlock title={G.hints.title} tone="reward" icon={<IconBulb />}>
        <p>{G.hints.body}</p>
      </InfoBlock>

      <InfoBlock title={G.menuTour.title} tone="accent" icon={<IconPassport />}>
        <InfoList items={G.menuTour.points} />
      </InfoBlock>

      <InfoBlock title={G.colourVision.title} tone="success" icon={<IconEye />}>
        <p>{G.colourVision.body}</p>
      </InfoBlock>

      <InfoBlock title={G.announce.title} tone="success" icon={<IconSpeaker />}>
        <p>{G.announce.body}</p>
      </InfoBlock>

      <InfoBlock title={G.controls.title} tone="success" icon={<IconSliders />} wide>
        <p>{G.controls.intro}</p>
        <div className="info-controls">
          <Toggle
            label={S.highContrast}
            sub={S.highContrastSub}
            checked={settings.highContrast}
            onChange={(highContrast) => update({ highContrast })}
          />
          <Seg<MotionPref>
            label={S.reduceMotion}
            value={settings.reduceMotion}
            options={[
              { v: "auto", label: S.motionAuto },
              { v: "on", label: S.motionOn },
              { v: "off", label: S.motionOff },
            ]}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
          <Toggle
            label={S.graticule}
            sub={S.graticuleSub}
            checked={settings.graticule}
            onChange={(graticule) => update({ graticule })}
          />
          <Toggle
            label={S.sound}
            checked={settings.sound}
            onChange={(sound) => update({ sound })}
          />
          <Toggle
            label={S.haptics}
            sub={S.hapticsSub}
            checked={settings.haptics}
            onChange={(haptics) => update({ haptics })}
          />
        </div>
        <p className="info-note">{G.controls.saveNote}</p>
      </InfoBlock>

      <InfoBlock title={G.tutorial.title} tone="accent" icon={<IconCompass />}>
        <p>{G.tutorial.body}</p>
      </InfoBlock>
    </InfoPage>
  );
}
