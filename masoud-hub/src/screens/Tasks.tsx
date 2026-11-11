import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteRecord, saveRecord, today, type Task, type TaskStatus } from '../db';
import { Chips, Empty, fmtDate, MicAppend, Sheet, toast } from '../components/ui';

type Filter = 'today' | 'all' | 'doing' | 'done';
const PRI = { 1: 'عالية', 2: 'متوسطة', 3: 'منخفضة' } as const;
const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'done', doing: 'done', done: 'todo' };

export function TaskRow({ t, onOpen }: { t: Task; onOpen: (t: Task) => void }) {
  const overdue = t.due && t.status !== 'done' && t.due < today();
  return (
    <div className={`list-item ${t.status === 'done' ? 'done' : ''}`}>
      <button
        className={`check ${t.status === 'done' ? 'on' : ''}`}
        onClick={() => saveRecord<Task>('tasks', { ...t, status: NEXT[t.status] })}
        aria-label="تم"
      >
        {t.status === 'done' ? '✓' : ''}
      </button>
      <div className="grow" onClick={() => onOpen(t)}>
        <div className="title">{t.title}</div>
        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
          {t.priority === 1 && <span className="tag p1">عالية</span>}
          {t.status === 'doing' && <span className="tag teal">شغال عليها</span>}
          {t.due && <span className={`tag ${overdue ? 'p1' : ''}`}>📅 {fmtDate(t.due)}</span>}
          {t.project && <span className="tag">#{t.project}</span>}
          {t.dirty === 1 && <span className="unsynced" title="لسه متزامنتش مع نوشن" />}
        </div>
      </div>
    </div>
  );
}

export function TaskEditor({ task, onClose }: { task?: Partial<Task>; onClose: () => void }) {
  const [t, setT] = useState<Partial<Task>>(task ?? { status: 'todo', priority: 2, due: today() });
  const save = async () => {
    if (!t.title?.trim()) return toast('اكتب عنوان المهمة');
    await saveRecord<Task>('tasks', {
      id: t.id,
      title: t.title.trim(),
      notes: t.notes,
      status: t.status ?? 'todo',
      priority: t.priority ?? 2,
      due: t.due || undefined,
      project: t.project?.trim() || undefined,
    });
    onClose();
  };
  return (
    <Sheet title={t.id ? 'تعديل المهمة' : 'مهمة جديدة'} onClose={onClose}>
      <div className="row">
        <input autoFocus placeholder="عايز تعمل إيه؟" value={t.title ?? ''} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <MicAppend value={t.title ?? ''} onChange={(v) => setT({ ...t, title: v })} />
      </div>
      <label>الأولوية</label>
      <Chips
        options={[1, 2, 3].map((p) => ({ id: String(p), label: PRI[p as 1] }))}
        value={String(t.priority ?? 2)}
        onChange={(v) => setT({ ...t, priority: Number(v) as 1 })}
      />
      <label>الحالة</label>
      <Chips
        options={[
          { id: 'todo', label: 'لسه' },
          { id: 'doing', label: 'شغال' },
          { id: 'done', label: 'خلصت' },
        ]}
        value={t.status ?? 'todo'}
        onChange={(v) => setT({ ...t, status: v as TaskStatus })}
      />
      <div className="grid2">
        <div>
          <label>الميعاد</label>
          <input type="date" value={t.due ?? ''} onChange={(e) => setT({ ...t, due: e.target.value })} />
        </div>
        <div>
          <label>المشروع</label>
          <input placeholder="مثلاً: عميل X" value={t.project ?? ''} onChange={(e) => setT({ ...t, project: e.target.value })} />
        </div>
      </div>
      <label>ملاحظات</label>
      <textarea value={t.notes ?? ''} onChange={(e) => setT({ ...t, notes: e.target.value })} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {t.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteRecord('tasks', t.id!);
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

export function Tasks() {
  const [filter, setFilter] = useState<Filter>('today');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), []) ?? [];
  const d = today();
  const shown = tasks
    .filter((t) =>
      filter === 'today'
        ? t.status !== 'done' && (!t.due || t.due <= d)
        : filter === 'doing'
          ? t.status === 'doing'
          : filter === 'done'
            ? t.status === 'done'
            : t.status !== 'done',
    )
    .sort((a, b) => a.priority - b.priority || (a.due ?? '9').localeCompare(b.due ?? '9'));
  const doneToday = tasks.filter((t) => t.status === 'done' && new Date(t.updatedAt).toDateString() === new Date().toDateString()).length;

  return (
    <>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="v">{tasks.filter((t) => t.status !== 'done').length}</div>
          <div className="l">مفتوحة</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--teal)' }}>{doneToday}</div>
          <div className="l">خلصت النهارده</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--red)' }}>{tasks.filter((t) => t.status !== 'done' && t.due && t.due < d).length}</div>
          <div className="l">متأخرة</div>
        </div>
      </div>
      <Chips
        options={[
          { id: 'today', label: 'النهارده' },
          { id: 'all', label: 'كل المفتوح' },
          { id: 'doing', label: 'شغال عليها' },
          { id: 'done', label: 'خلصت' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div style={{ marginTop: 12 }}>
        {shown.length ? shown.map((t) => <TaskRow key={t.id} t={t} onOpen={setEditing} />) : <Empty icon="🌿" text="مفيش مهام هنا" />}
      </div>
      <button className="fab" onClick={() => setEditing({})} aria-label="مهمة جديدة">
        +
      </button>
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
