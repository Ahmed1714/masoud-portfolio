import { useEffect, useState } from 'react';

export type Route =
  | 'home'
  | 'tasks'
  | 'quran'
  | 'voice'
  | 'more'
  | 'journal'
  | 'expenses'
  | 'ideas'
  | 'azkar'
  | 'english'
  | 'content'
  | 'social'
  | 'settings';

export const TITLES: Record<Route, string> = {
  home: 'الرئيسية',
  tasks: 'المهام',
  quran: 'القرآن الكريم',
  voice: 'استوديو الصوت',
  more: 'كل الأقسام',
  journal: 'اليوميات',
  expenses: 'المصروفات',
  ideas: 'الأفكار',
  azkar: 'الأذكار',
  english: 'الإنجليزي',
  content: 'صناعة المحتوى',
  social: 'السوشيال ميديا',
  settings: 'الإعدادات',
};

const parse = (): Route => {
  const h = location.hash.replace('#/', '').split('?')[0] as Route;
  return h in TITLES ? h : 'home';
};

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const fn = () => setRoute(parse());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return [route, go];
}

export function go(r: Route) {
  location.hash = `#/${r}`;
  window.scrollTo({ top: 0 });
}
