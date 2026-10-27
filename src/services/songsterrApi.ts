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
  dead?: boolean; // muted "x" note: percussive, no defined pitch
  ghost?: boolean; // played softly, usually not required
  tapping?: boolean;
  grace?: boolean; // ornamental, takes no time of its own
  harmonic?: string; // 'natural' | 'artificial' | 'pinch' | ...; midiNote is the sounding pitch when known
  bendSemitones?: number; // highest bend target above midiNote
}

export interface BeatMark {
  timeMs: number;
  accent: boolean; // first beat of the measure
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
  beatGrid: BeatMark[]; // metronome beats, following time signature and tempo changes
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

// Semitones above the stopped note for a harmonic touched N frets higher (harmonic series)
const HARMONIC_SEMITONES: Record<number, number> = {
  12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28, 3: 31
};

/**
 * Sounding MIDI pitch of a note, accounting for harmonics. Songsterr stores natural harmonics as
 * the touched fret over the open string, and artificial/pinch ones as an offset (harmonicFret, e.g.
 * 12 = octave) above the fretted note. Unknown offsets fall back to the fretted pitch.
 */
export function soundingMidi(openMidi: number, fret: number, harmonic?: string, harmonicFret?: number): number {
  if (harmonic === 'natural') return openMidi + (HARMONIC_SEMITONES[fret] ?? fret);
  if (harmonic && typeof harmonicFret === 'number') {
    return openMidi + fret + (HARMONIC_SEMITONES[harmonicFret] ?? 0);
  }
  return openMidi + fret;
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
    const initialBpm = currentBpm;

    const notes: NoteEvent[] = [];
    let currentTimeMs = 0;
    let noteIdCounter = 0;
    // Last emitted note per string, so tied notes extend it instead of becoming a new hit
    const lastNoteByString = new Map<number, NoteEvent>();
    const beatGrid: BeatMark[] = [];
    // Songsterr only repeats the signature on measures where it changes
    let signature: [number, number] = [4, 4];

    const measures = rawTab.measures || [];

    for (let mIdx = 0; mIdx < measures.length; mIdx++) {
      if (tempoMap.has(mIdx)) {
        currentBpm = tempoMap.get(mIdx)!;
      }

      const measure = measures[mIdx];
      if (Array.isArray(measure.signature) && measure.signature[0] > 0 && measure.signature[1] > 0) {
        signature = [measure.signature[0], measure.signature[1]];
      }
      const voices = measure.voices || [];
      const primaryVoice = voices[0];
      if (!primaryVoice) continue;

      const pulseMs = ((60000 / currentBpm) * 4) / signature[1];
      for (let pulse = 0; pulse < signature[0]; pulse++) {
        beatGrid.push({ timeMs: Math.round(currentTimeMs + pulse * pulseMs), accent: pulse === 0 });
      }

      const beats = primaryVoice.beats || [];
      for (let bIdx = 0; bIdx < beats.length; bIdx++) {
        const beat = beats[bIdx];

        // Beat duration: [numerator, denominator], e.g. [1, 4] for quarter note, [1, 8] for eighth note
        const [num, den] = beat.duration || [1, 4];
        // At currentBpm: 1 whole note (4/4) = 4 beats = (60000 / BPM) * 4 ms
        const wholeNoteMs = (60000 / currentBpm) * 4;
        // Songsterr durations already include dots and tuplets (checked against time signatures)
        const beatDurationMs = (wholeNoteMs * num) / den;
        // Grace notes sit just before the next real beat and don't shift the rest of the measure.
        // A run of graces is laid out back from that beat so they keep their written order.
        const isGrace = !!beat.graceNote;
        let graceLeadMs = 0;
        if (isGrace) {
          for (let g = bIdx; g < beats.length && beats[g].graceNote; g++) {
            const [gNum, gDen] = beats[g].duration || [1, 4];
            graceLeadMs += (wholeNoteMs * gNum) / gDen;
          }
        }
        const noteTimeMs = isGrace ? Math.max(0, currentTimeMs - graceLeadMs) : currentTimeMs;

        if (beat.notes && Array.isArray(beat.notes) && !beat.rest) {
          for (const rawNote of beat.notes) {
            if (rawNote.rest) continue;

            const fret = typeof rawNote.fret === 'number' ? rawNote.fret : 0;
            // Raw Songsterr strings are 0-indexed (0 = highest, matching tuning[0]); NoteEvent uses 1-indexed
            const rawString = typeof rawNote.string === 'number' ? rawNote.string : 0;
            const stringNum = rawString + 1;

            // Bend tone follows Guitar Pro units: 100 = full step (2 semitones)
            const bendTone = typeof rawNote.bend?.tone === 'number' ? rawNote.bend.tone : 0;
            const bendSemitones = bendTone > 0 ? bendTone / 50 : undefined;
            const vibrato = !!(rawNote.leftHandVibrato || rawNote.vibrato || beat.vibrato);

            const previous = lastNoteByString.get(stringNum);
            if (rawNote.tie && previous && !isGrace) {
              // Techniques written on the tied part (e.g. bend after sustain) still apply to the held note
              previous.durationMs = Math.round(currentTimeMs + beatDurationMs - previous.timeMs);
              if (bendSemitones !== undefined) {
                previous.bendSemitones = Math.max(previous.bendSemitones ?? 0, bendSemitones);
              }
              if (vibrato) previous.vibrato = true;
              continue;
            }

            const openMidi = tuning[rawString] ?? (64 - rawString * 5);
            const harmonic = typeof rawNote.harmonic === 'string' ? rawNote.harmonic : undefined;
            const midiNote = soundingMidi(openMidi, fret, harmonic, rawNote.harmonicFret);
            const freqHz = midiToFrequency(midiNote);
            const noteName = midiToNoteName(midiNote);

            const note: NoteEvent = {
              id: `note-${++noteIdCounter}`,
              timeMs: Math.round(noteTimeMs),
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
              vibrato,
              dead: !!rawNote.dead,
              ghost: !!rawNote.ghost,
              tapping: !!beat.tapping,
              grace: isGrace,
              harmonic,
              bendSemitones
            };
            notes.push(note);
            if (!isGrace) lastNoteByString.set(stringNum, note);
          }
        }

        if (!isGrace) currentTimeMs += beatDurationMs;
      }
    }

    // Grace notes are placed before their beat, after earlier notes were already pushed
    notes.sort((a, b) => a.timeMs - b.timeMs);

    return {
      songId: songMeta.songId,
      title: songMeta.title,
      artist: songMeta.artist,
      trackName: track.name || track.instrument || 'Guitar',
      tuning,
      stringCount,
      totalDurationMs: Math.round(currentTimeMs),
      notes,
      beatGrid,
      initialBpm
    };
  }
}
