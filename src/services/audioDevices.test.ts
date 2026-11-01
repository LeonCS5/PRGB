import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_OPTIONS,
  audioDeviceName,
  dbToGain,
  diagnoseSignal,
  formatAudioFormat,
  groupAudioDevices,
  inputLevelState,
  isSystemAlias,
  looksLikeInstrumentInput,
  onSameHardware,
  parseDeviceLabel,
  peakToDb,
  pickInstrumentInput,
  pickMonitorOutput,
  readAudioOptions,
  toneCameBack,
  toneLevel,
  type SignalReading,
} from './audioDevices';

// The real list of a Windows computer with a USB interface and an onboard Realtek microphone
const WINDOWS_INPUTS = [
  { deviceId: 'default', label: 'Padrão - Microfone (Realtek(R) Audio)' },
  { deviceId: 'communications', label: 'Comunicações - Microfone (Realtek(R) Audio)' },
  { deviceId: 'a1', label: 'Linha (USB-Audio) (301a:5555)' },
  { deviceId: 'b2', label: 'Microfone (Realtek(R) Audio)' },
];

describe('telling the guitar from the computer microphone', () => {
  it('finds the interface and never picks a system alias', () => {
    expect(pickInstrumentInput(WINDOWS_INPUTS)?.deviceId).toBe('a1');
  });

  it.each([
    'Linha (USB-Audio) (301a:5555)',
    'Microfone (USB Audio CODEC)',
    'Microphone (Scarlett 2i2 USB)',
    'Line In (Behringer UMC204HD)',
    'Input 1-2 (Focusrite USB Audio)',
  ])('accepts %s', (label) => {
    expect(looksLikeInstrumentInput(label)).toBe(true);
  });

  it.each([
    'Microfone (Realtek(R) Audio)',
    'Padrão - Microfone (Realtek(R) Audio)',
    'Microfone (HD USB Webcam)',
    'Headset Microphone (USB Headset)',
    'Microphone Array (Intel Smart Sound)',
    'MacBook Pro Microphone',
    'Microfone (Bluetooth Hands-Free)',
    'MediaStreamAudioDestinationNode',
  ])('rejects %s', (label) => {
    expect(looksLikeInstrumentInput(label)).toBe(false);
  });

  it('finds nothing on a computer with only its own microphone', () => {
    expect(pickInstrumentInput([{ deviceId: 'b2', label: 'Microfone (Realtek(R) Audio)' }])).toBeNull();
  });

  it('finds nothing before the browser reveals the device names', () => {
    expect(pickInstrumentInput([{ deviceId: 'a1', label: '' }])).toBeNull();
  });

  it('knows the system aliases', () => {
    expect(isSystemAlias('default')).toBe(true);
    expect(isSystemAlias('communications')).toBe(true);
    expect(isSystemAlias('a1')).toBe(false);
  });
});

describe('pickMonitorOutput', () => {
  const outputs = [
    { deviceId: 'default', label: 'Padrão - Alto-falantes (USB-Audio) (301a:5555)', groupId: 'usb' },
    { deviceId: 'd1', label: 'Realtek Digital Output (Realtek(R) Audio)', groupId: 'pc' },
    { deviceId: 'a1', label: 'Alto-falantes (Realtek(R) Audio)', groupId: 'pc' },
    { deviceId: 'u1', label: 'Alto-falantes (USB-Audio) (301a:5555)', groupId: 'usb' },
  ];

  it('picks speakers on other hardware, not a digital output', () => {
    expect(pickMonitorOutput(outputs, { label: '', groupId: 'usb' })?.deviceId).toBe('a1');
  });

  it('falls back to a digital output when nothing else exists', () => {
    expect(pickMonitorOutput(outputs.slice(0, 2), { label: '', groupId: 'usb' })?.deviceId).toBe('d1');
  });

  it('finds nothing when the interface is the only output', () => {
    expect(pickMonitorOutput([outputs[0], outputs[3]], { label: '', groupId: 'usb' })).toBeNull();
  });
});

describe('loopback tone', () => {
  const sine = (frequency: number, amplitude: number) =>
    Float32Array.from({ length: 2048 }, (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / 48000));

  it('measures the amplitude of a tone', () => {
    expect(toneLevel(sine(7001, 0.01), 7001, 48000)).toBeCloseTo(0.01, 3);
  });

  it('ignores other frequencies', () => {
    expect(toneLevel(sine(196, 0.5), 7001, 48000)).toBeLessThan(0.001);
  });

  it('recognises what was measured on an interface that loops its output back', () => {
    // -40 dBFS came back at -34 dBFS over a -90 dBFS floor
    expect(toneCameBack(0.00003, 0.02)).toBe(true);
  });

  it('still sees it over a loud chord, which reaches -60 dBFS up there', () => {
    expect(toneCameBack(0.001, 0.02)).toBe(true);
  });

  it('sees no loop when nothing comes back', () => {
    expect(toneCameBack(0.00003, 0.000005)).toBe(false);
  });

  it('is not fooled by a guitar already ringing at that frequency', () => {
    expect(toneCameBack(0.05, 0.06)).toBe(false);
  });
});

// The real lists of the Windows computer above, with their different groupIds per Realtek endpoint
const WINDOWS_OUTPUTS = [
  { deviceId: 'default', label: 'Padrão - Alto-falantes (USB-Audio) (301a:5555)', groupId: 'u' },
  { deviceId: 'c3', label: 'Alto-falantes (Realtek(R) Audio)', groupId: 'r1' },
  { deviceId: 'd4', label: 'Alto-falantes (USB-Audio) (301a:5555)', groupId: 'u' },
  { deviceId: 'e5', label: 'Realtek Digital Output (Realtek(R) Audio)', groupId: 'r2' },
];

