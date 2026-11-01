import { describe, expect, it, vi } from 'vitest';
import {
  audioDeviceName,
  inputLevelState,
  isSystemAlias,
  looksLikeInstrumentInput,
  peakToDb,
  pickInstrumentInput,
  pickMonitorOutput,
  routeAudioContext,
  toneCameBack,
  toneLevel,
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
    expect(pickMonitorOutput(outputs, 'usb')?.deviceId).toBe('a1');
  });

  it('falls back to a digital output when nothing else exists', () => {
    expect(pickMonitorOutput(outputs.slice(0, 2), 'usb')?.deviceId).toBe('d1');
  });

  it('finds nothing when the interface is the only output', () => {
    expect(pickMonitorOutput([outputs[0], outputs[3]], 'usb')).toBeNull();
  });
});

describe('loopback tone', () => {
  const sine = (frequency: number, amplitude: number) =>
    Float32Array.from({ length: 2048 }, (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / 48000));

  it('measures the amplitude of a tone', () => {
    expect(toneLevel(sine(997, 0.01), 997, 48000)).toBeCloseTo(0.01, 3);
  });

  it('ignores other frequencies', () => {
    expect(toneLevel(sine(196, 0.5), 997, 48000)).toBeLessThan(0.005);
  });

  it('recognises what was measured on an interface that loops its output back', () => {
    // -30 dBFS came back at -38 dBFS over a -92 dBFS floor
    expect(toneCameBack(0.00003, 0.0126)).toBe(true);
  });

  it('sees no loop when nothing comes back', () => {
    expect(toneCameBack(0.00003, 0.000005)).toBe(false);
  });

  it('is not fooled by a guitar already ringing at that frequency', () => {
    expect(toneCameBack(0.05, 0.06)).toBe(false);
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

describe('routeAudioContext', () => {
  it('sends the audio to the chosen device', async () => {
    const setSinkId = vi.fn(async () => undefined);
    await routeAudioContext({ setSinkId } as unknown as AudioContext, 'speakers');
    expect(setSinkId).toHaveBeenCalledWith('speakers');
  });

  it('turns the system alias into the default output', async () => {
    const setSinkId = vi.fn(async () => undefined);
    await routeAudioContext({ setSinkId } as unknown as AudioContext, 'default');
    expect(setSinkId).toHaveBeenCalledWith('');
  });

  it('does nothing on a browser that cannot choose', async () => {
    await expect(routeAudioContext({} as AudioContext, 'speakers')).resolves.toBeUndefined();
  });
});
