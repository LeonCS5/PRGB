// Personal bests and recent runs, kept only in this browser: no account, nothing leaves the device.
// Storage can be blocked, full or tampered with, so every read is validated and nothing here throws.

export type RunMode = 'solo' | 'duo-local' | 'duo-online';

export interface RunResult {
  songId: number; // -1 = offline demo
  partId: number;
  title: string;
  artist: string;
  trackName: string;
  score: number;
  accuracy: number; // 0-100
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  speed: number; // 0.5 | 0.75 | 1
  mode: RunMode;
  playedAt: string; // ISO 8601
}

export interface RecordOutcome {
  isPersonalBest: boolean;
  previousBest: RunResult | null;
}

interface RecordsData {
  history: RunResult[]; // most recent first
  bests: RunResult[]; // most recently played first, one per song, part and speed
}

const STORAGE_KEY = 'prgb:records:v1';
const DATA_VERSION = 1;
const HISTORY_LIMIT = 50;
const BESTS_LIMIT = 500;
const TEXT_MAX = 120;
const SPEEDS = [0.5, 0.75, 1];
const MODES: readonly RunMode[] = ['solo', 'duo-local', 'duo-online'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
// Control characters, lone surrogates and bidi overrides/isolates (they garble the text around them)
const UNSAFE_CHAR = /[\p{Cc}\p{Cs}‪-‮⁦-⁩]/u;
const UNSAFE_CHARS = /[\p{Cc}\p{Cs}‪-‮⁦-⁩]/gu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isSongId = (value: unknown): value is number => isCount(value) ? value >= 1 : value === -1;

const isAccuracy = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

const isSpeed = (value: unknown): value is number => typeof value === 'number' && SPEEDS.includes(value);

const isMode = (value: unknown): value is RunMode => MODES.some((mode) => mode === value);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && Array.from(value).length <= TEXT_MAX && !UNSAFE_CHAR.test(value);

const isPlayedAt = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

// Builds a fresh object with only the known fields, or null if anything is out of spec
const parseRun = (value: unknown): RunResult | null => {
  if (!isRecord(value)) return null;
  const { songId, partId, title, artist, trackName, score, accuracy, maxCombo, perfect, good, miss, speed, mode, playedAt } = value;
  if (!isSongId(songId) || !isCount(partId) || !isText(title) || !isText(artist) || !isText(trackName)
    || !isCount(score) || !isAccuracy(accuracy) || !isCount(maxCombo) || !isCount(perfect) || !isCount(good)
    || !isCount(miss) || !isSpeed(speed) || !isMode(mode) || !isPlayedAt(playedAt)) {
    return null;
  }
  return { songId, partId, title, artist, trackName, score, accuracy, maxCombo, perfect, good, miss, speed, mode, playedAt };
};

const cleanText = (value: unknown): unknown =>
  typeof value === 'string' ? Array.from(value.replace(UNSAFE_CHARS, '')).slice(0, TEXT_MAX).join('') : value;

// Song metadata can be long or messy: it is trimmed to fit instead of losing the run
const prepareRun = (run: RunResult): RunResult | null => parseRun({
  ...run,
  title: cleanText(run.title),
  artist: cleanText(run.artist),
  trackName: cleanText(run.trackName),
  playedAt: isPlayedAt(run.playedAt) ? new Date(run.playedAt).toISOString() : run.playedAt
});

const bestKey = ({ songId, partId, speed }: Pick<RunResult, 'songId' | 'partId' | 'speed'>): string =>
  `${songId}:${partId}:${speed}`;

const resolveStorage = (storage?: Storage): Storage | null => {
  if (storage) return storage;
  try {
    // Reading window.localStorage itself throws in some browsers when site data is blocked
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readData = (storage: Storage | null): RecordsData => {
  const empty: RecordsData = { history: [], bests: [] };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(value) || value.version !== DATA_VERSION || !Array.isArray(value.history) || !Array.isArray(value.bests)) {
      return empty;
    }
    const keys = new Set<string>();
    const bests = value.bests.map(parseRun).filter((run): run is RunResult => {
      if (!run || keys.has(bestKey(run))) return false;
      keys.add(bestKey(run));
      return true;
    });
    return {
      history: value.history.map(parseRun).filter((run): run is RunResult => run !== null).slice(0, HISTORY_LIMIT),
      bests: bests.slice(0, BESTS_LIMIT)
    };
  } catch {
    return empty;
  }
};

const writeData = (storage: Storage | null, data: RecordsData): void => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, ...data }));
  } catch {
    // Records are optional when storage is blocked or full.
  }
};

const findBest = (bests: RunResult[], key: string): RunResult | null => bests.find((best) => bestKey(best) === key) ?? null;

/**
 * Save a finished run to the history and update the personal best for its song, part and speed.
 * Only a strictly higher score is a new record: a tie is not, and 0 points never is. A run with
 * invalid numbers is not saved. The outcome is still returned if the browser refuses to save.
 */
export function recordRun(run: RunResult, storage?: Storage): RecordOutcome {
  const target = resolveStorage(storage);
  const data = readData(target);
  const entry = prepareRun(run);
  if (!entry) return { isPersonalBest: false, previousBest: findBest(data.bests, bestKey(run)) };

  const key = bestKey(entry);
  const previousBest = findBest(data.bests, key);
  const isPersonalBest = entry.score > (previousBest?.score ?? 0);
  const best = isPersonalBest ? entry : previousBest;
  const otherBests = data.bests.filter((item) => bestKey(item) !== key);
  writeData(target, {
    history: [entry, ...data.history].slice(0, HISTORY_LIMIT),
    // The played song moves to the front, so the cap drops the songs left unplayed the longest
    bests: (best ? [best, ...otherBests] : otherBests).slice(0, BESTS_LIMIT)
  });
  return { isPersonalBest, previousBest };
}

export function getPersonalBest(songId: number, partId: number, speed = 1, storage?: Storage): RunResult | null {
  return findBest(readData(resolveStorage(storage)).bests, bestKey({ songId, partId, speed }));
}

export function getHistory(limit = HISTORY_LIMIT, storage?: Storage): RunResult[] {
  return readData(resolveStorage(storage)).history.slice(0, Math.max(0, limit));
}

export function clearRecords(storage?: Storage): void {
  try {
    resolveStorage(storage)?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

// Readable copy of everything this module keeps, for the user to download (data portability)
export function exportLocalData(storage?: Storage): string {
  const { history, bests } = readData(resolveStorage(storage));
  return JSON.stringify({
    app: 'PRGB',
    description: 'Recordes pessoais e histórico de jogadas guardados neste navegador.',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    personalBests: bests,
    history
  }, null, 2);
}
