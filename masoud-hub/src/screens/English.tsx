import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Word } from '../db';
import { Chips, Empty, MicAppend, Sheet, toast } from '../components/ui';
import { aiComplete, aiReady, parseJSON, prompts } from '../lib/ai';
import { speak } from '../lib/speech';

type Tab = 'review' | 'words' | 'write' | 'talk';
const DAY = 86400000;
const INTERVALS = [0, 1, 2, 4, 8, 16]; // days per Leitner box

function AddWord({ onClose }: { onClose: () => void }) {
  const [w, setW] = useState({ word: '', meaning: '', example: '' });
  const [busy, setBusy] = useState(false);
  const fill = async () => {
    if (!w.word.trim()) return;
    setBusy(true);
    try {
      const r = parseJSON<{ meaning: string; example: string }>(await aiComplete(prompts.englishWord().system, w.word));
      setW({ ...w, meaning: r.meaning, example: r.example });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!w.word.trim() || !w.meaning.trim()) return toast('اكتب الكلمة والمعنى');
    await db.words.add({ id: uid(), word: w.word.trim(), meaning: w.meaning.trim(), example: w.example.trim(), box: 1, nextReview: Date.now(), createdAt: Date.now() });
    toast('اتضافت 📚');
    onClose();
  };
  return (
    <Sheet title="كلمة جديدة" onClose={onClose}>
      <div className="row">
        <input autoFocus className="ltr" placeholder="word / phrase" value={w.word} onChange={(e) => setW({ ...w, word: e.target.value })} />
        <MicAppend lang="en-US" value={w.word} onChange={(v) => setW({ ...w, word: v })} />
      </div>
      {aiReady() && (
        <button className="btn sm teal" style={{ marginTop: 8 }} disabled={busy} onClick={fill}>
          {busy ? '…' : '✨ هات المعنى ومثال'}
        </button>
      )}
      <label>المعنى</label>
      <input value={w.meaning} onChange={(e) => setW({ ...w, meaning: e.target.value })} />
      <label>مثال</label>
      <textarea className="ltr" style={{ minHeight: 70 }} value={w.example} onChange={(e) => setW({ ...w, example: e.target.value })} />
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={save}>
        حفظ
      </button>
    </Sheet>
  );
}

function Review() {
  const due = useLiveQuery(() => db.words.where('nextReview').belowOrEqual(Date.now()).toArray(), []) ?? [];
  const [flip, setFlip] = useState(false);
  const w = due[0];
  if (!w) return <Empty icon="🎉" text="خلصت مراجعة النهارده! ضيف كلمات جديدة." />;
  const answer = async (ok: boolean) => {
    const box = ok ? Math.min(5, w.box + 1) : 1;
    await db.words.update(w.id, { box, nextReview: Date.now() + INTERVALS[box] * DAY - 60000 + (ok ? 0 : 60000) });
    setFlip(false);
  };
  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>فاضل {due.length} للمراجعة</div>
      <div className="flash" onClick={() => setFlip(!flip)}>
        <div>
          <div className="w">{w.word}</div>
          {flip ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{w.meaning}</div>
              {w.example && <div className="muted ltr" style={{ marginTop: 8, textAlign: 'center' }}>{w.example}</div>}
            </>
          ) : (
            <div className="muted" style={{ marginTop: 14 }}>اضغط عشان تشوف المعنى</div>
          )}
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => speak(w.word)}>🔊</button>
        <button className="btn danger grow" onClick={() => answer(false)}>
          نسيتها
        </button>
        <button className="btn teal grow" onClick={() => answer(true)}>
          عارفها ✓
        </button>
      </div>
    </>
  );
}

function Words() {
  const words = useLiveQuery(() => db.words.orderBy('box').toArray(), []) ?? [];
  if (!words.length) return <Empty icon="📚" text="لسه مفيش كلمات" />;
  return (
    <>
      {words.map((w) => (
        <div key={w.id} className="list-item">
          <button className="btn sm ghost" onClick={() => speak(w.word)}>🔊</button>
          <div className="grow">
            <div className="title ltr" style={{ textAlign: 'right' }}>{w.word}</div>
            <div className="muted">{w.meaning}</div>
          </div>
          <span className="tag">{'★'.repeat(w.box)}</span>
          <button className="btn sm ghost danger" onClick={() => db.words.delete(w.id)}>✕</button>
        </div>
      ))}
    </>
  );
}

function Write() {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setOut(await aiComplete(prompts.englishCorrect().system, text));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>اكتب أو اتكلم بالإنجليزي عن يومك أو شغلك، والـ AI هيصححلك ويشرح.</div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <textarea className="ltr" placeholder="Today I worked on…" value={text} onChange={(e) => setText(e.target.value)} />
        <MicAppend lang="en-US" value={text} onChange={setText} />
      </div>
      <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || !text.trim() || !aiReady()} onClick={run}>
        {busy ? '…' : aiReady() ? '✨ صحّحلي' : 'اربط AI من الإعدادات'}
      </button>
      {out && <div className="output" style={{ marginTop: 12 }}>{out}</div>}
    </>
  );
}

function Talk() {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    const next = [...msgs, { me: true, text }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const transcript = next.map((m) => `${m.me ? 'Learner' : 'Tutor'}: ${m.text}`).join('\n');
      const reply = await aiComplete(prompts.englishChat().system, `${transcript}\nTutor:`);
      setMsgs([...next, { me: false, text: reply }]);
      speak(reply.split('💡')[0]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>دردشة إنجليزي — اتكلم بالمايك والـ AI يرد عليك بصوت.</div>
      {msgs.map((m, i) => (
        <div key={i} className="card ltr" style={{ background: m.me ? 'var(--surface-2)' : 'var(--gold-glow)', marginInlineStart: m.me ? 30 : 0, whiteSpace: 'pre-wrap' }}>
          {m.text}
        </div>
      ))}
      <div className="row">
        <input className="ltr" placeholder="Say something…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <MicAppend lang="en-US" value={text} onChange={setText} />
        <button className="btn primary" disabled={busy || !aiReady()} onClick={send}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </>
  );
}

export function English() {
  const [tab, setTab] = useState<Tab>('review');
  const [adding, setAdding] = useState(false);
  const total = useLiveQuery(() => db.words.count(), []) ?? 0;
  const mastered = useLiveQuery(() => db.words.where('box').equals(5).count(), []) ?? 0;
  return (
    <>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="v">{total}</div>
          <div className="l">كلمة في القاموس</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--teal)' }}>{mastered}</div>
          <div className="l">حافظها كويس</div>
        </div>
      </div>
      <Chips
        options={[
          { id: 'review', label: '🃏 مراجعة' },
          { id: 'words', label: '📚 كلماتي' },
          { id: 'write', label: '✍️ كتابة' },
          { id: 'talk', label: '🗣 محادثة' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div style={{ marginTop: 14 }}>
        {tab === 'review' && <Review />}
        {tab === 'words' && <Words />}
        {tab === 'write' && <Write />}
        {tab === 'talk' && <Talk />}
      </div>
      {(tab === 'review' || tab === 'words') && (
        <button className="fab" onClick={() => setAdding(true)}>
          +
        </button>
      )}
      {adding && <AddWord onClose={() => setAdding(false)} />}
    </>
  );
}

export type { Word };
