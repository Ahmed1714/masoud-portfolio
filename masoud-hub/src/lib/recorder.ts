import { db, uid, type Recording } from '../db';

/**
 * Unlimited voice recorder.
 *
 * Audio is captured with MediaRecorder and cut into self-contained segments
 * (one file every SEGMENT_MS) that are written to IndexedDB as they finish, so
 * a recording can run for hours, survives low memory, and works offline.
 * Transcription happens later (see transcribe.ts) whenever there is internet.
 */
const SEGMENT_MS: number = (globalThis as { __recSegmentMs?: number }).__recSegmentMs ?? 2 * 60 * 1000;

export interface RecorderHandle {
  id: string;
  stop: () => Promise<Recording | undefined>;
  pause: () => void;
  resume: () => void;
  readonly paused: boolean;
  /** 0..1 input level for the live meter */
  level: () => number;
  elapsed: () => number; // seconds
}

function pickMime() {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

type WakeLockSentinel = { release: () => Promise<void> };

export async function startRecording(lang: string): Promise<RecorderHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('الجهاز ده مش بيدعم التسجيل.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    throw new Error('محتاج إذن الميكروفون عشان أسجّل.');
  }

  const id = uid();
  const mime = pickMime();
  await db.recordings.put({ id, createdAt: Date.now(), duration: 0, status: 'recording', chunks: 0, lang });

  // Keep the screen awake so Android doesn't suspend the recording.
  let wake: WakeLockSentinel | null = null;
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } };
  const lockScreen = async () => {
    try {
      wake = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      /* not supported */
    }
  };
  lockScreen();
  const onVisible = () => document.visibilityState === 'visible' && !stopped && lockScreen();
  document.addEventListener('visibilitychange', onVisible);

  // Level meter
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  let idx = 0;
  let stopped = false;
  let paused = false;
  let rec: MediaRecorder | null = null;
  let segTimer: ReturnType<typeof setTimeout> | undefined;
  let elapsedMs = 0;
  let runningSince = Date.now();
  const pending: Promise<void>[] = [];

  const startSegment = () => {
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    const parts: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const done = new Promise<void>((resolve) => {
      r.onstop = async () => {
        if (parts.length) {
          const blob = new Blob(parts, { type: r.mimeType || mime || 'audio/webm' });
          const n = idx++;
          await db.audioChunks.put({ id: `${id}:${n}`, recId: id, idx: n, blob, mime: blob.type });
          await db.recordings.update(id, { chunks: n + 1, duration: Math.round(elapsed()) });
        }
        resolve();
      };
    });
    pending.push(done);
    r.start(1000);
    rec = r;
    segTimer = setTimeout(rotate, SEGMENT_MS);
  };

  // Close the current file and immediately open the next one.
  const rotate = () => {
    if (stopped || paused) return;
    rec?.stop();
    startSegment();
  };

  const elapsed = () => (elapsedMs + (paused || stopped ? 0 : Date.now() - runningSince)) / 1000;

  startSegment();

  return {
    id,
    get paused() {
      return paused;
    },
    pause: () => {
      if (paused || stopped) return;
      paused = true;
      elapsedMs += Date.now() - runningSince;
      clearTimeout(segTimer);
      rec?.pause();
    },
    resume: () => {
      if (!paused || stopped) return;
      paused = false;
      runningSince = Date.now();
      rec?.resume();
      segTimer = setTimeout(rotate, SEGMENT_MS);
    },
    level: () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      return Math.min(1, peak / 90);
    },
    elapsed,
    stop: async () => {
      if (stopped) return db.recordings.get(id);
      const total = Math.round(elapsed());
      stopped = true;
      clearTimeout(segTimer);
      if (rec && rec.state !== 'inactive') rec.stop();
      await Promise.all(pending);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      document.removeEventListener('visibilitychange', onVisible);
      wake?.release().catch(() => {});
      const chunks = await db.audioChunks.where('recId').equals(id).count();
      if (!chunks) {
        await db.recordings.delete(id);
        return undefined;
      }
      await db.recordings.update(id, { status: 'pending', duration: total, chunks });
      return db.recordings.get(id);
    },
  };
}

/** Recordings left in "recording" state (app was killed) become pending so their audio isn't lost. */
export async function recoverInterrupted() {
  const stuck = await db.recordings.where('status').anyOf('recording', 'transcribing').toArray();
  for (const r of stuck) {
    const chunks = await db.audioChunks.where('recId').equals(r.id).count();
    if (chunks) await db.recordings.update(r.id, { status: 'pending', chunks });
    else await db.recordings.delete(r.id);
  }
}

export async function recordingAudio(recId: string): Promise<Blob | null> {
  const chunks = await db.audioChunks.where('recId').equals(recId).sortBy('idx');
  if (!chunks.length) return null;
  return new Blob(
    chunks.map((c) => c.blob),
    { type: chunks[0].mime },
  );
}

export async function deleteRecording(recId: string) {
  await db.audioChunks.where('recId').equals(recId).delete();
  await db.recordings.delete(recId);
}

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(s).padStart(2, '0');
};
