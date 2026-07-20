import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { STR } from "../content/strings";
import type { MapEngine } from "../map/MapEngine";
import type { Country, LonLat, World } from "../lib/geo";
import { compassDirection } from "../lib/geo";
import * as sfx from "../lib/audio";

interface TutorialProps {
  onDone: () => void;
  engineRef: RefObject<MapEngine | null>;
  world: World | null;
  reduceMotion: boolean;
}

/** Recognisable, mid-size, near the default view — a good demo target. */
const DEMO_ISO_PREFERENCE = ["IT", "MG", "JP"];

function pickDemoCountry(world: World | null): Country | null {
  if (!world) return null;
  for (const iso of DEMO_ISO_PREFERENCE) {
    const hit = world.quizable.find((c) => c.props.iso === iso);
    if (hit) return hit;
  }
  return world.quizable[0] ?? null;
}

/** Non-invasive first-run offer, then a three-step tour acted out on the globe. */
export function Tutorial({ onDone, engineRef, world, reduceMotion }: TutorialProps): JSX.Element {
  const [step, setStep] = useState<number>(-1); // -1 = the offer itself
  const timers = useRef<number[]>([]);

  const demo = useMemo(() => pickDemoCountry(world), [world]);
  // A deliberate near-miss just outside the border, so the compass ring has a story to tell.
  const missPoint = useMemo<LonLat | null>(
    () => (demo ? [demo.centroid[0] + 8, demo.centroid[1] - 3] : null),
    [demo]
  );

  // Each step is a little scene on the globe behind the card.
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !demo || !missPoint || step < 0) return;

    const after = (ms: number, fn: () => void): void => {
      timers.current.push(window.setTimeout(fn, reduceMotion ? Math.min(ms, 80) : ms));
    };

    if (step === 0) {
      // The mission: glide over to the demo country's neighbourhood. No reveal —
      // the card's chip names it, the map stays silent.
      e.clearPins();
      e.clearFlashes();
      e.flyTo(demo.centroid, { zoom: 1.3, dur: 1100 });
    } else if (step === 1) {
      // A guess lands just outside the border; the ring points the way.
      e.clearPins();
      e.clearFlashes();
      e.flyTo(missPoint, { zoom: 1.9, dur: 800 });
      after(900, () => {
        e.addPin(missPoint, "miss");
        e.ripple(missPoint, "miss");
        sfx.sfxPin();
      });
      after(1250, () => {
        e.showDirectionHint(missPoint, compassDirection(missPoint, demo.centroid));
        sfx.sfxMiss();
      });
    } else if (step === 2) {
      // The payoff: pin lands inside, country lights up, confetti.
      e.clearPins();
      e.flyTo(demo.centroid, { zoom: 1.9, dur: 700 });
      after(800, () => {
        e.addPin(demo.centroid, "correct");
        e.ripple(demo.centroid, "correct");
        e.flash(demo.id, "correct");
        sfx.sfxPin();
        sfx.sfxCorrect(2);
      });
      after(1000, () => {
        e.confettiBurst(e.screenOf(demo.centroid) ?? undefined, "correct");
      });
    }

    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [step, demo, missPoint, reduceMotion, engineRef]);

  if (step === -1) {
    return (
      <div className="tutorial-card" role="dialog" aria-label={STR.tutorial.offerTitle}>
        <h3>{STR.tutorial.offerTitle}</h3>
        <p>{STR.tutorial.offerBody}</p>
        <div className="row">
          <button className="btn btn-primary" autoFocus onClick={() => setStep(0)}>
            {STR.tutorial.offerYes}
          </button>
          <button className="btn btn-ghost" onClick={onDone}>
            {STR.tutorial.offerNo}
          </button>
        </div>
      </div>
    );
  }

  const steps = STR.tutorial.steps;
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <div className="tutorial-card" role="dialog" aria-label={s.title}>
      <div className="dots" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={i === step ? "is-on" : ""} />
        ))}
      </div>
      {demo && (
        <div className="tutorial-chip" aria-hidden="true">
          <span className="find">{STR.game.find}</span>
          <span className="target">
            {demo.flag ? `${demo.flag} ` : ""}
            {demo.props.name}
          </span>
        </div>
      )}
      <h3>{s.title}</h3>
      <p>{s.body}</p>
      <div className="row">
        <button
          className="btn btn-primary"
          autoFocus
          onClick={() => (last ? onDone() : setStep(step + 1))}
        >
          {last ? STR.tutorial.done : STR.tutorial.next}
        </button>
        {!last && (
          <button className="btn-quiet" onClick={onDone}>
            {STR.tutorial.skipTour}
          </button>
        )}
      </div>
    </div>
  );
}
