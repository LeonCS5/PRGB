// Songsterr API client with reverse-engineered endpoints & parser

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

export interface SongsterrMeta {
  songId: number;
  revisionId: number;
  title: string;
  artist: string;
  image: string;
  tracks: {
    instrumentId: number;
    instrument: string;
    name: string;
    tuning: number[];
    difficulty?: number;
    partId: number;
  }[];
}

export interface NoteEvent {
  id: string;
  timeMs: number;
  durationMs: number;
  string: number; // 1-indexed: 1 = high string (e.g. high E), 6 = low string (low E)
  fret: number;
  midiNote: number;
  freqHz: number;
  noteName: string;
  palmMute?: boolean;
  tie?: boolean;
  hammerOnOrPullOff?: boolean;
  slide?: string;
  vibrato?: boolean;
}

export interface NormalizedSongTab {
  songId: number;
  title: string;
  artist: string;
  trackName: string;
  tuning: number[]; // e.g. [64, 59, 55, 50, 45, 40]
  stringCount: number;
  totalDurationMs: number;
  notes: NoteEvent[];
  initialBpm: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
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
    const data = await response.json();
    return {
      songId: data.songId,
      revisionId: data.revisionId || data.latestRevisionId,
      title: data.title,
      artist: data.artist,
      image: data.image,
      tracks: data.tracks.map((t: any, idx: number) => ({
        instrumentId: t.instrumentId,
        instrument: t.instrument,
        name: t.name,
        tuning: t.tuning || [64, 59, 55, 50, 45, 40],
        difficulty: t.difficulty,
        partId: typeof t.partId === 'number' ? t.partId : idx
      }))
    };
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
   * Convert Songsterr raw measure/beat hierarchy into a clean linear note timeline for Yousician gaming
   */
  static normalizeTab(rawTab: any, songMeta: SongsterrMeta, trackIndex: number): NormalizedSongTab {
    const track = songMeta.tracks[trackIndex] || songMeta.tracks[0];
    const tuning = rawTab.tuning || track?.tuning || [64, 59, 55, 50, 45, 40];
    const stringCount = tuning.length;

    // Tempo automation map: measure index -> bpm
    const tempoMap = new Map<number, number>();
    let currentBpm = 120;
    if (rawTab.automations?.tempo && Array.isArray(rawTab.automations.tempo)) {
      for (const t of rawTab.automations.tempo) {
        tempoMap.set(t.measure, t.bpm);
        if (t.measure === 0) currentBpm = t.bpm;
      }
    }

    const notes: NoteEvent[] = [];
    let currentTimeMs = 0;
    let noteIdCounter = 0;

    const measures = rawTab.measures || [];

    for (let mIdx = 0; mIdx < measures.length; mIdx++) {
      if (tempoMap.has(mIdx)) {
        currentBpm = tempoMap.get(mIdx)!;
      }

      const measure = measures[mIdx];
      const voices = measure.voices || [];
      const primaryVoice = voices[0];
      if (!primaryVoice) continue;

      const beats = primaryVoice.beats || [];
      for (let bIdx = 0; bIdx < beats.length; bIdx++) {
        const beat = beats[bIdx];

        // Beat duration: [numerator, denominator], e.g. [1, 4] for quarter note, [1, 8] for eighth note
        const [num, den] = beat.duration || [1, 4];
        // At currentBpm: 1 whole note (4/4) = 4 beats = (60000 / BPM) * 4 ms
        const wholeNoteMs = (60000 / currentBpm) * 4;
        const beatDurationMs = (wholeNoteMs * num) / den;

        if (beat.notes && Array.isArray(beat.notes) && !beat.rest) {
          for (const rawNote of beat.notes) {
            if (rawNote.rest) continue;

            const fret = typeof rawNote.fret === 'number' ? rawNote.fret : 0;
            // Songsterr string: 1 to N, where 1 is highest pitch (e.g. high E)
            const stringNum = typeof rawNote.string === 'number' ? rawNote.string : 1;
            
            // Base tuning for this string: tuning[0] is string 1, tuning[1] is string 2, etc.
            const baseMidi = tuning[stringNum - 1] ?? (64 - (stringNum - 1) * 5);
            const midiNote = baseMidi + fret;
            const freqHz = midiToFrequency(midiNote);
            const noteName = midiToNoteName(midiNote);

            notes.push({
              id: `note-${++noteIdCounter}`,
              timeMs: Math.round(currentTimeMs),
              durationMs: Math.round(beatDurationMs),
              string: stringNum,
              fret,
              midiNote,
              freqHz,
              noteName,
              palmMute: !!(beat.palmMute || rawNote.palmMute),
              tie: !!rawNote.tie,
              hammerOnOrPullOff: !!rawNote.hp,
              slide: rawNote.slide,
              vibrato: !!rawNote.leftHandVibrato
            });
          }
        }

        currentTimeMs += beatDurationMs;
      }
    }

    return {
      songId: songMeta.songId,
      title: songMeta.title,
      artist: songMeta.artist,
      trackName: track.name || track.instrument || 'Guitar',
      tuning,
      stringCount,
      totalDurationMs: Math.round(currentTimeMs),
      notes,
      initialBpm: currentBpm
    };
  }
}
