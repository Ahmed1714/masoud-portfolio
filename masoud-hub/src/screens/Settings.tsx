import { useEffect, useState } from 'react';
import { Share } from '@capacitor/share';
import { db, SYNC_TABLES } from '../db';
import { Chips, toast } from '../components/ui';
import { aiComplete, PROVIDER_LABEL } from '../lib/ai';
import { createDatabase, extractNotionId, SCHEMAS, testConnection } from '../lib/notion';
import { getSettingsSync, saveSettings, type AIProvider, type Settings } from '../lib/settings';
import { subscribeSync, syncNow, type SyncState } from '../lib/sync';

const TABLE_AR = { tasks: 'المهام', journal: 'اليوميات', expenses: 'المصروفات', ideas: 'الأفكار', content: 'المحتوى' } as const;

export function SettingsScreen() {
  const [s, setS] = useState<Settings>(getSettingsSync());
  const [busy, setBusy] = useState('');
  const [sync, setSync] = useState<SyncState | null>(null);
  useEffect(() => {
    const un = subscribeSync(setSync);
    return () => void un();
  }, []);

  const update = (next: Settings) => {
    setS(next);
    saveSettings(next);
  };
  const ai = s.ai;
  const setAI = (patch: Partial<Settings['ai']>) => update({ ...s, ai: { ...ai, ...patch } });
  const setNotion = (patch: Partial<Settings['notion']>) => update({ ...s, notion: { ...s.notion, ...patch } });

  const testAI = async () => {
    setBusy('ai');
    try {
      const r = await aiComplete('Reply with one short friendly sentence in Egyptian Arabic.', 'قول أهلاً');
      toast(`✔ ${r.slice(0, 80)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy('');
    }
  };

  const setupNotion = async () => {
    setBusy('notion');
    try {
      const ws = await testConnection();
      const parent = extractNotionId(s.notion.parentPageId);
      if (!parent) throw new Error('حط لينك الصفحة الأم');
      const dbs = { ...s.notion.dbs };
      for (const t of SYNC_TABLES) if (!dbs[t]) dbs[t] = await createDatabase(t, parent);
      update({ ...s, notion: { ...s.notion, parentPageId: parent, dbs } });
      toast(`✔ اتربط بـ ${ws} واتعملت الجداول`);
      // Mark every existing record dirty so history uploads too.
      for (const t of SYNC_TABLES) await (db[t] as unknown as import('dexie').Table<{ dirty: 0 | 1 }>).toCollection().modify({ dirty: 1 });
      syncNow();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy('');
    }
  };

  const exportData = async () => {
    const dump: Record<string, unknown> = { app: 'masoud-hub', version: 1, exportedAt: new Date().toISOString() };
    for (const t of db.tables) dump[t.name] = t.name === 'kv' ? (await t.toArray()).filter((r) => r.key !== 'settings') : await t.toArray();
    const json = JSON.stringify(dump);
    try {
      await Share.share({ title: 'Masoud Hub backup', text: json });
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `masoud-hub-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };
  const importData = async (file: File) => {
    try {
      const dump = JSON.parse(await file.text());
      if (dump.app !== 'masoud-hub') throw new Error('الملف ده مش نسخة احتياطية من التطبيق');
      await db.transaction('rw', db.tables, async () => {
        for (const t of db.tables) if (Array.isArray(dump[t.name])) await t.bulkPut(dump[t.name]);
      });
      toast('✔ اترجعت البيانات');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ملف غلط');
    }
  };

  const keyField = (label: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <>
      <label>{label}</label>
      <input className="ltr" type="password" autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value.trim())} />
    </>
  );

  return (
    <>
      <div className="card">
        <h3>👤 عام</h3>
        <label>اسمك</label>
        <input value={s.name} onChange={(e) => update({ ...s, name: e.target.value })} />
        <label>العملة الأساسية</label>
        <select value={s.currency} onChange={(e) => update({ ...s, currency: e.target.value })}>
          {['EGP', 'USD', 'EUR', 'SAR', 'AED'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label>تصنيفات المصروفات (افصل بفاصلة)</label>
        <input value={s.expenseCategories.join('، ')} onChange={(e) => update({ ...s, expenseCategories: e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean) })} />
      </div>

      <div className="card">
        <h3>🤖 الذكاء الاصطناعي</h3>
        <div className="muted">اختار المزوّد الأساسي. المفاتيح بتتحفظ على موبايلك بس.</div>
        <div style={{ marginTop: 10 }}>
          <Chips
            options={(Object.keys(PROVIDER_LABEL) as AIProvider[]).map((id) => ({ id, label: PROVIDER_LABEL[id] }))}
            value={ai.provider}
            onChange={(provider) => setAI({ provider })}
          />
        </div>
        {ai.provider === 'claude' && (
          <>
            {keyField('Claude API key', ai.claudeKey, (claudeKey) => setAI({ claudeKey }), 'sk-ant-…')}
            <label>الموديل</label>
            <select className="ltr" value={ai.claudeModel} onChange={(e) => setAI({ claudeModel: e.target.value })}>
              <option value="claude-opus-5-5">Claude Opus 5.5 (الأذكى)</option>
              <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (متوازن)</option>
              <option value="claude-haiku-5-5">Claude Haiku 5.5 (الأسرع والأرخص)</option>
            </select>
            <div className="muted" style={{ marginTop: 6 }}>المفتاح من console.anthropic.com</div>
          </>
        )}
        {ai.provider === 'openai' && (
          <>
            {keyField('OpenAI API key', ai.openaiKey, (openaiKey) => setAI({ openaiKey }), 'sk-…')}
            <label>الموديل</label>
            <input className="ltr" value={ai.openaiModel} onChange={(e) => setAI({ openaiModel: e.target.value.trim() })} />
            <div className="muted" style={{ marginTop: 6 }}>المفتاح من platform.openai.com</div>
          </>
        )}
        {ai.provider === 'gemini' && (
          <>
            {keyField('Gemini API key', ai.geminiKey, (geminiKey) => setAI({ geminiKey }), 'AIza…')}
            <label>الموديل</label>
            <input className="ltr" value={ai.geminiModel} onChange={(e) => setAI({ geminiModel: e.target.value.trim() })} />
            <div className="muted" style={{ marginTop: 6 }}>المفتاح من aistudio.google.com</div>
          </>
        )}
        <button className="btn sm teal" style={{ marginTop: 12 }} disabled={busy === 'ai'} onClick={testAI}>
          {busy === 'ai' ? '…' : 'جرّب الاتصال'}
        </button>
      </div>

      <div className="card">
        <h3>🔗 Notion</h3>
        <ol className="muted" style={{ paddingInlineStart: 18, margin: '0 0 8px' }}>
          <li>اعمل Integration من notion.so/my-integrations وانسخ الـ Secret.</li>
          <li>اعمل صفحة في نوشن (مثلاً "Masoud Hub")، ومن ⋯ ← Connections ضيف الـ Integration.</li>
          <li>حط اللينك هنا ودوس "اربط" — التطبيق هيعمل 5 جداول جوه الصفحة.</li>
        </ol>
        {keyField('Integration secret', s.notion.token, (token) => setNotion({ token }), 'ntn_… / secret_…')}
        <label>لينك الصفحة الأم</label>
        <input className="ltr" placeholder="https://www.notion.so/…" value={s.notion.parentPageId} onChange={(e) => setNotion({ parentPageId: e.target.value })} />
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy === 'notion' || !s.notion.token || !s.notion.parentPageId} onClick={setupNotion}>
          {busy === 'notion' ? 'بيربط…' : 'اربط واعمل الجداول'}
        </button>
        <details style={{ marginTop: 12 }}>
          <summary className="muted">أو استخدم جداول موجودة عندك</summary>
          {SYNC_TABLES.map((t) => (
            <div key={t}>
              <label>
                {TABLE_AR[t]} — لازم يكون فيه أعمدة: {Object.keys(SCHEMAS[t].properties).join(', ')}
              </label>
              <input
                className="ltr"
                placeholder="Database link / ID"
                value={s.notion.dbs[t] ?? ''}
                onChange={(e) => setNotion({ dbs: { ...s.notion.dbs, [t]: e.target.value ? extractNotionId(e.target.value) : undefined } })}
              />
            </div>
          ))}
        </details>
        <label className="row" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={s.notion.autoSync} onChange={(e) => setNotion({ autoSync: e.target.checked })} />
          <span>مزامنة تلقائية أول ما النت يرجع</span>
        </label>
        {sync && (
          <div className="muted" style={{ marginTop: 8 }}>
            {sync.online ? '🟢 أونلاين' : '🔴 أوفلاين'} · {sync.pending} تعديل مستني
            {sync.lastSync ? ` · آخر مزامنة ${new Date(sync.lastSync).toLocaleTimeString('ar-EG')}` : ''}
            {sync.error ? <div style={{ color: 'var(--red)' }}>⚠ {sync.error}</div> : null}
          </div>
        )}
        <button className="btn sm teal" style={{ marginTop: 10 }} onClick={() => syncNow()}>
          ⟳ زامن دلوقتي
        </button>
      </div>

      <div className="card">
        <h3>💾 نسخة احتياطية</h3>
        <div className="muted">كل بياناتك متخزنة على الموبايل. خد نسخة احتياطية كل فترة.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={exportData}>
            ⬇ تصدير
          </button>
          <label className="btn sm" style={{ margin: 0, color: 'inherit', fontSize: 13 }}>
            ⬆ استيراد
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
      </div>
      <div className="muted" style={{ textAlign: 'center', margin: '20px 0' }}>
        <span className="logo" style={{ fontSize: 22 }}>
          M<span>.</span>
        </span>{' '}
        Masoud Hub v1.0
      </div>
    </>
  );
}
