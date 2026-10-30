import { RealtimeClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createRoomService, type RoomEvent, type RoomHandle } from './roomChannel';

// The room service on the real Realtime client, with only the network replaced: a tiny Phoenix server in memory
// that answers joins, keeps presence and relays broadcasts like Supabase Realtime. It checks what the fake channel
// of roomChannel.test.ts assumes about the library: presence shape, sync events, the join payload of a private
// channel and rejoining after a dropped socket. Protocol 1.0.0 is plain JSON; 2.0.0 only encodes frames differently.
type Frame = { topic: string; event: string; payload: Record<string, never>; ref: string | null; join_ref?: string | null };
type Metas = Record<string, { metas: Record<string, unknown>[] }>;

interface Member {
  key: string;
  meta: Record<string, unknown> | null; // includes phx_ref: Phoenix matches a leave to its join by that ref
}

class FakeSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly server: FakeServer;
  readonly url: string;
  readonly protocol = '';
  binaryType = 'arraybuffer';
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(server: FakeServer, url: string) {
    this.server = server;
    this.url = url;
    setTimeout(() => {
      this.readyState = this.OPEN;
      this.onopen?.({});
    }, 0);
  }

  send(data: string): void {
    this.server.receive(this, JSON.parse(data) as Frame);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === this.CLOSED) return;
    this.readyState = this.CLOSED;
    this.server.forget(this);
    setTimeout(() => this.onclose?.({ code, reason, wasClean: code === 1000 }), 0);
  }

  deliver(frame: Record<string, unknown>): void {
    setTimeout(() => {
      if (this.readyState === this.OPEN) this.onmessage?.({ data: JSON.stringify(frame) });
    }, 0);
  }
}

class FakeServer {
  readonly topics = new Map<string, Map<FakeSocket, Member>>();
  readonly joins: Record<string, unknown>[] = [];
  refuse: string | null = null;
  #refs = 0;

  socketClass(): new (url: string) => FakeSocket {
    const server = this as FakeServer;
    return class extends FakeSocket {
      constructor(url: string) {
        super(server, url);
      }
    };
  }

  #reply(socket: FakeSocket, frame: Frame, status: 'ok' | 'error', response: Record<string, unknown> = {}): void {
    socket.deliver({
      topic: frame.topic, event: 'phx_reply', ref: frame.ref, join_ref: frame.join_ref, payload: { status, response }
    });
  }

  #metas(member: Member): Metas {
    return member.meta ? { [member.key]: { metas: [member.meta] } } : {};
  }

  #diff(topic: string, joins: Metas, leaves: Metas, except?: FakeSocket): void {
    for (const [socket] of this.topics.get(topic) ?? []) {
      if (socket !== except) socket.deliver({ topic, event: 'presence_diff', ref: null, payload: { joins, leaves } });
    }
  }

  #remove(topic: string, socket: FakeSocket): void {
    const members = this.topics.get(topic);
    const member = members?.get(socket);
    if (!members || !member) return;
    members.delete(socket);
    this.#diff(topic, {}, this.#metas(member));
  }

  forget(socket: FakeSocket): void {
    for (const topic of this.topics.keys()) this.#remove(topic, socket);
  }

  receive(socket: FakeSocket, frame: Frame): void {
    const { topic, event, payload } = frame;
    const members = this.topics.get(topic) ?? new Map<FakeSocket, Member>();
    this.topics.set(topic, members);
    const member = members.get(socket);

    if (event === 'heartbeat') {
      this.#reply(socket, frame, 'ok');
    } else if (event === 'phx_join') {
      this.joins.push(payload);
      if (this.refuse) {
        this.#reply(socket, frame, 'error', { reason: this.refuse });
        return;
      }
      const config = payload.config as unknown as { presence: { key: string } };
      members.set(socket, { key: config.presence.key, meta: null });
      this.#reply(socket, frame, 'ok', { postgres_changes: [] });
      const state: Metas = {};
      for (const other of members.values()) Object.assign(state, this.#metas(other));
      socket.deliver({ topic, event: 'presence_state', ref: null, payload: state });
    } else if (event === 'presence' && member) {
      const { event: action, payload: meta } = payload as unknown as { event: string; payload: Record<string, unknown> };
      this.#reply(socket, frame, 'ok');
      if (action === 'track') {
        member.meta = { ...meta, phx_ref: `ref-${++this.#refs}` };
        this.#diff(topic, this.#metas(member), {});
      } else {
        const leaves = this.#metas(member);
        member.meta = null;
        this.#diff(topic, {}, leaves);
      }
    } else if (event === 'broadcast') {
      for (const [other] of members) {
        if (other !== socket) other.deliver({ topic, event: 'broadcast', ref: null, payload });
      }
    } else if (event === 'phx_leave') {
      this.#reply(socket, frame, 'ok');
      socket.deliver({ topic, event: 'phx_close', ref: frame.join_ref, payload: {} });
      this.#remove(topic, socket);
    }
  }

  /** The network drops for the player in this role. */
  dropConnection(role: 'host' | 'guest'): void {
    for (const members of this.topics.values()) {
      for (const [socket, member] of members) {
        if (member.meta?.role === role) socket.close(1006, 'network');
      }
    }
  }
}

