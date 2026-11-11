import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export type SpeechLang = 'ar-EG' | 'ar-SA' | 'en-US';
export const SPEECH_LANGS: { id: SpeechLang; label: string }[] = [
  { id: 'ar-EG', label: 'مصري' },
  { id: 'ar-SA', label: 'فصحى' },
  { id: 'en-US', label: 'English' },
];

export interface Dictation {
  stop: () => Promise<void>;
}

/**
 * Continuous dictation. Android's recognizer stops after a pause, so we
 * restart it automatically and keep appending text until stop() is called.
 */
export async function startDictation(
  lang: SpeechLang,
  onText: (full: string) => void,
  onError: (msg: string) => void,
): Promise<Dictation> {
  if (Capacitor.isNativePlatform()) return startNative(lang, onText, onError);
  return startWeb(lang, onText, onError);
}

async function startNative(lang: SpeechLang, onText: (t: string) => void, onError: (m: string) => void) {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('التعرف على الصوت مش متاح على الجهاز ده.');
  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('محتاج إذن الميكروفون.');

  let committed = '';
  let partial = '';
  let active = true;
  const handles: PluginListenerHandle[] = [];
  const emit = () => onText(join(committed, partial));

  const run = async () => {
    try {
      await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 });
    } catch (e) {
      // "No match" / timeout errors are normal between sentences; keep going.
      if (active) setTimeout(run, 250);
      else if (String(e).includes('permission')) onError('محتاج إذن الميكروفون.');
    }
  };

  handles.push(
    await SpeechRecognition.addListener('partialResults', (d) => {
      partial = d.matches?.[0] ?? '';
      emit();
    }),
  );
  handles.push(
    await SpeechRecognition.addListener('listeningState', (d) => {
      if (d.status === 'stopped') {
        committed = join(committed, partial);
        partial = '';
        emit();
        if (active) setTimeout(run, 150);
      }
    }),
  );
  run();

  return {
    stop: async () => {
      active = false;
      try {
        await SpeechRecognition.stop();
      } catch {
        /* already stopped */
      }
      committed = join(committed, partial);
      partial = '';
      emit();
      handles.forEach((h) => h.remove());
    },
  };
}

type WebRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

async function startWeb(lang: SpeechLang, onText: (t: string) => void, onError: (m: string) => void) {
  const w = window as unknown as { SpeechRecognition?: new () => WebRec; webkitSpeechRecognition?: new () => WebRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('المتصفح ده مش بيدعم تحويل الصوت لكتابة.');
  let committed = '';
  let active = true;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) committed = join(committed, r[0].transcript);
      else interim += r[0].transcript;
    }
    onText(join(committed, interim));
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed') {
      active = false;
      onError('محتاج إذن الميكروفون.');
    }
  };
  rec.onend = () => {
    if (active) rec.start();
  };
  rec.start();
  return {
    stop: async () => {
      active = false;
      rec.stop();
    },
  };
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(' ');

export async function speak(text: string, lang = 'en-US') {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({ text, lang, rate: 0.9 });
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
