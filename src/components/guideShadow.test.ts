import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HIT_LATE_MS } from '../services/scoring';
import { SoundFX } from '../services/synthAudio';
import type { NoteEvent } from '../services/tabsApi';
import { computeGuide, createGuideFrame, drawGuide, GUIDE_APPROACH_MS, GUIDE_FAR_OPACITY, GUIDE_FAR_SIZE, GUIDE_HOP_MS, GUIDE_PULSE_MS } from './guideShadow';
import type { NoteState } from './noteStyles';
import { layoutLanes, playHitFeedback, stringY, type HitEffects } from './practiceLanes';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';

beforeAll(installPath2D);

const note = (id: string, timeMs: number, string: number, over: Partial<NoteEvent> = {}): NoteEvent => ({
  id, timeMs, durationMs: 200, string, fret: 3, midiNote: 60, freqHz: 261, noteName: 'C4', ...over
});
const NONE: ReadonlyMap<string, NoteState> = new Map();

describe('computeGuide', () => {
  const notes = [note('a', 1000, 3), note('b', 2000, 5), note('c', 2000, 2, { chordMember: true }), note('d', 3000, 1)];

  it('has nothing to show when no note is left', () => {
    const frame = createGuideFrame();
    expect(computeGuide([], NONE, 0, 1, false, frame)).toBe(false);
    const done = new Map<string, NoteState>(notes.map((n) => [n.id, 'perfect']));
    expect(computeGuide(notes, done, 0, 1, false, frame)).toBe(false);
  });

  it('points at the next pending note and skips the ones already judged', () => {
    const frame = createGuideFrame();
    expect(computeGuide(notes, NONE, 900, 1, false, frame)).toBe(true);
    expect(frame.strings[0]).toBe(3);
    const states = new Map<string, NoteState>([['a', 'perfect']]);
    computeGuide(notes, states, 1100, 1, false, frame);
    expect(frame.strings[0]).toBe(5);
    expect(frame.fromString).toBe(3);
  });

  it('shows every string of a chord and never aims at dead or grace notes', () => {
    const frame = createGuideFrame();
    const withNoise = [note('x', 500, 6, { dead: true }), note('g', 600, 4, { grace: true }), ...notes];
    computeGuide(withNoise, NONE, 0, 1, false, frame);
    expect(frame.strings[0]).toBe(3);
    computeGuide(withNoise, new Map<string, NoteState>([['a', 'perfect']]), 1500, 1, false, frame);
    expect(frame.count).toBe(2);
    expect([...frame.strings.slice(0, 2)]).toEqual([5, 2]);
  });

  it('lands on the note at exactly its time and is on its way before that', () => {
    const frame = createGuideFrame();
    const states = new Map<string, NoteState>([['a', 'perfect']]);
    computeGuide(notes, states, 2000 - GUIDE_HOP_MS - 1, 1, false, frame);
    expect(frame.hop).toBe(0);
    computeGuide(notes, states, 2000 - GUIDE_HOP_MS / 2, 1, false, frame);
    expect(frame.hop).toBeGreaterThan(0.3);
    expect(frame.hop).toBeLessThan(0.7);
    computeGuide(notes, states, 2000, 1, false, frame);
    expect(frame.hop).toBe(1);
  });

  it('keeps the hop the same in real time at another speed', () => {
    const frame = createGuideFrame();
    const states = new Map<string, NoteState>([['a', 'perfect']]);
    // At half speed the song moves half as fast, so the same real hop is half as long in song time
    computeGuide(notes, states, 2000 - GUIDE_HOP_MS * 0.5 - 1, 0.5, false, frame);
    expect(frame.hop).toBe(0);
    computeGuide(notes, states, 2000 - GUIDE_HOP_MS * 0.25, 0.5, false, frame);
    expect(frame.hop).toBeGreaterThan(0.3);
  });

  it('shows up as the note comes and pulses once it is due', () => {
    const frame = createGuideFrame();
    computeGuide(notes, NONE, 1000 - GUIDE_APPROACH_MS - 100, 1, false, frame);
    expect(frame.visibility).toBe(0);
    computeGuide(notes, NONE, 1000 - 100, 1, false, frame);
    expect(frame.visibility).toBe(1);
    expect(frame.pulse).toBe(0);
    computeGuide(notes, NONE, 1000, 1, false, frame);
    expect(frame.pulse).toBe(1);
    computeGuide(notes, NONE, 1000 + GUIDE_PULSE_MS / 2, 1, false, frame);
    expect(frame.pulse).toBeCloseTo(0.5, 1);
  });

  it('does not wait on a note that is a miss by now, even with no states', () => {
    const frame = createGuideFrame();
    computeGuide(notes, NONE, 1000 + HIT_LATE_MS + 10, 1, false, frame);
    expect(frame.strings[0]).toBe(5);
  });

  it('with reduced motion only changes place: no hop, no pulse', () => {
    const frame = createGuideFrame();
    computeGuide(notes, new Map<string, NoteState>([['a', 'perfect']]), 1500, 1, true, frame);
    expect(frame.hop).toBe(1);
    computeGuide(notes, NONE, 1000, 1, true, frame);
    expect(frame.pulse).toBe(0);
  });
});

