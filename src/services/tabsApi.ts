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

export class TabsApi {
  // Same-origin proxies only (Vite dev server, Vercel rewrites): calling the source from the browser
  // would hand visitors' IPs straight to third parties, which the privacy policy says doesn't happen
  private static readonly API_BASE = '/api/tabs';
  private static readonly CDN_BASES = ['/cdn/tabs', '/cdn2/tabs'];

  /**
   * Search the catalog of songs
   */
  static async searchSongs(query: string): Promise<TabSearchResult[]> {
    const url = `${this.API_BASE}/songs?pattern=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    return response.json();
  }

  /**
   * Get metadata and track parts for a specific song
   */
  static async getSongMeta(songId: number): Promise<SongMeta> {
    const url = `${this.API_BASE}/meta/${songId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Meta fetch failed: ${response.status}`);
    return normalizeSongMeta(await response.json());
  }

  /**
   * Download and parse the raw tab JSON for a given track part
   */
  static async getTrackTabJson(
    songId: number,
    revisionId: number,
    image: string,
    partId: number
  ): Promise<any> {
    const cdnPath = `/${songId}/${revisionId}/${image}/${partId}.json`;
    let lastError = null;
    for (const base of this.CDN_BASES) {
      try {
        const res = await fetch(`${base}${cdnPath}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Failed to load track tab from CDN: ${lastError || 'All endpoints failed'}`);
  }

  /**
   * Convert the raw measure/beat hierarchy into a clean linear note timeline for the game
   */
  static normalizeTab(rawTab: any, songMeta: SongMeta, trackIndex: number): NormalizedSongTab {
    return normalizeRawTab(rawTab, songMeta, trackIndex);
  }
}
