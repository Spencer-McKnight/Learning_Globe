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
import { GUEST_ACCOUNT, watchAccount, type Account } from "./lib/account";
import { setActiveAccount } from "./lib/storage";

/**
 * Auth lives above the game. Keying App on the account identity remounts
 * it on sign-in/out, so every piece of state loaded from storage at mount
 * (settings, passport, history, leaderboard) re-reads from the account's
 * own bucket — no per-loader plumbing.
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

  return <App key={account.kind === "guest" ? "guest" : account.id} account={account} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
