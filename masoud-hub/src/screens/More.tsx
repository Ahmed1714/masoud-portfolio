import { go, type Route } from '../router';

const GROUPS: { title: string; items: { r: Route; ic: string; label: string }[] }[] = [
  {
    title: 'الإنتاجية',
    items: [
      { r: 'tasks', ic: '✅', label: 'المهام' },
      { r: 'journal', ic: '📔', label: 'اليوميات' },
      { r: 'expenses', ic: '💸', label: 'المصروفات' },
      { r: 'ideas', ic: '💡', label: 'الأفكار' },
      { r: 'voice', ic: '🎙', label: 'استوديو الصوت' },
    ],
  },
  {
    title: 'الروح',
    items: [
      { r: 'quran', ic: '📖', label: 'القرآن' },
      { r: 'azkar', ic: '📿', label: 'الأذكار' },
    ],
  },
  {
    title: 'النمو والبراند',
    items: [
      { r: 'english', ic: '🇬🇧', label: 'الإنجليزي' },
      { r: 'content', ic: '🎬', label: 'المحتوى' },
      { r: 'social', ic: '🌐', label: 'السوشيال' },
    ],
  },
  { title: 'التطبيق', items: [{ r: 'settings', ic: '⚙️', label: 'الإعدادات' }] },
];

export function More() {
  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="section-title">{g.title}</div>
          <div className="tiles">
            {g.items.map((i) => (
              <button key={i.r} className="tile" onClick={() => go(i.r)}>
                <span className="ic">{i.ic}</span>
                {i.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