describe('drawGuide', () => {
  const [lane] = layoutLanes(400, [6]);
  const upcoming = [note('a', 1000, 3), note('b', 2000, 5)];

  it('draws nothing while hidden, and draws on the string of the note once it shows', () => {
    const frame = createGuideFrame();
    computeGuide(upcoming, NONE, -5000, 1, false, frame);
    const hidden = createRecorder();
    drawGuide(hidden.ctx, frame, lane, 300, 100, ORIGINAL_PALETTE.signal, 2, 40, false);
    expect(hidden.log).toEqual([]);
    computeGuide(upcoming, NONE, 1000, 1, false, frame);
    const shown = createRecorder();
    drawGuide(shown.ctx, frame, lane, 300, 0, ORIGINAL_PALETTE.signal, 2, 40, false, 'hologram');
    expect(shown.log.some((line) => line.startsWith(`ellipse(300,${stringY(lane, 3)}`))).toBe(true);
  });

  it('is stronger at a higher intensity and never creates a gradient', () => {
    const frame = createGuideFrame();
    computeGuide(upcoming, NONE, 1000, 1, false, frame);
    const blur = (intensity: 1 | 2 | 3) => {
      const rec = createRecorder();
      drawGuide(rec.ctx, frame, lane, 300, 200, ORIGINAL_PALETTE.signal, intensity, 40, false, 'hologram');
      expect(rec.log.some((line) => line.startsWith('createLinearGradient') || line.startsWith('createRadialGradient'))).toBe(false);
      return Math.max(...rec.log.filter((line) => line.startsWith('shadowBlur=')).map((line) => Number(line.split('=')[1])));
    };
    expect(blur(3)).toBeGreaterThan(blur(1));
  });
});

describe('the dark body while the note is still far', () => {
  const [lane] = layoutLanes(400, [6]);
  const upcoming = [note('a', 3000, 3)];
  const bodyAt = (positionMs: number) => {
    const frame = createGuideFrame();
    computeGuide(upcoming, NONE, positionMs, 1, false, frame);
    const rec = createRecorder();
    drawGuide(rec.ctx, frame, lane, 300, 100, ORIGINAL_PALETTE.signal, 2, 40, false, 'shadow');
    const alphas = rec.log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.split('=')[1]));
    return { proximity: frame.proximity, maxAlpha: Math.max(0, ...alphas), log: rec.log };
  };

  it('has a proximity of 0 as it first shows and 1 as the note is due', () => {
    expect(bodyAt(3000 - GUIDE_APPROACH_MS).proximity).toBeCloseTo(0, 5);
    expect(bodyAt(3000 - GUIDE_APPROACH_MS / 2).proximity).toBeCloseTo(0.5, 5);
    expect(bodyAt(3000).proximity).toBe(1);
    expect(bodyAt(3000 + 100).proximity).toBe(1); // past the line: full weight
  });

  it('is lighter far from the note and reaches the full opacity as it arrives', () => {
    const far = bodyAt(3000 - GUIDE_APPROACH_MS * 0.6); // visible, a good way off
    const near = bodyAt(3000 - 40);
    const due = bodyAt(3000);
    expect(far.maxAlpha).toBeLessThan(near.maxAlpha);
    expect(near.maxAlpha).toBeLessThanOrEqual(due.maxAlpha + 1e-9);
    expect(far.maxAlpha).toBeGreaterThan(0);
    expect(far.maxAlpha / due.maxAlpha).toBeLessThan(0.8);
    expect(far.maxAlpha / due.maxAlpha).toBeGreaterThanOrEqual(GUIDE_FAR_OPACITY - 1e-9);
  });

  it('is a little smaller far away, and never smaller than its far size', () => {
    expect(GUIDE_FAR_SIZE).toBeGreaterThan(0.5);
    expect(GUIDE_FAR_SIZE).toBeLessThan(1);
  });
});

