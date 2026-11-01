import type { InputChannelMode } from '../services/audioEngine';
import { DEFAULT_AUDIO_OPTIONS, readAudioOptions, type AudioOptions } from '../services/audioDevices';
import { validateNickname } from '../services/nickname';
import { AMP_PRESETS, type AmpSettings } from '../services/ampEngine';

export interface SavedSong {
  songId: number;
  partId: number;
}

export interface Preferences {
  deviceId: string;
  inputChosen: boolean; // the player picked the input: the app must not move to the interface by itself
  outputDeviceId: string;
  audioOptions: AudioOptions;
  channelMode: InputChannelMode;
  ampEngine: AmpSettings | null;
  lastSong: SavedSong | null;
  nickname: string | null; // local only, used to sign challenge links
}

const STORAGE_KEY = 'prgb:prefs:v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const isToneSettings = (value: unknown): value is AmpSettings => {
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
  const defaults: Preferences = { deviceId: '', inputChosen: false, outputDeviceId: '', audioOptions: DEFAULT_AUDIO_OPTIONS, channelMode: 'ch1', ampEngine: null, lastSong: null, nickname: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(value)) return defaults;
    return {
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : defaults.deviceId,
      inputChosen: value.inputChosen === true,
      outputDeviceId: typeof value.outputDeviceId === 'string' ? value.outputDeviceId : defaults.outputDeviceId,
      audioOptions: readAudioOptions(value.audioOptions),
      channelMode: value.channelMode === 'ch1' || value.channelMode === 'ch2' || value.channelMode === 'both'
        ? value.channelMode : defaults.channelMode,
      ampEngine: isToneSettings(value.ampEngine) ? value.ampEngine : null,
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
