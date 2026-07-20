import type { ReactNode } from "react";

/**
 * Inline stroke icons. They inherit currentColor so they follow the text
 * color of whatever button they sit in — no per-icon color props needed.
 */

interface IconProps {
  size?: number;
}

function Svg(props: IconProps & { children: ReactNode }): JSX.Element {
  const size = props.size ?? 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

export function IconCompass(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path
        d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

export function IconSliders(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.6" fill="currentColor" stroke="none" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPassport(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <circle cx="12" cy="10" r="3" />
      <line x1="9" y1="16.5" x2="15" y2="16.5" />
    </Svg>
  );
}

export function IconPause(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <line x1="9.2" y1="6" x2="9.2" y2="18" />
      <line x1="14.8" y1="6" x2="14.8" y2="18" />
    </Svg>
  );
}

export function IconBulb(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8.6 14.2a5.5 5.5 0 1 1 6.8 0c-.8.7-1.4 1.5-1.4 2.4h-4c0-.9-.6-1.7-1.4-2.4z" />
      <line x1="10" y1="20" x2="14" y2="20" />
    </Svg>
  );
}

export function IconPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <line x1="12" y1="5.5" x2="12" y2="18.5" />
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
    </Svg>
  );
}

export function IconMinus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
    </Svg>
  );
}

export function IconTrophy(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5c.2 2.8 1.7 4.4 4 4.8" />
      <path d="M17 5.5h2.5c-.2 2.8-1.7 4.4-4 4.8" />
      <line x1="12" y1="14" x2="12" y2="18.5" />
      <line x1="8.5" y1="18.5" x2="15.5" y2="18.5" />
    </Svg>
  );
}

/** Ranked podium — the global board, distinct from the trophy on the passport. */
export function IconLeaderboard(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="9.5" y="4" width="5" height="16" rx="1.2" />
      <rect x="3" y="10" width="5" height="10" rx="1.2" />
      <rect x="16" y="8" width="5" height="12" rx="1.2" />
    </Svg>
  );
}

/** Arrow lifting out of a tray — share / send onward. */
export function IconShare(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 10.5H7a2.2 2.2 0 0 0-2.2 2.2v5.6A2.2 2.2 0 0 0 7 20.5h10a2.2 2.2 0 0 0 2.2-2.2v-5.6A2.2 2.2 0 0 0 17 10.5h-1" />
      <line x1="12" y1="3.8" x2="12" y2="13.8" />
      <path d="M8.6 6.9L12 3.5l3.4 3.4" />
    </Svg>
  );
}

export function IconUser(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}

/* ---------- info pages (/privacy, /guide) ---------- */

export function IconShield(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3l7 2.6v5.2c0 4.6-3 8.1-7 9.7-4-1.6-7-5.1-7-9.7V5.6z" />
      <path d="M9 11.8l2.1 2.1 3.9-4" />
    </Svg>
  );
}

export function IconLock(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V7.7a3.5 3.5 0 0 1 7 0v2.8" />
      <line x1="12" y1="14.5" x2="12" y2="16.5" />
    </Svg>
  );
}

export function IconDatabase(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
      <path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </Svg>
  );
}

export function IconCookie(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M20.8 13.1A9 9 0 1 1 10.9 3.2a3.6 3.6 0 0 0 4.4 4.4 3.6 3.6 0 0 0 5.5 5.5z" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconHeart(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7.4 4.4 4.4 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
    </Svg>
  );
}

export function IconDoc(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <line x1="10" y1="12" x2="15" y2="12" />
      <line x1="10" y1="16" x2="15" y2="16" />
    </Svg>
  );
}

export function IconKeyboard(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <line x1="7" y1="11" x2="7" y2="11.01" />
      <line x1="11" y1="11" x2="11" y2="11.01" />
      <line x1="15" y1="11" x2="15" y2="11.01" />
      <line x1="8" y1="14.5" x2="16" y2="14.5" />
    </Svg>
  );
}

export function IconMouse(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="8" y="3.5" width="8" height="17" rx="4" />
      <line x1="12" y1="7" x2="12" y2="10" />
    </Svg>
  );
}

export function IconTouch(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M9.5 11.5V6.3a1.8 1.8 0 0 1 3.6 0v5.2" />
      <path d="M13.1 12.6v-1.4a1.7 1.7 0 0 1 3.4.3v3.3c0 3.4-2.2 5.7-5.2 5.7-2.4 0-3.8-1.1-5.1-3.2l-1.6-2.7a1.6 1.6 0 0 1 2.7-1.7l1.2 1.7" />
      <path d="M7.2 4.4a4.6 4.6 0 0 1 8.1.1" />
    </Svg>
  );
}

export function IconEye(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function IconSpeaker(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M18 6.5a8 8 0 0 1 0 11" />
    </Svg>
  );
}
