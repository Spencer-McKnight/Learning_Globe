import { STR } from "../content/strings";
import type { Account } from "../lib/account";
import { IconUser } from "./icons";

/**
 * The one place the UI says who is playing — now a button that opens the
 * account sheet (sign in as a guest, manage profile as a member). Any
 * other guest/member visual difference must also branch on `account.kind`
 * (see lib/account.ts) — never on a loose boolean.
 */
export function AccountBadge({
  account,
  onOpen,
}: {
  account: Account;
  onOpen: () => void;
}): JSX.Element {
  const guest = account.kind === "guest";
  const label = guest ? STR.account.guest : account.name || account.email;
  const sub = guest ? STR.account.guestSub : STR.account.memberSub;
  return (
    <button
      className="journey-pill account-pill"
      title={sub}
      onClick={onOpen}
      aria-label={STR.account.openLabel}
    >
      <IconUser size={16} />
      <span>{label}</span>
      <span className="sr-only">{sub}</span>
    </button>
  );
}
