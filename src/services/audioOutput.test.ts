import { afterEach, describe, expect, it, vi } from 'vitest';
import { askBrowserForOutput, canAskBrowserForOutput, canChooseAudioOutput, createAudioOutputRoute } from './audioOutput';

const fakeStream = { id: 'mix' };

const firefoxContext = () => ({
  destination: { kind: 'speakers' },
  createMediaStreamDestination: vi.fn(() => ({ stream: fakeStream }))
}) as unknown as AudioContext;

class FakeAudioElement {
  static last: FakeAudioElement;
  srcObject: unknown = null;
  paused = true;
  setSinkId = vi.fn(async (_deviceId: string) => undefined);
  play = vi.fn(async () => undefined);
  pause = vi.fn();

  constructor() {
    FakeAudioElement.last = this;
  }
}

// What Firefox 159 reported: no sink on the context, one on media elements, and a prompt for outputs
const useFirefox = (selectAudioOutput?: ReturnType<typeof vi.fn>) => {
  class Context {}
  class MediaElement {
    setSinkId() {}
  }
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('HTMLMediaElement', MediaElement);
  vi.stubGlobal('Audio', FakeAudioElement);
  vi.stubGlobal('navigator', { mediaDevices: { selectAudioOutput } });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Chromium', () => {
  it('points the context itself at the output and plays straight into it', async () => {
    const setSinkId = vi.fn(async () => undefined);
    const context = { destination: { kind: 'speakers' }, setSinkId } as unknown as AudioContext;
    const route = createAudioOutputRoute(context);
    expect(route.node).toBe(context.destination);
    await expect(route.setDevice('b2')).resolves.toBe('b2');
    expect(setSinkId).toHaveBeenCalledWith('b2');
  });

  it('turns a system alias into the default output', async () => {
    const setSinkId = vi.fn(async () => undefined);
    const route = createAudioOutputRoute({ destination: {}, setSinkId } as unknown as AudioContext);
    await route.setDevice('default');
    expect(setSinkId).toHaveBeenCalledWith('');
  });

  it('lets a failure through, for the caller to fall back', async () => {
    const setSinkId = vi.fn(async () => { throw new DOMException('gone', 'NotFoundError'); });
    const route = createAudioOutputRoute({ destination: {}, setSinkId } as unknown as AudioContext);
    await expect(route.setDevice('b2')).rejects.toThrow('gone');
  });
});

describe('browsers with no way to choose', () => {
  it('plays on the default output and says so', async () => {
    const context = { destination: { kind: 'speakers' } } as unknown as AudioContext;
    const route = createAudioOutputRoute(context);
    expect(route.node).toBe(context.destination);
    await expect(route.setDevice('b2')).resolves.toBe('b2');
    expect(canChooseAudioOutput()).toBe(false);
    expect(canAskBrowserForOutput()).toBe(false);
  });
});

describe('Firefox', () => {
  it('can choose an output', () => {
    useFirefox(vi.fn());
    expect(canChooseAudioOutput()).toBe(true);
    expect(canAskBrowserForOutput()).toBe(true);
  });

  it('sends the sound through a stream into an audio element', () => {
    useFirefox();
    const context = firefoxContext();
    const route = createAudioOutputRoute(context);
    expect(route.node).toEqual({ stream: fakeStream });
    expect(route.node).not.toBe(context.destination);
    expect(FakeAudioElement.last.srcObject).toBe(fakeStream);
  });

  it('routes the element', async () => {
    useFirefox();
    const route = createAudioOutputRoute(firefoxContext());
    await expect(route.setDevice('b2')).resolves.toBe('b2');
    expect(FakeAudioElement.last.setSinkId).toHaveBeenCalledWith('b2');
  });

  it('asks the browser when the output needs the player to allow it', async () => {
    const prompt = vi.fn(async () => ({ deviceId: 'allowed' }));
    useFirefox(prompt);
    const route = createAudioOutputRoute(firefoxContext());
    FakeAudioElement.last.setSinkId.mockRejectedValueOnce(new DOMException('not allowed', 'NotFoundError'));
    await expect(route.setDevice('b2')).resolves.toBe('allowed');
    expect(prompt).toHaveBeenCalledWith({ deviceId: 'b2' });
    expect(FakeAudioElement.last.setSinkId).toHaveBeenLastCalledWith('allowed');
  });

  it('gives up when there is no click to ask with', async () => {
    useFirefox(vi.fn(async () => { throw new DOMException('no click', 'InvalidStateError'); }));
    const route = createAudioOutputRoute(firefoxContext());
    FakeAudioElement.last.setSinkId.mockRejectedValueOnce(new DOMException('not allowed', 'NotFoundError'));
    await expect(route.setDevice('b2')).rejects.toThrow('no click');
  });

  it('does not stop at a play the browser refuses, and tries again on the next start', () => {
    useFirefox();
    const route = createAudioOutputRoute(firefoxContext());
    FakeAudioElement.last.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    expect(() => route.start()).not.toThrow();
    route.start();
    expect(FakeAudioElement.last.play).toHaveBeenCalledTimes(2);
  });

  it('leaves an element that is already playing alone', () => {
    useFirefox();
    const route = createAudioOutputRoute(firefoxContext());
    FakeAudioElement.last.paused = false;
    route.start();
    expect(FakeAudioElement.last.play).not.toHaveBeenCalled();
  });

  it('lets go of the stream when closed', () => {
    useFirefox();
    const route = createAudioOutputRoute(firefoxContext());
    route.close();
    expect(FakeAudioElement.last.pause).toHaveBeenCalled();
    expect(FakeAudioElement.last.srcObject).toBeNull();
  });

  it('opens the browser list for any output when none is named', async () => {
    const prompt = vi.fn(async () => ({ deviceId: 'picked' }));
    useFirefox(prompt);
    await expect(askBrowserForOutput()).resolves.toBe('picked');
    expect(prompt).toHaveBeenCalledWith(undefined);
  });
});
