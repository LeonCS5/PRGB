import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerTime } from './rankingApi';
import {
  ROOM_CODE_ALPHABET,
  createRoomService,
  generateRoomCode,
  normalizeRoomCode,
  parseRoomMessage,
  type ProgressMessage,
  type RoomEvent,
  type RoomHandle,
  type RoomMessage
} from './roomChannel';

// In-memory stand-in for Supabase Realtime: channels on the same topic share presence and broadcasts,
// delivered asynchronously like over the network. It also reproduces what the real client does when the
// socket drops: reports an error, forgets the presence and reports SUBSCRIBED again on rejoining.
type Listener = { type: string; event: string; callback: (payload: unknown) => void };
type StatusCallback = (status: string, error?: Error) => void;
type Payload = { from: string; message: Record<string, unknown> };
type ChannelOptions = { config: { private: boolean; presence: { key: string } } };

class FakeHub {
  readonly channels = new Set<FakeChannel>();
  refuseJoin: string | null = null;
  silent = false;

  members(topic: string): FakeChannel[] {
    return [...this.channels].filter((channel) => channel.topic === topic);
  }

  syncPresence(topic: string): void {
    setTimeout(() => {
      for (const channel of this.members(topic)) channel.emit('presence', 'sync', {});
    }, 0);
  }

  broadcast(from: FakeChannel, event: string, payload: unknown): void {
    setTimeout(() => {
      for (const channel of this.members(from.topic)) {
        if (channel !== from) channel.emit('broadcast', event, { type: 'broadcast', event, payload });
      }
    }, 0);
  }

  drop(channel: FakeChannel): void {
    this.channels.delete(channel);
    channel.meta = null;
    channel.status?.('CHANNEL_ERROR', new Error('socket closed'));
    this.syncPresence(channel.topic);
  }

  restore(channel: FakeChannel): void {
    this.channels.add(channel);
    channel.status?.('SUBSCRIBED');
  }

  close(channel: FakeChannel): void {
    this.channels.delete(channel);
    channel.meta = null;
    channel.status?.('CLOSED');
    this.syncPresence(channel.topic);
  }
}

class FakeChannel {
  readonly hub: FakeHub;
  readonly topic: string;
  readonly key: string;
  readonly isPrivate: boolean;
  readonly listeners: Listener[] = [];
  readonly sent: Payload[] = [];
  readonly sentAt: number[] = [];
  meta: Record<string, unknown> | null = null;
  status: StatusCallback | null = null;

  constructor(hub: FakeHub, topic: string, options: ChannelOptions) {
    this.hub = hub;
    this.topic = topic;
    this.key = options.config.presence.key;
    this.isPrivate = options.config.private;
  }

  on(type: string, filter: { event: string }, callback: (payload: unknown) => void): this {
    this.listeners.push({ type, event: filter.event, callback });
    return this;
  }

  subscribe(callback: StatusCallback): this {
    this.status = callback;
    if (this.hub.silent) return this;
    setTimeout(() => {
      if (this.hub.refuseJoin) {
        callback('CHANNEL_ERROR', new Error(this.hub.refuseJoin));
        return;
      }
      this.hub.channels.add(this);
      callback('SUBSCRIBED');
    }, 0);
    return this;
  }

  async track(meta: Record<string, unknown>): Promise<string> {
    this.meta = meta;
    this.hub.syncPresence(this.topic);
    return 'ok';
  }

  async untrack(): Promise<string> {
    this.meta = null;
    this.hub.syncPresence(this.topic);
    return 'ok';
  }

  async send(args: { type: string; event: string; payload: Payload }): Promise<string> {
    this.sent.push(args.payload);
    this.sentAt.push(Date.now());
    this.hub.broadcast(this, args.event, args.payload);
    return 'ok';
  }

  presenceState(): Record<string, Record<string, unknown>[]> {
    const state: Record<string, Record<string, unknown>[]> = {};
    for (const channel of this.hub.members(this.topic)) {
      if (channel.meta) state[channel.key] = [{ ...channel.meta, presence_ref: `ref-${channel.key}` }];
    }
    return state;
  }

  emit(type: string, event: string, payload: unknown): void {
    for (const listener of this.listeners) {
      if (listener.type === type && listener.event === event) listener.callback(payload);
    }
  }
}

