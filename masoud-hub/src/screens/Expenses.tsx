import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteRecord, saveRecord, today, type Expense } from '../db';
import { Chips, Empty, fmtDate, fmtMoney, MicAppend, Sheet, toast } from '../components/ui';
import { getSettingsSync } from '../lib/settings';

const monthKey = (d: string) => d.slice(0, 7);

function Editor({ exp, onClose }: { exp: Partial<Expense>; onClose: () => void }) {
  const s = getSettingsSync();
  const [e, setE] = useState<Partial<Expense>>({ type: 'expense', date: today(), currency: s.currency, category: s.expenseCategories[0], ...exp });
  const [amount, setAmount] = useState(exp.amount ? String(exp.amount) : '');
  const save = async () => {
    const n = Number(amount.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
    if (!n || n <= 0) return toast('اكتب المبلغ صح');
    await saveRecord<Expense>('expenses', {
      id: e.id,
      amount: n,
      type: e.type ?? 'expense',
      date: e.date ?? today(),
      category: e.category ?? 'أخرى',
      currency: e.currency ?? s.currency,
      note: e.note?.trim(),
    });
    onClose();
  };
  return (
    <Sheet title={e.id ? 'تعديل' : 'عملية جديدة'} onClose={onClose}>
      <Chips
        options={[
          { id: 'expense', label: '➖ مصروف' },
          { id: 'income', label: '➕ دخل' },
        ]}
        value={e.type ?? 'expense'}
        onChange={(v) => setE({ ...e, type: v })}
      />
      <label>المبلغ</label>
      <input autoFocus inputMode="decimal" placeholder="0" value={amount} onChange={(x) => setAmount(x.target.value)} style={{ fontSize: 26, fontWeight: 800 }} />
      <label>التصنيف</label>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {(e.type === 'income' ? ['شغل فري لانس', 'مرتب', 'كورسات', 'أخرى'] : s.expenseCategories).map((c) => (
          <button key={c} className={`chip ${e.category === c ? 'active' : ''}`} onClick={() => setE({ ...e, category: c })}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid2">
        <div>
          <label>التاريخ</label>
          <input type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
        </div>
        <div>
          <label>العملة</label>
          <select value={e.currency} onChange={(x) => setE({ ...e, currency: x.target.value })}>
            {['EGP', 'USD', 'EUR', 'SAR', 'AED'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <label>ملاحظة</label>
      <div className="row">
        <input value={e.note ?? ''} onChange={(x) => setE({ ...e, note: x.target.value })} placeholder="اتصرفت على إيه؟" />
        <MicAppend value={e.note ?? ''} onChange={(v) => setE({ ...e, note: v })} />
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {e.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteRecord('expenses', e.id!);
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

export function Expenses() {
  const s = getSettingsSync();
  const [month, setMonth] = useState(monthKey(today()));
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const all = useLiveQuery(() => db.expenses.orderBy('date').reverse().filter((x) => !x.deleted).toArray(), []) ?? [];
  const items = all.filter((x) => monthKey(x.date) === month && x.currency === s.currency);
  const other = all.filter((x) => monthKey(x.date) === month && x.currency !== s.currency);
  const spent = items.filter((x) => x.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const income = items.filter((x) => x.type === 'income').reduce((a, b) => a + b.amount, 0);
  const byCat = Object.entries(
    items.filter((x) => x.type === 'expense').reduce<Record<string, number>>((m, x) => ((m[x.category] = (m[x.category] ?? 0) + x.amount), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  const months = [...new Set([monthKey(today()), ...all.map((x) => monthKey(x.date))])].sort().reverse().slice(0, 12);

  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {months.map((m) => (
          <button key={m} className={`chip ${m === month ? 'active' : ''}`} onClick={() => setMonth(m)}>
            {new Date(m + '-01').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
          </button>
        ))}
      </div>
      <div className="grid3">
        <div className="stat">
          <div className="v" style={{ color: 'var(--red)', fontSize: 17 }}>{fmtMoney(spent, s.currency)}</div>
          <div className="l">مصروف</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--green)', fontSize: 17 }}>{fmtMoney(income, s.currency)}</div>
          <div className="l">دخل</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: income - spent >= 0 ? 'var(--teal)' : 'var(--red)', fontSize: 17 }}>{fmtMoney(income - spent, s.currency)}</div>
          <div className="l">الصافي</div>
        </div>
      </div>
      {byCat.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>الصرف على إيه؟</h3>
          {byCat.map(([c, v]) => (
            <div key={c} className="bar-row">
              <span style={{ width: 90 }}>{c}</span>
              <div className="bar">
                <i style={{ width: `${(v / byCat[0][1]) * 100}%` }} />
              </div>
              <span className="muted" style={{ minWidth: 80, textAlign: 'left' }}>{fmtMoney(v, s.currency)}</span>
            </div>
          ))}
        </div>
      )}
      {other.length > 0 && <div className="muted">+ {other.length} عملية بعملات تانية (ظاهرة في القايمة)</div>}
      <div className="section-title"><span>Transactions · العمليات</span></div>
      {[...items, ...other].length ? (
        [...items, ...other].map((x) => (
          <div key={x.id} className="list-item" onClick={() => setEditing(x)}>
            <div style={{ fontSize: 20 }}>{x.type === 'income' ? '🟢' : '🔴'}</div>
            <div className="grow">
              <div className="title">{x.note || x.category}</div>
              <div className="muted">
                {x.category} · {fmtDate(x.date)}
              </div>
            </div>
            <div style={{ fontWeight: 800, color: x.type === 'income' ? 'var(--green)' : 'var(--white)' }}>
              {x.type === 'income' ? '+' : '-'}
              {fmtMoney(x.amount, x.currency)}
            </div>
            {x.dirty === 1 && <span className="unsynced" />}
          </div>
        ))
      ) : (
        <Empty icon="💸" text="مفيش عمليات في الشهر ده" />
      )}
      <button className="fab" onClick={() => setEditing({})}>
        +
      </button>
      {editing && <Editor exp={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
