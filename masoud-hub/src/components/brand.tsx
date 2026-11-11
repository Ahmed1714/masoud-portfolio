import { useEffect, useState, type CSSProperties } from 'react';

/** Masoud brand mark (vector trace of the official logo). */
export function Logo({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 1150 1390" width={size * 0.83} height={size} style={style} aria-label="Masoud">
      <path fill="var(--gold)" d="M135,845 C185,867 230,895 272,927 C220,906 170,889 122,880 Z" />
      <path fill="var(--teal)" d="M203,255 L382,180 L344,288 C305,372 289,455 289,545 C289,800 440,1032 648,1132 C420,1090 260,900 197,678 L99,946 C40,944 -4,898 1,842 C6,805 22,776 30,748 L185,307 Z" />
      <path fill="var(--teal)" d="M650,82 L852,0 L772,215 C754,280 747,345 747,410 C747,680 900,880 1150,1000 C910,955 720,790 636,581 L532,866 C460,864 405,805 420,750 C421,740 424,731 427,722 Z" />
      <path fill="var(--gold)" d="M148,1193 C330,1312 580,1320 826,1152 C770,1222 600,1388 410,1390 C270,1391 178,1300 148,1193 Z" />
    </svg>
  );
}

/** Thin-line icon set in the brand style (1.5px strokes, rounded caps). */
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  tasks: 'M9 6h11M9 12h11M9 18h11M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7',
  quran: 'M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14',
  menu: 'M4 7h16M4 12h16M4 17h10',
  journal: 'M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v18M11 8h4M11 12h4',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  azkar: 'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM6.5 6.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM17.5 6.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM19 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 17v4',
  english: 'M3 18 7.5 6 12 18M4.6 14h5.8M15 10h6M18 8v2M16 16c2.5 0 4-2 4.5-6M16.5 12.5c1 1.6 2.6 3.1 4.5 3.5',
  content: 'M3 6h18v13H3zM3 10h18M7 6l2 4M12 6l2 4M17 6l2 4M10 13.5v3.5l3-1.75z',
  social: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4z',
  plus: 'M12 5v14M5 12h14',
  back: 'M9 6l6 6-6 6',
  play: 'M7 5v14l12-7z',
  stop: 'M7 7h10v10H7z',
  pause: 'M8 5v14M16 5v14',
  record: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  infinity: 'M7 9c-2 0-3.5 1.4-3.5 3S5 15 7 15c3.5 0 6.5-6 10-6 2 0 3.5 1.4 3.5 3S19 15 17 15c-3.5 0-6.5-6-10-6z',
  wave: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, stroke = 1.5, style }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties }) {
  const filled = name === 'play' || name === 'stop' || name === 'record';
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Ornament from the portfolio hero: line · dot · line */
export function Rule() {
  return (
    <div className="rule">
      <span />
      <i />
      <span />
    </div>
  );
}

/** Opening title sequence, echoing the portfolio hero. Shown once per app launch. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOut(true), 1700);
    const b = setTimeout(onDone, 2300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone]);
  return (
    <div className={`intro ${out ? 'out' : ''}`} onClick={onDone}>
      <div className="glow g1" />
      <div className="glow g2" />
      <div className="intro-in">
        <div className="intro-logo">
          <Logo size={96} />
        </div>
        <div className="intro-name" aria-label="Masoud">
          {'Masoud'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.07}s` }}>
              {c}
            </span>
          ))}
        </div>
        <div className="eyebrow intro-sub">Motion Graphics &amp; Animation Designer</div>
        <Rule />
      </div>
    </div>
  );
}