function fakeClient(hub: FakeHub, session = true) {
  const channels: FakeChannel[] = [];
  return {
    channels,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: session ? { user: { id: 'user-id' } } : null }, error: null })),
      signInAnonymously: vi.fn()
    },
    realtime: { setAuth: vi.fn(async () => undefined) },
    channel: vi.fn((topic: string, options: ChannelOptions) => {
      const channel = new FakeChannel(hub, topic, options);
      channels.push(channel);
      return channel;
    }),
    removeChannel: vi.fn(async (channel: FakeChannel) => {
      await new Promise((resolve) => setTimeout(resolve, 1)); // a round trip to the server
      hub.channels.delete(channel);
      hub.syncPresence(channel.topic);
      return 'ok';
    })
  };
}

const TOPIC = 'room:AB9A9A';
const CODE_BYTES = Uint8Array.from([0, 1, 31, 32, 255, 64]); // AB9A9A
let ids = 0;

interface PlayerOptions {
  session?: boolean;
  offsetMs?: number;
  codes?: Uint8Array[];
  serverTime?: () => Promise<ServerTime>;
}

function player(hub: FakeHub, options: PlayerOptions = {}) {
  const client = fakeClient(hub, options.session);
  const codes = [...(options.codes ?? [])];
  const offsetMs = options.offsetMs ?? 0;
  const service = createRoomService({
    getClient: async () => client as unknown as SupabaseClient,
    getServerTime: options.serverTime ?? (async () => ({ serverTimeMs: Date.now() + offsetMs, offsetMs, roundTripMs: 20 })),
    randomBytes: (length) => (codes.shift() ?? CODE_BYTES).slice(0, length),
    newId: () => `client-${String(++ids).padStart(4, '0')}`,
    joinTimeoutMs: 100
  });
  return { client, ...service };
}

// Rounds of timers rather than a fixed delay: each hop of the fake network is a timer, and timers keep their
// order whatever the clock's granularity
const settle = async () => {
  for (let round = 0; round < 8; round++) await new Promise((resolve) => setTimeout(resolve, 2));
};

function record(handle: RoomHandle): RoomEvent[] {
  const events: RoomEvent[] = [];
  handle.onEvent((event) => events.push(event));
  return events;
}

const messagesIn = (events: RoomEvent[]): RoomMessage[] =>
  events.flatMap((event) => (event.type === 'message' ? [event.message] : []));

/** Host and guest seated, with the events of getting there already consumed. */
async function duel() {
  const hub = new FakeHub();
  const hostPlayer = player(hub);
  const host = await hostPlayer.createRoom();
  const hostEvents = record(host);
  const guestPlayer = player(hub);
  const guest = await guestPlayer.joinRoom(host.code);
  const guestEvents = record(guest);
  await settle();
  hostEvents.length = 0;
  guestEvents.length = 0;
  return {
    hub, host, guest, hostPlayer, guestPlayer, hostEvents, guestEvents,
    hostChannel: hostPlayer.client.channels[0],
    guestChannel: guestPlayer.client.channels[0]
  };
}

const HELLO = { type: 'hello', nickname: 'Ana Lima', ready: false } as const;
const progress = (score: number, finished = false): ProgressMessage =>
  ({ type: 'progress', score, combo: 0, accuracy: 100, positionMs: score, finished });

afterEach(() => {
  vi.useRealTimers();
});

