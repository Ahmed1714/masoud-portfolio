import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteRecord, saveRecord, today, type JournalEntry } from '../db';
import { Empty, fmtDate, LangPicker, MicAppend, Sheet, toast } from '../components/ui';
import { aiComplete, aiReady, parseJSON, prompts } from '../lib/ai';
import type { SpeechLang } from '../lib/speech';

const MOODS = ['😄', '🙂', '😐', '😔', '😤', '🤲', '🔥', '😴'];

function Editor({ entry, onClose }: { entry: Partial<JournalEntry>; onClose: () => void }) {
  const [e, setE] = useState(entry);
  const [lang, setLang] = useState<SpeechLang>('ar-EG');
  const [busy, setBusy] = useState(false);

  const polish = async () => {
    if (!e.body?.trim()) return;
    setBusy(true);
    try {
      const out = parseJSON<{ title: string; body: string; mood: string }>(await aiComplete(prompts.journal().system, e.body));
      setE({ ...e, title: e.title || out.title, body: out.body, mood: e.mood || out.mood });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!e.body?.trim()) return toast('اكتب حاجة الأول');
    await saveRecord<JournalEntry>('journal', {
      id: e.id,
      date: e.date ?? today(),
      title: e.title?.trim() || `يومية ${fmtDate(e.date ?? today())}`,
      body: e.body.trim(),
      mood: e.mood,
    });
    toast('اتحفظت ✨');
    onClose();
  };

  return (
    <Sheet title={e.id ? 'تعديل اليومية' : 'يومية جديدة'} onClose={onClose}>
      <div className="grid2">
        <input placeholder="عنوان (اختياري)" value={e.title ?? ''} onChange={(x) => setE({ ...e, title: x.target.value })} />
        <input type="date" value={e.date ?? today()} onChange={(x) => setE({ ...e, date: x.target.value })} />
      </div>
      <label>المود</label>
      <div className="chips">
        {MOODS.map((m) => (
          <button key={m} className={`chip ${e.mood === m ? 'active' : ''}`} onClick={() => setE({ ...e, mood: m })} style={{ fontSize: 20 }}>
            {m}
          </button>
        ))}
      </div>
      <label>احكي يومك (اكتب أو اتكلم)</label>
      <LangPicker value={lang} onChange={setLang} />
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
        <textarea style={{ minHeight: 200 }} value={e.body ?? ''} onChange={(x) => setE({ ...e, body: x.target.value })} placeholder="النهارده حصل…" />
        <MicAppend lang={lang} value={e.body ?? ''} onChange={(v) => setE({ ...e, body: v })} />
      </div>
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {aiReady() && (
          <button className="btn teal" disabled={busy} onClick={polish}>
            {busy ? '…' : '✨ رتّبها'}
          </button>
        )}
        {e.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteRecord('journal', e.id!);
              onClose();
            }}
          >
            حذف
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function Journal() {
  const [editing, setEditing] = useState<Partial<JournalEntry> | null>(null);
  const [q, setQ] = useState('');
  const entries = useLiveQuery(() => db.journal.orderBy('date').reverse().filter((x) => !x.deleted).toArray(), []) ?? [];
  const shown = q ? entries.filter((x) => (x.title + x.body).includes(q)) : entries;
  const streak = (() => {
    const days = new Set(entries.map((x) => x.date));
    let n = 0;
    const d = new Date();
    for (;;) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!days.has(k)) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  })();

  return (
    <>
      <div className="card gold row">
        <div className="grow">
          <h3>🔥 {streak} يوم ورا بعض</h3>
          <div className="muted">{entries.length} يومية مكتوبة</div>
        </div>
        <button className="btn primary" onClick={() => setEditing({ date: today() })}>
          اكتب النهارده
        </button>
      </div>
      <input placeholder="🔍 دوّر في اليوميات" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ marginTop: 12 }}>
        {shown.length ? (
          shown.map((x) => (
            <div key={x.id} className="list-item" onClick={() => setEditing(x)}>
              <div style={{ fontSize: 26 }}>{x.mood ?? '📝'}</div>
              <div className="grow">
                <div className="title">{x.title}</div>
                <div className="muted">{fmtDate(x.date)}</div>
                <div className="muted" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {x.body}
                </div>
              </div>
              {x.dirty === 1 && <span className="unsynced" />}
            </div>
          ))
        ) : (
          <Empty icon="📔" text="ابدأ أول يومية ليك" />
        )}
      </div>
      <button className="fab" onClick={() => setEditing({ date: today() })}>
        +
      </button>
      {editing && <Editor entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
