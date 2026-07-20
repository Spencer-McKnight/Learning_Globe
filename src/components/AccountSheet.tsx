import { useEffect, useState, type FormEvent } from "react";
import { STR } from "../content/strings";
import {
  fetchEnabledProviders,
  requestEmailCode,
  signInWithProvider,
  signOut,
  updateDisplayName,
  verifyEmailCode,
  type Account,
  type OAuthProvider,
} from "../lib/account";
import { Sheet } from "./Sheet";

/**
 * Sign in / manage account, opened from the Guest badge on the menu.
 * Email one-time code is the primary flow (link in the same email also
 * works); OAuth providers ride below it. Members see their profile and
 * can rename or sign out. On success the auth listener in main.tsx
 * remounts the app, so this sheet never has to sync state itself.
 */
export function AccountSheet({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}): JSX.Element {
  return (
    <Sheet title={STR.account.sheetTitle} onClose={onClose}>
      {account.kind === "member" ? (
        <MemberPanel account={account} onClose={onClose} />
      ) : (
        <SignInPanel />
      )}
    </Sheet>
  );
}

const PROVIDERS: { id: OAuthProvider; label: string; glyph: JSX.Element }[] = [
  { id: "google", label: STR.account.providerGoogle, glyph: <GoogleGlyph /> },
  { id: "github", label: STR.account.providerGitHub, glyph: <GitHubGlyph /> },
  { id: "apple", label: STR.account.providerApple, glyph: <AppleGlyph /> },
];

function SignInPanel(): JSX.Element {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only providers with credentials configured on the auth server.
  const [enabled, setEnabled] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchEnabledProviders().then((list) => {
      if (alive) setEnabled(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const sendCode = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    const res = await requestEmailCode(email.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setCode("");
    setStep("code");
  };

  const verify = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const res = await verifyEmailCode(email.trim(), code);
    setBusy(false);
    // Success: the auth listener remounts the app and this sheet unmounts.
    if (res.error) setError(res.error);
  };

  const oauth = async (provider: OAuthProvider): Promise<void> => {
    setError(null);
    const res = await signInWithProvider(provider);
    if (res.error) setError(STR.account.providerError);
  };

  return (
    <div className="account-panel">
      {step === "email" ? (
        <form className="account-form" onSubmit={sendCode}>
          <p className="account-intro">{STR.account.signInIntro}</p>
          <label className="account-label" htmlFor="account-email">
            {STR.account.emailLabel}
          </label>
          <input
            id="account-email"
            className="text-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder={STR.account.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? STR.account.sending : STR.account.sendCode}
          </button>
        </form>
      ) : (
        <form className="account-form" onSubmit={verify}>
          <p className="account-intro">{STR.account.codeSentTo(email.trim())}</p>
          <p className="account-hint">{STR.account.codeSentHint}</p>
          <label className="account-label" htmlFor="account-code">
            {STR.account.codeLabel}
          </label>
          <input
            id="account-code"
            className="text-input code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || code.length < 6}
          >
            {busy ? STR.account.verifying : STR.account.verify}
          </button>
          <div className="account-links">
            <button type="button" className="btn btn-ghost" onClick={() => sendCode()}>
              {STR.account.resend}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
            >
              {STR.account.useDifferentEmail}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}

      {enabled.length > 0 && (
        <>
          <div className="account-divider" aria-hidden="true">
            <span>{STR.account.orContinueWith}</span>
          </div>
          <div className="account-providers">
            {PROVIDERS.filter((p) => enabled.includes(p.id)).map((p) => (
              <button key={p.id} className="btn provider-btn" onClick={() => oauth(p.id)}>
                {p.glyph}
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MemberPanel({
  account,
  onClose,
}: {
  account: Extract<Account, { kind: "member" }>;
  onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(account.name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const res = await updateDisplayName(name);
    if (res.error) setError(res.error);
    else setSaved(true);
  };

  return (
    <div className="account-panel">
      <p className="account-intro">{STR.account.signedIn}</p>
      <p className="account-hint">{STR.account.signedInAs(account.email)}</p>

      <form className="account-form" onSubmit={save}>
        <label className="account-label" htmlFor="account-name">
          {STR.account.displayNameLabel}
        </label>
        <input
          id="account-name"
          className="text-input"
          type="text"
          maxLength={40}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <button className="btn" type="submit" disabled={!name.trim() || name === account.name}>
          {saved ? STR.account.displayNameSaved : STR.account.displayNameSave}
        </button>
      </form>

      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="btn btn-ghost account-signout"
        onClick={() => {
          void signOut();
          onClose();
        }}
      >
        {STR.account.signOut}
      </button>
    </div>
  );
}

// Provider glyphs — single-colour marks so they inherit the theme.

function GoogleGlyph(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 4.3-5.35 4.3a5.8 5.8 0 1 1 0-11.6c1.5 0 2.8.55 3.85 1.45l2.15-2.15A8.86 8.86 0 0 0 12 3.5a8.5 8.5 0 1 0 0 17c4.9 0 8.35-3.45 8.35-8.3 0-.38-.04-.74-.1-1.1Z" />
    </svg>
  );
}

function GitHubGlyph(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.1.39-1.99 1.03-2.7-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03a9.56 9.56 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.4.1 2.64.64.71 1.03 1.6 1.03 2.7 0 3.84-2.34 4.68-4.57 4.93.36.3.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function AppleGlyph(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.76c.03 3.1 2.72 4.13 2.75 4.14-.02.07-.43 1.47-1.42 2.92-.85 1.25-1.74 2.5-3.14 2.52-1.37.03-1.82-.81-3.39-.81-1.57 0-2.06.79-3.36.84-1.35.05-2.37-1.35-3.23-2.6-1.76-2.55-3.1-7.2-1.3-10.33a5.02 5.02 0 0 1 4.24-2.57c1.32-.03 2.57.89 3.38.89.8 0 2.32-1.1 3.92-.94.67.03 2.54.27 3.74 2.03-.1.06-2.23 1.3-2.2 3.9ZM13.8 4.24c.72-.86 1.2-2.06 1.06-3.24-1.02.04-2.26.68-3 1.54-.66.77-1.24 2-1.08 3.16 1.14.09 2.3-.58 3.02-1.46Z" />
    </svg>
  );
}
