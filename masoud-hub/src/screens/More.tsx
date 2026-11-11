import { Icon, type IconName } from '../components/brand';
import { go, type Route } from '../router';

const GROUPS: { title: string; items: { r: Route; ic: IconName; label: string }[] }[] = [
  {
    title: 'Productivity · الإنتاجية',
    items: [
      { r: 'tasks', ic: 'tasks', label: 'المهام' },
      { r: 'journal', ic: 'journal', label: 'اليوميات' },
      { r: 'expenses', ic: 'wallet', label: 'المصروفات' },
      { r: 'ideas', ic: 'idea', label: 'الأفكار' },
      { r: 'voice', ic: 'mic', label: 'استوديو الصوت' },
    ],
  },
  {
    title: 'Soul · الروح',
    items: [
      { r: 'quran', ic: 'quran', label: 'القرآن' },
      { r: 'azkar', ic: 'azkar', label: 'الأذكار' },
    ],
  },
  {
    title: 'Growth · النمو والبراند',
    items: [
      { r: 'english', ic: 'english', label: 'الإنجليزي' },
      { r: 'content', ic: 'content', label: 'المحتوى' },
      { r: 'social', ic: 'social', label: 'السوشيال' },
    ],
  },
  { title: 'App · التطبيق', items: [{ r: 'settings', ic: 'settings', label: 'الإعدادات' }] },
];

export function More() {
  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="section-title"><span>{g.title}</span></div>
          <div className="tiles">
            {g.items.map((i) => (
              <button key={i.r} className="tile" onClick={() => go(i.r)}>
                <span className="ic"><Icon name={i.ic} size={26} stroke={1.3} /></span>
                {i.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
