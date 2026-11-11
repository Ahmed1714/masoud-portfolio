import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
import { db, onChange, SYNC_TABLES, type SyncMeta } from '../db';
import { archivePage, upsertPage } from './notion';
import { getSettingsSync } from './settings';
import { processRecordings } from './transcribe';

export type SyncState = {
  online: boolean;
  running: boolean;
  pending: number;
  lastSync?: number;
  error?: string;
};

let state: SyncState = { online: navigator.onLine, running: false, pending: 0 };
const subs = new Set<(s: SyncState) => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn(state));
};
export const getSyncState = () => state;
export function subscribeSync(fn: (s: SyncState) => void) {
  subs.add(fn);
  fn(state);
  return () => subs.delete(fn);
}

export function notionConfigured() {
  const { notion } = getSettingsSync();
  return Boolean(notion.token && Object.values(notion.dbs).some(Boolean));
}

async function countPending() {
  let n = 0;
  for (const t of SYNC_TABLES) n += await db[t].where('dirty').equals(1).count();
  set({ pending: n });
  return n;
}

/** Push every locally changed record to Notion. Safe to call any time; no-ops when offline. */
export async function syncNow(): Promise<void> {
  await countPending();
  if (state.running || !state.online || !notionConfigured()) return;
  set({ running: true, error: undefined });
  const { notion } = getSettingsSync();
  try {
    for (const table of SYNC_TABLES) {
      const dbId = notion.dbs[table];
      if (!dbId) continue;
      const tbl = db[table] as unknown as import('dexie').Table<SyncMeta, string>;
      const dirty = await tbl.where('dirty').equals(1).toArray();
      for (const rec of dirty) {
        if (rec.deleted) {
          if (rec.notionId) await archivePage(rec.notionId);
          await tbl.delete(rec.id);
          continue;
        }
        const notionId = await upsertPage(table, dbId, rec as never);
        // Only clear the flag if the record wasn't edited again while we were uploading.
        const latest = await tbl.get(rec.id);
        if (latest) await tbl.put({ ...latest, notionId, dirty: latest.updatedAt === rec.updatedAt ? 0 : 1 });
      }
    }
    set({ lastSync: Date.now() });
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    set({ running: false });
    await countPending();
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(delay = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    processRecordings(); // voice recordings waiting for internet
    if (getSettingsSync().notion.autoSync) syncNow();
    else countPending();
  }, delay);
}

export async function initSync() {
  try {
    const s = await Network.getStatus();
    set({ online: s.connected });
    Network.addListener('networkStatusChange', (st) => {
      set({ online: st.connected });
      if (st.connected) scheduleSync(1000); // back online -> push queued changes
    });
  } catch {
    window.addEventListener('online', () => {
      set({ online: true });
      scheduleSync(1000);
    });
    window.addEventListener('offline', () => set({ online: false }));
  }
  try {
    App.addListener('appStateChange', ({ isActive }) => isActive && scheduleSync(500));
  } catch {
    /* web */
  }
  onChange(() => scheduleSync());
  setInterval(() => scheduleSync(0), 5 * 60 * 1000);
  scheduleSync(1500);
}
