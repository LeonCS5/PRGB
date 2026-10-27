import { describe, expect, it } from 'vitest';
import { DEMO_SONG_ID, getDemoSong } from './demoSong';

describe('getDemoSong', () => {
  const demo = getDemoSong();

  it('is a playable tab in standard tuning', () => {
    expect(demo.songId).toBe(DEMO_SONG_ID);
    expect(demo.tuning).toEqual([64, 59, 55, 50, 45, 40]);
    expect(demo.initialBpm).toBe(90);
    expect(demo.notes.length).toBeGreaterThan(30);
    // 7 bars of 4/4 at 90 BPM
    expect(demo.totalDurationMs).toBe(Math.round(7 * 4 * (60000 / 90)));
  });

  it('starts on the open low E and walks the A minor pentatonic box', () => {
    expect(demo.notes[0]).toMatchObject({ string: 6, fret: 0, noteName: 'E2' });
    const pentatonic = new Set([9, 0, 2, 4, 7]); // A C D E G
    for (const note of demo.notes) expect(pentatonic.has(note.midiNote % 12)).toBe(true);
  });

  it('includes the techniques the game renders', () => {
    expect(demo.notes.some((n) => n.hammerOnOrPullOff)).toBe(true);
    expect(demo.notes.some((n) => n.bendSemitones === 2)).toBe(true);
    expect(demo.notes.some((n) => n.vibrato)).toBe(true);
    expect(demo.beatGrid.filter((b) => b.accent)).toHaveLength(7);
  });

  it('returns independent copies', () => {
    const other = getDemoSong();
    other.notes[0].durationMs = 1;
    expect(getDemoSong().notes[0].durationMs).not.toBe(1);
  });
});
