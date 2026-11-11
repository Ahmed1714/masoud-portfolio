import { useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { saveRecord, today, type ContentItem, type Idea, type JournalEntry, type Task } from '../db';
import { Chips, LangPicker, toast, useDictation } from '../components/ui';
import { aiComplete, aiReady, OUT_LANG_LABEL, parseJSON, PLATFORMS, PROVIDER_LABEL, prompts, type OutLang } from '../lib/ai';
import { getSettingsSync } from '../lib/settings';
import type { SpeechLang } from '../lib/speech';
import { go } from '../router';

type Mode = 'post' | 'message' | 'clean' | 'tasks' | 'journal';
const MODES: { id: Mode; label: string }[] = [
  { id: 'post', label: '📣 بوست' },
  { id: 'message', label: '✉️ رسالة' },
  { id: 'clean', label: '🧹 تنقيح' },
  { id: 'tasks', label: '✅ مهام' },
  { id: 'journal', label: '📔 يومية' },
];
const TONES = ['احترافي', 'ودود', 'ملهم', 'خفيف ومرح', 'رسمي', 'تعليمي'];

export function Voice() {
  const [lang, setLang] = useState<SpeechLang>('ar-EG');
  const [text, setText] = useState('');
  const base = useRef('');
  const [mode, setMode] = useState<Mode>('post');
  const [platform, setPlatform] = useState<string>('LinkedIn');
  const [outLang, setOutLang] = useState<OutLang>('same');
  const [tone, setTone] = useState(TONES[0]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const { live, start, stop } = useDictation((t) => setText([base.current, t].filter(Boolean).join(' ')));

  const toggle = () => {
    if (live) stop();
    else {
      base.current = text;
      start(lang);
    }
  };

  const run = async () => {
    if (!text.trim()) return toast('اتكلم أو اكتب الأول');
    if (live) await stop();
    setBusy(true);
    setResult('');
    try {
      if (mode === 'tasks') {
        const list = parseJSON<{ title: string; priority?: number; due?: string | null }[]>(await aiComplete(prompts.tasks().system, text));
        for (const t of list)
          await saveRecord<Task>('tasks', { title: t.title, status: 'todo', priority: ([1, 2, 3].includes(t.priority ?? 2) ? t.priority : 2) as 1, due: t.due || undefined });
        setResult(list.map((t) => `• ${t.title}`).join('\n'));
        toast(`اتضاف ${list.length} مهمة ✅`);
      } else if (mode === 'journal') {
        const j = parseJSON<{ title: string; body: string; mood: string }>(await aiComplete(prompts.journal().system, text));
        await saveRecord<JournalEntry>('journal', { date: today(), title: j.title, body: j.body, mood: j.mood });
        setResult(`${j.mood} ${j.title}\n\n${j.body}`);
        toast('اتحفظت في اليوميات 📔');
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
      toast('اتنسخ 📋');
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

  const provider = PROVIDER_LABEL[getSettingsSync().ai.provider];

  return (
    <>
      <div className="card gold" style={{ textAlign: 'center' }}>
        <LangPicker value={lang} onChange={setLang} />
        <div style={{ margin: '18px 0 10px' }}>
          <button className={`mic-btn ${live ? 'live' : ''}`} onClick={toggle} aria-label="ابدأ التسجيل">
            {live ? '■' : '🎙'}
          </button>
        </div>
        <div className="muted">{live ? 'بسمعك… اتكلم براحتك ودوس تاني لما تخلص' : 'دوس واتكلم بالمصري أو الفصحى أو الإنجليزي'}</div>
      </div>

      <textarea
        className={lang === 'en-US' ? 'ltr' : ''}
        style={{ minHeight: 140 }}
        placeholder="الكلام هيظهر هنا… وتقدر تعدّل عليه"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="section-title">حوّله لـ</div>
      <Chips options={MODES} value={mode} onChange={setMode} />

      {(mode === 'post' || mode === 'message' || mode === 'clean') && (
        <div className="stack" style={{ marginTop: 12 }}>
          {mode === 'post' && <Chips options={PLATFORMS.map((p) => ({ id: p, label: p }))} value={platform} onChange={setPlatform} />}
          <Chips options={(Object.keys(OUT_LANG_LABEL) as OutLang[]).map((id) => ({ id, label: OUT_LANG_LABEL[id] }))} value={outLang} onChange={setOutLang} />
          {mode !== 'clean' && <Chips options={TONES.map((t) => ({ id: t, label: t }))} value={tone} onChange={setTone} />}
        </div>
      )}

      {aiReady() ? (
        <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={run}>
          {busy ? `${provider} بيكتب…` : `✨ حوّل بـ ${provider}`}
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
          <div className="section-title">النتيجة</div>
          <div className={`output ${outLang === 'english' ? 'ltr' : ''}`}>{result}</div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => copy(result)}>📋 نسخ</button>
            <button className="btn sm" onClick={() => share(result)}>↗ مشاركة</button>
            {mode === 'post' && <button className="btn sm teal" onClick={saveAsContent}>🗂 مسودة محتوى</button>}
            <button className="btn sm" onClick={() => saveRaw('idea')}>💡 فكرة</button>
          </div>
        </>
      )}

      {text && !result && (
        <div className="row wrap" style={{ marginTop: 12 }}>
          <span className="muted">احفظ الكلام زي ما هو:</span>
          <button className="btn sm" onClick={() => saveRaw('idea')}>💡 فكرة</button>
          <button className="btn sm" onClick={() => saveRaw('task')}>✅ مهمة</button>
          <button className="btn sm" onClick={() => saveRaw('journal')}>📔 يومية</button>
        </div>
      )}
    </>
  );
}
