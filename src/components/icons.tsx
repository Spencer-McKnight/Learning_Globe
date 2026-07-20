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

export function IconUser(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}
