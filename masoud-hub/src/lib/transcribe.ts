import { db, type AudioChunk } from '../db';
import { getSettingsSync } from './settings';

/**
 * Turns recorded audio into text with Gemini or OpenAI (Claude has no audio input).
 * Each 2-minute segment is converted to 16 kHz mono WAV (a format both APIs accept),
 * transcribed, and saved, so a long recording is processed piece by piece and a
 * failure halfway resumes where it stopped.
 */

export type Transcriber = 'gemini' | 'openai';

export function activeTranscriber(): Transcriber | null {
  const { ai } = getSettingsSync();
  if (ai.transcriber === 'gemini') return ai.geminiKey ? 'gemini' : null;
  if (ai.transcriber === 'openai') return ai.openaiKey ? 'openai' : null;
  if (ai.geminiKey) return 'gemini';
  if (ai.openaiKey) return 'openai';
  return null;
}

async function toWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    out.setUint32(4, 36 + pcm.length * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, 1, true);
    out.setUint32(24, rate, true);
    out.setUint32(28, rate * 2, true);
    out.setUint16(32, 2, true);
    out.setUint16(34, 16, true);
    str(36, 'data');
    out.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    return new Blob([out], { type: 'audio/wav' });
  } finally {
    ctx.close().catch(() => {});
  }
}

const toBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(b);
  });

const LANG_HINT: Record<string, string> = {
  'ar-EG': 'Egyptian Arabic (may mix in English words)',
  'ar-SA': 'Modern Standard Arabic (may mix in English words)',
  'en-US': 'English',
};

async function transcribeGemini(wav: Blob, lang: string): Promise<string> {
  const { ai } = getSettingsSync();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.geminiKey },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Transcribe this audio verbatim. The speaker uses ${LANG_HINT[lang] ?? 'Arabic or English'}. Keep the dialect exactly as spoken (do not convert Egyptian to Fusha), write English words in English letters, add natural punctuation. Output only the transcript, nothing else. If there is no speech, output nothing.`,
            },
            { inline_data: { mime_type: 'audio/wav', data: await toBase64(wav) } },
          ],
        },
      ],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini: ${j?.error?.message ?? r.status}`);
  return (j.candidates?.[0]?.content?.parts ?? [])
    .map((x: { text?: string }) => x.text ?? '')
    .join('')
    .trim();
}

async function transcribeOpenAI(wav: Blob, lang: string): Promise<string> {
  const { ai } = getSettingsSync();
  const send = async (model: string) => {
    const form = new FormData();
    form.append('file', wav, 'audio.wav');
    form.append('model', model);
    form.append('language', lang.startsWith('ar') ? 'ar' : 'en');
    form.append('response_format', 'text');
    return fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ai.openaiKey}` },
      body: form,
    });
  };
  let r = await send(ai.openaiTranscribeModel);
  // Fall back to whisper-1 if the configured model isn't available on this account.
  if (!r.ok && (r.status === 400 || r.status === 404) && ai.openaiTranscribeModel !== 'whisper-1') r = await send('whisper-1');
  const t = await r.text();
  if (!r.ok) {
    let msg = String(r.status);
    try {
      msg = JSON.parse(t).error?.message ?? msg;
    } catch {
      /* plain text */
    }
    throw new Error(`OpenAI: ${msg}`);
  }
  return t.trim();
}

async function transcribeChunk(c: AudioChunk, lang: string, who: Transcriber) {
  const wav = await toWav(c.blob);
  return who === 'gemini' ? transcribeGemini(wav, lang) : transcribeOpenAI(wav, lang);
}

let running = false;

/** Transcribes every pending recording. Safe to call repeatedly (e.g. whenever the internet comes back). */
export async function processRecordings(): Promise<void> {
  if (running || !navigator.onLine) return;
  const who = activeTranscriber();
  if (!who) return;
  running = true;
  try {
    const queue = await db.recordings.where('status').anyOf('pending', 'error').toArray();
    for (const rec of queue.sort((a, b) => a.createdAt - b.createdAt)) {
      await db.recordings.update(rec.id, { status: 'transcribing', error: undefined });
      try {
        const chunks = await db.audioChunks.where('recId').equals(rec.id).sortBy('idx');
        for (const c of chunks) {
          if (c.text !== undefined) continue; // already done in an earlier attempt
          const text = await transcribeChunk(c, rec.lang, who);
          await db.audioChunks.update(c.id, { text });
        }
        const done = await db.audioChunks.where('recId').equals(rec.id).sortBy('idx');
        await db.recordings.update(rec.id, {
          status: 'done',
          text: done
            .map((c) => c.text ?? '')
            .filter(Boolean)
            .join('\n\n'),
        });
      } catch (e) {
        await db.recordings.update(rec.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
        if (!navigator.onLine) break;
      }
    }
  } finally {
    running = false;
  }
}

/** Re-run transcription for a single recording (e.g. after changing the provider). */
export async function retranscribe(recId: string) {
  await db.audioChunks.where('recId').equals(recId).modify((c) => {
    delete c.text;
  });
  await db.recordings.update(recId, { status: 'pending', text: undefined, error: undefined });
  return processRecordings();
}