describe('guide over simultaneous notes', () => {
  const [lane] = layoutLanes(400, [6]);
  const chord = (time: number, strings: number[]) =>
    strings.map((string, i) => note(`c${time}-${string}`, time, string, i === 0 ? {} : { chordMember: true }));

  it('covers every note of a chord of 2, 3 and 6, not only its first', () => {
    for (const strings of [[3, 2], [4, 3, 2], [6, 5, 4, 3, 2, 1]]) {
      const frame = createGuideFrame();
      expect(computeGuide(chord(1000, strings), NONE, 900, 1, false, frame)).toBe(true);
      expect(frame.count).toBe(strings.length);
      expect([...frame.strings.slice(0, frame.count)].sort()).toEqual([...strings].sort());
      expect(frame.toLo).toBe(Math.min(...strings));
      expect(frame.toHi).toBe(Math.max(...strings));
    }
  });

  it('covers non adjacent strings and plain simultaneous notes that are not marked as a chord', () => {
    const frame = createGuideFrame();
    const notes = [note('a', 1000, 6), note('b', 1000, 2), note('c', 1010, 4)];
    computeGuide(notes, NONE, 900, 1, false, frame);
    expect(frame.count).toBe(3);
    expect([frame.toLo, frame.toHi]).toEqual([2, 6]);
  });

  it('does not take notes of the next beat into the set', () => {
    const frame = createGuideFrame();
    computeGuide([...chord(1000, [3, 2]), note('n', 1200, 5)], NONE, 900, 1, false, frame);
    expect(frame.count).toBe(2);
  });

  it('hops as a set: from a single note to a chord and from a chord to a single note', () => {
    const notes = [note('a', 1000, 5), ...chord(2000, [4, 3, 2]), note('z', 3000, 1)];
    const frame = createGuideFrame();
    computeGuide(notes, new Map<string, NoteState>([['a', 'perfect']]), 1900, 1, false, frame);
    expect([frame.fromLo, frame.fromHi, frame.toLo, frame.toHi]).toEqual([5, 5, 2, 4]);
    const judged = new Map<string, NoteState>([['a', 'perfect'], ['c2000-4', 'perfect'], ['c2000-3', 'perfect'], ['c2000-2', 'perfect']]);
    computeGuide(notes, judged, 2900, 1, false, frame);
    expect([frame.fromLo, frame.fromHi, frame.toLo, frame.toHi]).toEqual([2, 4, 1, 1]);
  });

  it('keeps the set whole and still lands exactly on its time at 0.5x and 2x', () => {
    const notes = [note('a', 1000, 5), ...chord(2000, [4, 2])];
    const states = new Map<string, NoteState>([['a', 'perfect']]);
    for (const speed of [0.5, 2]) {
      const frame = createGuideFrame();
      computeGuide(notes, states, 2000 - GUIDE_HOP_MS * speed - 1, speed, false, frame);
      expect(frame.hop).toBe(0);
      expect(frame.count).toBe(2);
      computeGuide(notes, states, 2000, speed, false, frame);
      expect(frame.hop).toBe(1);
    }
  });

  it('with reduced motion sits on the whole set at once', () => {
    const frame = createGuideFrame();
    computeGuide([note('a', 1000, 5), ...chord(2000, [4, 2])], new Map<string, NoteState>([['a', 'perfect']]), 1500, 1, true, frame);
    expect(frame.hop).toBe(1);
    expect(frame.count).toBe(2);
  });

  it('draws one shape from the highest to the lowest string of the set, in both styles', () => {
    const frame = createGuideFrame();
    computeGuide(chord(1000, [5, 1]), NONE, 1000, 1, false, frame);
    const top = stringY(lane, 1);
    const bottom = stringY(lane, 5);
    for (const style of ['hologram', 'shadow'] as const) {
      const rec = createRecorder();
      drawGuide(rec.ctx, frame, lane, 300, 0, ORIGINAL_PALETTE.signal, 2, 40, true, style);
      if (style === 'hologram') {
        const ys = rec.log.filter((line) => line.startsWith('ellipse(300,')).map((line) => Number(line.split(',')[1]));
        expect(Math.min(...ys)).toBeLessThanOrEqual(top + 40 * 0.1);
        expect(Math.max(...ys)).toBeGreaterThanOrEqual(bottom);
        expect(rec.log.some((line) => line.startsWith('rect('))).toBe(true);
      } else {
        // The shadow is one rounded rectangle that reaches past the highest and the lowest string
        const [, y, , height] = (rec.log.find((line) => line.startsWith('roundRect(')) ?? '').slice(10, -1).split(',').map(Number);
        expect(y).toBeLessThanOrEqual(top);
        expect(y + height).toBeGreaterThanOrEqual(bottom);
      }
    }
  });
});

