import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV, setKV, today, uid } from '../db';
import { Empty, toast } from '../components/ui';
import { audioUrl, fromGlobal, globalIndex, JUZ_STARTS, juzOf, loadQuran, toArabicDigits, TOTAL_AYAHS, type Surah } from '../lib/quran';
import { getSettingsSync, saveSettings } from '../lib/settings';

export interface QuranPos {
  s: number;
  a: number;
}

export function useWird() {
  const pos = useLiveQuery(() => getKV<QuranPos>('quranPos', { s: 1, a: 0 }), []);
  const todayRead = useLiveQuery(async () => (await db.quranLog.where('date').equals(today()).toArray()).reduce((a, b) => a + b.ayahs, 0), []) ?? 0;
  const khatmas = useLiveQuery(() => getKV<number>('khatmas', 0), []) ?? 0;
  const target = Math.ceil(TOTAL_AYAHS / getSettingsSync().quran.khatmaDays);
  return { pos, todayRead, target, khatmas };
}

const MAX_SESSION = 700;

/** Moves the reading bookmark and logs the ayahs read since the previous bookmark. */
async function markReached(q: Surah[], s: number, a: number) {
  const prev = await getKV<QuranPos | null>('quranPos', null);
  const prevIdx = !prev || prev.a === 0 ? 0 : globalIndex(q, prev.s, prev.a);
  const idx = globalIndex(q, s, a);
  // First bookmark, or a big jump (more than ~3 juz), just moves the bookmark without counting it as read.
  const delta = prev && idx - prevIdx <= MAX_SESSION ? idx - prevIdx : 0;
  if (delta > 0) {
    await db.quranLog.add({ id: uid(), date: today(), ayahs: delta, from: `${prev!.s}:${prev!.a + 1}`, to: `${s}:${a}` });
  }
  if (idx >= TOTAL_AYAHS) {
    await setKV('khatmas', (await getKV<number>('khatmas', 0)) + 1);
    await setKV('quranPos', { s: 1, a: 0 });
    toast('ختمت القرآن 🎉 تقبل الله منك');
    return;
  }
  await setKV('quranPos', { s, a });
  toast(delta > 0 ? `✔ قرأت ${toArabicDigits(delta)} آية` : '📍 اتحدد مكانك');
}

function Reader({ q, surah, startAyah, onBack }: { q: Surah[]; surah: number; startAyah?: number; onBack: () => void }) {
  const sura = q[surah - 1];
  const [sel, setSel] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [size, setSize] = useState(getSettingsSync().quran.fontSize);
  const audio = useRef<HTMLAudioElement | null>(null);
  const pos = useLiveQuery(() => getKV<QuranPos>('quranPos', { s: 1, a: 0 }), []);

  useEffect(() => {
    const target = startAyah ?? (pos?.s === surah ? pos.a + 1 : 0);
    if (target > 1) setTimeout(() => document.getElementById(`ayah-${target}`)?.scrollIntoView({ block: 'center' }), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, startAyah]);
  useEffect(() => () => audio.current?.pause(), []);

  const play = (a: number) => {
    if (!navigator.onLine) return toast('الاستماع محتاج إنترنت — القراءة شغالة أوفلاين');
    audio.current?.pause();
    const el = new Audio(audioUrl(globalIndex(q, surah, a)));
    audio.current = el;
    setPlaying(a);
    el.onended = () => (a < sura.total_verses ? play(a + 1) : setPlaying(null));
    el.onerror = () => {
      setPlaying(null);
      toast('مقدرتش أشغّل الصوت');
    };
    el.play().catch(() => setPlaying(null));
    document.getElementById(`ayah-${a}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const changeSize = (d: number) => {
    const n = Math.min(40, Math.max(18, size + d));
    setSize(n);
    const s = getSettingsSync();
    saveSettings({ ...s, quran: { ...s.quran, fontSize: n } });
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn sm" onClick={onBack}>
          → الفهرس
        </button>
        <div className="grow" />
        <button className="btn sm" onClick={() => changeSize(-2)}>
          أ-
        </button>
        <button className="btn sm" onClick={() => changeSize(2)}>
          أ+
        </button>
        {playing ? (
          <button
            className="btn sm teal"
            onClick={() => {
              audio.current?.pause();
              setPlaying(null);
            }}
          >
            ■ إيقاف
          </button>
        ) : (
          <button className="btn sm teal" onClick={() => play(1)}>
            ▶ استمع
          </button>
        )}
      </div>
      <div className="mushaf" style={{ fontSize: size }}>
        <div className="surah-head">سورة {sura.name}</div>
        {surah !== 1 && surah !== 9 && <div className="basmala">{q[0].verses[0].text}</div>}
        {sura.verses.map((v) => (
          <span
            key={v.id}
            id={`ayah-${v.id}`}
            className={`ayah ${pos?.s === surah && pos.a === v.id ? 'mark' : ''} ${playing === v.id || sel === v.id ? 'playing' : ''}`}
            onClick={() => setSel(sel === v.id ? null : v.id)}
          >
            {v.text}
            <span className="ayah-no">{toArabicDigits(v.id)}</span>{' '}
          </span>
        ))}
      </div>
      {sel && (
        <div className="sheet" style={{ animation: 'up .25s var(--ease)' }}>
          <div className="row">
            <div className="grow muted">
              {sura.name} · آية {toArabicDigits(sel)} · الجزء {toArabicDigits(juzOf(surah, sel))}
            </div>
            <button className="btn sm ghost" onClick={() => setSel(null)}>
              ✕
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn primary grow"
              onClick={async () => {
                await markReached(q, surah, sel);
                setSel(null);
              }}
            >
              📍 وصلت هنا
            </button>
            <button
              className="btn teal"
              onClick={() => {
                play(sel);
                setSel(null);
              }}
            >
              ▶ استمع من هنا
            </button>
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
        {surah > 1 ? (
          <button className="btn sm" onClick={() => (location.hash = `#/quran?s=${surah - 1}`)}>
            → {q[surah - 2].name}
          </button>
        ) : (
          <span />
        )}
        {surah < 114 && (
          <button className="btn sm" onClick={() => (location.hash = `#/quran?s=${surah + 1}`)}>
            {q[surah].name} ←
          </button>
        )}
      </div>
    </>
  );
}

