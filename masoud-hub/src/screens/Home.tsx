import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV, today } from '../db';
import { fmtMoney } from '../components/ui';
import { go, type Route } from '../router';
import { getSettingsSync } from '../lib/settings';
import { AZKAR } from '../lib/azkar';
import { toArabicDigits } from '../lib/quran';
import { useWird } from './Quran';
import { TaskEditor, TaskRow } from './Tasks';
import type { Task } from '../db';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'ليلة هادية';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'نهارك سعيد';
  return 'مساء الخير';
}

function hijri() {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  } catch {
    return '';
  }
}

const QUICK: { r: Route; ic: string; label: string }[] = [
  { r: 'journal', ic: '📔', label: 'يومية' },
  { r: 'expenses', ic: '💸', label: 'مصروف' },
  { r: 'ideas', ic: '💡', label: 'فكرة' },
  { r: 'azkar', ic: '📿', label: 'أذكار' },
  { r: 'english', ic: '🇬🇧', label: 'إنجليزي' },
  { r: 'content', ic: '🎬', label: 'محتوى' },
];

export function Home() {
  const s = getSettingsSync();
  const d = today();
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.deleted && t.status !== 'done' && (!t.due || t.due <= d)).toArray(), [d]) ?? [];
  const month = useLiveQuery(
    () =>
      db.expenses
        .filter((e) => !e.deleted && e.type === 'expense' && e.date.startsWith(d.slice(0, 7)) && e.currency === s.currency)
        .toArray()
        .then((l) => l.reduce((a, b) => a + b.amount, 0)),
    [d],
  );
  const wroteToday = useLiveQuery(() => db.journal.where('date').equals(d).filter((j) => !j.deleted).count(), [d]) ?? 0;
  const wordsDue = useLiveQuery(() => db.words.where('nextReview').belowOrEqual(Date.now()).count(), []) ?? 0;
  const { todayRead, target } = useWird();
  const [azkar, setAzkar] = useState<Record<string, number[]>>({});
  useEffect(() => {
    getKV<Record<string, number[]>>(`azkar:${d}`, {}).then(setAzkar);
  }, [d]);
  const azkarDone = (id: string) => {
    const c = AZKAR.find((x) => x.id === id)!;
    return c.items.every((z, i) => (azkar[id]?.[i] ?? 0) >= z.count);
  };

  return (
    <>
      <div className="hero">
        <div className="hello">
          {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })} · {hijri()}
        </div>
        <div className="big">
          {greeting()} يا <em>{s.name}</em>
        </div>
      </div>

      <div className="grid2">
        <div className="card gold" style={{ marginBottom: 0 }} onClick={() => go('quran')}>
          <div className="muted">📖 الورد</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {toArabicDigits(todayRead)}
            <span className="muted"> / {toArabicDigits(target)}</span>
          </div>
          <div className="progress" style={{ marginTop: 8 }}>
            <i style={{ width: `${Math.min(100, (todayRead / target) * 100)}%` }} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }} onClick={() => go('azkar')}>
          <div className="muted">📿 الأذكار</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <span className={`tag ${azkarDone('morning') ? 'teal' : ''}`}>🌅 صباح {azkarDone('morning') ? '✓' : ''}</span>
            <span className={`tag ${azkarDone('evening') ? 'teal' : ''}`}>🌙 مساء {azkarDone('evening') ? '✓' : ''}</span>
          </div>
        </div>
      </div>

      <div className="section-title">
        <span>✅ مهام النهارده ({tasks.length})</span>
        <button className="btn sm ghost" onClick={() => go('tasks')}>
          الكل ←
        </button>
      </div>
      {tasks
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5)
        .map((t) => (
          <TaskRow key={t.id} t={t} onOpen={setEditing} />
        ))}
      <button className="btn block ghost" style={{ border: '1px dashed var(--border-strong)' }} onClick={() => setEditing({})}>
        + مهمة سريعة
      </button>

      <div className="section-title">النهارده</div>
      <div className="grid3">
        <div className="stat" onClick={() => go('expenses')}>
          <div className="v" style={{ fontSize: 16 }}>{fmtMoney(month ?? 0, s.currency)}</div>
          <div className="l">مصروف الشهر</div>
        </div>
        <div className="stat" onClick={() => go('journal')}>
          <div className="v">{wroteToday ? '✓' : '—'}</div>
          <div className="l">يومية النهارده</div>
        </div>
        <div className="stat" onClick={() => go('english')}>
          <div className="v">{wordsDue}</div>
          <div className="l">كلمة للمراجعة</div>
        </div>
      </div>

      <div className="section-title">وصول سريع</div>
      <div className="tiles">
        {QUICK.map((q) => (
          <button key={q.r} className="tile" onClick={() => go(q.r)}>
            <span className="ic">{q.ic}</span>
            {q.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }} onClick={() => go('voice')}>
        <div className="row">
          <div style={{ fontSize: 28 }}>🎙</div>
          <div className="grow">
            <h3 style={{ margin: 0 }}>قول اللي في دماغك</h3>
            <div className="muted">اتكلم وحوّله لبوست، رسالة، مهام أو يومية</div>
          </div>
          <span style={{ color: 'var(--gold)' }}>←</span>
        </div>
      </div>

      {editing && <TaskEditor task={editing.id ? editing : undefined} onClose={() => setEditing(null)} />}
    </>
  );
}
