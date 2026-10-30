// Telling the guitar apart from the computer's own microphone, and reading the input level. A browser only
// sees what the operating system lists and, with no choice made, opens the system's default input, which on
// most computers is not the audio interface.

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string; // shared by the inputs and outputs of one piece of hardware
}

const SYSTEM_ALIASES = new Set(['default', 'communications']);

const COMPUTER_DEVICE = /realtek|conexant|synaptics|cirrus|intel|\bamd\b|nvidia|webcam|camera|câmera|headset|bluetooth|hands-?free|built-?in|macbook|imac|internal|interno|array|matriz/i;
const INSTRUMENT_INPUT = /linha|\bline\b|instrument|guitar|interface|usb|codec|focusrite|scarlett|behringer|\bumc\b|uphoria|presonus|steinberg|audient|motu|tascam|zoom|roland|\bboss\b|line ?6|irig|\bm-?audio\b|mackie|universal audio|apollo/i;

// The system's "default" and "communications" entries repeat a device that is also listed by its own id
export const isSystemAlias = (deviceId: string): boolean => SYSTEM_ALIASES.has(deviceId);

export const looksLikeInstrumentInput = (label: string): boolean =>
  !COMPUTER_DEVICE.test(label) && INSTRUMENT_INPUT.test(label);

/** The input to use when nobody chose one. Labels stay empty until the browser has microphone permission. */
export const pickInstrumentInput = (devices: AudioDeviceOption[]): AudioDeviceOption | null =>
  devices.find((device) => !isSystemAlias(device.deviceId) && looksLikeInstrumentInput(device.label)) ?? null;

/** Speakers on other hardware than the input, for when the input's own outputs feed back into it. */
export const pickMonitorOutput = (devices: AudioDeviceOption[], inputGroupId: string): AudioDeviceOption | null => {
  const others = devices.filter((device) => !isSystemAlias(device.deviceId) && device.groupId !== inputGroupId);
  return others.find((device) => !/digital|hdmi|s\/?pdif|display/i.test(device.label)) ?? others[0] ?? null;
};

/** "Padrão - Linha (USB-Audio) (301a:5555)" as "Linha (USB-Audio)". */
export const audioDeviceName = (label: string): string =>
  label.replace(/^(Padrão|Comunicações|Default|Communications) - /i, '').replace(/ \([0-9a-f]{4}:[0-9a-f]{4}\)$/i, '').trim();

// Some USB interfaces send what they play back into their own input. With an amp in the path that loop turns
// into feedback at full scale, loud and with no note in it. A faint tone played before the monitor opens
// shows whether the output comes back, without ever letting the loop start.
export const LOOPBACK_TONE_HZ = 997;
export const LOOPBACK_TONE_GAIN = 0.01; // -40 dBFS: enough for a loop to return it, barely audible on speakers
const LOOPBACK_MIN_LEVEL = 0.0005; // -66 dBFS
const LOOPBACK_MIN_RISE = 10; // 20 dB over what was there before

/** Amplitude of one frequency in a block of samples (Goertzel). */
export const toneLevel = (samples: Float32Array, frequency: number, sampleRate: number): number => {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0;
  let beforePrevious = 0;
  for (const sample of samples) {
    const current = sample + coefficient * previous - beforePrevious;
    beforePrevious = previous;
    previous = current;
  }
  const power = previous * previous + beforePrevious * beforePrevious - coefficient * previous * beforePrevious;
  return (2 * Math.sqrt(Math.max(0, power))) / samples.length;
};

export const toneCameBack = (quiet: number, heard: number): boolean =>
  heard >= LOOPBACK_MIN_LEVEL && heard >= quiet * LOOPBACK_MIN_RISE;

export type InputLevelState = 'silent' | 'low' | 'good' | 'hot' | 'clipping';

const SILENT_DB = -54;
const LOW_DB = -30;
const HOT_DB = -6;
const CLIPPING_DB = -0.5;

export const peakToDb = (peak: number): number => (peak > 0 ? 20 * Math.log10(peak) : -Infinity);

export const inputLevelState = (peak: number): InputLevelState => {
  const db = peakToDb(peak);
  if (db < SILENT_DB) return 'silent';
  if (db < LOW_DB) return 'low';
  if (db < HOT_DB) return 'good';
  return db < CLIPPING_DB ? 'hot' : 'clipping';
};

/** Picks the speakers an AudioContext plays on. '' is the system default. Ignored by browsers without it. */
export const routeAudioContext = async (context: AudioContext, deviceId: string): Promise<void> => {
  const sink = context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (sink.setSinkId) await sink.setSinkId(isSystemAlias(deviceId) ? '' : deviceId);
};

export const canChooseAudioOutput = (): boolean =>
  typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
