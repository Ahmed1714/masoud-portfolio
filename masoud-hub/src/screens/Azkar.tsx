import { useEffect, useState } from 'react';
import { getKV, setKV, today } from '../db';
import { AZKAR, type Zikr } from '../lib/azkar';
import { loadQuran, toArabicDigits, type Surah } from '../lib/quran';
import { toast } from '../components/ui';

type Progress = Record<string, number[]>; // category -> counts per item

function zikrText(z: Zikr, q: Surah[] | null) {
  if (z.text) return z.text;
  if (!z.ayat || !q) return '…';
  const [s, from, to] = z.ayat;
  const verses = q[s - 1].verses.filter((v) => v.id >= from && v.id <= to).map((v) => `${v.text} ﴿${toArabicDigits(v.id)}﴾`);
  return (z.basmala ? `${q[0].verses[0].text}\n` : '') + verses.join(' ');
}

export function Azkar() {
  const [cat, setCat] = useState(() => (new Date().getHours() < 14 ? 'morning' : 'evening'));
  const [q, setQ] = useState<Surah[] | null>(null);
  const [prog, setProg] = useState<Progress>({});
  const key = `azkar:${today()}`;

  useEffect(() => {
    loadQuran().then(setQ);
    getKV<Progress>(key, {}).then(setProg);
  }, [key]);

  const category = AZKAR.find((c) => c.id === cat)!;
  const counts = prog[cat] ?? category.items.map(() => 0);
  const done = category.items.filter((z, i) => (counts[i] ?? 0) >= z.count).length;

  const tap = (i: number) => {
    const z = category.items[i];
    const next = [...counts];
    if ((next[i] ?? 0) >= z.count) return;
    next[i] = (next[i] ?? 0) + 1;
    const p = { ...prog, [cat]: next };
    setProg(p);
    setKV(key, p);
    navigator.vibrate?.(next[i] === z.count ? 60 : 12);
    if (next[i] === z.count) {
      const allDone = category.items.every((zz, j) => (next[j] ?? 0) >= zz.count);
      if (allDone) toast(`تقبّل الله ✨ خلصت ${category.title}`);
      else setTimeout(() => document.getElementById(`zikr-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  };

  const reset = () => {
    const p = { ...prog, [cat]: category.items.map(() => 0) };
    setProg(p);
    setKV(key, p);
  };

  return (
    <>
      <div className="chips">
        {AZKAR.map((c) => {
          const cc = prog[c.id] ?? [];
          const complete = c.items.every((z, i) => (cc[i] ?? 0) >= z.count);
          return (
            <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              {c.icon} {c.title} {complete ? '✓' : ''}
            </button>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div className="grow">
            {toArabicDigits(done)} من {toArabicDigits(category.items.length)}
          </div>
          <button className="btn sm ghost" onClick={reset}>
            ↺ من الأول
          </button>
        </div>
        <div className="progress" style={{ marginTop: 8 }}>
          <i style={{ width: `${(done / category.items.length) * 100}%` }} />
        </div>
      </div>
      {category.items.map((z, i) => {
        const c = counts[i] ?? 0;
        const finished = c >= z.count;
        return (
          <div key={i} id={`zikr-${i}`} className="card" style={{ opacity: finished ? 0.55 : 1, scrollMarginTop: 80 }}>
            {z.title && <div className="tag teal" style={{ display: 'inline-block', marginBottom: 8 }}>{z.title}</div>}
            <div className="zikr" style={{ whiteSpace: 'pre-line' }}>{zikrText(z, q)}</div>
            <button className={`counter ${finished ? 'done' : ''}`} onClick={() => tap(i)}>
              {finished ? '✓ تم' : `${toArabicDigits(c)} / ${toArabicDigits(z.count)}`}
            </button>
          </div>
        );
      })}
    </>
  );
}
