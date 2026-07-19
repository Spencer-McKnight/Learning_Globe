import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { STR } from "../content/strings";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet on phones, centered card on wider screens. */
export function Sheet({ title, onClose, children }: SheetProps): JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label={STR.settings.close}
          >
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
