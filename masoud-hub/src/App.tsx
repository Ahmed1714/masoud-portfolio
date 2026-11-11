import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { go, TITLES, useRoute, type Route } from './router';
import { notionConfigured, subscribeSync, syncNow, type SyncState } from './lib/sync';
import { ToastHost } from './components/ui';
import { Icon, Intro, Logo, type IconName } from './components/brand';
import { Home } from './screens/Home';
import { Tasks } from './screens/Tasks';
import { Journal } from './screens/Journal';
import { Expenses } from './screens/Expenses';
import { Ideas } from './screens/Ideas';
import { Voice } from './screens/Voice';
import { Quran } from './screens/Quran';
import { Azkar } from './screens/Azkar';
import { English } from './screens/English';
import { Content } from './screens/Content';
import { Social } from './screens/Social';
import { SettingsScreen } from './screens/Settings';
import { More } from './screens/More';

const TABS: { id: Route; label: string; ic: IconName }[] = [
  { id: 'home', label: 'الرئيسية', ic: 'home' },
  { id: 'tasks', label: 'المهام', ic: 'tasks' },
  { id: 'voice', label: 'صوت', ic: 'mic' },
  { id: 'quran', label: 'القرآن', ic: 'quran' },
  { id: 'more', label: 'المزيد', ic: 'menu' },
];

let introShown = false;

const SCREENS: Record<Route, () => React.JSX.Element> = {
  home: Home,
  tasks: Tasks,
  journal: Journal,
  expenses: Expenses,
  ideas: Ideas,
  voice: Voice,
  quran: Quran,
  azkar: Azkar,
  english: English,
  content: Content,
  social: Social,
  settings: SettingsScreen,
  more: More,
};

function SyncPill() {
  const [s, setS] = useState<SyncState | null>(null);
  useEffect(() => {
    const un = subscribeSync(setS);
    return () => void un();
  }, []);
  if (!s) return null;
  const cls = s.running ? 'busy' : s.online ? 'on' : 'off';
  const label = s.running
    ? 'بيزامن…'
    : !s.online
      ? 'أوفلاين'
      : !notionConfigured()
        ? 'محفوظ محلياً'
        : s.pending
          ? `${s.pending} مستني`
          : 'متزامن مع Notion';
  return (
    <button className="sync-pill" onClick={() => (notionConfigured() ? syncNow() : go('settings'))} title={s.error ?? ''}>
      <span className={`dot ${cls}`} />
      {s.error && s.online && !s.running ? 'خطأ مزامنة' : label}
    </button>
  );
}

export function App() {
  const [route] = useRoute();
  const Screen = SCREENS[route];
  const isTab = TABS.some((t) => t.id === route);
  const [intro, setIntro] = useState(!introShown);

  useEffect(() => {
    // Android back button: go to home instead of closing the app.
    let handle: { remove: () => void } | undefined;
    CapApp.addListener('backButton', () => {
      if (location.hash && location.hash !== '#/home') history.back();
      else CapApp.exitApp();
    })
      .then((h) => (handle = h))
      .catch(() => {});
    return () => handle?.remove();
  }, []);

  return (
    <div className="app">
      <div className="ambient">
        <div className="glow g1" />
        <div className="glow g2" />
      </div>
      <header className="topbar">
        {isTab ? (
          <button className="brand-mark" onClick={() => go('home')} aria-label="Masoud">
            <Logo size={34} />
          </button>
        ) : (
          <button className="back" onClick={() => history.back()} aria-label="رجوع">
            <Icon name="back" size={18} />
          </button>
        )}
        <h1>{route === 'home' ? '' : TITLES[route]}</h1>
        <SyncPill />
      </header>
      <main key={route}>
        <Screen />
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${route === t.id ? 'active' : ''} ${t.id === 'voice' ? 'mic-tab' : ''}`}
            onClick={() => go(t.id)}
          >
            <span className="ic">
              <Icon name={t.ic} size={t.id === 'voice' ? 24 : 22} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <ToastHost />
      {intro && (
        <Intro
          onDone={() => {
            introShown = true;
            setIntro(false);
          }}
        />
      )}
    </div>
  );
}
