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

// The groupId alone won't do: browsers differ on it, and one onboard chip can get a different one per endpoint
export const onSameHardware = (a: Pick<AudioDeviceOption, 'label' | 'groupId'>, b: Pick<AudioDeviceOption, 'label' | 'groupId'>): boolean => {
  if (a.groupId && a.groupId === b.groupId) return true;
  const hardware = parseDeviceLabel(a.label).hardware;
  return hardware !== '' && hardware === parseDeviceLabel(b.label).hardware;
};

/** Speakers on other hardware than the input, for when the input's own outputs feed back into it. */
export const pickMonitorOutput = (devices: AudioDeviceOption[], input: Pick<AudioDeviceOption, 'label' | 'groupId'>): AudioDeviceOption | null => {
  const others = devices.filter((device) => !isSystemAlias(device.deviceId) && !onSameHardware(device, input));
  return others.find((device) => !/digital|hdmi|s\/?pdif|display/i.test(device.label)) ?? others[0] ?? null;
};

/** "Padrão - Linha (USB-Audio) (301a:5555)" as "Linha (USB-Audio)". */
export const audioDeviceName = (label: string): string =>
  label.replace(/^(Padrão|Comunicações|Default|Communications) - /i, '').replace(/ \([0-9a-f]{4}:[0-9a-f]{4}\)$/i, '').trim();

// Some USB interfaces send what they play back into their own input. With an amp in the path that loop turns
// into feedback at full scale, loud and with no note in it. Faint bursts played before the monitor opens show
// whether the output comes back, without ever letting the loop start. The tone sits far above a guitar, whose
// strings may be ringing during the test: at 7 kHz a real interface read -90 dBFS at rest and -34 dBFS of return.
export const LOOPBACK_TONE_HZ = 7001;
export const LOOPBACK_TONE_GAIN = 0.01; // -40 dBFS: enough for a loop to return it, barely audible on speakers
export const LOOPBACK_BURSTS = 6; // a USB output can take over a second to really start playing
export const LOOPBACK_BURSTS_NEEDED = 2; // one burst can land on a pick attack
const LOOPBACK_MIN_LEVEL = 0.0005; // -66 dBFS
const LOOPBACK_MIN_RISE = 4; // 12 dB over what was there before

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

export const dbToGain = (db: number): number => 10 ** (db / 20);

export const inputLevelState = (peak: number): InputLevelState => {
  const db = peakToDb(peak);
  if (db < SILENT_DB) return 'silent';
  if (db < LOW_DB) return 'low';
  if (db < HOT_DB) return 'good';
  return db < CLIPPING_DB ? 'hot' : 'clipping';
};


// The options of a driver panel, as far as a browser can reach them. The buffer becomes the AudioContext's
// latency hint, which the system may round up: the real figures are the context's own latency readings.
export interface AudioOptions {
  bufferSamples: number; // 0 asks for the smallest the system allows
  resampleTo48k: boolean; // false runs at the output's own rate
  lowPower: boolean;
  inputGainDb: number;
  inputLatencySamples: number; // judged notes are moved back by these two, as the signal arrives late
  outputLatencySamples: number;
}

export const ENGINE_BUFFER_SIZES: readonly number[] = [0, 128, 256, 512, 1024, 2048];
export const INPUT_GAIN_MIN_DB = -12;
export const INPUT_GAIN_MAX_DB = 36;
export const LATENCY_SAMPLES_MAX = 9600; // 200 ms at 48 kHz
export const LATENCY_SAMPLES_STEP = 16;

