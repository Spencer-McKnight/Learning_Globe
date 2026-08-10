import { useEffect, useRef, useState } from "react";
import { STR } from "../content/strings";
import { IconChevron, IconShare } from "./icons";

/** The canonical address we hand to share sheets — the appName is the domain. */
const SHARE_URL = `https://${STR.appName}`;

interface SiteFooterProps {
  /** Settings is an in-app sheet, not a page — the footer opens it in place. */
  onSettings: () => void;
}

/**
 * Site chrome on the menu, pinned to the viewport bottom. Collapsed it shows
 * only a small indented pull-tab with an arrow; expanded it drops up over the
 * globe. No page scroll — the stage stays one full view tall, which keeps the
 * mobile URL bar from jittering the world.
 */
export function SiteFooter(props: SiteFooterProps): JSX.Element {
  const year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  /** Clipboard path only: flips the button into its "Link copied!" beat. */
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    []
  );

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    // React 18's DOM typings omit `inert`; set it imperatively so collapsed
    // links/buttons drop out of tab order and assistive tech.
    if (open) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * The share featureset, smallest that feels native everywhere: the OS share
   * sheet where one exists (phones, tablets — a dismissed sheet is not an
   * error), otherwise copy the link and say so on the button itself. No share
   * targets of our own to maintain, no third-party scripts.
   */
  const share = async (): Promise<void> => {
    if (navigator.share) {
      try {
        await navigator.share({ title: STR.appName, text: STR.footer.shareText, url: SHARE_URL });
      } catch {
        // Cancelled — the sheet was the feedback.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context) — leave the button at rest.
    }
  };

  return (
    <footer className={`site-footer${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="site-footer-handle"
        aria-expanded={open}
        aria-controls="site-footer-panel"
        aria-label={open ? STR.footer.close : STR.footer.open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconChevron size={18} />
      </button>

      <div className="site-footer-inner" id="site-footer-panel" ref={panelRef} aria-hidden={!open}>
        {/* The hero wordmark is fixed just above this page — the footer signs
            with the domain form instead of repeating it. */}
        <div className="site-footer-brand">
          <p className="site-footer-wordmark">{STR.appName}</p>
          <p className="site-footer-mission">{STR.footer.mission}</p>
        </div>

        {/* "Free, for everyone" is the mission; sharing is how it happens —
            the footer's one filled action, right under those words. */}
        <button
          className={`footer-share${copied ? " is-copied" : ""}`}
          onClick={() => void share()}
        >
          <IconShare size={18} />
          {copied ? STR.footer.copied : STR.footer.share}
        </button>

        <nav className="site-footer-nav" aria-label={STR.footer.navLabel}>
          <a className="footer-link" href="/privacy">
            {STR.footer.privacy}
          </a>
          <a className="footer-link" href="/guide">
            {STR.footer.guide}
          </a>
          <button className="footer-link" onClick={props.onSettings}>
            {STR.footer.settings}
          </button>
        </nav>

        <div className="site-footer-base">
          <span>{STR.footer.copyright(year)}</span>
          <span className="site-footer-sep" aria-hidden="true">
            ·
          </span>
          <span>
            {STR.footer.builtBy}{" "}
            <a
              className="site-footer-byline"
              href="https://digital-knight.au"
              target="_blank"
              rel="noreferrer"
            >
              {STR.footer.builtByName}
            </a>
          </span>
        </div>

        <div className="sr-only" aria-live="polite" role="status">
          {copied ? STR.footer.copied : ""}
        </div>
      </div>
    </footer>
  );
}
