import { useState } from "react";
import { STR } from "../content/strings";

interface TutorialProps {
  onDone: () => void;
}

/** Non-invasive first-run offer, then a three-step tour. */
export function Tutorial({ onDone }: TutorialProps): JSX.Element {
  const [step, setStep] = useState<number>(-1); // -1 = the offer itself

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
