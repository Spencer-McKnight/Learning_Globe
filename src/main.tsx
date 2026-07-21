import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./styles/theme.css";
import App from "./App";
import { GuidePage } from "./components/GuidePage";
import { NotFoundPage } from "./components/NotFoundPage";
import { PrivacyPage } from "./components/PrivacyPage";
import { GUEST_ACCOUNT, watchAccount, type Account } from "./lib/account";
import { setActiveAccount } from "./lib/storage";

/**
 * Auth lives above the game. Keying App on the account identity remounts
 * it on sign-in/out, so every piece of state loaded from storage at mount
 * (settings, passport, history, leaderboard) re-reads from the account's
 * own bucket — no per-loader plumbing.
 *
 * The info pages (/privacy, /guide) are whole-page destinations, not app
 * screens: the footer reaches them with plain anchors and they come back
 * with plain anchors, so no router is needed — just this path switch.
 * (Static hosting needs an SPA fallback to index.html for these paths.)
 */
function Root(): JSX.Element {
  const [account, setAccount] = useState<Account>(GUEST_ACCOUNT);

  useEffect(
    () =>
      watchAccount((a) => {
        setActiveAccount(a); // switch the storage bucket before App remounts
        setAccount(a);
      }),
    []
  );

  const accountKey = account.kind === "guest" ? "guest" : account.id;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/privacy") return <PrivacyPage />;
  // Keyed like App: the guide's live settings panel must re-read the right
  // storage bucket when the session lands.
  if (path === "/guide") return <GuidePage key={accountKey} account={account} />;
  // The host rewrites every path to this bundle, so unknown addresses land
  // here too — name the wrong turn instead of silently loading the game.
  if (path !== "/") return <NotFoundPage />;

  return <App key={accountKey} account={account} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
