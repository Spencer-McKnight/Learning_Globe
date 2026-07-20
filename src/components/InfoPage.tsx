import { useEffect, type ReactNode } from "react";
import { STR } from "../content/strings";

/**
 * Shared shell for the standalone info pages (/privacy, /guide). Unlike the
 * game these are real scrolling documents: normal flow, selectable text,
 * and a block grid that keeps each idea in its own card. They inherit the
 * saved world colours via the pre-paint snapshot in index.html, so the
 * pages always match the game the reader just left.
 */

export type InfoTone = "accent" | "success" | "reward" | "danger";

interface InfoBlockProps {
  title: string;
  /** Colours the icon badge and list markers; hierarchy stays typographic. */
  tone?: InfoTone;
  icon?: ReactNode;
  /** Full-row card for statements and the live-controls panel. */
  wide?: boolean;
  /** Oversized display heading — the page's one shout. */
  statement?: boolean;
  children: ReactNode;
}

export function InfoBlock(props: InfoBlockProps): JSX.Element {
  const cls = [
    "info-block",
    `info-block--${props.tone ?? "accent"}`,
    props.wide ? "info-block--wide" : "",
    props.statement ? "info-block--statement" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls}>
      <div className="info-block-head">
        {props.icon && (
          <span className="info-badge" aria-hidden="true">
            {props.icon}
          </span>
        )}
        <h2>{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

/** Bulleted card content; the dot markers take the block's tone. */
export function InfoList({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <ul className="info-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

interface InfoPageProps {
  docTitle: string;
  title: string;
  /** Small line under the title, e.g. the policy's effective date. */
  meta?: string;
  lede: string;
  /** The sibling page, cross-linked in the page footer. */
  crossHref: string;
  crossLabel: string;
  children: ReactNode;
}

export function InfoPage(props: InfoPageProps): JSX.Element {
  useEffect(() => {
    document.title = props.docTitle;
  }, [props.docTitle]);

  const year = new Date().getFullYear();

  return (
    <div className="info-page">
      <header className="info-hero">
        <a className="info-home" href="/" aria-label={STR.pages.backAria}>
          ← {STR.pages.back}
        </a>
        <p className="info-eyebrow">{STR.pages.eyebrow}</p>
        <h1>{props.title}</h1>
        {props.meta && <p className="info-meta">{props.meta}</p>}
        <p className="info-lede">{props.lede}</p>
      </header>

      <main className="info-blocks">{props.children}</main>

      <footer className="info-foot">
        <nav aria-label={STR.footer.navLabel}>
          <a href={props.crossHref}>{props.crossLabel}</a>
          <a href="/">{STR.pages.back}</a>
        </nav>
        <span>{STR.footer.copyright(year)}</span>
      </footer>
    </div>
  );
}