function useQuranParams(): [number | null, number | undefined] {
  const read = (): [number | null, number | undefined] => {
    const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const s = Number(p.get('s'));
    const a = Number(p.get('a'));
    return [s >= 1 && s <= 114 ? s : null, a || undefined];
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    const fn = () => {
      setV(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return v;
}

export function Quran() {
  const [q, setQ] = useState<Surah[] | null>(null);
  const [search, setSearch] = useState('');
  const [surah, startAyah] = useQuranParams();
  const { pos, todayRead, target, khatmas } = useWird();
  const [days, setDays] = useState(getSettingsSync().quran.khatmaDays);

  useEffect(() => {
    loadQuran().then(setQ);
  }, []);
  if (!q) return <Empty icon="📖" text="جاري التحميل…" />;

  if (surah) return <Reader q={q} surah={surah} startAyah={startAyah} onBack={() => (location.hash = '#/quran')} />;

  const doneIdx = pos && pos.a > 0 ? globalIndex(q, pos.s, pos.a) : 0;
  const [ns, na] = fromGlobal(q, Math.min(doneIdx + 1, TOTAL_AYAHS));
  const shown = q.filter((s) => !search || s.name.includes(search) || s.transliteration.toLowerCase().includes(search.toLowerCase()) || String(s.id) === search);

  return (
    <>
      <div className="card gold">
        <div className="row">
          <div className="grow">
            <h3>ورد النهارده</h3>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {toArabicDigits(todayRead)} <span className="muted">/ {toArabicDigits(target)} آية</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>{toArabicDigits(khatmas)}</div>
            <div className="muted">ختمة</div>
          </div>
        </div>
        <div className="progress" style={{ margin: '10px 0' }}>
          <i style={{ width: `${Math.min(100, (todayRead / target) * 100)}%` }} />
        </div>
        <div className="muted">
          الختمة الحالية: {Math.round((doneIdx / TOTAL_AYAHS) * 100)}% · الجزء {toArabicDigits(juzOf(ns, na))}
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => (location.hash = `#/quran?s=${ns}&a=${na}`)}>
          ▶ كمّل من {q[ns - 1].name} آية {toArabicDigits(na)}
        </button>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted grow">أختم كل</span>
          <select
            style={{ width: 120 }}
            value={days}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDays(n);
              const s = getSettingsSync();
              saveSettings({ ...s, quran: { ...s.quran, khatmaDays: n } });
            }}
          >
            {[7, 10, 15, 20, 30, 45, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} يوم
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-title">الأجزاء</div>
      <div className="chips">
        {JUZ_STARTS.map(([s, a], i) => (
          <button key={i} className="chip" onClick={() => (location.hash = `#/quran?s=${s}&a=${a}`)}>
            جزء {toArabicDigits(i + 1)}
          </button>
        ))}
      </div>

      <div className="section-title">السور</div>
      <input placeholder="🔍 اسم السورة أو رقمها" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div style={{ marginTop: 10 }}>
        {shown.map((s) => (
          <div key={s.id} className="list-item" onClick={() => (location.hash = `#/quran?s=${s.id}`)}>
            <div className="ayah-no" style={{ fontSize: 14, width: 34, height: 34 }}>
              {toArabicDigits(s.id)}
            </div>
            <div className="grow">
              <div className="title" style={{ fontFamily: 'var(--font-quran)', fontSize: 19 }}>
                {s.name}
              </div>
              <div className="muted">
                {s.type === 'meccan' ? 'مكية' : 'مدنية'} · {toArabicDigits(s.total_verses)} آية
              </div>
            </div>
            {pos?.s === s.id && pos.a > 0 && <span className="tag teal">📍</span>}
          </div>
        ))}
      </div>
    </>
  );
}
