import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Share } from '@capacitor/share';
import { db, deleteRecord, saveRecord, type ContentItem, type ContentStatus } from '../db';
import { Chips, Empty, fmtDate, MicAppend, Sheet, toast } from '../components/ui';
import { aiComplete, aiReady, parseJSON, PLATFORMS, prompts } from '../lib/ai';

const COLS: { id: ContentStatus; label: string; ic: string }[] = [
  { id: 'idea', label: 'أفكار', ic: '💡' },
  { id: 'draft', label: 'مسودات', ic: '✍️' },
  { id: 'scheduled', label: 'متجدول', ic: '📅' },
  { id: 'published', label: 'اتنشر', ic: '🚀' },
];

function Editor({ item, onClose }: { item: Partial<ContentItem>; onClose: () => void }) {
  const [c, setC] = useState<Partial<ContentItem>>({ status: 'idea', platform: 'Instagram', ...item });
  const [busy, setBusy] = useState(false);
  const write = async () => {
    setBusy(true);
    try {
      const p = prompts.post(c.platform ?? 'Instagram', 'same', 'ملهم وتعليمي');
      const body = await aiComplete(p.system, `${c.title}\n${c.body ?? ''}`);
      setC({ ...c, body, status: c.status === 'idea' ? 'draft' : c.status });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!c.title?.trim()) return toast('اكتب عنوان');
    await saveRecord<ContentItem>('content', {
      id: c.id,
      title: c.title.trim(),
      body: c.body ?? '',
      platform: c.platform ?? 'Instagram',
      status: c.status ?? 'idea',
      date: c.date || undefined,
    });
    onClose();
  };
  return (
    <Sheet title={c.id ? 'تعديل المحتوى' : 'محتوى جديد'} onClose={onClose}>
      <input autoFocus placeholder="عنوان / الفكرة" value={c.title ?? ''} onChange={(e) => setC({ ...c, title: e.target.value })} />
      <label>المنصة</label>
      <Chips options={PLATFORMS.map((p) => ({ id: p, label: p }))} value={c.platform ?? 'Instagram'} onChange={(v) => setC({ ...c, platform: v })} />
      <label>الحالة</label>
      <Chips options={COLS.map((x) => ({ id: x.id, label: `${x.ic} ${x.label}` }))} value={c.status ?? 'idea'} onChange={(v) => setC({ ...c, status: v })} />
      <label>ميعاد النشر</label>
      <input type="date" value={c.date ?? ''} onChange={(e) => setC({ ...c, date: e.target.value })} />
      <label>المحتوى / السكريبت</label>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <textarea style={{ minHeight: 180 }} value={c.body ?? ''} onChange={(e) => setC({ ...c, body: e.target.value })} />
        <MicAppend value={c.body ?? ''} onChange={(v) => setC({ ...c, body: v })} />
      </div>
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {aiReady() && (
          <button className="btn teal" disabled={busy} onClick={write}>
            {busy ? '…' : '✨ اكتبه'}
          </button>
        )}
        {c.body && (
          <button className="btn" onClick={() => Share.share({ text: c.body }).catch(() => navigator.clipboard.writeText(c.body ?? ''))}>
            ↗
          </button>
        )}
        {c.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteRecord('content', c.id!);
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

function IdeaGen({ onClose }: { onClose: () => void }) {
  const [niche, setNiche] = useState('موشن جرافيك وأنيميشن وصناعة المحتوى البصري');
  const [platform, setPlatform] = useState('Instagram');
  const [ideas, setIdeas] = useState<{ title: string; body: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const p = prompts.contentIdeas(niche, platform);
      setIdeas(parseJSON(await aiComplete(p.system, niche)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="✨ مولّد أفكار محتوى" onClose={onClose}>
      <label>المجال</label>
      <input value={niche} onChange={(e) => setNiche(e.target.value)} />
      <label>المنصة</label>
      <Chips options={PLATFORMS.map((p) => ({ id: p, label: p }))} value={platform} onChange={setPlatform} />
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy} onClick={run}>
        {busy ? 'بيفكر…' : 'هات أفكار'}
      </button>
      <div style={{ marginTop: 12 }}>
        {ideas.map((x, i) => (
          <div key={i} className="card">
            <h3>{x.title}</h3>
            <div className="muted">{x.body}</div>
            <button
              className="btn sm teal"
              style={{ marginTop: 8 }}
              onClick={async () => {
                await saveRecord<ContentItem>('content', { title: x.title, body: x.body, platform, status: 'idea' });
                toast('اتضافت ✔');
              }}
            >
              + أضف للخطة
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function Content() {
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null);
  const [gen, setGen] = useState(false);
  const items = useLiveQuery(() => db.content.orderBy('updatedAt').reverse().filter((x) => !x.deleted).toArray(), []) ?? [];
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow muted">خطة المحتوى القيّم — من الفكرة للنشر</div>
        {aiReady() && (
          <button className="btn sm teal" onClick={() => setGen(true)}>
            ✨ أفكار
          </button>
        )}
      </div>
      {items.length === 0 && <Empty icon="🎬" text="ابدأ أول فكرة محتوى" />}
      <div className="kanban">
        {COLS.map((col) => {
          const list = items.filter((x) => x.status === col.id);
          return (
            <div key={col.id}>
              <div className="section-title" style={{ marginTop: 0 }}>
                {col.ic} {col.label} <span className="tag">{list.length}</span>
              </div>
              {list.map((x) => (
                <div key={x.id} className="card" onClick={() => setEditing(x)} style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{x.title}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="tag">{x.platform}</span>
                    {x.date && <span className="tag teal">{fmtDate(x.date)}</span>}
                    {x.dirty === 1 && <span className="unsynced" />}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <button className="fab" onClick={() => setEditing({})}>
        +
      </button>
      {editing && <Editor item={editing} onClose={() => setEditing(null)} />}
      {gen && <IdeaGen onClose={() => setGen(false)} />}
    </>
  );
}