describe('drawGuide styles', () => {
  const [lane] = layoutLanes(400, [6]);
  const frame = createGuideFrame();
  computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, frame);

  it('the shadow is dark with soft edges and an outline; the hologram keeps its glow', () => {
    const shadow = createRecorder();
    drawGuide(shadow.ctx, frame, lane, 300, 100, ORIGINAL_PALETTE.signal, 3, 40, false, 'shadow');
    expect(shadow.log).toContain('fillStyle=#000000');
    expect(shadow.log.some((line) => line.startsWith('shadowBlur=') && Number(line.split('=')[1]) > 0)).toBe(true);
    expect(shadow.log.some((line) => line.startsWith('stroke'))).toBe(true);
    const hologram = createRecorder();
    drawGuide(hologram.ctx, frame, lane, 300, 100, ORIGINAL_PALETTE.signal, 3, 40, false, 'hologram');
    expect(hologram.log.some((line) => line.startsWith('shadowBlur=') && Number(line.split('=')[1]) > 0)).toBe(true);
  });

  it('a single note is still one ellipse per layer in the hologram, as before', () => {
    const rec = createRecorder();
    drawGuide(rec.ctx, frame, lane, 300, 0, ORIGINAL_PALETTE.signal, 2, 40, false, 'hologram');
    expect(rec.log.filter((line) => line.startsWith('ellipse(300,')).length).toBe(2); // halo and core
  });
});

describe('playHitFeedback sound', () => {
  const effects = (): HitEffects => ({ particles: [], texts: [] });
  const target = note('s', 0, 1);

  it('plays the judgement sounds by default', () => {
    const perfect = vi.spyOn(SoundFX, 'playPerfectHit').mockImplementation(() => undefined);
    const miss = vi.spyOn(SoundFX, 'playMissSound').mockImplementation(() => undefined);
    playHitFeedback('perfect', target, 300, 100, ORIGINAL_PALETTE, effects());
    playHitFeedback('good', target, 300, 100, ORIGINAL_PALETTE, effects());
    playHitFeedback('miss', target, 300, 100, ORIGINAL_PALETTE, effects());
    expect(perfect).toHaveBeenCalledTimes(2);
    expect(miss).toHaveBeenCalledTimes(1);
    perfect.mockRestore();
    miss.mockRestore();
  });

  it('is silent when sounds are off, and still shows the sparks and the text', () => {
    const perfect = vi.spyOn(SoundFX, 'playPerfectHit').mockImplementation(() => undefined);
    const miss = vi.spyOn(SoundFX, 'playMissSound').mockImplementation(() => undefined);
    const fx = effects();
    for (const judgement of ['perfect', 'good', 'miss'] as const) playHitFeedback(judgement, target, 300, 100, ORIGINAL_PALETTE, fx, false);
    expect(perfect).not.toHaveBeenCalled();
    expect(miss).not.toHaveBeenCalled();
    expect(fx.texts).toHaveLength(3);
    expect(fx.particles.length).toBeGreaterThan(0);
    perfect.mockRestore();
    miss.mockRestore();
  });
});
