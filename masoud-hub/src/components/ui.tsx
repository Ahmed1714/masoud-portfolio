import { useEffect, useRef, useState, type ReactNode } from 'react';
import { startDictation, SPEECH_LANGS, type Dictation, type SpeechLang } from '../lib/speech';

// ---------- toast ----------
let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

// ---------- bottom sheet ----------
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="handle" />
        <h2>{title}</h2>
        {children}
      </div>
    </>
  );
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="empty">
      <span className="ic">{icon}</span>
      {text}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.id} className={`chip ${value === o.id ? 'active' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- dictation ----------
export function useDictation(onText: (t: string) => void) {
  const [live, setLive] = useState(false);
  const ref = useRef<Dictation | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  const start = async (lang: SpeechLang) => {
    try {
      ref.current = await startDictation(
        lang,
        (t) => cb.current(t),
        (m) => {
          toast(m);
          setLive(false);
        },
      );
      setLive(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };
  const stop = async () => {
    await ref.current?.stop();
    ref.current = null;
    setLive(false);
  };
  useEffect(() => () => void ref.current?.stop(), []);
  return { live, start, stop };
}

/**
 * Small mic button that appends dictated speech to an existing text value.
 */
export function MicAppend({ value, onChange, lang = 'ar-EG' }: { value: string; onChange: (v: string) => void; lang?: SpeechLang }) {
  const base = useRef(value);
  const { live, start, stop } = useDictation((t) => onChange([base.current, t].filter(Boolean).join(' ')));
  return (
    <button
      type="button"
      className={`mic-btn sm ${live ? 'live' : ''}`}
      onClick={() => {
        if (live) stop();
        else {
          base.current = value;
          start(lang);
        }
      }}
      aria-label="إملاء صوتي"
    >
      🎙
    </button>
  );
}

export function LangPicker({ value, onChange }: { value: SpeechLang; onChange: (l: SpeechLang) => void }) {
  return <Chips options={SPEECH_LANGS} value={value} onChange={onChange} />;
}

export const fmtMoney = (n: number, cur: string) =>
  `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${cur === 'EGP' ? 'ج.م' : cur}`;

export const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
