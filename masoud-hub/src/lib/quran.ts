export interface Verse {
  id: number;
  text: string;
}
export interface Surah {
  id: number;
  name: string;
  transliteration: string;
  type: 'meccan' | 'medinan';
  total_verses: number;
  verses: Verse[];
}

export const TOTAL_AYAHS = 6236;

/** Starting ayah of each juz (surah, ayah). */
export const JUZ_STARTS: [number, number][] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

let cache: Surah[] | null = null;
let loading: Promise<Surah[]> | null = null;

/** The full Uthmani text is bundled inside the app, so this works fully offline. */
export function loadQuran(): Promise<Surah[]> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch('./quran.json')
    .then((r) => r.json())
    .then((d: Surah[]) => (cache = d));
  return loading;
}

let offsets: number[] | null = null;
function getOffsets(q: Surah[]) {
  if (!offsets) {
    offsets = [0];
    for (const s of q) offsets.push(offsets[offsets.length - 1] + s.total_verses);
  }
  return offsets;
}

/** 1-based index of an ayah in the whole mushaf (1..6236). */
export function globalIndex(q: Surah[], surah: number, ayah: number) {
  return getOffsets(q)[surah - 1] + ayah;
}

export function fromGlobal(q: Surah[], idx: number): [number, number] {
  const off = getOffsets(q);
  let s = 1;
  while (s < 114 && off[s] < idx) s++;
  return [s, idx - off[s - 1]];
}

export function juzOf(surah: number, ayah: number) {
  let j = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i];
    if (surah > s || (surah === s && ayah >= a)) j = i + 1;
  }
  return j;
}

export const audioUrl = (globalAyah: number) =>
  `https://cdn.islamic.network/quran/audio/128/ar.abdulbasitmurattal/${globalAyah}.mp3`;

export const toArabicDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