describe('room codes', () => {
  it('uses 6 symbols of an alphabet without look-alikes, from random bytes', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01IO]/);
    expect(generateRoomCode(() => CODE_BYTES)).toBe('AB9A9A');
    expect(generateRoomCode()).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`));
  });

  it('normalizes what the player types and refuses impossible codes', () => {
    expect(normalizeRoomCode(' ab9a9a ')).toBe('AB9A9A');
    for (const code of ['ABCDE', 'ABCDEFG', 'ABCDE0', 'ABCDEI', 'ABC DE', '']) expect(normalizeRoomCode(code), code).toBeNull();
  });
});

describe('parseRoomMessage', () => {
  it('keeps valid messages and drops unknown fields', () => {
    expect(parseRoomMessage({ ...HELLO, partId: 2, trackName: 'Lead', extra: 'x' }))
      .toEqual({ type: 'hello', nickname: 'Ana Lima', partId: 2, trackName: 'Lead', ready: false });
    expect(parseRoomMessage(HELLO)).toEqual(HELLO);
    expect(parseRoomMessage({ type: 'select_song', songId: -1, partId: 0, revisionId: 5, title: 'T', artist: 'A', trackName: 'L' }))
      .toEqual({ type: 'select_song', songId: -1, partId: 0, revisionId: 5, title: 'T', artist: 'A', trackName: 'L' });
    expect(parseRoomMessage({ type: 'select_part', partId: 1, trackName: 'L' })).toEqual({ type: 'select_part', partId: 1, trackName: 'L' });
    expect(parseRoomMessage({ type: 'ready', ready: true })).toEqual({ type: 'ready', ready: true });
    expect(parseRoomMessage({ type: 'start', startAtServerMs: 1234 })).toEqual({ type: 'start', startAtServerMs: 1234 });
    expect(parseRoomMessage({ type: 'progress', score: 10, combo: 2, accuracy: 97.5, positionMs: 1200.5, finished: false }))
      .toEqual({ type: 'progress', score: 10, combo: 2, accuracy: 97.5, positionMs: 1200.5, finished: false });
    expect(parseRoomMessage({ type: 'leave', from: 'x' })).toEqual({ type: 'leave' });
  });

  it.each([
    null, 'hello', [], 7, { type: 'unknown' },
    { ...HELLO, nickname: 'Puta' }, { ...HELLO, nickname: '  Ana  ' }, { ...HELLO, nickname: 5 }, { ...HELLO, ready: 'yes' },
    { ...HELLO, partId: -1 }, { ...HELLO, trackName: 'x'.repeat(201) },
    { type: 'select_song', songId: 7, partId: 0, title: 'x'.repeat(201), artist: 'A', trackName: 'L' },
    { type: 'select_song', songId: 7.5, partId: 0, title: 'T', artist: 'A', trackName: 'L' },
    { type: 'select_song', songId: 7, partId: 0, revisionId: -1, title: 'T', artist: 'A', trackName: 'L' },
    { type: 'select_part', partId: 1.5, trackName: 'L' },
    { type: 'ready' },
    { type: 'start', startAtServerMs: -5 }, { type: 'start', startAtServerMs: 0 }, { type: 'start', startAtServerMs: '9' },
    { type: 'progress', score: 10, combo: 2, accuracy: 101, positionMs: 0, finished: false },
    { type: 'progress', score: 10, combo: 2, accuracy: Number.NaN, positionMs: 0, finished: false },
    { type: 'progress', score: -1, combo: 2, accuracy: 50, positionMs: 0, finished: false },
    { type: 'progress', score: 1, combo: 2, accuracy: 50, positionMs: Number.POSITIVE_INFINITY, finished: false },
    { type: 'progress', score: 1, combo: 2, accuracy: 50, positionMs: 0 }
  ])('drops %j', (value) => {
    expect(parseRoomMessage(value)).toBeNull();
  });
});

describe('entering a room', () => {
  it('needs a configured backend and an existing session, and never creates an account', async () => {
    const hub = new FakeHub();
    const anonymous = player(hub, { session: false });
    await expect(anonymous.createRoom()).rejects.toMatchObject({ name: 'RoomError', code: 'not_authenticated' });
    await expect(anonymous.joinRoom('AB9A9A')).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(anonymous.client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(anonymous.client.channel).not.toHaveBeenCalled();
    const unconfigured = createRoomService({ getClient: async () => null });
    await expect(unconfigured.joinRoom('AB9A9A')).rejects.toMatchObject({ code: 'not_configured' });
    await expect(player(hub).joinRoom('ABC')).rejects.toMatchObject({ code: 'invalid_code' });
  });

  it('reports network when supabase-js or the server clock are out of reach', async () => {
    const offline = createRoomService({ getClient: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(offline.createRoom()).rejects.toMatchObject({ code: 'network' });
    const noClock = player(new FakeHub(), { serverTime: () => Promise.reject(new Error('down')) });
    await expect(noClock.createRoom()).rejects.toMatchObject({ code: 'network' });
  });

  it('opens a private channel with the session token and seats host and guest', async () => {
    const hub = new FakeHub();
    const hostPlayer = player(hub);
    const host = await hostPlayer.createRoom();
    const hostEvents = record(host);
    const guestPlayer = player(hub);
    const guest = await guestPlayer.joinRoom(host.code.toLowerCase());
    const guestEvents = record(guest);
    await settle();

    const [hostChannel] = hostPlayer.client.channels;
    const [guestChannel] = guestPlayer.client.channels;
    expect([host.code, host.role, guest.role]).toEqual(['AB9A9A', 'host', 'guest']);
    expect(guestChannel).toMatchObject({ topic: TOPIC, isPrivate: true });
    expect(guestPlayer.client.realtime.setAuth).toHaveBeenCalled();
    expect(hostEvents).toEqual([{ type: 'peer_joined', peer: { id: guestChannel.key, role: 'guest' } }]);
    expect(guestEvents).toEqual([{ type: 'peer_joined', peer: { id: hostChannel.key, role: 'host' } }]);
    expect(host.getPeers()).toEqual([{ id: guestChannel.key, role: 'guest' }]);
    expect(guest.getPeers()).toEqual([{ id: hostChannel.key, role: 'host' }]);
  });

  it('shares no user id: presence holds a random id, the role and the join time', async () => {
    const { hostChannel } = await duel();
    expect(hostChannel.meta).toEqual({ role: 'host', joinedAt: expect.any(Number) });
    expect(JSON.stringify([hostChannel.key, hostChannel.meta, hostChannel.sent])).not.toContain('user-id');
  });

  it('turns a third player away with room_full and closes its channel', async () => {
    const { hub, host } = await duel();
    const third = player(hub);
    await expect(third.joinRoom(host.code)).rejects.toMatchObject({ code: 'room_full' });
    // Already gone when the call rejects, so trying the code again gets a new channel
    expect(hub.channels.has(third.client.channels[0])).toBe(false);
    await settle();
    expect(hub.members(TOPIC).filter((channel) => channel.meta)).toHaveLength(2);
    expect(host.getPeers()).toHaveLength(1);
  });

  it('gives only one of two simultaneous guests the seat', async () => {
    const hub = new FakeHub();
    const host = await player(hub).createRoom();
    const results = await Promise.allSettled([player(hub).joinRoom(host.code), player(hub).joinRoom(host.code)]);
    expect(results.map((result) => (result.status === 'fulfilled' ? 'joined' : result.reason.code)).sort())
      .toEqual(['joined', 'room_full']);
  });

  it('reports room_not_found when nobody hosts the code, even with another guest waiting', async () => {
    await expect(player(new FakeHub()).joinRoom('ZZZZZZ')).rejects.toMatchObject({ code: 'room_not_found' });
    const hub = new FakeHub();
    const results = await Promise.allSettled([player(hub).joinRoom('ZZZZZZ'), player(hub).joinRoom('ZZZZZZ')]);
    expect(results.map((result) => (result.status === 'rejected' ? result.reason.code : 'joined')))
      .toEqual(['room_not_found', 'room_not_found']);
  });

  it('picks another code when the one drawn is already hosted', async () => {
    const hub = new FakeHub();
    await player(hub).createRoom();
    const other = player(hub, { codes: [CODE_BYTES, Uint8Array.from([2, 2, 2, 2, 2, 2])] });
    const room = await other.createRoom();
    expect([room.code, room.role]).toEqual(['CCCCCC', 'host']);
    expect(other.client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('reports not_authenticated when Realtime refuses the channel, and network when it does not answer', async () => {
    const hub = new FakeHub();
    hub.refuseJoin = 'Unauthorized: You do not have permissions to read from this Channel topic: room:AB9A9A';
    await expect(player(hub).createRoom()).rejects.toMatchObject({ code: 'not_authenticated' });
    hub.refuseJoin = 'Something else';
    await expect(player(hub).joinRoom('AB9A9A')).rejects.toMatchObject({ code: 'network' });
    const silent = new FakeHub();
    silent.silent = true;
    await expect(player(silent).joinRoom('AB9A9A')).rejects.toMatchObject({ code: 'network' });
  });
});

describe('messages', () => {
  it('delivers valid messages from the other player and drops the rest', async () => {
    const { host, guest, hostEvents, guestEvents, hostChannel, guestChannel } = await duel();

    await guest.send({ ...HELLO, partId: 1, trackName: 'Bass' });
    await host.send({ type: 'select_song', songId: 7, partId: 0, title: 'Song', artist: 'Band', trackName: 'Lead' });
    // Not a valid message, or not one a guest can send
    await expect(guest.send({ type: 'start', startAtServerMs: 1 })).rejects.toMatchObject({ code: 'invalid_message' });
    await expect(guest.send({ type: 'select_song', songId: 7, partId: 0, title: 'T', artist: 'A', trackName: 'L' }))
      .rejects.toMatchObject({ code: 'invalid_message' });
    await expect(guest.send({ type: 'ready' } as never)).rejects.toMatchObject({ code: 'invalid_message' });
    // Forged broadcasts: host-only messages from the guest, garbage, and someone who holds no seat
    const forge = (from: string, message: Record<string, unknown>) =>
      guestChannel.send({ type: 'broadcast', event: 'room', payload: { from, message } });
    await forge(guestChannel.key, { type: 'start', startAtServerMs: 5 });
    await forge(guestChannel.key, { type: 'select_song', songId: 7, partId: 0, title: 'T', artist: 'A', trackName: 'L' });
    await forge(guestChannel.key, { type: 'progress', score: -3 });
    await forge('stranger', { type: 'ready', ready: true });
    await settle();

    expect(hostEvents).toEqual([{
      type: 'message',
      from: { id: guestChannel.key, role: 'guest' },
      message: { type: 'hello', nickname: 'Ana Lima', partId: 1, trackName: 'Bass', ready: false }
    }]);
    expect(guestEvents).toEqual([{
      type: 'message',
      from: { id: hostChannel.key, role: 'host' },
      message: { type: 'select_song', songId: 7, partId: 0, title: 'Song', artist: 'Band', trackName: 'Lead' }
    }]);
  });

  it('keeps what happens before the first listener, as the host greeting a guest still joining', async () => {
    const hub = new FakeHub();
    const host = await player(hub).createRoom();
    host.onEvent((event) => {
      if (event.type === 'peer_joined') void host.send(HELLO);
    });
    const guest = await player(hub).joinRoom(host.code);
    await settle();
    const events = record(guest);
    await settle();
    expect(events.map((event) => event.type)).toEqual(['peer_joined', 'message']);
    expect(messagesIn(events)).toEqual([HELLO]);
  });

  it('keeps messages that arrive before the sender shows up in presence', async () => {
    const hub = new FakeHub();
    const host = await player(hub).createRoom();
    const events = record(host);
    const early = new FakeChannel(hub, TOPIC, { config: { private: true, presence: { key: 'early-guest' } } });
    hub.channels.add(early);
    await early.send({ type: 'broadcast', event: 'room', payload: { from: 'early-guest', message: HELLO } });
    await settle();
    expect(events).toEqual([]);
    await early.track({ role: 'guest', joinedAt: Date.now() });
    await settle();
    expect(events.map((event) => event.type)).toEqual(['peer_joined', 'message']);
  });

  it('sends progress at most 4 times per second, keeping the latest, and finished at once', async () => {
    const { guest, guestChannel } = await duel();
    vi.useFakeTimers();
    const sentProgress = () => guestChannel.sent.filter(({ message }) => message.type === 'progress');

    for (let score = 1; score <= 20; score++) {
      await guest.send(progress(score));
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(300);

    const sent = sentProgress();
    expect(sent.length).toBeGreaterThanOrEqual(4);
    expect(sent.length).toBeLessThanOrEqual(5);
    expect(sent.at(-1)?.message.score).toBe(20);
    const times = guestChannel.sentAt.slice(-sent.length);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(250);

    await guest.send(progress(21));
    await guest.send(progress(22, true));
    expect(sentProgress().at(-1)?.message).toMatchObject({ score: 22, finished: true });
  });
});

describe('starting together', () => {
  it('schedules the start on the server clock and converts it to each local clock', async () => {
    const hub = new FakeHub();
    const host = await player(hub, { offsetMs: 1000 }).createRoom();
    const guest = await player(hub, { offsetMs: -500 }).joinRoom(host.code);
    const events = record(guest);
    const before = Date.now();
    const hostLocalStart = await host.scheduleStart();
    await settle();

    const [start] = messagesIn(events);
    const startAtServerMs = start?.type === 'start' ? start.startAtServerMs : 0;
    expect(startAtServerMs).toBeGreaterThan(0);
    // Both local times point at the same server instant, about 4 s ahead
    expect(hostLocalStart).toBe(startAtServerMs - 1000);
    expect(guest.localStartTimeFor(startAtServerMs)).toBe(startAtServerMs + 500);
    expect(hostLocalStart - before).toBeGreaterThanOrEqual(3990);
    expect(hostLocalStart - before).toBeLessThanOrEqual(4500);
  });

  it('is only for the host, and keeps the known offset if the clock cannot be read again', async () => {
    const { guest } = await duel();
    await expect(guest.scheduleStart()).rejects.toMatchObject({ code: 'invalid_message' });

    const clock = vi.fn(async (): Promise<ServerTime> => ({ serverTimeMs: 0, offsetMs: 1000, roundTripMs: 20 }));
    const host = await player(new FakeHub(), { serverTime: clock }).createRoom();
    clock.mockRejectedValueOnce(new Error('down'));
    const before = Date.now();
    const localStart = await host.scheduleStart(2000);
    expect(host.localStartTimeFor(localStart + 1000)).toBe(localStart);
    expect(localStart - before).toBeGreaterThanOrEqual(1990);
    expect(localStart - before).toBeLessThanOrEqual(2500);
  });
});

describe('leaving and connection problems', () => {
  it('leaves cleanly: the other player gets leave and peer_left', async () => {
    const { host, guest, guestPlayer, hostEvents, guestEvents } = await duel();
    await guest.leave();
    await settle();

    expect(hostEvents.map((event) => (event.type === 'message' ? event.message.type : event.type))).toEqual(['leave', 'peer_left']);
    expect(guestEvents).toEqual([{ type: 'closed' }]);
    expect(guestPlayer.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(host.getPeers()).toEqual([]);
    expect(guest.getPeers()).toEqual([]);
    await expect(guest.send(HELLO)).rejects.toMatchObject({ code: 'room_closed' });
    await guest.leave(); // a second call does nothing
    expect(guestPlayer.client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('treats sending leave as leaving', async () => {
    const { guest, guestPlayer } = await duel();
    await guest.send({ type: 'leave' });
    expect(guestPlayer.client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('survives a dropped connection: no REST fallback, same seat, queued progress goes out', async () => {
    const { hub, guest, guestChannel, hostEvents, guestEvents } = await duel();
    const joinedAt = guestChannel.meta?.joinedAt;

    hub.drop(guestChannel);
    hub.drop(guestChannel); // Realtime keeps retrying: one warning is enough
    await settle();
    expect(guestEvents).toEqual([{ type: 'error', code: 'network' }]);
    expect(hostEvents.map((event) => event.type)).toEqual(['peer_left']);

    const sentBefore = guestChannel.sent.length;
    await expect(guest.send({ type: 'ready', ready: true })).rejects.toMatchObject({ code: 'network' });
    await guest.send(progress(50));
    await guest.send(progress(60, true));
    expect(guestChannel.sent).toHaveLength(sentBefore);

    hub.restore(guestChannel);
    await settle();
    expect(guestEvents.at(-1)).toEqual({ type: 'reconnected' });
    expect(guestChannel.meta?.joinedAt).toBe(joinedAt);
    expect(guestChannel.sent).toHaveLength(sentBefore + 1);
    expect(guestChannel.sent.at(-1)?.message).toMatchObject({ type: 'progress', score: 60, finished: true });
    expect(hostEvents.map((event) => event.type)).toEqual(['peer_left', 'peer_joined', 'message']);
  });

  it('closes the room when Realtime closes the channel for good', async () => {
    const { hub, guest, guestChannel, guestEvents } = await duel();
    hub.close(guestChannel);
    await settle();
    expect(guestEvents).toEqual([{ type: 'error', code: 'network' }, { type: 'closed' }]);
    await expect(guest.send(HELLO)).rejects.toMatchObject({ code: 'room_closed' });
  });

  it('gives up the seat if the presence says another guest arrived first', async () => {
    const { hub, guestEvents } = await duel();
    const earlier = new FakeChannel(hub, TOPIC, { config: { private: true, presence: { key: 'earlier-guest' } } });
    hub.channels.add(earlier);
    await earlier.track({ role: 'guest', joinedAt: 0 });
    await settle();
    expect(guestEvents).toEqual([{ type: 'error', code: 'room_full' }, { type: 'closed' }]);
  });

  it('ignores presence entries without a valid role or time', async () => {
    const { hub, host } = await duel();
    const odd = new FakeChannel(hub, TOPIC, { config: { private: true, presence: { key: 'odd' } } });
    hub.channels.add(odd);
    await odd.track({ role: 'referee', joinedAt: 0 });
    await settle();
    expect(host.getPeers()).toHaveLength(1);
  });

  it('stops delivering to a listener that was removed', async () => {
    const { host, guest } = await duel();
    const events: RoomEvent[] = [];
    const stop = host.onEvent((event) => events.push(event));
    stop();
    await guest.send(HELLO);
    await settle();
    expect(events).toEqual([]);
  });
});
