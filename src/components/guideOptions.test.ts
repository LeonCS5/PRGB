import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_GUIDE, DEFAULT_GUIDE_SHADOW } from '../appearance/defaults';
import { GUIDE_PRESET_IDS, GUIDE_PRESETS, getGuidePreset, matchGuidePreset } from '../appearance/guidePresets';
import type { AppearanceSettings, GuideShadowSettings } from '../appearance/types';
import { validateAppearance } from '../appearance/validate';
import { GuideSection } from './appearance/GuideSection';
import { guideSummaries } from './appearance/guideSummaries';
import { computeGuide, createGuideFrame, drawGuide } from './guideShadow';
import { layoutLanes, stringY } from './practiceLanes';
import type { NoteState } from './noteStyles';
import { createRecorder, installPath2D, ORIGINAL_PALETTE } from './testCanvas';
import type { NoteEvent } from '../services/tabsApi';

beforeAll(installPath2D);

const note = (id: string, timeMs: number, string: number): NoteEvent => ({
  id, timeMs, durationMs: 250, string, fret: 3, midiNote: 60, freqHz: 261, noteName: 'C4'
}) as NoteEvent;
const NONE: ReadonlyMap<string, NoteState> = new Map();
const [lane] = layoutLanes(400, [6]);
const withShadow = (overrides: Partial<GuideShadowSettings>): GuideShadowSettings => ({ ...DEFAULT_GUIDE_SHADOW, ...overrides });

describe('guide shadow settings', () => {
  it('the default is the "Destaque" look: bigger than the note, with a visible rim, on top of every other option', () => {
    expect(DEFAULT_GUIDE.shadow.width).toBeGreaterThan(100);
    expect(DEFAULT_GUIDE.shadow.height).toBeGreaterThan(100);
    expect(DEFAULT_GUIDE.shadow.outline).toBe(true);
    expect(matchGuidePreset(DEFAULT_GUIDE)).toBe('highlight');
  });

  it('an old look without the detailed options gets the defaults for all of them', () => {
    const migrated = validateAppearance({ guide: { enabled: false, intensity: 3, style: 'hologram' } });
    expect(migrated.guide).toEqual({ enabled: false, intensity: 3, style: 'hologram', shadow: DEFAULT_GUIDE_SHADOW });
  });

  it('validates every option on its own: a bad one goes back to its default and the rest is kept', () => {
    const result = validateAppearance({
      guide: { shadow: { opacity: 55, color: 'violet', width: 500, height: 150, blur: 'soft', offsetX: -20, shape: 'star', outlineWidth: 4,
        trailLength: 45, hopMs: 250, easing: 'elastic', chordCover: 'played', showNext: true, pulse: 'yes' } }
    }).guide.shadow;
    expect(result).toMatchObject({
      opacity: 55, color: 'violet', width: DEFAULT_GUIDE_SHADOW.width, height: 150, blur: DEFAULT_GUIDE_SHADOW.blur, offsetX: -20,
      shape: DEFAULT_GUIDE_SHADOW.shape, outlineWidth: 4, trailLength: DEFAULT_GUIDE_SHADOW.trailLength, hopMs: 250, easing: 'elastic',
      chordCover: 'played', showNext: true, pulse: DEFAULT_GUIDE_SHADOW.pulse
    });
  });

  it('keeps ranges and steps: values off the step or out of range are not accepted', () => {
    const read = (shadow: Record<string, unknown>) => validateAppearance({ guide: { shadow } }).guide.shadow;
    expect(read({ hopMs: 99 }).hopMs).toBe(DEFAULT_GUIDE_SHADOW.hopMs);
    expect(read({ hopMs: 601 }).hopMs).toBe(DEFAULT_GUIDE_SHADOW.hopMs);
    expect(read({ hopMs: 600 }).hopMs).toBe(600);
    expect(read({ opacity: 19 }).opacity).toBe(DEFAULT_GUIDE_SHADOW.opacity);
    expect(read({ opacity: 22 }).opacity).toBe(DEFAULT_GUIDE_SHADOW.opacity);
    expect(read({ offsetY: -50 }).offsetY).toBe(-50);
    expect(read({ outlineWidth: 7 }).outlineWidth).toBe(DEFAULT_GUIDE_SHADOW.outlineWidth);
    expect(read({ color: 'pink' }).color).toBe(DEFAULT_GUIDE_SHADOW.color);
    expect(validateAppearance({ guide: { shadow: 'x' } }).guide.shadow).toEqual(DEFAULT_GUIDE_SHADOW);
  });
});

