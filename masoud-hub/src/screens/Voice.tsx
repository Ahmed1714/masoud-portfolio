import { useEffect, useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveRecord, today, type ContentItem, type Idea, type JournalEntry, type Recording, type Task } from '../db';
import { Chips, LangPicker, toast, useDictation } from '../components/ui';
import { Icon } from '../components/brand';
import { aiComplete, aiReady, effectiveProvider, OUT_LANG_LABEL, parseJSON, PLATFORMS, PROVIDER_LABEL, prompts, type OutLang } from '../lib/ai';
import { getSettingsSync } from '../lib/settings';
import type { SpeechLang } from '../lib/speech';
import { deleteRecording, fmtDuration, recordingAudio, startRecording, type RecorderHandle } from '../lib/recorder';
import { activeTranscriber, processRecordings, retranscribe } from '../lib/transcribe';
import { go } from '../router';

type Mode = 'post' | 'message' | 'clean' | 'tasks' | 'journal';
const MODES: { id: Mode; label: string }[] = [
  { id: 'post', label: 'بوست' },
  { id: 'message', label: 'رسالة' },
  { id: 'clean', label: 'تنقيح' },
  { id: 'tasks', label: 'مهام' },
  { id: 'journal', label: 'يومية' },
];
const TONES = ['احترافي', 'ودود', 'ملهم', 'خفيف ومرح', 'رسمي', 'تعليمي'];

// ---------------- unlimited recorder ----------------

function Meter({ handle }: { handle: RecorderHandle | null }) {
  const [bars, setBars] = useState<number[]>(() => Array(28).fill(0));
  useEffect(() => {
    if (!handle) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 70) {
        last = t;
        const v = handle.paused ? 0 : handle.level();
        setBars((b) => [...b.slice(1), v]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [handle]);
  return (
    <div className="meter">
      {bars.map((v, i) => (
        <i key={i} style={{ height: `${4 + v * 50}px`, opacity: 0.35 + (i / bars.length) * 0.65 }} />
      ))}
    </div>
  );
}

function RecorderPanel({ lang, onRecorded }: { lang: SpeechLang; onRecorded: (id: string) => void }) {
  const [handle, setHandle] = useState<RecorderHandle | null>(null);
  const [paused, setPaused] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    if (!handle) return;
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [handle]);
  useEffect(() => () => void handle?.stop(), [handle]);

  const toggle = async () => {
    if (!handle) {
      try {
        setHandle(await startRecording(lang));
        setPaused(false);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'مقدرتش أبدأ التسجيل');
      }
      return;
    }
    const rec = await handle.stop();
    setHandle(null);
    if (!rec) return;
    onRecorded(rec.id);
    if (!activeTranscriber()) toast('اتسجّل ✔ — اربط Gemini أو OpenAI عشان يتحول لكتابة');
    else if (!navigator.onLine) toast('اتسجّل ✔ — هيتحول لكتابة أول ما النت يرجع');
    else {
      toast('اتسجّل ✔ — بيتحول لكتابة…');
      processRecordings();
    }
  };

  return (
    <div className="card gold rec-stage">
      <div className="eyebrow">{handle ? (paused ? 'Paused' : '● Recording') : 'Unlimited recording'}</div>
      <div className="rec-time">{fmtDuration(handle ? handle.elapsed() : 0)}</div>
      <Meter handle={handle} />
      <div className="row" style={{ justifyContent: 'center', gap: 22 }}>
        {handle && (
          <button
            className="btn ghost"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0 }}
            onClick={() => {
              if (paused) handle.resume();
              else handle.pause();
              setPaused(!paused);
            }}
            aria-label={paused ? 'كمّل' : 'إيقاف مؤقت'}
          >
            <Icon name={paused ? 'play' : 'pause'} size={20} />
          </button>
        )}
        <button className={`rec-btn ${handle ? 'live' : ''}`} onClick={toggle} aria-label={handle ? 'إنهاء التسجيل' : 'ابدأ التسجيل'}>
          <span className="core">{handle ? <Icon name="stop" size={18} /> : <Icon name="mic" size={26} />}</span>
        </button>
        {handle && <span style={{ width: 52 }} />}
      </div>
      <div className="muted" style={{ marginTop: 12 }}>
        {handle ? 'اتكلم براحتك — مفيش حد للوقت. الشاشة هتفضل منوّرة لحد ما تخلص.' : 'سجّل ساعة أو أكتر، حتى من غير نت. هيتحول لكتابة لوحده.'}
      </div>
    </div>
  );
}

function StatusBadge({ r }: { r: Recording }) {
  const map: Record<Recording['status'], [string, string]> = {
    recording: ['بيتسجّل', 'busy'],
    pending: [navigator.onLine ? 'مستني التحويل' : 'مستني النت', ''],
    transcribing: ['بيتحول لكتابة…', 'busy'],
    done: ['اتحوّل ✔', 'done'],
    error: ['حصل خطأ', 'err'],
  };
  const [label, cls] = map[r.status];
  return <span className={`rec-status ${cls}`}>{label}</span>;
}

