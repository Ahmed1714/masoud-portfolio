import type { ContentItem, Expense, Idea, JournalEntry, SyncTableName, Task } from '../db';
import { getSettingsSync } from './settings';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

export class NotionError extends Error {
  constructor(
    msg: string,
    public status = 0,
  ) {
    super(msg);
  }
}

async function call<T = Record<string, unknown>>(path: string, method: string, body?: unknown): Promise<T> {
  const { notion } = getSettingsSync();
  if (!notion.token) throw new NotionError('مفيش Notion token');
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${notion.token}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new NotionError(j?.message ?? `Notion ${r.status}`, r.status);
  return j as T;
}

/** Accepts a raw id or any notion.so URL and returns the 32-char id. */
export function extractNotionId(input: string): string {
  const clean = input.trim().split('?')[0];
  const m = clean.replace(/-/g, '').match(/[0-9a-f]{32}(?!.*[0-9a-f]{32})/i);
  return m ? m[0] : clean;
}

// ---------- property helpers ----------
const text = (s: string) => {
  // Notion limits each rich_text item to 2000 chars and 100 items.
  const chunks: { type: 'text'; text: { content: string } }[] = [];
  for (let i = 0; i < s.length && chunks.length < 100; i += 1900) chunks.push({ type: 'text', text: { content: s.slice(i, i + 1900) } });
  return chunks;
};
const title = (s: string) => ({ title: text(s || 'بدون عنوان').slice(0, 1) });
const rich = (s?: string) => ({ rich_text: text(s ?? '') });
const select = (s?: string) => ({ select: s ? { name: s.replace(/,/g, ' ').slice(0, 100) } : null });
const date = (s?: string) => ({ date: s ? { start: s } : null });
const paragraphs = (s: string) =>
  s
    .split(/\n+/)
    .filter(Boolean)
    .slice(0, 90)
    .map((p) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: text(p) } }));

const STATUS_AR: Record<string, string> = { todo: 'لسه', doing: 'شغال', done: 'خلص' };
const PRIORITY_AR: Record<number, string> = { 1: 'عالية', 2: 'متوسطة', 3: 'منخفضة' };
const CONTENT_AR: Record<string, string> = { idea: 'فكرة', draft: 'مسودة', scheduled: 'متجدول', published: 'اتنشر' };

// ---------- schemas (used when auto-creating the databases) ----------
export const SCHEMAS: Record<SyncTableName, { title: string; properties: Record<string, unknown> }> = {
  tasks: {
    title: 'المهام — Masoud Hub',
    properties: {
      Name: { title: {} },
      Status: { select: { options: Object.values(STATUS_AR).map((name) => ({ name })) } },
      Priority: { select: { options: Object.values(PRIORITY_AR).map((name) => ({ name })) } },
      Due: { date: {} },
      Project: { select: {} },
      Notes: { rich_text: {} },
    },
  },
  journal: {
    title: 'اليوميات — Masoud Hub',
    properties: { Name: { title: {} }, Date: { date: {} }, Mood: { select: {} }, Content: { rich_text: {} } },
  },
  expenses: {
    title: 'المصروفات — Masoud Hub',
    properties: {
      Name: { title: {} },
      Amount: { number: { format: 'number' } },
      Type: { select: { options: [{ name: 'مصروف' }, { name: 'دخل' }] } },
      Category: { select: {} },
      Currency: { select: {} },
      Date: { date: {} },
    },
  },
  ideas: {
    title: 'الأفكار — Masoud Hub',
    properties: { Name: { title: {} }, Content: { rich_text: {} }, Tags: { multi_select: {} } },
  },
  content: {
    title: 'المحتوى — Masoud Hub',
    properties: {
      Name: { title: {} },
      Platform: { select: {} },
      Status: { select: { options: Object.values(CONTENT_AR).map((name) => ({ name })) } },
      Date: { date: {} },
      Content: { rich_text: {} },
    },
  },
};

type AnyRec = Task | JournalEntry | Expense | Idea | ContentItem;

function toProps(table: SyncTableName, r: AnyRec): { props: Record<string, unknown>; body?: string } {
  switch (table) {
    case 'tasks': {
      const t = r as Task;
      return {
        props: {
          Name: title(t.title),
          Status: select(STATUS_AR[t.status]),
          Priority: select(PRIORITY_AR[t.priority]),
          Due: date(t.due),
          Project: select(t.project),
          Notes: rich(t.notes),
        },
      };
    }
    case 'journal': {
      const j = r as JournalEntry;
      return {
        props: { Name: title(j.title), Date: date(j.date), Mood: select(j.mood), Content: rich(j.body) },
        body: j.body,
      };
    }
    case 'expenses': {
      const e = r as Expense;
      return {
        props: {
          Name: title(e.note || e.category),
          Amount: { number: e.amount },
          Type: select(e.type === 'income' ? 'دخل' : 'مصروف'),
          Category: select(e.category),
          Currency: select(e.currency),
          Date: date(e.date),
        },
      };
    }
    case 'ideas': {
      const i = r as Idea;
      return {
        props: {
          Name: title(i.title),
          Content: rich(i.body),
          Tags: { multi_select: i.tags.slice(0, 10).map((name) => ({ name: name.replace(/,/g, ' ') })) },
        },
        body: i.body,
      };
    }
    case 'content': {
      const c = r as ContentItem;
      return {
        props: {
          Name: title(c.title),
          Platform: select(c.platform),
          Status: select(CONTENT_AR[c.status]),
          Date: date(c.date),
          Content: rich(c.body),
        },
        body: c.body,
      };
    }
  }
}

export async function createDatabase(table: SyncTableName, parentPageId: string): Promise<string> {
  const s = SCHEMAS[table];
  const res = await call<{ id: string }>('/databases', 'POST', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: s.title } }],
    properties: s.properties,
  });
  return res.id;
}

/** Creates or updates the Notion page for one record. Returns the page id. */
export async function upsertPage(table: SyncTableName, dbId: string, rec: AnyRec): Promise<string> {
  const { props, body } = toProps(table, rec);
  if (rec.notionId) {
    try {
      await call(`/pages/${rec.notionId}`, 'PATCH', { properties: props, archived: false });
      return rec.notionId;
    } catch (e) {
      // Page was deleted in Notion -> recreate it.
      if (!(e instanceof NotionError && (e.status === 404 || e.status === 400))) throw e;
    }
  }
  const res = await call<{ id: string }>('/pages', 'POST', {
    parent: { database_id: dbId },
    properties: props,
    ...(body ? { children: paragraphs(body) } : {}),
  });
  return res.id;
}

export async function archivePage(pageId: string) {
  try {
    await call(`/pages/${pageId}`, 'PATCH', { archived: true });
  } catch (e) {
    if (!(e instanceof NotionError && e.status === 404)) throw e;
  }
}

export async function testConnection(): Promise<string> {
  const me = await call<{ name?: string; bot?: { workspace_name?: string } }>('/users/me', 'GET');
  return me.bot?.workspace_name ?? me.name ?? 'Notion';
}
