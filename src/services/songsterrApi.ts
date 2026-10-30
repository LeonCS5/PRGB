// Songsterr API client with reverse-engineered endpoints & parser.
// The parser lives in supabase/functions/_shared so the ranking Edge Function counts notes like the game.

import {
  normalizeSongMeta,
  normalizeTab as normalizeSongsterrTab,
  type NormalizedSongTab,
  type SongsterrMeta
} from '../../supabase/functions/_shared/tabNormalizer.ts';

export {
  midiToFrequency,
  midiToNoteName,
  soundingMidi,
  type BeatMark,
  type NormalizedSongTab,
  type NoteEvent,
  type SongsterrMeta
} from '../../supabase/functions/_shared/tabNormalizer.ts';

export interface SongsterrTrack {
  instrumentId: number;
  instrument: string;
  name: string;
  tuning: number[]; // MIDI notes, e.g. [64, 59, 55, 50, 45, 40]
  difficulty?: number;
  hash: string;
  partId?: number;
}

export interface SongsterrSearchResult {
  songId: number;
  artistId: number;
  artist: string;
  title: string;
  hasPlayer: boolean;
  tracks: SongsterrTrack[];
  defaultTrack: number;
  popularTrack?: number;
}

export class SongsterrApi {
  private static readonly API_BASE = '/api/songsterr';
  private static readonly CDN_BASE = '/cdn/songsterr';
  private static readonly DIRECT_CDN_1 = 'https://dqsljvtekg760.cloudfront.net';
  private static readonly DIRECT_CDN_2 = 'https://d3d3l6a6rcgkaf.cloudfront.net';

  /**
   * Search Songsterr's vast catalog of songs
   */
  static async searchSongs(query: string): Promise<SongsterrSearchResult[]> {
    const url = `${this.API_BASE}/songs?pattern=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) {
      // Direct fallback
      const directUrl = `https://www.songsterr.com/api/songs?pattern=${encodeURIComponent(query)}`;
      const directRes = await fetch(directUrl);
      if (!directRes.ok) throw new Error(`Search failed: ${directRes.status}`);
      return directRes.json();
    }
    return response.json();
  }

  /**
   * Get metadata and track parts for a specific song
   */
  static async getSongMeta(songId: number): Promise<SongsterrMeta> {
    const url = `${this.API_BASE}/meta/${songId}`;
    let response = await fetch(url);
    if (!response.ok) {
      const directUrl = `https://www.songsterr.com/api/meta/${songId}`;
      response = await fetch(directUrl);
      if (!response.ok) throw new Error(`Meta fetch failed: ${response.status}`);
    }
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
    const urls = [
      `${this.CDN_BASE}${cdnPath}`,
      `${this.DIRECT_CDN_1}${cdnPath}`,
      `${this.DIRECT_CDN_2}${cdnPath}`
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
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
   * Convert Songsterr raw measure/beat hierarchy into a clean linear note timeline for the game
   */
  static normalizeTab(rawTab: any, songMeta: SongsterrMeta, trackIndex: number): NormalizedSongTab {
    return normalizeSongsterrTab(rawTab, songMeta, trackIndex);
  }
}