describe('guide presets', () => {
  it('has the five looks, each a valid set of options that is recognised back', () => {
    expect(GUIDE_PRESETS.map((preset) => preset.id)).toEqual([...GUIDE_PRESET_IDS]);
    for (const preset of GUIDE_PRESETS) {
      const guide = { ...DEFAULT_GUIDE, style: preset.style, shadow: { ...preset.shadow } };
      expect(validateAppearance({ guide }).guide.shadow).toEqual(preset.shadow);
      expect(matchGuidePreset(guide)).toBe(preset.id);
    }
  });

  it('Destaque is the default, Neon is the hologram, and the others are shadows', () => {
    expect(getGuidePreset('highlight').shadow).toEqual(DEFAULT_GUIDE_SHADOW);
    expect(getGuidePreset('neon').style).toBe('hologram');
    for (const id of ['discreet', 'highlight', 'cinema', 'outline'] as const) expect(getGuidePreset(id).style).toBe('shadow');
  });

  it('touching any single option leaves every preset: the look is "Personalizada"', () => {
    const base = { ...DEFAULT_GUIDE, shadow: { ...DEFAULT_GUIDE_SHADOW } };
    expect(matchGuidePreset({ ...base, shadow: { ...base.shadow, opacity: 85 } })).toBeNull();
    expect(matchGuidePreset({ ...base, style: 'hologram' })).toBeNull();
  });
});

describe('computeGuide with options', () => {
  const notes = [note('a', 1000, 5), note('b', 2000, 3)];
  const states = new Map<string, NoteState>([['a', 'perfect']]);

  it('the hop starts as early as the option says, and lands exactly on the note whatever the curve', () => {
    for (const easing of ['smooth', 'snap', 'elastic'] as const) {
      const shadow = withShadow({ hopMs: 500, easing });
      const frame = createGuideFrame();
      computeGuide(notes, states, 2000 - 501, 1, false, frame, shadow);
      expect(frame.hop).toBe(0);
      computeGuide(notes, states, 2000, 1, false, frame, shadow);
      expect(frame.hop).toBe(1);
      computeGuide(notes, states, 2000 - 50, 1, false, frame, shadow);
      expect(frame.hop).toBeGreaterThan(0);
    }
  });

  it('the elastic curve passes the note a little before it settles, and the snap one waits', () => {
    const frame = createGuideFrame();
    const at = (easing: 'snap' | 'elastic' | 'smooth', ms: number) => {
      computeGuide(notes, states, ms, 1, false, frame, withShadow({ easing }));
      return frame.hop;
    };
    const mid = 2000 - 280 * 0.2;
    expect(at('elastic', mid)).toBeGreaterThan(1);
    expect(at('snap', 2000 - 280 * 0.6)).toBeLessThan(at('smooth', 2000 - 280 * 0.6));
  });

  it('the pulse option turns the pulse off', () => {
    const frame = createGuideFrame();
    computeGuide(notes, NONE, 1000 + 50, 1, false, frame, withShadow({ pulse: false }));
    expect(frame.pulse).toBe(0);
    computeGuide(notes, NONE, 1000 + 50, 1, false, frame, withShadow({ pulse: true }));
    expect(frame.pulse).toBeGreaterThan(0);
  });

  it('finds the set after the next one only when the preview of the next is on', () => {
    const three = [note('a', 1000, 5), note('b', 2000, 3), note('c', 3000, 1), note('d', 3000, 4)];
    const frame = createGuideFrame();
    computeGuide(three, NONE, 900, 1, false, frame, withShadow({ showNext: false }));
    expect(frame.hasNext).toBe(false);
    computeGuide(three, NONE, 900, 1, false, frame, withShadow({ showNext: true }));
    expect(frame.hasNext).toBe(true);
    expect([frame.nextLo, frame.nextHi]).toEqual([3, 3]);
    computeGuide(three, new Map<string, NoteState>([['a', 'perfect']]), 1900, 1, false, frame, withShadow({ showNext: true }));
    expect([frame.nextLo, frame.nextHi]).toEqual([1, 4]);
    computeGuide(three, new Map<string, NoteState>([['a', 'perfect'], ['b', 'perfect']]), 2900, 1, false, frame, withShadow({ showNext: true }));
    expect(frame.hasNext).toBe(false);
  });
});

