import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS, getSessionSettings, isLegendSeen, LEGEND_KEY, markLegendSeen, saveSessionSettings
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
    saveSessionSettings(9002, { speed: 0.75, metronome: true, synth: false, training: true });
    expect(getSessionSettings(9002)).toEqual({ speed: 0.75, metronome: true, synth: false, training: true });
    expect(getSessionSettings(9003)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('ignores a speed the game does not offer', () => {
    saveSessionSettings(9004, { speed: 3, metronome: true, synth: true, training: false });
    expect(getSessionSettings(9004)).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('forgets the oldest sessions', () => {
    saveSessionSettings(100, { speed: 0.5, metronome: false, synth: true, training: false });
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
