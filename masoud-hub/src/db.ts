import Dexie, { type Table } from 'dexie';

/** Fields every synced record carries. */
export interface SyncMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted?: 0 | 1;
  /** 1 = has local changes not yet pushed to Notion */
  dirty: 0 | 1;
  notionId?: string;
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export interface Task extends SyncMeta {
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: 1 | 2 | 3;
  due?: string; // yyyy-mm-dd
  project?: string;
}

export interface JournalEntry extends SyncMeta {
  date: string;
  title: string;
  body: string;
  mood?: string;
}

export interface Expense extends SyncMeta {
  date: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note?: string;
  currency: string;
}

export interface Idea extends SyncMeta {
  title: string;
  body: string;
  tags: string[];
}

export type ContentStatus = 'idea' | 'draft' | 'scheduled' | 'published';
export interface ContentItem extends SyncMeta {
  title: string;
  body: string;
  platform: string;
  status: ContentStatus;
  date?: string;
}

export interface Word {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  box: number; // Leitner box 1..5
  nextReview: number; // timestamp
  createdAt: number;
}

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  url: string;
  followers?: number;
  lastUpdated?: number;
}

export interface SocialStat {
  id: string;
  accountId: string;
  date: string;
  followers: number;
}

export interface QuranLog {
  id: string;
  date: string;
  ayahs: number;
  from: string; // "s:a"
  to: string;
}

export type RecStatus = 'recording' | 'pending' | 'transcribing' | 'done' | 'error';
export interface Recording {
  id: string;
  createdAt: number;
  duration: number; // seconds
  status: RecStatus;
  chunks: number;
  text?: string;
  error?: string;
  lang: string;
}
export interface AudioChunk {
  id: string;
  recId: string;
  idx: number;
  blob: Blob;
  mime: string;
  text?: string;
}

export interface KV {
  key: string;
  value: unknown;
}

class HubDB extends Dexie {
  tasks!: Table<Task, string>;
  journal!: Table<JournalEntry, string>;
  expenses!: Table<Expense, string>;
  ideas!: Table<Idea, string>;
  content!: Table<ContentItem, string>;
  words!: Table<Word, string>;
  social!: Table<SocialAccount, string>;
  socialStats!: Table<SocialStat, string>;
  quranLog!: Table<QuranLog, string>;
  kv!: Table<KV, string>;
  recordings!: Table<Recording, string>;
  audioChunks!: Table<AudioChunk, string>;

  constructor() {
    super('masoud-hub');
    this.version(1).stores({
      tasks: 'id, status, due, updatedAt, dirty, deleted',
      journal: 'id, date, updatedAt, dirty, deleted',
      expenses: 'id, date, category, updatedAt, dirty, deleted',
      ideas: 'id, updatedAt, dirty, deleted',
      content: 'id, status, date, updatedAt, dirty, deleted',
      words: 'id, nextReview, box',
      social: 'id, platform',
      socialStats: 'id, accountId, date',
      quranLog: 'id, date',
      kv: 'key',
    });
    this.version(2).stores({
      recordings: 'id, createdAt, status',
      audioChunks: 'id, recId, [recId+idx]',
    });
  }
}

export const db = new HubDB();

export type SyncTableName = 'tasks' | 'journal' | 'expenses' | 'ideas' | 'content';
export const SYNC_TABLES: SyncTableName[] = ['tasks', 'journal', 'expenses', 'ideas', 'content'];

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Payload<T> = Omit<T, keyof SyncMeta> & Partial<Pick<SyncMeta, 'id'>>;

/** Insert or update a synced record, marking it dirty so the sync engine pushes it. */
export async function saveRecord<T extends SyncMeta>(table: SyncTableName, data: Payload<T>): Promise<string> {
  const t = db[table] as unknown as Table<T, string>;
  const now = Date.now();
  if (data.id) {
    const existing = await t.get(data.id);
    if (existing) {
      await t.put({ ...existing, ...data, updatedAt: now, dirty: 1 } as T);
      notifyChange();
      return data.id;
    }
  }
  const id = data.id ?? uid();
  await t.put({ ...data, id, createdAt: now, updatedAt: now, dirty: 1, deleted: 0 } as unknown as T);
  notifyChange();
  return id;
}

/** Soft delete: kept locally until the deletion reaches Notion (or immediately removed if never synced). */
export async function deleteRecord(table: SyncTableName, id: string) {
  const t = db[table] as unknown as Table<SyncMeta, string>;
  const rec = await t.get(id);
  if (!rec) return;
  if (!rec.notionId) await t.delete(id);
  else await t.put({ ...rec, deleted: 1, dirty: 1, updatedAt: Date.now() });
  notifyChange();
}

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

// Lightweight change bus used to trigger a debounced background sync.
const listeners = new Set<() => void>();
export const onChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function notifyChange() {
  listeners.forEach((fn) => fn());
}
