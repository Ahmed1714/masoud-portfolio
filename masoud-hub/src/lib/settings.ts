import { getKV, setKV } from '../db';

export type AIProvider = 'claude' | 'openai' | 'gemini';

export interface Settings {
  name: string;
  currency: string;
  ai: {
    provider: AIProvider;
    claudeKey: string;
    claudeModel: string;
    openaiKey: string;
    openaiModel: string;
    geminiKey: string;
    geminiModel: string;
  };
  notion: {
    token: string;
    parentPageId: string;
    autoSync: boolean;
    dbs: Partial<Record<'tasks' | 'journal' | 'expenses' | 'ideas' | 'content', string>>;
  };
  quran: {
    khatmaDays: number;
    fontSize: number;
  };
  expenseCategories: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  name: 'مسعود',
  currency: 'EGP',
  ai: {
    provider: 'claude',
    claudeKey: '',
    claudeModel: 'claude-opus-5-5',
    openaiKey: '',
    openaiModel: 'gpt-5-mini',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash',
  },
  notion: { token: '', parentPageId: '', autoSync: true, dbs: {} },
  quran: { khatmaDays: 30, fontSize: 26 },
  expenseCategories: ['أكل', 'مواصلات', 'فواتير', 'شغل/أدوات', 'اشتراكات', 'بيت', 'صحة', 'صدقة', 'ترفيه', 'أخرى'],
};

let cache: Settings | null = null;
const subs = new Set<(s: Settings) => void>();

function merge(s: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    ai: { ...DEFAULT_SETTINGS.ai, ...(s.ai ?? {}) },
    notion: { ...DEFAULT_SETTINGS.notion, ...(s.notion ?? {}), dbs: { ...(s.notion?.dbs ?? {}) } },
    quran: { ...DEFAULT_SETTINGS.quran, ...(s.quran ?? {}) },
  };
}

export async function loadSettings(): Promise<Settings> {
  if (cache) return cache;
  cache = merge(await getKV<Partial<Settings>>('settings', {}));
  return cache;
}

export function getSettingsSync(): Settings {
  return cache ?? DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings) {
  cache = merge(next);
  await setKV('settings', cache);
  subs.forEach((fn) => fn(cache!));
}

export function subscribeSettings(fn: (s: Settings) => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}
