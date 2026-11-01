// Where a context's sound goes. Chromium points an AudioContext at any output. Firefox can't: it only routes
// media elements, so there the context plays into a stream and a detached <audio> takes it to the device.

import { isSystemAlias } from './audioDevices';

type SinkTarget = { setSinkId?: (deviceId: string) => Promise<void> };
type OutputPicker = { selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo> };

export interface AudioOutputRoute {
  node: AudioNode; // what to connect the sound into
  setDevice: (deviceId: string) => Promise<string>; // resolves with the output in use: the player may pick another
  start: () => void;
  close: () => void;
}

const contextHasSink = (): boolean => typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
const elementHasSink = (): boolean => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

export const canChooseAudioOutput = (): boolean => contextHasSink() || elementHasSink();

const outputPicker = (): OutputPicker | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.mediaDevices as MediaDevices & OutputPicker | undefined;

/** Firefox may keep the outputs hidden until the player picks one in its own prompt. */
export const canAskBrowserForOutput = (): boolean => Boolean(outputPicker()?.selectAudioOutput);

/** Opens the browser's own list of outputs. Needs a click on the call stack. */
export const askBrowserForOutput = async (deviceId?: string): Promise<string> => {
  const picker = outputPicker();
  if (!picker?.selectAudioOutput) throw new DOMException('No output prompt', 'NotSupportedError');
  return (await picker.selectAudioOutput(deviceId ? { deviceId } : undefined)).deviceId;
};

// Firefox refuses an output the player hasn't allowed yet, and only a click can ask
const routeElement = async (element: HTMLAudioElement & SinkTarget, deviceId: string): Promise<string> => {
  try {
    await element.setSinkId?.(deviceId);
    return deviceId;
  } catch (error) {
    if (!deviceId || !canAskBrowserForOutput()) throw error;
    const allowed = await askBrowserForOutput(deviceId);
    await element.setSinkId?.(allowed);
    return allowed;
  }
};

export const createAudioOutputRoute = (context: AudioContext): AudioOutputRoute => {
  const direct = context as AudioContext & SinkTarget;
  if (direct.setSinkId || !elementHasSink()) {
    return {
      node: context.destination,
      setDevice: async (deviceId) => {
        await direct.setSinkId?.(isSystemAlias(deviceId) ? '' : deviceId);
        return deviceId;
      },
      start: () => undefined,
      close: () => undefined
    };
  }
  const stream = context.createMediaStreamDestination();
  const element: HTMLAudioElement & SinkTarget = new Audio();
  element.srcObject = stream.stream;
  return {
    node: stream,
    setDevice: (deviceId) => routeElement(element, isSystemAlias(deviceId) ? '' : deviceId),
    // Refused until the page has a click or a microphone: the next start tries again
    start: () => {
      if (element.paused) void element.play().catch(() => undefined);
    },
    close: () => {
      element.pause();
      element.srcObject = null;
    }
  };
};