describe('drawGuide with options', () => {
  const frame = createGuideFrame();
  computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, frame);
  const draw = (shadow: GuideShadowSettings, style: 'shadow' | 'hologram' = 'shadow', target = frame, noteStyle: 'classic' | 'digital' = 'classic') => {
    const rec = createRecorder();
    drawGuide(rec.ctx, target, lane, 300, 150, ORIGINAL_PALETTE.signal, 2, 40, false, style, {
      shadow, stringColors: ORIGINAL_PALETTE.strings, noteStyle
    });
    return rec.log;
  };
  const blurs = (log: string[]) => log.filter((line) => line.startsWith('shadowBlur=')).map((line) => Number(line.split('=')[1]));
  const roundRects = (log: string[]) => log.filter((line) => line.startsWith('roundRect(')).map((line) => line.slice(10, -1).split(',').map(Number));

  it('the body is bigger than the note by default and follows the width and the height options', () => {
    const [[x, , width, height]] = roundRects(draw(DEFAULT_GUIDE_SHADOW));
    expect(width).toBeGreaterThan(40);
    expect(height).toBeGreaterThan(40);
    const [[, , widerWidth]] = roundRects(draw(withShadow({ width: 180 })));
    const [[, , narrowWidth]] = roundRects(draw(withShadow({ width: 80 })));
    expect(widerWidth).toBeGreaterThan(width);
    expect(narrowWidth).toBeLessThan(width);
    expect(x + width / 2).toBeCloseTo(300, 5);
  });

  it('opacity, blur and offsets change what is drawn', () => {
    const alphas = (log: string[]) => log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.split('=')[1]));
    expect(Math.max(...alphas(draw(withShadow({ opacity: 100 }))))).toBeGreaterThan(Math.max(...alphas(draw(withShadow({ opacity: 30 })))));
    expect(Math.max(...blurs(draw(withShadow({ blur: 100 }))))).toBeGreaterThan(Math.max(...blurs(draw(withShadow({ blur: 10 })))));
    expect(Math.max(...blurs(draw(withShadow({ blur: 0 }))))).toBe(0);
    const [[left]] = roundRects(draw(withShadow({ offsetX: 0 })));
    const [[shiftedLeft]] = roundRects(draw(withShadow({ offsetX: 30 })));
    expect(shiftedLeft).toBeGreaterThan(left);
    const [[, top]] = roundRects(draw(withShadow({ offsetY: 0 })));
    const [[, loweredTop]] = roundRects(draw(withShadow({ offsetY: 30 })));
    expect(loweredTop).toBeGreaterThan(top);
  });

  it('the colour options set the fill, the string colour comes from the string of the note', () => {
    expect(draw(withShadow({ color: 'auto' }))).toContain('fillStyle=#000000');
    expect(draw(withShadow({ color: 'white' }))).toContain('fillStyle=#ffffff');
    expect(draw(withShadow({ color: 'string' }))).toContain(`fillStyle=${ORIGINAL_PALETTE.strings[2]}`); // string 3
    expect(draw(withShadow({ outlineColor: 'red' }))).toContain('strokeStyle=#ff4d6d');
  });

  it('the shape option picks the path: ellipse, rounded rectangle, capsule and the shape of the note style', () => {
    expect(draw(withShadow({ shape: 'ellipse' })).some((line) => line.startsWith('ellipse('))).toBe(true);
    const radius = (shape: GuideShadowSettings['shape'], noteStyle: 'classic' | 'digital' = 'classic') => roundRects(draw(withShadow({ shape }), 'shadow', frame, noteStyle))[0][4];
    expect(radius('rounded')).toBeLessThan(radius('capsule'));
    expect(radius('note', 'classic')).toBe(radius('capsule'));
    expect(radius('note', 'digital')).toBeLessThan(radius('rounded'));
  });

  it('the outline can be turned off and has the width asked for', () => {
    expect(draw(withShadow({ outline: false })).some((line) => line.startsWith('stroke'))).toBe(false);
    // The width is a share of the note (the 5 is for the size the widths were drawn for), never a fixed number of pixels
    expect(draw(withShadow({ outline: true, outlineWidth: 5 })).some((line) => line.startsWith('lineWidth=') && Math.abs(Number(line.split('=')[1]) - (5 * 40) / 46) < 1e-5)).toBe(true);
  });

  it('the trail can be turned off, and its length and opacity are the ones asked for', () => {
    const fills = (log: string[]) => log.filter((line) => line.startsWith('fillRect(')).length;
    expect(fills(draw(withShadow({ trail: false })))).toBe(0);
    expect(fills(draw(withShadow({ trail: true })))).toBeGreaterThan(0);
    const reach = (trailLength: number) => Math.max(...draw(withShadow({ trailLength })).filter((line) => line.startsWith('fillRect(')).map((line) => {
      const [x, , width] = line.slice(9, -1).split(',').map(Number);
      return x + width;
    }));
    expect(reach(100)).toBeGreaterThan(reach(30));
  });

  it('the pulse size follows its strength, and no pulse means a steady size', () => {
    const pulsing = createGuideFrame();
    computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, pulsing);
    const width = (shadow: GuideShadowSettings) => roundRects(draw(shadow, 'shadow', pulsing))[0][2];
    expect(width(withShadow({ pulseStrength: 100 }))).toBeGreaterThan(width(withShadow({ pulseStrength: 10 })));
    const quiet = createGuideFrame();
    computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, quiet, withShadow({ pulse: false }));
    expect(roundRects(draw(withShadow({ pulse: false }), 'shadow', quiet))[0][2]).toBeLessThan(width(withShadow({ pulseStrength: 100 })));
  });

  it('the ghost of the next note is drawn only when asked and when there is one', () => {
    const notes = [note('a', 1000, 3), note('b', 2000, 5)];
    const next = createGuideFrame();
    computeGuide(notes, NONE, 1000, 1, false, next, withShadow({ showNext: true }));
    const bodies = (shadow: GuideShadowSettings, target = next) => roundRects(draw(shadow, 'shadow', target)).length;
    expect(bodies(withShadow({ showNext: true }))).toBeGreaterThan(bodies(withShadow({ showNext: false })));
    const last = createGuideFrame();
    computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, last, withShadow({ showNext: true }));
    expect(bodies(withShadow({ showNext: true }), last)).toBe(bodies(withShadow({ showNext: false }), last));
  });

  it('a chord is one shape over the strings, or one per played string with "só as tocadas"', () => {
    const chord = createGuideFrame();
    computeGuide([note('a', 1000, 6), note('b', 1000, 1)], NONE, 1000, 1, false, chord);
    const between = roundRects(draw(withShadow({ outline: false, chordCover: 'between' }), 'shadow', chord));
    const played = roundRects(draw(withShadow({ outline: false, chordCover: 'played' }), 'shadow', chord));
    expect(between).toHaveLength(1);
    expect(played).toHaveLength(2);
    expect(between[0][3]).toBeGreaterThan(stringY(lane, 6) - stringY(lane, 1)); // covers all the strings in between
    expect(played[0][3]).toBeLessThan(between[0][3] / 2);
  });

  it('the hologram uses the options that fit it: its glow, its colour and its size, and ignores shape and outline', () => {
    const base = draw(withShadow({ preserveNote: false }), 'hologram');
    expect(base.some((line) => line.startsWith('roundRect('))).toBe(false);
    expect(base.some((line) => line.startsWith('stroke'))).toBe(false);
    expect(Math.max(...blurs(draw(withShadow({ glow: 100 }), 'hologram')))).toBeGreaterThan(Math.max(...blurs(draw(withShadow({ glow: 20 }), 'hologram'))));
    expect(draw(withShadow({ color: 'white' }), 'hologram')).toContain('fillStyle=#ffffff');
    const rx = (shadow: GuideShadowSettings) => Number(draw(shadow, 'hologram').find((line) => line.startsWith('ellipse(300,'))?.split(',')[2]);
    expect(rx(withShadow({ width: 180 }))).toBeGreaterThan(rx(withShadow({ width: 100 })));
  });

  it('draws nothing at all for a frame with no note, whatever the options', () => {
    const empty = createGuideFrame();
    expect(draw(withShadow({ showNext: true }), 'shadow', empty)).toEqual([]);
  });
});

