import { describe, it, expect } from 'vitest';
import { updateTrail, TRAIL_WINDOW_MS, type PlayedNote } from './noteTrail';
import type { DetectedPitch } from './audioEngine';

// Minimal DetectedPitch factory
const pitch = (attackId: number, opts: Partial<DetectedPitch> = {}): DetectedPitch => ({
  frequency: 440,
  midiNote: 69,
  noteName: 'A4',
  cents: 0,
  clarity: 0.9,
  volume: 0.5,
  attackId,
  ...opts,
});

describe('updateTrail', () => {
  it('returns empty array when pitch is null and trail is empty', () => {
    expect(updateTrail([], null, 1000)).toEqual([]);
  });

  it('appends a new note on the first pitch', () => {
    const result = updateTrail([], pitch(1), 1000);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ attackId: 1, startMs: 1000, endMs: 1000, noteName: 'A4' });
  });

  it('does not change the last note when pitch is null', () => {
    const initial = updateTrail([], pitch(1), 1000);
    const result = updateTrail(initial, null, 2000);
    expect(result).toHaveLength(1);
    expect(result[0].endMs).toBe(1000); // unchanged
  });

  it('extends endMs of the last note on the same attackId', () => {
    const initial = updateTrail([], pitch(1), 1000);
    const result = updateTrail(initial, pitch(1), 1500);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(1000);
    expect(result[0].endMs).toBe(1500);
  });

  it('appends a new note when attackId changes', () => {
    const after1 = updateTrail([], pitch(1), 1000);
    const after2 = updateTrail(after1, pitch(2), 2000);
    expect(after2).toHaveLength(2);
    expect(after2[1]).toMatchObject({ attackId: 2, startMs: 2000, endMs: 2000 });
  });

  it('discards notes whose endMs is older than nowMs - TRAIL_WINDOW_MS', () => {
    const old: PlayedNote = {
      attackId: 1,
      noteName: 'E4',
      midiNote: 64,
      string: 1,
      fret: 0,
      clarity: 1,
      startMs: 0,
      endMs: 0, // will be at cutoff - 1
    };
    const nowMs = TRAIL_WINDOW_MS + 1; // cutoff = 1
    const result = updateTrail([old], null, nowMs);
    expect(result).toHaveLength(0);
  });

  it('keeps notes exactly at the cutoff boundary', () => {
    const nowMs = TRAIL_WINDOW_MS + 100;
    const borderNote: PlayedNote = {
      attackId: 1,
      noteName: 'E4',
      midiNote: 64,
      string: 1,
      fret: 0,
      clarity: 1,
      startMs: 0,
      endMs: 100, // nowMs - TRAIL_WINDOW_MS = 100 → exactly at cutoff, kept
    };
    const result = updateTrail([borderNote], null, nowMs);
    expect(result).toHaveLength(1);
  });

  it('maps stringEstimate and fretEstimate to string and fret fields', () => {
    const p = pitch(1, { stringEstimate: 3, fretEstimate: 5 });
    const result = updateTrail([], p, 500);
    expect(result[0].string).toBe(3);
    expect(result[0].fret).toBe(5);
  });

  it('uses null for string and fret when estimates are absent', () => {
    const p = pitch(1); // no stringEstimate or fretEstimate
    const result = updateTrail([], p, 500);
    expect(result[0].string).toBeNull();
    expect(result[0].fret).toBeNull();
  });

  it('replaces a shaky first reading with a clearer one of the same pluck', () => {
    const shaky = pitch(1, { noteName: 'G#3', midiNote: 56, clarity: 0.6, stringEstimate: 3, fretEstimate: 1 });
    const clear = pitch(1, { noteName: 'G3', midiNote: 55, clarity: 0.98, stringEstimate: 3, fretEstimate: 0 });
    const [note] = updateTrail(updateTrail([], shaky, 1000), clear, 1050);
    expect(note).toMatchObject({ noteName: 'G3', midiNote: 55, fret: 0, clarity: 0.98, startMs: 1000, endMs: 1050 });
  });

  it('keeps the clearest reading while the note fades, and still extends it', () => {
    const clear = pitch(1, { noteName: 'G3', midiNote: 55, clarity: 0.98, stringEstimate: 3, fretEstimate: 0 });
    const fading = pitch(1, { noteName: 'A3', midiNote: 57, clarity: 0.6, stringEstimate: 3, fretEstimate: 2 });
    const [note] = updateTrail(updateTrail([], clear, 1000), fading, 1500);
    expect(note).toMatchObject({ noteName: 'G3', midiNote: 55, fret: 0, clarity: 0.98, endMs: 1500 });
  });

  it('does not mutate the input trail', () => {
    const original: PlayedNote[] = [];
    updateTrail(original, pitch(1), 1000);
    expect(original).toHaveLength(0);

    const trail = updateTrail([], pitch(1), 1000);
    const copy = [...trail];
    updateTrail(trail, pitch(1), 1500);
    expect(trail).toEqual(copy); // input unchanged
  });

  it('does not mutate the last note object when extending endMs', () => {
    const trail = updateTrail([], pitch(1), 1000);
    const originalNote = trail[0];
    const updated = updateTrail(trail, pitch(1), 2000);
    expect(updated[0]).not.toBe(originalNote); // new object
    expect(originalNote.endMs).toBe(1000); // original unchanged
  });
});
