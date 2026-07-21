import { useEffect } from "react";
import { STR } from "../content/strings";
import { IconCompass } from "./icons";

/**
 * The catch-all for addresses that exist on no map. It wears the info-page
 * chrome so even a wrong turn looks like learnthe.world, but stays one
 * centred moment: name the missing place, show the course that was set,
 * and point straight back to charted water. The compass stands in for the
 * zero in 404 — searching, like the reader.
 */
export function NotFoundPage(): JSX.Element {
  useEffect(() => {
    document.title = STR.notFoundPage.docTitle;
  }, []);

  const path = window.location.pathname;

  return (
    <div className="info-page nf-page">
      <main className="nf-card">
        <p className="info-eyebrow">{STR.pages.eyebrow}</p>
        <p className="nf-code" role="img" aria-label={STR.notFoundPage.codeAria}>
          <span aria-hidden="true">4</span>
          <span className="nf-compass" aria-hidden="true">
            <IconCompass size={64} />
          </span>
          <span aria-hidden="true">4</span>
        </p>
        <h1>{STR.notFoundPage.title}</h1>
        <p className="info-lede">{STR.notFoundPage.lede}</p>
        <p className="nf-path">
          {STR.notFoundPage.pathIntro} <code>{path}</code>
        </p>
        <nav className="nf-actions" aria-label={STR.footer.navLabel}>
          <a className="nf-cta" href="/">
            {STR.notFoundPage.home}
          </a>
          <a className="info-home" href="/guide">
            {STR.pages.toGuide}
          </a>
          <a className="info-home" href="/privacy">
            {STR.pages.toPrivacy}
          </a>
        </nav>
      </main>
    </div>
  );
}
