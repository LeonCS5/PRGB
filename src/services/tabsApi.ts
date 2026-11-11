// Tab catalog client & parser.
// The parser lives in supabase/functions/_shared so the ranking Edge Function counts notes like the game.

import {
  normalizeSongMeta,
  normalizeTab as normalizeRawTab,
  type NormalizedSongTab,
  type SongMeta
} from '../../supabase/functions/_shared/tabNormalizer.ts';

export {
  midiToFrequency,
  midiToNoteName,
  soundingMidi,
  type BeatMark,
  type ChordTarget,
  type NormalizedSongTab,
  type NoteEvent,
  type SongMeta
} from '../../supabase/functions/_shared/tabNormalizer.ts';

export interface TabTrack {
  instrumentId: number;
  instrument: string;
  name: string;
  tuning: number[]; // MIDI notes, e.g. [64, 59, 55, 50, 45, 40]
  difficulty?: number;
  hash: string;
  partId?: number;
}

export interface TabSearchResult {
  songId: number;
  artistId: number;
  artist: string;
  title: string;
  hasPlayer: boolean;
  tracks: TabTrack[];
  defaultTrack: number;
  popularTrack?: number;
}

// Songs taken out after a rights holder's request (Termos de Uso, Direitos autorais e pedidos de remoção)
const REMOVED_SONG_IDS: ReadonlySet<number> = new Set<number>([]);

export const isSongRemoved = (songId: number, removed: ReadonlySet<number> = REMOVED_SONG_IDS): boolean => removed.has(songId);

/** The provider answered, but not in the shape the app reads. Not a connectivity problem. */
export class TabsFormatError extends Error {
  constructor(what: string) {
    super(`Unexpected response format: ${what}`);
    this.name = 'TabsFormatError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseSearchItem = (item: unknown): TabSearchResult | null => {
  if (!isRecord(item)) return null;
  if (!isFiniteNumber(item.songId) || typeof item.title !== 'string' || typeof item.artist !== 'string') return null;
  if (!Array.isArray(item.tracks)) return null;
  return item as unknown as TabSearchResult;
};

const assertSongMeta = (data: unknown): void => {
  if (!isRecord(data)) throw new TabsFormatError('meta is not an object');
  if (!isFiniteNumber(data.songId)) throw new TabsFormatError('meta without songId');
  if (!isFiniteNumber(data.revisionId) && !isFiniteNumber(data.latestRevisionId)) {
    throw new TabsFormatError('meta without revision');
  }
  if (typeof data.image !== 'string') throw new TabsFormatError('meta without image');
  if (!Array.isArray(data.tracks)) throw new TabsFormatError('meta without tracks');
  if (data.tracks.some((track) => !isRecord(track))) throw new TabsFormatError('meta with invalid track');
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class TabsApi {
  // Same-origin proxies only (Vite dev server, Vercel rewrites): calling the source from the browser
  // would hand visitors' IPs straight to third parties, which the privacy policy says doesn't happen
  private static readonly API_BASE = '/api/tabs';
  private static readonly CDN_BASES = ['/cdn/tabs', '/cdn2/tabs'];

  // Mutable only so tests can shrink them
  static searchTimeoutMs = 12_000;
  static metaTimeoutMs = 12_000;
  static tabTimeoutMs = 20_000;
  static retryDelayMs = 400;

  /**
   * GET with a timeout and one retry for network failures and 5xx. Timeouts are not retried (they would
   * double an already long wait) and neither is a cancellation by the caller.
   */
  private static async fetchGet(url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const timeout = AbortSignal.timeout(timeoutMs);
      // AbortSignal.any is missing in older Safari: there only the timeout applies
      const combined = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await fetch(url, { signal: combined });
        if (response.status < 500 || attempt > 0) return response;
      } catch (error) {
        if (signal?.aborted || timeout.aborted || attempt > 0) throw error;
      }
      await wait(this.retryDelayMs * (attempt + 1));
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
  }

  /**
   * Search the catalog of songs
   */
  static async searchSongs(query: string, signal?: AbortSignal): Promise<TabSearchResult[]> {
    const url = `${this.API_BASE}/songs?pattern=${encodeURIComponent(query)}`;
    const response = await this.fetchGet(url, this.searchTimeoutMs, signal);
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const data: unknown = await response.json().catch(() => {
      throw new TabsFormatError('search is not JSON');
    });
    if (!Array.isArray(data)) throw new TabsFormatError('search is not a list');
    const songs = data.map(parseSearchItem).filter((song): song is TabSearchResult => song !== null);
    if (data.length > 0 && songs.length === 0) throw new TabsFormatError('no valid search item');
    return songs.filter((song) => !isSongRemoved(song.songId));
  }

  /**
   * Get metadata and track parts for a specific song
   */
  static async getSongMeta(songId: number, signal?: AbortSignal): Promise<SongMeta> {
    if (isSongRemoved(songId)) throw new Error('Song removed');
    const url = `${this.API_BASE}/meta/${songId}`;
    const response = await this.fetchGet(url, this.metaTimeoutMs, signal);
    if (!response.ok) throw new Error(`Meta fetch failed: ${response.status}`);
    const data: unknown = await response.json().catch(() => {
      throw new TabsFormatError('meta is not JSON');
    });
    assertSongMeta(data);
    return normalizeSongMeta(data);
  }

  /**
   * Download and parse the raw tab JSON for a given track part
   */
  static async getTrackTabJson(
    songId: number,
    revisionId: number,
    image: string,
    partId: number,
    signal?: AbortSignal
  ): Promise<unknown> {
    const cdnPath = `/${songId}/${revisionId}/${image}/${partId}.json`;
    let lastError: unknown = null;
    for (const base of this.CDN_BASES) {
      try {
        const res = await this.fetchGet(`${base}${cdnPath}`, this.tabTimeoutMs, signal);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err;
      }
    }
    throw new Error(`Failed to load track tab from CDN: ${lastError || 'All endpoints failed'}`);
  }

  /**
   * Convert the raw measure/beat hierarchy into a clean linear note timeline for the game
   */
  static normalizeTab(rawTab: unknown, songMeta: SongMeta, trackIndex: number): NormalizedSongTab {
    return normalizeRawTab(rawTab, songMeta, trackIndex);
  }
}