function realClient(server: FakeServer) {
  const realtime = new RealtimeClient('ws://realtime.test/socket', {
    params: { apikey: 'public-key' },
    transport: server.socketClass() as never,
    vsn: '1.0.0',
    accessToken: async () => 'session-token',
    reconnectAfterMs: () => 5,
    timeout: 1000
  });
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-id' } } }, error: null }) },
    realtime,
    channel: (...args: Parameters<RealtimeClient['channel']>) => realtime.channel(...args),
    removeChannel: (channel: Parameters<RealtimeClient['removeChannel']>[0]) => realtime.removeChannel(channel)
  };
  return client as unknown as SupabaseClient;
}

function service(server: FakeServer) {
  const client = realClient(server);
  return createRoomService({
    getClient: async () => client,
    getServerTime: async () => ({ serverTimeMs: Date.now(), offsetMs: 0, roundTripMs: 10 }),
    joinTimeoutMs: 500
  });
}

function record(handle: RoomHandle): RoomEvent[] {
  const events: RoomEvent[] = [];
  handle.onEvent((event) => events.push(event));
  return events;
}

const types = (events: RoomEvent[]) => events.map((event) => (event.type === 'message' ? event.message.type : event.type));

describe('rooms on the real Realtime client', () => {
  it('joins a private channel with the session token and plays a whole duel', async () => {
    const server = new FakeServer();
    const host = await service(server).createRoom();
    const hostEvents = record(host);
    const guest = await service(server).joinRoom(host.code);
    const guestEvents = record(guest);

    await vi.waitFor(() => expect(types(hostEvents)).toEqual(['peer_joined']));
    await vi.waitFor(() => expect(types(guestEvents)).toEqual(['peer_joined']));
    expect(server.joins).toHaveLength(2);
    for (const join of server.joins) {
      expect(join).toMatchObject({ access_token: 'session-token', config: { private: true, broadcast: { self: false } } });
    }

    await guest.send({ type: 'hello', nickname: 'Ana Lima', ready: true });
    await host.send({ type: 'select_song', songId: 7, partId: 0, title: 'Song', artist: 'Band', trackName: 'Lead' });
    const localStart = await host.scheduleStart(1000);
    await guest.send({ type: 'progress', score: 150, combo: 1, accuracy: 100, positionMs: 500, finished: true });

    await vi.waitFor(() => expect(types(hostEvents)).toEqual(['peer_joined', 'hello', 'progress']));
    await vi.waitFor(() => expect(types(guestEvents)).toEqual(['peer_joined', 'select_song', 'start']));
    const start = guestEvents.at(-1);
    expect(start?.type === 'message' && start.message).toMatchObject({ type: 'start' });
    expect(localStart).toBeGreaterThan(Date.now());

    await guest.leave();
    await vi.waitFor(() => expect(types(hostEvents).slice(-2)).toEqual(['leave', 'peer_left']));
    expect(types(guestEvents).at(-1)).toBe('closed');
    expect(host.getPeers()).toEqual([]);
    await host.leave();
  });

  it('turns a third player away and refuses a code nobody hosts', async () => {
    const server = new FakeServer();
    const host = await service(server).createRoom();
    await service(server).joinRoom(host.code);
    await expect(service(server).joinRoom(host.code)).rejects.toMatchObject({ code: 'room_full' });
    await expect(service(server).joinRoom('ZZZZZZ')).rejects.toMatchObject({ code: 'room_not_found' });
  });

  it('maps a join refused by the Realtime policies to not_authenticated', async () => {
    const server = new FakeServer();
    server.refuse = 'Unauthorized: You do not have permissions to read from this Channel topic: room:AB9A9A';
    await expect(service(server).createRoom()).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('rejoins after a dropped socket, tracking presence again with the same seat', async () => {
    const server = new FakeServer();
    const host = await service(server).createRoom();
    const hostEvents = record(host);
    const guest = await service(server).joinRoom(host.code);
    const guestEvents = record(guest);
    await vi.waitFor(() => expect(types(hostEvents)).toEqual(['peer_joined']));

    server.dropConnection('guest');
    await vi.waitFor(() => expect(types(guestEvents)).toContain('error'));
    await vi.waitFor(() => expect(types(guestEvents)).toContain('reconnected'), { timeout: 3000 });
    await vi.waitFor(() => expect(types(hostEvents)).toEqual(['peer_joined', 'peer_left', 'peer_joined']), { timeout: 3000 });

    await guest.send({ type: 'ready', ready: true });
    await vi.waitFor(() => expect(types(hostEvents).at(-1)).toBe('ready'));
    await guest.leave();
    await host.leave();
  });
});
