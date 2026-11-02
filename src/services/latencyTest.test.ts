import { describe, expect, it } from 'vitest';
import type { DetectedPitch } from './audioEngine';
import { LATENCY_SAMPLES_MAX, LATENCY_SAMPLES_STEP } from './audioDevices';
import {
  NOTE_INTERVAL_MS,
  TEST_NOTE_COUNT,
  WARM_UP_NOTES,
  createAttackTracker,
  emptyOffsets,
  latencySettings,
  noteForHit,
  readAttack,
  summarizeTest,
  testNoteTime
} from './latencyTest';

const pitch = (attackId: number, midiNote = 45, volume = 0.3): DetectedPitch =>
  ({ attackId, midiNote, volume, frequency: 110, noteName: 'A2', cents: 0, clarity: 0.95 });

const withWarmUp = (offsets: (number | null)[]): (number | null)[] => [null, null, ...offsets];
const repeated = (value: number | null, count = TEST_NOTE_COUNT - WARM_UP_NOTES) => Array.from({ length: count }, () => value);

describe('noteForHit', () => {
  it('finds the note a hit belongs to', () => {
    expect(noteForHit(emptyOffsets(), testNoteTime(0) + 90)).toBe(0);
    expect(noteForHit(emptyOffsets(), testNoteTime(3) + 90)).toBe(3);
  });

  it('takes a hit a little before the line, since a player can be early', () => {
    expect(noteForHit(emptyOffsets(), testNoteTime(2) - 200)).toBe(2);
  });

  it('never gives a note two hits: the second attack of a double pick finds no note', () => {
    const offsets = emptyOffsets();
    offsets[0] = 90;
    expect(noteForHit(offsets, testNoteTime(0) + 140)).toBeNull();
  });

  it('ignores a hit before the first note and after the last', () => {
    expect(noteForHit(emptyOffsets(), testNoteTime(0) - 500)).toBeNull();
    expect(noteForHit(emptyOffsets(), testNoteTime(TEST_NOTE_COUNT - 1) + 650)).toBeNull();
  });

  it('keeps the windows of two notes from overlapping', () => {
    for (let index = 0; index + 1 < TEST_NOTE_COUNT; index += 1) expect(testNoteTime(index + 1) - testNoteTime(index)).toBe(NOTE_INTERVAL_MS);
    expect(400 + 600).toBeLessThanOrEqual(NOTE_INTERVAL_MS);
  });
});

describe('readAttack', () => {
  it('does not count the attack that was ringing when the test started', () => {
    const tracker = createAttackTracker(pitch(7));
    expect(readAttack(tracker, pitch(7), 1000).hitMs).toBeNull();
  });

  it('dates the hit to the first frame of a new attack, once a second reading agrees', () => {
    const first = readAttack(createAttackTracker(pitch(7)), pitch(8), 1000);
    expect(first.hitMs).toBeNull();
    const second = readAttack(first.tracker, pitch(8), 1016);
    expect(second.hitMs).toBe(1000);
  });

  it('waits for the note when the first reading is a stray one, as scoring would', () => {
    const noise = readAttack(createAttackTracker(pitch(7)), pitch(8, 70), 1000);
    const note = readAttack(noise.tracker, pitch(8, 45), 1016);
    expect(note.hitMs).toBeNull();
    expect(readAttack(note.tracker, pitch(8, 45), 1032).hitMs).toBe(1016);
  });

  it('counts each attack once', () => {
    let reading = readAttack(createAttackTracker(pitch(7)), pitch(8), 1000);
    reading = readAttack(reading.tracker, pitch(8), 1016);
    expect(readAttack(reading.tracker, pitch(8), 1032).hitMs).toBeNull();
  });

  it('ignores silence', () => {
    expect(readAttack(createAttackTracker(null), null, 1000).hitMs).toBeNull();
    const faint = readAttack(createAttackTracker(null), pitch(8, 45, 0.001), 1000);
    expect(readAttack(faint.tracker, pitch(8, 45, 0.001), 1016).hitMs).toBeNull();
  });

  it('counts the first attack of a session', () => {
    const first = readAttack(createAttackTracker(null), pitch(1), 1000);
    expect(readAttack(first.tracker, pitch(1), 1016).hitMs).toBe(1000);
  });
});

describe('summarizeTest', () => {
  it('gives the latency of a steady player', () => {
    const result = summarizeTest(withWarmUp([84, 90, 96, 88, 92, 86, 94, 90, 88, 92]));
    expect(result).toMatchObject({ verdict: 'ok', latencyMs: 90, heard: 10, expected: 10 });
    expect(result.spreadMs).toBeLessThanOrEqual(4);
  });

  it('leaves the warm-up out', () => {
    expect(summarizeTest([900, 900, ...repeated(90)]).latencyMs).toBe(90);
  });

  it('is not moved by a slip of the hand', () => {
    expect(summarizeTest(withWarmUp([90, 92, 88, 91, 89, 90, 92, 88, 420, -310])).latencyMs).toBe(90);
  });

  it('says so when the player was not steady, instead of offering a number as good', () => {
    const result = summarizeTest(withWarmUp([-120, 240, 30, 180, -60, 300, 90, -150, 210, 20]));
    expect(result.verdict).toBe('unsteady');
  });

  it('says so when too few notes were heard', () => {
    expect(summarizeTest(withWarmUp([90, 92, 88, null, null, null, null, null, null, null]))).toMatchObject({ verdict: 'few', heard: 3 });
    expect(summarizeTest(emptyOffsets())).toMatchObject({ verdict: 'few', heard: 0, latencyMs: 0 });
  });

  it('accepts a few missed notes', () => {
    expect(summarizeTest(withWarmUp([90, null, 92, 88, null, 91, 89, null, 90, 92]))).toMatchObject({ verdict: 'ok', heard: 7 });
  });

  it('never gives a negative latency to a player who plays ahead of the line', () => {
    expect(summarizeTest(withWarmUp(repeated(-40))).latencyMs).toBe(0);
  });
});

describe('latencySettings', () => {
  it('turns milliseconds into samples, on the steps of the slider', () => {
    const { inputLatencySamples, outputLatencySamples } = latencySettings(90, 48000);
    expect(inputLatencySamples).toBe(4320);
    expect(outputLatencySamples).toBe(0);
    expect(inputLatencySamples % LATENCY_SAMPLES_STEP).toBe(0);
  });

  it('follows the sample rate', () => {
    expect(latencySettings(100, 44100).inputLatencySamples).toBe(4416);
  });

  it('uses the second setting when the first one is full', () => {
    const { inputLatencySamples, outputLatencySamples } = latencySettings(300, 48000);
    expect(inputLatencySamples).toBe(LATENCY_SAMPLES_MAX);
    expect(outputLatencySamples).toBe(14400 - LATENCY_SAMPLES_MAX);
  });

  it('stops at what the settings can hold', () => {
    const { inputLatencySamples, outputLatencySamples } = latencySettings(2000, 48000);
    expect(inputLatencySamples).toBe(LATENCY_SAMPLES_MAX);
    expect(outputLatencySamples).toBe(LATENCY_SAMPLES_MAX);
  });

  it('clears both for a player with no latency', () => {
    expect(latencySettings(0, 48000)).toEqual({ inputLatencySamples: 0, outputLatencySamples: 0 });
  });
});