describe('onSameHardware', () => {
  it('goes by the groupId when the browser shares one', () => {
    expect(onSameHardware({ label: 'A', groupId: 'x' }, { label: 'B', groupId: 'x' })).toBe(true);
  });

  it('goes by the name when it does not, as Firefox may', () => {
    expect(onSameHardware({ label: 'Linha (USB-Audio)', groupId: 'x' }, { label: 'Alto-falantes (USB-Audio)', groupId: 'y' })).toBe(true);
  });

  it('tells two pieces of hardware apart', () => {
    expect(onSameHardware({ label: 'Linha (USB-Audio)', groupId: 'x' }, { label: 'Alto-falantes (Realtek(R) Audio)', groupId: 'y' })).toBe(false);
  });

  it('does not match on names with no hardware in them', () => {
    expect(onSameHardware({ label: 'Saída', groupId: '' }, { label: 'Saída', groupId: '' })).toBe(false);
  });
});

describe('device tree', () => {
  it('splits a label into endpoint and hardware', () => {
    expect(parseDeviceLabel('Linha (USB-Audio) (301a:5555)')).toEqual({ endpoint: 'Linha', hardware: 'USB-Audio' });
    expect(parseDeviceLabel('Realtek Digital Output (Realtek(R) Audio)')).toEqual({ endpoint: 'Realtek Digital Output', hardware: 'Realtek(R) Audio' });
    expect(parseDeviceLabel('Interface USB')).toEqual({ endpoint: 'Interface USB', hardware: '' });
  });

  it('shows each piece of hardware once, with its outputs and inputs and no system aliases', () => {
    const groups = groupAudioDevices(WINDOWS_INPUTS, WINDOWS_OUTPUTS);
    expect(groups.map((group) => [group.name, group.outputs.map((device) => device.deviceId), group.inputs.map((device) => device.deviceId)])).toEqual([
      ['Realtek(R) Audio', ['c3', 'e5'], ['b2']],
      ['USB-Audio', ['d4'], ['a1']],
    ]);
  });

  it('keeps a device with no hardware in its name', () => {
    expect(groupAudioDevices([{ deviceId: 'x', label: '' }], [])[0]).toMatchObject({ name: 'Outros dispositivos' });
  });

  it('writes the format the way a driver panel does', () => {
    expect(formatAudioFormat({ channels: 1, sampleRate: 48000, bits: 16 })).toBe('1× 48 kHz 16 bit');
    expect(formatAudioFormat({ channels: 2, sampleRate: 44100 })).toBe('2× 44,1 kHz');
    expect(formatAudioFormat({})).toBe('');
  });
});

describe('audio options', () => {
  it('starts from the defaults', () => {
    expect(readAudioOptions(undefined)).toEqual(DEFAULT_AUDIO_OPTIONS);
  });

  it('keeps what is valid and drops only what is not', () => {
    expect(readAudioOptions({ bufferSamples: 512, inputGainDb: 999, lowPower: 'yes', inputLatencySamples: 16 })).toEqual({
      ...DEFAULT_AUDIO_OPTIONS, bufferSamples: 512, inputLatencySamples: 16,
    });
  });

  it('refuses a buffer size that is not on the list', () => {
    expect(readAudioOptions({ bufferSamples: 333 }).bufferSamples).toBe(0);
  });

  it('turns decibels into gain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(20)).toBeCloseTo(10, 5);
  });
});

describe('diagnoseSignal', () => {
  const playing: SignalReading = { running: true, contextRunning: true, inputRms: 0.05, gateOpen: true, monitoring: true, monitorOpen: true };

  it.each<[string, Partial<SignalReading>, string]>([
    ['audio off', { running: false }, 'off'],
    ['a paused context', { contextRunning: false }, 'suspended'],
    ['the player mute', { monitoring: false }, 'monitor-off'],
    ['a monitor shut for feedback', { monitorOpen: false }, 'monitor-closed'],
    ['a line at rest, which read -76 dB', { inputRms: 0.00016 }, 'no-signal'],
    ['a note under the gate', { inputRms: 0.004, gateOpen: false }, 'gate'],
    ['a note going through', {}, 'playing'],
  ])('points at %s', (_name, change, stage) => {
    expect(diagnoseSignal({ ...playing, ...change })).toBe(stage);
  });
});

describe('audioDeviceName', () => {
  it('drops the system prefix and the USB id', () => {
    expect(audioDeviceName('Padrão - Alto-falantes (USB-Audio) (301a:5555)')).toBe('Alto-falantes (USB-Audio)');
  });

  it('keeps a plain name', () => {
    expect(audioDeviceName('Alto-falantes (Realtek(R) Audio)')).toBe('Alto-falantes (Realtek(R) Audio)');
  });
});

describe('input level', () => {
  it('converts a peak to decibels', () => {
    expect(peakToDb(1)).toBe(0);
    expect(peakToDb(0.1)).toBeCloseTo(-20);
    expect(peakToDb(0)).toBe(-Infinity);
  });

  it.each([
    [0, 'silent'],
    [0.0015, 'silent'], // the guitar line of a real interface at rest
    [0.01, 'low'],
    [0.2, 'good'],
    [0.7, 'hot'],
    [0.96, 'clipping'],
    [1, 'clipping'],
  ])('reads a peak of %s as %s', (peak, state) => {
    expect(inputLevelState(peak)).toBe(state);
  });
});
