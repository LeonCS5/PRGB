import type { InputChannelMode } from '../services/audioEngine';
import { validateNickname } from '../services/nickname';
import { AMP_PRESETS, type Tone3000Settings } from '../services/tone3000Amp';

export interface SavedSong {
  songId: number;
  partId: number;
}

export interface Preferences {
  deviceId: string;
  channelMode: InputChannelMode;
  tone3000: Tone3000Settings | null;
  lastSong: SavedSong | null;
  nickname: string | null; // local only, used to sign challenge links
}

const STORAGE_KEY = 'prgb:prefs:v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const isToneSettings = (value: unknown): value is Tone3000Settings => {
  if (!isRecord(value)) return false;
  return typeof value.isMonitoringEnabled === 'boolean'
    && typeof value.preset === 'string' && Object.hasOwn(AMP_PRESETS, value.preset)
    && inRange(value.gain, 0, 100)
    && inRange(value.bass, -12, 12) && inRange(value.mid, -12, 12)
    && inRange(value.treble, -12, 12) && inRange(value.presence, -12, 12)
    && inRange(value.masterVolume, 0, 1) && inRange(value.reverbMix, 0, 1)
    && inRange(value.gateThreshold, -80, -20)
    && typeof value.cabSim === 'string'
    && ['4x12_vintage', '2x12_british', '1x12_tweed', '4x12_metal', 'bypass'].includes(value.cabSim);
};

const readNickname = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const result = validateNickname(value);
  return result.ok ? result.value : null;
};

const isSavedSong = (value: unknown): value is SavedSong =>
  isRecord(value) && inRange(value.songId, 1, Number.MAX_SAFE_INTEGER)
  && Number.isInteger(value.songId) && inRange(value.partId, 0, Number.MAX_SAFE_INTEGER)
  && Number.isInteger(value.partId);

export const readPreferences = (): Preferences => {
  const defaults: Preferences = { deviceId: '', channelMode: 'ch1', tone3000: null, lastSong: null, nickname: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(value)) return defaults;
    return {
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : defaults.deviceId,
      channelMode: value.channelMode === 'ch1' || value.channelMode === 'ch2' || value.channelMode === 'both'
        ? value.channelMode : defaults.channelMode,
      tone3000: isToneSettings(value.tone3000) ? value.tone3000 : null,
      lastSong: isSavedSong(value.lastSong) ? value.lastSong : null,
      nickname: readNickname(value.nickname)
    };
  } catch {
    return defaults;
  }
};

export const savePreferences = (changes: Partial<Preferences>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readPreferences(), ...changes }));
  } catch {
    // Preferences are optional when storage is blocked or full.
  }
};

export const clearPreferences = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
};
