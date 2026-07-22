import { STR } from "../content/strings";
import { InfoBlock, InfoList, InfoPage } from "./InfoPage";
import {
  IconChart,
  IconCookie,
  IconDatabase,
  IconDoc,
  IconHeart,
  IconLeaderboard,
  IconLock,
  IconShare,
  IconShield,
  IconSliders,
  IconUser,
} from "./icons";

/**
 * /privacy — the plain-language contract behind the game. Every claim here
 * mirrors the real infrastructure: guests are localStorage-only, members
 * live in Supabase behind row level security (supabase/migrations), and the
 * only public surface is the leaderboard row. Update this page whenever
 * that changes, not after.
 */
export function PrivacyPage(): JSX.Element {
  const P = STR.privacyPage;
  return (
    <InfoPage
      docTitle={P.docTitle}
      title={P.title}
      meta={P.effective}
      lede={P.intro}
      crossHref="/guide"
      crossLabel={STR.pages.toGuide}
    >
      <InfoBlock title={P.pledge.title} tone="success" icon={<IconShield />} wide statement>
        <p>{P.pledge.body}</p>
      </InfoBlock>

      <InfoBlock title={P.guest.title} tone="accent" icon={<IconUser />}>
        <p>{P.guest.body}</p>
        <InfoList items={P.guest.points} />
      </InfoBlock>

      <InfoBlock title={P.account.title} tone="accent" icon={<IconLock />}>
        <p>{P.account.body}</p>
        <InfoList items={P.account.points} />
        <p>{P.account.after}</p>
      </InfoBlock>

      <InfoBlock title={P.storage.title} tone="accent" icon={<IconDatabase />}>
        <p>{P.storage.body}</p>
      </InfoBlock>

      <InfoBlock title={P.visible.title} tone="reward" icon={<IconLeaderboard />}>
        <p>{P.visible.body}</p>
      </InfoBlock>

      <InfoBlock title={P.analytics.title} tone="accent" icon={<IconChart />}>
        <p>{P.analytics.body}</p>
        <InfoList items={P.analytics.points} />
        <p>{P.analytics.after}</p>
      </InfoBlock>

      <InfoBlock title={P.cookies.title} tone="reward" icon={<IconCookie />}>
        <p>{P.cookies.body}</p>
      </InfoBlock>

      <InfoBlock title={P.rights.title} tone="success" icon={<IconSliders />}>
        <InfoList items={P.rights.points} />
        <p>{P.rights.after}</p>
      </InfoBlock>

      <InfoBlock title={P.children.title} tone="success" icon={<IconHeart />}>
        <p>{P.children.body}</p>
      </InfoBlock>

      <InfoBlock title={P.changes.title} tone="accent" icon={<IconDoc />}>
        <p>{P.changes.body}</p>
      </InfoBlock>

      <InfoBlock title={P.contact.title} tone="accent" icon={<IconShare />}>
        <p>
          {P.contact.body}{" "}
          <a href="https://digital-knight.au" target="_blank" rel="noreferrer">
            {P.contact.linkLabel}
          </a>
          .
        </p>
      </InfoBlock>
    </InfoPage>
  );
}