function RecordingItem({ r, onUse }: { r: Recording; onUse: (text: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const listen = async () => {
    const b = await recordingAudio(r.id);
    if (b) setUrl(URL.createObjectURL(b));
  };
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row">
        <div className="grow" onClick={() => setOpen(!open)}>
          <div style={{ fontWeight: 500 }}>
            {new Date(r.createdAt).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
            {new Date(r.createdAt).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <span className="muted" style={{ fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{fmtDuration(r.duration)}</span>
            <StatusBadge r={r} />
          </div>
        </div>
        {r.status === 'done' && r.text && (
          <button className="btn sm primary" onClick={() => onUse(r.text!)}>
            استخدم
          </button>
        )}
      </div>
      {r.text && (
        <div className="muted" style={{ marginTop: 10, whiteSpace: 'pre-wrap', ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }} onClick={() => setOpen(!open)}>
          {r.text}
        </div>
      )}
      {r.error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{r.error}</div>}
      {url && <audio src={url} controls autoPlay />}
      <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
        {!url && (
          <button className="btn sm ghost" onClick={listen}>
            <Icon name="play" size={14} /> اسمع
          </button>
        )}
        {r.text && (
          <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(r.text!).then(() => toast('اتنسخ'))}>
            <Icon name="copy" size={14} /> نسخ
          </button>
        )}
        {(r.status === 'error' || r.status === 'done') && (
          <button className="btn sm ghost" onClick={() => retranscribe(r.id)}>
            ↻ حوّل تاني
          </button>
        )}
        <button
          className="btn sm ghost danger"
          onClick={() => {
            if (confirm('تمسح التسجيل ده؟')) deleteRecording(r.id);
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------------- screen ----------------

export function Voice() {
  const [capture, setCapture] = useState<'long' | 'live'>('long');
  const [lang, setLang] = useState<SpeechLang>('ar-EG');
  const [text, setText] = useState('');
  const base = useRef('');
  const [mode, setMode] = useState<Mode>('post');
  const [platform, setPlatform] = useState<string>('LinkedIn');
  const [outLang, setOutLang] = useState<OutLang>('same');
  const [tone, setTone] = useState(TONES[0]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const { live, start, stop } = useDictation((t) => setText([base.current, t].filter(Boolean).join(' ')));
  const recordings = useLiveQuery(() => db.recordings.orderBy('createdAt').reverse().toArray(), []) ?? [];

  // Drop the transcript of the recording we just made straight into the editor.
  useEffect(() => {
    if (!waitingFor) return;
    const r = recordings.find((x) => x.id === waitingFor);
    if (r?.status === 'done' && r.text) {
      setText((t) => [t, r.text].filter(Boolean).join('\n\n'));
      setWaitingFor(null);
      toast('النص جاهز ✨');
    }
  }, [recordings, waitingFor]);

  const toggleLive = () => {
    if (live) stop();
    else {
      base.current = text;
      start(lang);
    }
  };

  const run = async () => {
    if (!text.trim()) return toast('سجّل أو اكتب الأول');
    if (live) await stop();
    setBusy(true);
    setResult('');
    try {
      if (mode === 'tasks') {
        const list = parseJSON<{ title: string; priority?: number; due?: string | null }[]>(await aiComplete(prompts.tasks().system, text));
        for (const t of list)
          await saveRecord<Task>('tasks', { title: t.title, status: 'todo', priority: ([1, 2, 3].includes(t.priority ?? 2) ? t.priority : 2) as 1, due: t.due || undefined });
        setResult(list.map((t) => `• ${t.title}`).join('\n'));
        toast(`اتضاف ${list.length} مهمة`);
      } else if (mode === 'journal') {
        const j = parseJSON<{ title: string; body: string; mood: string }>(await aiComplete(prompts.journal().system, text));
        await saveRecord<JournalEntry>('journal', { date: today(), title: j.title, body: j.body, mood: j.mood });
        setResult(`${j.mood} ${j.title}\n\n${j.body}`);
        toast('اتحفظت في اليوميات');
      } else {
        const p = mode === 'post' ? prompts.post(platform, outLang, tone) : mode === 'message' ? prompts.message(outLang, tone) : prompts.clean(outLang);
        setResult(await aiComplete(p.system, text));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'حصل خطأ');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      toast('اتنسخ');
    } catch {
      toast('مقدرتش أنسخ');
    }
  };
  const share = async (s: string) => {
    try {
      await Share.share({ text: s });
    } catch {
      copy(s);
    }
  };
  const saveRaw = async (kind: 'idea' | 'task' | 'journal') => {
    const body = (result || text).trim();
    if (!body) return;
    if (kind === 'idea') await saveRecord<Idea>('ideas', { title: body.split(/\s+/).slice(0, 6).join(' '), body, tags: ['صوت'] });
    if (kind === 'task') await saveRecord<Task>('tasks', { title: body.slice(0, 200), status: 'todo', priority: 2, due: today() });
    if (kind === 'journal') await saveRecord<JournalEntry>('journal', { date: today(), title: `يومية ${today()}`, body });
    toast('اتحفظ ✔');
  };
  const saveAsContent = async () => {
    await saveRecord<ContentItem>('content', { title: result.split('\n')[0].slice(0, 80), body: result, platform, status: 'draft' });
    toast('اتحفظ كمسودة في المحتوى');
  };

  const provider = PROVIDER_LABEL[effectiveProvider() ?? getSettingsSync().ai.provider];
  const transcriber = activeTranscriber();

  return (
    <>
      <div className="seg">
        <button className={capture === 'long' ? 'active' : ''} onClick={() => setCapture('long')}>
          <Icon name="infinity" size={18} /> تسجيل مفتوح
        </button>
        <button className={capture === 'live' ? 'active' : ''} onClick={() => setCapture('live')}>
          <Icon name="wave" size={18} /> كتابة مباشرة
        </button>
      </div>
      <LangPicker value={lang} onChange={setLang} />
      <div style={{ height: 12 }} />

      {capture === 'long' ? (
        <>
          <RecorderPanel lang={lang} onRecorded={setWaitingFor} />
          {!transcriber && (
            <div className="card">
              <div className="muted">
                التسجيل شغال من غير أي حاجة. عشان يتحول لكتابة لوحده، حط مفتاح <b>Gemini</b> (فيه استخدام مجاني) أو <b>OpenAI</b> في الإعدادات.
              </div>
              <button className="btn sm teal" style={{ marginTop: 8 }} onClick={() => go('settings')}>
                الإعدادات
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card gold rec-stage">
          <div className="eyebrow">{live ? '● Listening' : 'Live dictation'}</div>
          <div style={{ margin: '16px 0 10px' }}>
            <button className={`rec-btn ${live ? 'live' : ''}`} onClick={toggleLive} aria-label="ابدأ الإملاء">
              <span className="core">{live ? <Icon name="stop" size={18} /> : <Icon name="mic" size={26} />}</span>
            </button>
          </div>
          <div className="muted">الكلام بيتكتب قدامك وانت بتتكلم — بيشتغل أوفلاين لو لغة الموبايل متنزّلة.</div>
        </div>
      )}

      <div className="section-title">
        <span>Text · النص</span>
      </div>
      <textarea
        className={lang === 'en-US' ? 'ltr' : ''}
        style={{ minHeight: 140 }}
        placeholder="النص هيظهر هنا… وتقدر تعدّل عليه"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="section-title">
        <span>Transform · حوّله لـ</span>
      </div>
      <Chips options={MODES} value={mode} onChange={setMode} />
      {(mode === 'post' || mode === 'message' || mode === 'clean') && (
        <div className="stack" style={{ marginTop: 10 }}>
          {mode === 'post' && <Chips options={PLATFORMS.map((p) => ({ id: p, label: p }))} value={platform} onChange={setPlatform} />}
          <Chips options={(Object.keys(OUT_LANG_LABEL) as OutLang[]).map((id) => ({ id, label: OUT_LANG_LABEL[id] }))} value={outLang} onChange={setOutLang} />
          {mode !== 'clean' && <Chips options={TONES.map((t) => ({ id: t, label: t }))} value={tone} onChange={setTone} />}
        </div>
      )}

      {aiReady() ? (
        <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={run}>
          <Icon name="sparkle" size={18} /> {busy ? `${provider} بيكتب…` : `حوّل بـ ${provider}`}
        </button>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="muted">عشان تحوّل الكلام لبوست أو رسالة، اربط Claude أو ChatGPT أو Gemini من الإعدادات.</div>
          <button className="btn sm teal" style={{ marginTop: 8 }} onClick={() => go('settings')}>
            افتح الإعدادات
          </button>
        </div>
      )}

      {result && (
        <>
          <div className="section-title">
            <span>Result · النتيجة</span>
          </div>
          <div className={`output ${outLang === 'english' ? 'ltr' : ''}`}>{result}</div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => copy(result)}>
              <Icon name="copy" size={15} /> نسخ
            </button>
            <button className="btn sm" onClick={() => share(result)}>
              <Icon name="share" size={15} /> مشاركة
            </button>
            {mode === 'post' && (
              <button className="btn sm teal" onClick={saveAsContent}>
                مسودة محتوى
              </button>
            )}
            <button className="btn sm" onClick={() => saveRaw('idea')}>
              فكرة
            </button>
          </div>
        </>
      )}

      {text && !result && (
        <div className="row wrap" style={{ marginTop: 12 }}>
          <span className="muted">احفظ زي ما هو:</span>
          <button className="btn sm" onClick={() => saveRaw('idea')}>
            فكرة
          </button>
          <button className="btn sm" onClick={() => saveRaw('task')}>
            مهمة
          </button>
          <button className="btn sm" onClick={() => saveRaw('journal')}>
            يومية
          </button>
        </div>
      )}

      {recordings.length > 0 && (
        <>
          <div className="section-title">
            <span>Recordings · التسجيلات</span>
            <span className="tag">{recordings.length}</span>
          </div>
          {recordings.map((r) => (
            <RecordingItem
              key={r.id}
              r={r}
              onUse={(t) => {
                setText(t);
                setResult('');
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
            />
          ))}
        </>
      )}
    </>
  );
}
