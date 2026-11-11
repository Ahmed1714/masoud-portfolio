import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Share } from '@capacitor/share';
import { db, today, uid, type SocialAccount } from '../db';
import { Empty, fmtDate, Sheet, toast } from '../components/ui';
import { go } from '../router';

const PLATFORMS: Record<string, { ic: string; url: (h: string) => string }> = {
  Instagram: { ic: '📸', url: (h) => `https://instagram.com/${h}` },
  Facebook: { ic: '📘', url: (h) => `https://facebook.com/${h}` },
  LinkedIn: { ic: '💼', url: (h) => `https://linkedin.com/in/${h}` },
  X: { ic: '✖️', url: (h) => `https://x.com/${h}` },
  TikTok: { ic: '🎵', url: (h) => `https://tiktok.com/@${h}` },
  YouTube: { ic: '▶️', url: (h) => `https://youtube.com/@${h}` },
  Behance: { ic: '🅱️', url: (h) => `https://behance.net/${h}` },
  Dribbble: { ic: '🏀', url: (h) => `https://dribbble.com/${h}` },
  Threads: { ic: '🧵', url: (h) => `https://threads.net/@${h}` },
};

function AccountEditor({ acc, onClose }: { acc: Partial<SocialAccount>; onClose: () => void }) {
  const [a, setA] = useState<Partial<SocialAccount>>({ platform: 'Instagram', ...acc });
  const save = async () => {
    const handle = (a.handle ?? '').replace(/^@/, '').trim();
    if (!handle) return toast('اكتب اليوزر');
    await db.social.put({
      id: a.id ?? uid(),
      platform: a.platform ?? 'Instagram',
      handle,
      url: a.url?.trim() || PLATFORMS[a.platform ?? 'Instagram']?.url(handle) || '',
      followers: a.followers,
      lastUpdated: a.lastUpdated,
    });
    onClose();
  };
  return (
    <Sheet title={a.id ? 'تعديل الحساب' : 'إضافة حساب'} onClose={onClose}>
      <label>المنصة</label>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {Object.entries(PLATFORMS).map(([p, v]) => (
          <button key={p} className={`chip ${a.platform === p ? 'active' : ''}`} onClick={() => setA({ ...a, platform: p, url: '' })}>
            {v.ic} {p}
          </button>
        ))}
      </div>
      <label>اليوزر</label>
      <input className="ltr" placeholder="@username" value={a.handle ?? ''} onChange={(e) => setA({ ...a, handle: e.target.value })} />
      <label>لينك مخصص (اختياري)</label>
      <input className="ltr" placeholder="https://" value={a.url ?? ''} onChange={(e) => setA({ ...a, url: e.target.value })} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary grow" onClick={save}>
          حفظ
        </button>
        {a.id && (
          <button
            className="btn danger"
            onClick={async () => {
              await db.social.delete(a.id!);
              await db.socialStats.where('accountId').equals(a.id!).delete();
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

function StatsEditor({ acc, onClose }: { acc: SocialAccount; onClose: () => void }) {
  const [n, setN] = useState(acc.followers ? String(acc.followers) : '');
  const history = useLiveQuery(() => db.socialStats.where('accountId').equals(acc.id).sortBy('date'), [acc.id]) ?? [];
  const save = async () => {
    const v = Number(n);
    if (!(v >= 0)) return toast('رقم غلط');
    const existing = history.find((h) => h.date === today());
    await db.socialStats.put({ id: existing?.id ?? uid(), accountId: acc.id, date: today(), followers: v });
    await db.social.update(acc.id, { followers: v, lastUpdated: Date.now() });
    onClose();
  };
  const max = Math.max(1, ...history.map((h) => h.followers));
  return (
    <Sheet title={`${PLATFORMS[acc.platform]?.ic ?? ''} @${acc.handle}`} onClose={onClose}>
      <label>عدد المتابعين النهارده</label>
      <input autoFocus inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} style={{ fontSize: 22, fontWeight: 800 }} />
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={save}>
        سجّل
      </button>
      {history.length > 1 && (
        <>
          <div className="section-title">النمو</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
            {history.slice(-20).map((h) => (
              <div key={h.id} title={`${h.date}: ${h.followers}`} style={{ flex: 1, height: `${(h.followers / max) * 100}%`, background: 'var(--gold)', borderRadius: 4, minHeight: 4 }} />
            ))}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            من {history[0].followers.toLocaleString()} لـ {history[history.length - 1].followers.toLocaleString()} (
            {history[history.length - 1].followers - history[0].followers >= 0 ? '+' : ''}
            {(history[history.length - 1].followers - history[0].followers).toLocaleString()})
          </div>
        </>
      )}
    </Sheet>
  );
}

export function Social() {
  const accounts = useLiveQuery(() => db.social.toArray(), []) ?? [];
  const upcoming =
    useLiveQuery(
      () =>
        db.content
          .filter((c) => !c.deleted && c.status === 'scheduled')
          .toArray()
          .then((l) => l.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))),
      [],
    ) ?? [];
  const [editing, setEditing] = useState<Partial<SocialAccount> | null>(null);
  const [stats, setStats] = useState<SocialAccount | null>(null);
  const total = accounts.reduce((a, b) => a + (b.followers ?? 0), 0);

  return (
    <>
      <div className="card gold row">
        <div className="grow">
          <div className="muted">إجمالي المتابعين</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{total.toLocaleString('ar-EG')}</div>
        </div>
        <button className="btn sm" onClick={() => setEditing({})}>
          + حساب
        </button>
      </div>

      {accounts.length === 0 ? (
        <Empty icon="🌐" text="ضيف حساباتك عشان تفتحها وتتابع نموها من مكان واحد" />
      ) : (
        accounts.map((a) => (
          <div key={a.id} className="list-item">
            <div style={{ fontSize: 26 }}>{PLATFORMS[a.platform]?.ic ?? '🌐'}</div>
            <div className="grow" onClick={() => setStats(a)}>
              <div className="title">{a.platform}</div>
              <div className="muted ltr" style={{ textAlign: 'right' }}>@{a.handle}</div>
              {a.followers !== undefined && (
                <div className="muted">
                  {a.followers.toLocaleString('ar-EG')} متابع · اتحدث {a.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString('ar-EG') : ''}
                </div>
              )}
            </div>
            <button className="btn sm teal" onClick={() => window.open(a.url, '_blank')}>
              افتح
            </button>
            <button className="btn sm ghost" onClick={() => setEditing(a)}>
              ⋯
            </button>
          </div>
        ))
      )}

      <div className="section-title">
        <span>📅 بوستات متجدولة</span>
        <button className="btn sm ghost" onClick={() => go('content')}>
          خطة المحتوى ←
        </button>
      </div>
      {upcoming.length ? (
        upcoming.map((c) => (
          <div key={c.id} className="list-item">
            <div className="grow">
              <div className="title">{c.title}</div>
              <div className="muted">
                {c.platform} · {fmtDate(c.date)}
              </div>
            </div>
            <button className="btn sm" onClick={() => Share.share({ text: c.body }).catch(() => toast('مقدرتش أفتح المشاركة'))}>
              انشر ↗
            </button>
          </div>
        ))
      ) : (
        <div className="muted">مفيش بوستات متجدولة.</div>
      )}

      {editing && <AccountEditor acc={editing} onClose={() => setEditing(null)} />}
      {stats && <StatsEditor acc={stats} onClose={() => setStats(null)} />}
    </>
  );
}