export const DEFAULT_AUDIO_OPTIONS: AudioOptions = {
  bufferSamples: 0,
  resampleTo48k: true,
  lowPower: false,
  inputGainDb: 0,
  inputLatencySamples: 0,
  outputLatencySamples: 0,
};

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Stored options, field by field: one bad value must not cost the player the others. */
export const readAudioOptions = (value: unknown): AudioOptions => {
  const saved = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const defaults = DEFAULT_AUDIO_OPTIONS;
  return {
    bufferSamples: typeof saved.bufferSamples === 'number' && ENGINE_BUFFER_SIZES.includes(saved.bufferSamples)
      ? saved.bufferSamples : defaults.bufferSamples,
    resampleTo48k: typeof saved.resampleTo48k === 'boolean' ? saved.resampleTo48k : defaults.resampleTo48k,
    lowPower: typeof saved.lowPower === 'boolean' ? saved.lowPower : defaults.lowPower,
    inputGainDb: inRange(saved.inputGainDb, INPUT_GAIN_MIN_DB, INPUT_GAIN_MAX_DB) ? saved.inputGainDb : defaults.inputGainDb,
    inputLatencySamples: inRange(saved.inputLatencySamples, 0, LATENCY_SAMPLES_MAX) ? saved.inputLatencySamples : defaults.inputLatencySamples,
    outputLatencySamples: inRange(saved.outputLatencySamples, 0, LATENCY_SAMPLES_MAX) ? saved.outputLatencySamples : defaults.outputLatencySamples,
  };
};

/** "Alto-falantes (Realtek(R) Audio)" is the endpoint "Alto-falantes" of the hardware "Realtek(R) Audio". */
export const parseDeviceLabel = (label: string): { endpoint: string; hardware: string } => {
  const name = audioDeviceName(label);
  const open = name.indexOf(' (');
  if (open < 1 || !name.endsWith(')')) return { endpoint: name, hardware: '' };
  return { endpoint: name.slice(0, open), hardware: name.slice(open + 2, -1) };
};

export interface AudioDeviceGroup {
  name: string;
  outputs: AudioDeviceOption[];
  inputs: AudioDeviceOption[];
}

// By name, not by groupId: the endpoints of one onboard chip come with a different groupId each
export const groupAudioDevices = (inputs: AudioDeviceOption[], outputs: AudioDeviceOption[]): AudioDeviceGroup[] => {
  const groups = new Map<string, AudioDeviceGroup>();
  const place = (device: AudioDeviceOption, side: 'inputs' | 'outputs') => {
    if (isSystemAlias(device.deviceId)) return;
    const name = parseDeviceLabel(device.label).hardware || 'Outros dispositivos';
    const group = groups.get(name) ?? { name, outputs: [], inputs: [] };
    group[side].push(device);
    groups.set(name, group);
  };
  outputs.forEach((device) => place(device, 'outputs'));
  inputs.forEach((device) => place(device, 'inputs'));
  return [...groups.values()];
};

export interface AudioFormat {
  channels?: number;
  sampleRate?: number;
  bits?: number;
}

/** "1× 48 kHz 16 bit", with whatever the browser told. */
export const formatAudioFormat = ({ channels, sampleRate, bits }: AudioFormat): string => [
  channels ? `${channels}×` : '',
  sampleRate ? `${(sampleRate / 1000).toLocaleString('pt-BR')} kHz` : '',
  bits ? `${bits} bit` : '',
].filter(Boolean).join(' ');

// The path of the sound, read each moment, to show where it stops
export interface SignalReading {
  running: boolean;
  contextRunning: boolean;
  inputRms: number;
  gateOpen: boolean;
  monitoring: boolean; // the player's own switch
  monitorOpen: boolean; // closed by the app while the output feeds the input
  monitorChecking: boolean; // the loopback test is running: closed, but nothing is wrong yet
}

export type SignalStage = 'off' | 'suspended' | 'monitor-off' | 'checking' | 'monitor-closed' | 'no-signal' | 'gate' | 'playing';

const NO_SIGNAL_RMS = 0.001; // -60 dBFS: a real line input at rest read -76, a soft note -44

export const diagnoseSignal = (reading: SignalReading): SignalStage => {
  if (!reading.running) return 'off';
  if (!reading.contextRunning) return 'suspended';
  if (!reading.monitoring) return 'monitor-off';
  if (reading.monitorChecking) return 'checking';
  if (!reading.monitorOpen) return 'monitor-closed';
  if (reading.inputRms < NO_SIGNAL_RMS) return 'no-signal';
  return reading.gateOpen ? 'playing' : 'gate';
};
