import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteRecord, saveRecord, type Idea } from '../db';
import { Empty, LangPicker, MicAppend, Sheet, toast } from '../components/ui';
import type { SpeechLang } from '../lib/speech';

function Editor({ idea, onClose }: { idea: Partial<Idea>; onClose: () => void }) {
  const [i, setI] = useState<Partial<Idea>>(idea);
  const [tags, setTags] = useState((idea.tags ?? []).join('، '));
  const [lang, setLang] = useState<SpeechLang>('ar-EG');
  const save = async () => {
    if (!i.body?.trim() && !i.title?.trim()) return toast('اكتب الفكرة');
    await saveRecord<Idea>('ideas', {
      id: i.id,
      title: i.title?.trim() || (i.body ?? '').trim().split(/\s+/).slice(0, 6).join(' '),
      body: (i.body ?? '').trim(),
      tags: tags.split(/[،,]/).map((x) => x.trim()).filter(Boolean),
    });
    onClose();
  };
  return (
    <Sheet title={i.id ? 'تعديل الفكرة' : 'فكرة جديدة 💡'} onClose={onClose}>
      <input placeholder="عنوان الفكرة" value={i.title ?? ''} onChange={(e) => setI({ ...i, title: e.target.value })} />
      <label>التفاصيل (اكتب أو اتكلم)</label>
      <LangPicker value={lang} onChange={setLang} />
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
        <textarea autoFocus style={{ minHeight: 170 }} value={i.body ?? ''} onChange={(e) => setI({ ...i, body: e.target.value })} />
        <MicAppend lang={lang} value={i.body ?? ''} onChange={(v) => setI({ ...i, body: v })} />
      </div>
      <label>تاجات (افصل بفاصلة)</label>
      <input placeholder="موشن، بيزنس، محتوى" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {i.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteRecord('ideas', i.id!);
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

export function Ideas() {
  const [editing, setEditing] = useState<Partial<Idea> | null>(null);
  const [tag, setTag] = useState('');
  const ideas = useLiveQuery(() => db.ideas.orderBy('updatedAt').reverse().filter((x) => !x.deleted).toArray(), []) ?? [];
  const allTags = [...new Set(ideas.flatMap((x) => x.tags))];
  const shown = tag ? ideas.filter((x) => x.tags.includes(tag)) : ideas;
  return (
    <>
      {allTags.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${!tag ? 'active' : ''}`} onClick={() => setTag('')}>
            الكل
          </button>
          {allTags.map((t) => (
            <button key={t} className={`chip ${tag === t ? 'active' : ''}`} onClick={() => setTag(t)}>
              #{t}
            </button>
          ))}
        </div>
      )}
      {shown.length ? (
        shown.map((x) => (
          <div key={x.id} className="card" onClick={() => setEditing(x)}>
            <div className="row">
              <h3 className="grow" style={{ margin: 0 }}>💡 {x.title}</h3>
              {x.dirty === 1 && <span className="unsynced" />}
            </div>
            {x.body && <div className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{x.body.slice(0, 220)}</div>}
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {x.tags.map((t) => (
                <span key={t} className="tag">#{t}</span>
              ))}
            </div>
          </div>
        ))
      ) : (
        <Empty icon="💡" text="سجّل أول فكرة قبل ما تطير" />
      )}
      <button className="fab" onClick={() => setEditing({})}>
        +
      </button>
      {editing && <Editor idea={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
