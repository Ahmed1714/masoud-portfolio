import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/amiri/400.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { App } from './App';
import { loadSettings } from './lib/settings';
import { initSync } from './lib/sync';

loadSettings().then(() => {
  initSync();
  createRoot(document.getElementById('root')!).render(<App />);
});
