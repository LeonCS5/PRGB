// What the player chose in the game that must outlive it: the game remounts for each exercise of a practice
// session, so speed, metronome, synth and training are kept per session (by queue id) and read back as the
// initial state. Memory only: nothing is written to the browser for this.
//
// Also the "seen" flag of the first-run legend (how to read the lanes), the one thing here that is stored.

export interface SessionSettings {
  speed: number;
  metronome: boolean;
  synth: boolean;
  training: boolean;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = { speed: 1, metronome: false, synth: true, training: false };

export const SPEED_OPTIONS: readonly number[] = [0.25, 0.4, 0.5, 0.65, 0.75, 0.85, 1, 1.15, 1.25, 1.5];

// Old sessions are of no use: only the last few are kept
const MAX_SESSIONS = 10;
const settingsBySession = new Map<number, SessionSettings>();

export const getSessionSettings = (queueId: number | null | undefined): SessionSettings => {
  const saved = queueId == null ? undefined : settingsBySession.get(queueId);
  return saved ? { ...saved } : { ...DEFAULT_SESSION_SETTINGS };
};

export const saveSessionSettings = (queueId: number, settings: SessionSettings): void => {
  if (!SPEED_OPTIONS.includes(settings.speed)) return;
  settingsBySession.delete(queueId);
  settingsBySession.set(queueId, { ...settings });
  while (settingsBySession.size > MAX_SESSIONS) {
    const oldest = settingsBySession.keys().next();
    if (oldest.done) break;
    settingsBySession.delete(oldest.value);
  }
};

export const LEGEND_KEY = 'prgb:legend:v1';

// Part of the local data: erasing it brings the first-game legend back
export const clearLegendSeen = (): void => {
  try {
    window.localStorage.removeItem(LEGEND_KEY);
  } catch {
    // Without storage there is nothing to erase.
  }
};

export const isLegendSeen = (): boolean => {
  try {
    return window.localStorage.getItem(LEGEND_KEY) === '1';
  } catch {
    return false;
  }
};

export const markLegendSeen = (): void => {
  try {
    window.localStorage.setItem(LEGEND_KEY, '1');
  } catch {
    // Storage blocked or full: the legend shows again next time, which is harmless
  }
};
