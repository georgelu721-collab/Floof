import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

const mk = (paths: React.ReactNode) =>
  function Icon({ size, ...props }: P) {
    return <svg {...base(size, props)} aria-hidden="true">{paths}</svg>;
  };

export const IconHome = mk(<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />);
export const IconSearch = mk(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconTrophy = mk(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></>);
export const IconUser = mk(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const IconHeart = mk(<path d="M12 20s-7-4.5-9-9.5C1.6 6.8 4 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3 0 5.4 2.8 4 6.5-2 5-9 9.5-9 9.5z" />);
export const IconComment = mk(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />);
export const IconSend = mk(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>);
export const IconBookmark = mk(<path d="M6 3h12v18l-6-4-6 4z" />);
export const IconBell = mk(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconChat = mk(<><path d="M4 5h16v11H8l-4 4z" /><path d="M8 10h8M8 13h5" /></>);
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IconBack = mk(<path d="m15 18-6-6 6-6" />);
export const IconChevron = mk(<path d="m9 18 6-6-6-6" />);
export const IconMore = mk(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const IconSettings = mk(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconPin = mk(<><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>);
export const IconCalendar = mk(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>);
export const IconCheck = mk(<path d="m5 12 5 5L20 7" />);
export const IconX = mk(<path d="M18 6 6 18M6 6l12 12" />);
export const IconShop = mk(<><path d="M4 7h16l-1.5 12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></>);
export const IconUsers = mk(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>);
export const IconImage = mk(<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>);
export const IconGrid = mk(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const IconStar = mk(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />);
export const IconWallet = mk(<><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /></>);
export const IconShield = mk(<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />);
export const IconFlame = mk(<path d="M12 22c4 0 7-2.7 7-6.5 0-3.6-2.5-5.8-4-8.5-.5 2-1.5 3-3 3.5C12 7 10.5 4.5 8 2c.5 3.5-3 6.5-3 11.5C5 19.3 8 22 12 22z" />);

export function PawIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <ellipse cx="6" cy="9" rx="2.2" ry="2.8" />
      <ellipse cx="10" cy="5.5" rx="2.2" ry="2.8" />
      <ellipse cx="14" cy="5.5" rx="2.2" ry="2.8" />
      <ellipse cx="18" cy="9" rx="2.2" ry="2.8" />
      <path d="M12 11c-3.2 0-6 3.6-6 6.2 0 2 1.6 2.8 3 2.8 1.3 0 2-.6 3-.6s1.7.6 3 .6c1.4 0 3-.8 3-2.8 0-2.6-2.8-6.2-6-6.2z" />
    </svg>
  );
}

export function BiscuitIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  const bone = (fill: string, grow = 0) => (
    <g fill={fill}>
      <circle cx="8" cy="12" r={4.6 + grow} />
      <circle cx="8" cy="20" r={4.6 + grow} />
      <circle cx="24" cy="12" r={4.6 + grow} />
      <circle cx="24" cy="20" r={4.6 + grow} />
      <rect x={8 - grow} y={10.5 - grow} width={16 + grow * 2} height={11 + grow * 2} rx="2" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g transform="rotate(-28 16 16)">
        {bone("#8A4F22", 1.6)}
        {bone("#E9A862")}
        <circle cx="12" cy="15" r="1.2" fill="#8A4F22" />
        <circle cx="16.5" cy="17.5" r="1.2" fill="#8A4F22" />
        <circle cx="20" cy="14.5" r="1.2" fill="#8A4F22" />
      </g>
    </svg>
  );
}
export const IconTag = mk(<><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>);
export const IconChevronDown = mk(<path d="m6 9 6 6 6-6" />);
