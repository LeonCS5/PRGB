import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS, getSessionSettings, isLegendSeen, LEGEND_KEY, markLegendSeen, saveSessionSettings, ZOOM_AUTO, ZOOM_OPTIONS
} from './sessionSettings';

describe('session settings', () => {
  it('starts every unknown session from the defaults, and never shares the object', () => {
    const first = getSessionSettings(9001);
    expect(first).toEqual(DEFAULT_SESSION_SETTINGS);
    first.speed = 0.5;
    expect(getSessionSettings(9001)).toEqual(DEFAULT_SESSION_SETTINGS);
    expect(getSessionSettings(null)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('gives the next exercise of a session what the player chose in the one before', () => {
    saveSessionSettings(9002, { speed: 0.75, metronome: true, synth: false, training: true, zoom: 1.25 });
    expect(getSessionSettings(9002)).toEqual({ speed: 0.75, metronome: true, synth: false, training: true, zoom: 1.25 });
    expect(getSessionSettings(9003)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('ignores a speed the game does not offer', () => {
    saveSessionSettings(9004, { speed: 3, metronome: true, synth: true, training: false, zoom: 1 });
    expect(getSessionSettings(9004)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('starts on the automatic zoom, and remembers it like any other choice', () => {
    expect(DEFAULT_SESSION_SETTINGS.zoom).toBe(ZOOM_AUTO);
    expect(ZOOM_OPTIONS[0]).toBe(ZOOM_AUTO);
    saveSessionSettings(9006, { speed: 1, metronome: false, synth: true, training: false, zoom: 1.5 });
    saveSessionSettings(9006, { speed: 1, metronome: false, synth: true, training: false, zoom: ZOOM_AUTO });
    expect(getSessionSettings(9006).zoom).toBe(ZOOM_AUTO);
  });

  it('still accepts the fixed zooms the game offered before Auto', () => {
    for (const zoom of [0.75, 1, 1.25, 1.5]) {
      saveSessionSettings(9007, { speed: 1, metronome: false, synth: true, training: false, zoom });
      expect(getSessionSettings(9007).zoom).toBe(zoom);
    }
  });

  it('ignores a zoom the game does not offer', () => {
    saveSessionSettings(9005, { speed: 1, metronome: true, synth: true, training: false, zoom: 4 });
    expect(getSessionSettings(9005)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('forgets the oldest sessions', () => {
    saveSessionSettings(100, { speed: 0.5, metronome: false, synth: true, training: false, zoom: 1 });
    for (let id = 101; id < 115; id++) saveSessionSettings(id, DEFAULT_SESSION_SETTINGS);
    expect(getSessionSettings(100).speed).toBe(1);
  });
});

describe('first-run legend flag', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubStorage = (store: Record<string, string>) => vi.stubGlobal('window', {
    localStorage: { getItem: (key: string) => store[key] ?? null, setItem: (key: string, value: string) => { store[key] = value; } }
  });

  it('is unseen until dismissed, then stays seen', () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    expect(isLegendSeen()).toBe(false);
    markLegendSeen();
    expect(store[LEGEND_KEY]).toBe('1');
    expect(isLegendSeen()).toBe(true);
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('window', { get localStorage(): never { throw new Error('blocked'); } });
    expect(isLegendSeen()).toBe(false);
    expect(() => markLegendSeen()).not.toThrow();
  });
});