describe('GuideSection', () => {
  const render = (settings: AppearanceSettings) => renderToStaticMarkup(createElement(GuideSection, { settings, onChange: () => {} }));

  it('shows the presets, the style, the intensity, the folded groups and the restore button', () => {
    const html = render(DEFAULT_APPEARANCE);
    for (const text of ['Sombra-guia', 'Predefinições', 'Discreta', 'Destaque', 'Cinema', 'Contorno', 'Neon', 'Estilo da sombra-guia', 'Intensidade da sombra-guia', 'Restaurar sombra']) {
      expect(html).toContain(text);
    }
    for (const group of ['Corpo', 'Rastro', 'Movimento', 'Acordes e próxima nota']) expect(html).toContain(group);
    expect(html).toContain('Predefinição <strong');
    expect(html.match(/<details/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toMatch(/<details[^>]* open/); // folded: the screen is not 20 controls at once
  });

  it('says "Personalizada" as soon as an option leaves the preset', () => {
    const html = render({ ...DEFAULT_APPEARANCE, guide: { ...DEFAULT_APPEARANCE.guide, shadow: { ...DEFAULT_GUIDE_SHADOW, opacity: 55 } } });
    expect(html).toContain('Personalizada');
  });

  it('shows nothing but the switch while the guide is off', () => {
    const html = render({ ...DEFAULT_APPEARANCE, guide: { ...DEFAULT_APPEARANCE.guide, enabled: false } });
    expect(html).toContain('Sombra-guia');
    expect(html).not.toContain('Predefinições');
    expect(html).not.toContain('Restaurar sombra');
  });

  it('the hologram shows its brightness and hides what only the shadow has', () => {
    const html = render({ ...DEFAULT_APPEARANCE, guide: { ...DEFAULT_APPEARANCE.guide, style: 'hologram' } });
    expect(html).toContain('Brilho');
    expect(html).not.toContain('Suavidade das bordas');
    expect(html).not.toContain('Cor do contorno');
    const shadow = render(DEFAULT_APPEARANCE);
    expect(shadow).toContain('Suavidade das bordas');
    expect(shadow).not.toContain('Só vale para o estilo Holograma');
  });

  it('summarises the values of each group, so the folded ones still say something', () => {
    const summaries = guideSummaries(DEFAULT_APPEARANCE.guide);
    expect(summaries.body).toContain('80%');
    expect(summaries.body).toContain('140×140%');
    expect(summaries.motion).toContain('280 ms');
    expect(guideSummaries({ ...DEFAULT_APPEARANCE.guide, shadow: { ...DEFAULT_GUIDE_SHADOW, trail: false, outline: false } })).toMatchObject({ trail: 'desligado', outline: 'desligado' });
  });
});

describe('"Preservar a nota"', () => {
  const frame = createGuideFrame();
  computeGuide([note('a', 1000, 3)], NONE, 1000, 1, false, frame);
  const draw = (shadow: GuideShadowSettings, style: 'shadow' | 'hologram') => {
    const rec = createRecorder();
    drawGuide(rec.ctx, frame, lane, 300, 150, ORIGINAL_PALETTE.signal, 3, 40, false, style, { shadow, stringColors: ORIGINAL_PALETTE.strings });
    return rec.log;
  };
  const alphas = (log: string[]) => log.filter((line) => line.startsWith('globalAlpha=')).map((line) => Number(line.split('=')[1]));

  it('is on by default, in the types and in the presets', () => {
    expect(DEFAULT_GUIDE_SHADOW.preserveNote).toBe(true);
    for (const preset of GUIDE_PRESETS) expect(preset.shadow.preserveNote).toBe(true);
    expect(validateAppearance({ guide: { shadow: { preserveNote: 'sim' } } }).guide.shadow.preserveNote).toBe(true);
    expect(validateAppearance({ guide: { shadow: { preserveNote: false } } }).guide.shadow.preserveNote).toBe(false);
  });

  it('turns the hologram into a ring: a faint fill and the light on the edge, with no dense core over the note', () => {
    const ring = draw(DEFAULT_GUIDE_SHADOW, 'hologram');
    const old = draw({ ...DEFAULT_GUIDE_SHADOW, preserveNote: false }, 'hologram');
    expect(ring.some((line) => line.startsWith('stroke'))).toBe(true);
    expect(old.some((line) => line.startsWith('stroke'))).toBe(false);
    // The old hologram filled a core over the middle of the note: two ellipse fills; the ring fills once (faint)
    expect(ring.filter((line) => line === 'fill()').length).toBe(1);
    expect(old.filter((line) => line === 'fill()').length).toBe(2);
    // What is filled is faint, so the note over it keeps its contrast
    expect(Math.min(...alphas(ring).filter((a) => a > 0))).toBeLessThanOrEqual(0.25);
  });

  it('keeps the dark body see-through, and with it off the body may be as dense as before', () => {
    // The opacity of the body itself: the globalAlpha in force at each fill() (the rim and the trail are other layers)
    const peak = (shadow: GuideShadowSettings) => {
      let current = 1;
      let top = 0;
      for (const line of draw(shadow, 'shadow')) {
        if (line.startsWith('globalAlpha=')) current = Number(line.split('=')[1]);
        else if (line === 'fill()') top = Math.max(top, current);
      }
      return top;
    };
    expect(peak({ ...DEFAULT_GUIDE_SHADOW, opacity: 100, preserveNote: true })).toBeLessThanOrEqual(0.85 + 1e-5);
    expect(peak({ ...DEFAULT_GUIDE_SHADOW, opacity: 100, preserveNote: false })).toBeGreaterThan(0.85);
  });
});
