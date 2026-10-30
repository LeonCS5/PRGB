// Online duel rooms (host + guest) over Supabase Realtime: Broadcast carries the game messages and Presence
// tells who is in the room, on the private channel room:<CODE> (policies in the _room_realtime migration).
// Nothing is written to any table, and no user id is shared: each connection has a random id. Only players
// with a session can join (the app asks for 18+ consent and room acceptance first); this service never
// creates an account. The two-seat limit is enforced by the clients: Realtime can't count who is in a channel.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { validateNickname } from '../nickname';
import { getServerTime as fetchServerTime, toRankingError, type ServerTime } from './rankingApi';
import { getSupabaseClient } from './supabaseClient';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CAPACITY = 2;
export const START_LEAD_MS = 4000;
export const PROGRESS_INTERVAL_MS = 250; // at most 4 progress messages per second
export const JOIN_TIMEOUT_MS = 5000;

const BROADCAST_EVENT = 'room';
const TEXT_MAX = 200;
const EARLY_MAX = 20;
const EARLY_TTL_MS = 5000;
const BACKLOG_MAX = 50;
const CREATE_ATTEMPTS = 3;
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export type RoomRole = 'host' | 'guest';

export type RoomErrorCode =
  | 'not_configured'
  | 'not_authenticated' // no session, or Realtime refused it
  | 'network'
  | 'room_full' // already two players
  | 'room_not_found' // nobody hosting this code
  | 'invalid_code'
  | 'invalid_message' // malformed outgoing message, or one this role can't send
  | 'room_closed'; // send() after leave()

export class RoomError extends Error {
  readonly code: RoomErrorCode;

  constructor(code: RoomErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'RoomError';
    this.code = code;
  }
}

export interface HelloMessage {
  type: 'hello';
  nickname: string;
  partId?: number;
  trackName?: string;
  ready: boolean;
}

/** Host only: the song both play. */
export interface SelectSongMessage {
  type: 'select_song';
  songId: number;
  partId: number;
  revisionId?: number;
  title: string;
  artist: string;
  trackName: string;
}

/** Each player picks their own part of the song. */
export interface SelectPartMessage {
  type: 'select_part';
  partId: number;
  trackName: string;
}

export interface ReadyMessage {
  type: 'ready';
  ready: boolean;
}

/** Host only: when both start, on the server clock (see RoomHandle.localStartTimeFor). */
export interface StartMessage {
  type: 'start';
  startAtServerMs: number;
}

export interface ProgressMessage {
  type: 'progress';
  score: number;
  combo: number;
  accuracy: number;
  positionMs: number;
  finished: boolean;
}

export interface LeaveMessage {
  type: 'leave';
}

export type RoomMessage =
  | HelloMessage
  | SelectSongMessage
  | SelectPartMessage
  | ReadyMessage
  | StartMessage
  | ProgressMessage
  | LeaveMessage;

/** The other player; `id` is random per connection. */
export interface RoomPeer {
  id: string;
  role: RoomRole;
}

export type RoomEvent =
  | { type: 'peer_joined'; peer: RoomPeer } // also when the peer comes back after a dropped connection
  | { type: 'peer_left'; peer: RoomPeer } // a dropped connection too; a `leave` message comes first when they quit
  | { type: 'message'; from: RoomPeer; message: RoomMessage }
  // network: connection lost, Realtime keeps retrying (see reconnected); room_full: lost the seat, the room closes
  | { type: 'error'; code: RoomErrorCode }
  | { type: 'reconnected' }
  | { type: 'closed' };

export interface RoomHandle {
  readonly code: string;
  readonly role: RoomRole;
  /** Returns a function that removes the listener. The first listener also gets what happened before it. */
  onEvent(listener: (event: RoomEvent) => void): () => void;
  /**
   * Validates and broadcasts. Progress is throttled to 4 per second keeping the latest (finished: true goes at
   * once) and waits for the reconnection when offline; other messages reject with `network` while offline.
   * `{ type: 'leave' }` is the same as leave().
   */
  send(message: RoomMessage): Promise<void>;
  getPeers(): RoomPeer[];
  /** Host only: sends start a few seconds ahead on the server clock; returns the local start time. */
  scheduleStart(leadMs?: number): Promise<number>;
  /**
   * Server time of a start message as a local Date.now() time. For audio, schedule on the AudioContext clock:
   * ctx.currentTime + (localStart - Date.now()) / 1000.
   */
  localStartTimeFor(startAtServerMs: number): number;
  leave(): Promise<void>;
}

export interface RoomService {
  /** Opens a new room as host with a fresh code (a code someone already hosts is skipped). */
  createRoom(): Promise<RoomHandle>;
  /** Joins a hosted room as guest: room_not_found when nobody hosts it, room_full with two players. */
  joinRoom(code: string): Promise<RoomHandle>;
}

export interface RoomDeps {
  getClient: () => Promise<SupabaseClient | null>;
  getServerTime: () => Promise<ServerTime>;
  randomBytes: (length: number) => Uint8Array;
  newId: () => string;
  joinTimeoutMs: number;
}

const DEFAULT_DEPS: RoomDeps = {
  getClient: getSupabaseClient,
  getServerTime: fetchServerTime,
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  newId: () => crypto.randomUUID(),
  joinTimeoutMs: JOIN_TIMEOUT_MS
};

// Codes ---------------------------------------------------------------------------------------------------

/** 32 symbols divide 256, so a random byte modulo 32 keeps every symbol equally likely. */
export function generateRoomCode(randomBytes: RoomDeps['randomBytes'] = DEFAULT_DEPS.randomBytes): string {
  return Array.from(randomBytes(ROOM_CODE_LENGTH), (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length])
    .join('');
}

/** Trimmed and uppercased code, or null when it can't be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

// Messages (validated both ways: a peer's payload is untrusted) ----------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= TEXT_MAX;

/** A clean copy of a valid message, or null. Unknown fields are dropped. */
export function parseRoomMessage(value: unknown): RoomMessage | null {
  if (!isRecord(value)) return null;
  const v = value;
  switch (v.type) {
    case 'hello': {
      const nickname = typeof v.nickname === 'string' ? validateNickname(v.nickname) : null;
      if (!nickname?.ok || nickname.value !== v.nickname || typeof v.ready !== 'boolean') return null;
      if (v.partId !== undefined && !isCount(v.partId)) return null;
      if (v.trackName !== undefined && !isText(v.trackName)) return null;
      return {
        type: 'hello',
        nickname: nickname.value,
        ...(v.partId !== undefined ? { partId: v.partId } : {}),
        ...(v.trackName !== undefined ? { trackName: v.trackName } : {}),
        ready: v.ready
      };
    }
    case 'select_song':
      if (!Number.isSafeInteger(v.songId) || !isCount(v.partId) || !isText(v.title) || !isText(v.artist)
        || !isText(v.trackName) || (v.revisionId !== undefined && !isCount(v.revisionId))) return null;
      return {
        type: 'select_song',
        songId: v.songId as number,
        partId: v.partId,
        ...(v.revisionId !== undefined ? { revisionId: v.revisionId } : {}),
        title: v.title,
        artist: v.artist,
        trackName: v.trackName
      };
    case 'select_part':
      return isCount(v.partId) && isText(v.trackName) ? { type: 'select_part', partId: v.partId, trackName: v.trackName } : null;
    case 'ready':
      return typeof v.ready === 'boolean' ? { type: 'ready', ready: v.ready } : null;
    case 'start':
      return isCount(v.startAtServerMs) && v.startAtServerMs > 0 ? { type: 'start', startAtServerMs: v.startAtServerMs } : null;
    case 'progress':
      if (!isCount(v.score) || !isCount(v.combo) || typeof v.accuracy !== 'number' || !(v.accuracy >= 0 && v.accuracy <= 100)
        || typeof v.positionMs !== 'number' || !(v.positionMs >= 0 && Number.isFinite(v.positionMs))
        || typeof v.finished !== 'boolean') return null;
      return {
        type: 'progress', score: v.score, combo: v.combo, accuracy: v.accuracy, positionMs: v.positionMs,
        finished: v.finished
      };
    case 'leave':
      return { type: 'leave' };
    default:
      return null;
  }
}

const HOST_ONLY: ReadonlySet<RoomMessage['type']> = new Set(['select_song', 'start']);

// Presence ------------------------------------------------------------------------------------------------

interface Member extends RoomPeer {
  joinedAt: number;
}

function readMembers(channel: RealtimeChannel): Member[] {
  const members: Member[] = [];
  for (const [id, metas] of Object.entries(channel.presenceState<{ role?: unknown; joinedAt?: unknown }>())) {
    const meta = metas[0];
    if ((meta?.role === 'host' || meta?.role === 'guest') && typeof meta.joinedAt === 'number') {
      members.push({ id, role: meta.role, joinedAt: meta.joinedAt });
    }
  }
  return members;
}

// The first host and the first guest (by join time, then id) hold the two seats; everyone computes the same
// answer from the same presence state, so a third player knows it has to leave.
function seated(members: Member[]): Member[] {
  const byArrival = (a: Member, b: Member) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const first = (role: RoomRole) => members.filter((member) => member.role === role).sort(byArrival)[0];
  return [first('host'), first('guest')].filter((member): member is Member => member !== undefined)
    .slice(0, ROOM_CAPACITY);
}

// Room ----------------------------------------------------------------------------------------------------

class Room {
  readonly code: string;
  readonly role: RoomRole;
  readonly #client: SupabaseClient;
  readonly #channel: RealtimeChannel;
  readonly #deps: RoomDeps;
  readonly #selfId: string;
  readonly #joinedAt: number;
  readonly #listeners = new Set<(event: RoomEvent) => void>();
  // Events from before the first listener: the host is usually in the room when joinRoom returns
  readonly #backlog: RoomEvent[] = [];
  // Messages from a player not seen in presence yet (their join can arrive after their first message)
  readonly #early: { from: string; at: number; message: RoomMessage }[] = [];
  #offsetMs: number;
  #peer: Member | null = null;
  #joined = false;
  #connected = false;
  #closed = false;
  #lastProgressAt = Number.NEGATIVE_INFINITY;
  #queuedProgress: ProgressMessage | null = null;
  #progressTimer: ReturnType<typeof setTimeout> | null = null;
  #settleJoin: ((error?: RoomError) => void) | null = null;

  constructor(client: SupabaseClient, deps: RoomDeps, code: string, role: RoomRole, offsetMs: number) {
    this.#client = client;
    this.#deps = deps;
    this.code = code;
    this.role = role;
    this.#offsetMs = offsetMs;
    this.#selfId = deps.newId();
    this.#joinedAt = Math.round(Date.now() + offsetMs);
    this.#channel = client.channel(`room:${code}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: this.#selfId } }
    });
  }

  /** Subscribes, takes a seat and waits until the room is usable (guest: until the host is there). */
  join(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const giveUpAfter = (ms: number, code: RoomErrorCode) => {
        clearTimeout(timer);
        timer = setTimeout(() => this.#settleJoin?.(new RoomError(code)), ms);
      };
      this.#settleJoin = (error) => {
        clearTimeout(timer);
        this.#settleJoin = null;
        if (error) {
          // Closed before rejecting, so trying the same code again gets a new channel
          void this.#close(false).finally(() => reject(error));
        } else {
          this.#joined = true;
          resolve();
        }
      };
      // Reaching Realtime gets more time than waiting for the host once inside
      giveUpAfter(this.#deps.joinTimeoutMs * 2, 'network');

      this.#channel
        .on('presence', { event: 'sync' }, () => this.#onPresence())
        .on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => this.#onBroadcast(payload))
        .subscribe((status, error) => {
          const state = `${status}`;
          if (state === 'SUBSCRIBED') {
            if (this.#settleJoin) {
              giveUpAfter(this.#deps.joinTimeoutMs, this.role === 'guest' ? 'room_not_found' : 'network');
            }
            this.#onSubscribed();
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            const refused = /unauthori[sz]ed|permission/i.test(error?.message ?? '');
            this.#onConnectionLost(new RoomError(refused ? 'not_authenticated' : 'network', { cause: error }));
          } else if (state === 'CLOSED' && !this.#closed) {
            // Realtime retries after errors, but a closed channel is gone for good
            this.#onConnectionLost(new RoomError('network'));
            void this.leave();
          }
        });
    });
  }

  #onSubscribed(): void {
    if (this.#closed) return;
    const reconnected = this.#joined && !this.#connected;
    this.#connected = true;
    // Also after reconnecting: presence does not survive a dropped socket. Same joinedAt, so the seat stays.
    void this.#channel.track({ role: this.role, joinedAt: this.#joinedAt }).then(
      (result) => {
        if (result !== 'ok') this.#onConnectionLost(new RoomError('network'));
      },
      (cause: unknown) => this.#onConnectionLost(new RoomError('network', { cause }))
    );
    if (reconnected) {
      this.#emit({ type: 'reconnected' });
      this.#flushProgress();
    }
  }

  #onConnectionLost(error: RoomError): void {
    if (this.#settleJoin) {
      this.#settleJoin(error);
    } else if (this.#connected && !this.#closed) {
      this.#connected = false;
      this.#emit({ type: 'error', code: error.code });
    }
  }

  #emit(event: RoomEvent): void {
    if (this.#listeners.size === 0) {
      if (this.#backlog.length < BACKLOG_MAX) this.#backlog.push(event);
      return;
    }
    for (const listener of [...this.#listeners]) listener(event);
  }

  #onPresence(): void {
    if (this.#closed) return;
    const members = readMembers(this.#channel);
    if (!members.some((member) => member.id === this.#selfId)) return; // our own track() not seen yet
    const seats = seated(members);
    if (!seats.some((member) => member.id === this.#selfId)) {
      if (!this.#settleJoin) {
        this.#emit({ type: 'error', code: 'room_full' });
        void this.leave();
      } else if (seats.some((member) => member.role === 'host')) {
        this.#settleJoin(new RoomError('room_full'));
      }
      return; // no host: a waiting guest ends in room_not_found
    }

    const peer = seats.find((member) => member.id !== this.#selfId) ?? null;
    if (peer?.id !== this.#peer?.id) {
      const previous = this.#peer;
      this.#peer = peer;
      if (previous) this.#emit({ type: 'peer_left', peer: { id: previous.id, role: previous.role } });
      if (peer) {
        this.#emit({ type: 'peer_joined', peer: { id: peer.id, role: peer.role } });
        this.#flushEarly(peer);
      }
    }
    if (this.#settleJoin && (this.role === 'host' || this.#peer?.role === 'host')) this.#settleJoin();
  }

  #onBroadcast(payload: unknown): void {
    if (this.#closed || !isRecord(payload) || typeof payload.from !== 'string' || payload.from === this.#selfId) return;
    const message = parseRoomMessage(payload.message);
    if (!message) return; // invalid payloads are dropped
    if (this.#peer?.id === payload.from) {
      this.#deliver(this.#peer, message);
      return;
    }
    if (this.#early.length >= EARLY_MAX) this.#early.shift();
    this.#early.push({ from: payload.from, at: Date.now(), message });
  }

  #flushEarly(peer: Member): void {
    const oldest = Date.now() - EARLY_TTL_MS;
    for (const entry of this.#early.splice(0)) {
      if (entry.from === peer.id && entry.at >= oldest) this.#deliver(peer, entry.message);
    }
  }

  #deliver(peer: Member, message: RoomMessage): void {
    if (HOST_ONLY.has(message.type) && peer.role !== 'host') return;
    this.#emit({ type: 'message', from: { id: peer.id, role: peer.role }, message });
  }

  async #broadcast(message: RoomMessage): Promise<void> {
    // With the socket down, channel.send() would fall back to one REST call per message
    if (!this.#connected) throw new RoomError('network');
    const result = await this.#channel.send({
      type: 'broadcast',
      event: BROADCAST_EVENT,
      payload: { from: this.#selfId, message }
    });
    if (result !== 'ok') throw new RoomError('network');
  }

  #sendProgress(message: ProgressMessage): Promise<void> {
    this.#lastProgressAt = Date.now();
    return this.#broadcast(message);
  }

  // Only the latest progress matters, so one waiting replaces the other. Offline it waits for the reconnection.
  #queueProgress(message: ProgressMessage): Promise<void> {
    const wait = this.#lastProgressAt + PROGRESS_INTERVAL_MS - Date.now();
    if (this.#connected && (message.finished || wait <= 0)) {
      this.#clearProgressQueue();
      return this.#sendProgress(message);
    }
    this.#queuedProgress = message;
    if (this.#connected) this.#progressTimer ??= setTimeout(() => this.#flushProgress(), wait);
    return Promise.resolve();
  }

  #clearProgressQueue(): void {
    if (this.#progressTimer) clearTimeout(this.#progressTimer);
    this.#progressTimer = null;
    this.#queuedProgress = null;
  }

  #flushProgress(): void {
    const queued = this.#queuedProgress;
    this.#clearProgressQueue();
    if (queued && !this.#closed) {
      this.#sendProgress(queued).catch(() => this.#emit({ type: 'error', code: 'network' }));
    }
  }

  async #close(sendLeave: boolean): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#clearProgressQueue();
    if (sendLeave) await this.#broadcast({ type: 'leave' }).catch(() => undefined);
    this.#connected = false;
    this.#peer = null;
    await this.#channel.untrack().catch(() => undefined);
    await this.#client.removeChannel(this.#channel).catch(() => undefined);
  }

  async send(message: RoomMessage): Promise<void> {
    if (this.#closed) throw new RoomError('room_closed');
    const clean = parseRoomMessage(message);
    if (!clean || (HOST_ONLY.has(clean.type) && this.role !== 'host')) throw new RoomError('invalid_message');
    if (clean.type === 'leave') return this.leave();
    if (clean.type === 'progress') return this.#queueProgress(clean);
    return this.#broadcast(clean);
  }

  async scheduleStart(leadMs: number): Promise<number> {
    if (this.role !== 'host') throw new RoomError('invalid_message');
    try {
      this.#offsetMs = (await this.#deps.getServerTime()).offsetMs;
    } catch {
      // The offset measured when joining is still good enough
    }
    const startAtServerMs = Math.round(Date.now() + this.#offsetMs + leadMs);
    await this.send({ type: 'start', startAtServerMs });
    return this.localStartTimeFor(startAtServerMs);
  }

  localStartTimeFor(startAtServerMs: number): number {
    return startAtServerMs - this.#offsetMs;
  }

  async leave(): Promise<void> {
    if (this.#closed) return;
    await this.#close(this.#joined);
    this.#emit({ type: 'closed' });
    this.#listeners.clear();
  }

  handle(): RoomHandle {
    return {
      code: this.code,
      role: this.role,
      onEvent: (listener) => {
        this.#listeners.add(listener);
        if (this.#backlog.length > 0) {
          queueMicrotask(() => {
            for (const event of this.#backlog.splice(0)) this.#emit(event);
          });
        }
        return () => this.#listeners.delete(listener);
      },
      send: (message) => this.send(message),
      getPeers: () => (this.#peer ? [{ id: this.#peer.id, role: this.#peer.role }] : []),
      scheduleStart: (leadMs = START_LEAD_MS) => this.scheduleStart(leadMs),
      localStartTimeFor: (startAtServerMs) => this.localStartTimeFor(startAtServerMs),
      leave: () => this.leave()
    };
  }
}

async function openRoom(deps: RoomDeps, code: string, role: RoomRole): Promise<RoomHandle> {
  let client: SupabaseClient | null;
  try {
    client = await deps.getClient();
  } catch (error) {
    throw new RoomError('network', { cause: error });
  }
  if (!client) throw new RoomError('not_configured');
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new RoomError(toRankingError(error).code === 'not_authenticated' ? 'not_authenticated' : 'network', { cause: error });
  }
  if (!data.session) throw new RoomError('not_authenticated');

  let offsetMs: number;
  try {
    offsetMs = (await deps.getServerTime()).offsetMs;
    // Private channels authorize with the session token, which has to be set before subscribing
    await client.realtime.setAuth();
  } catch (cause) {
    throw new RoomError('network', { cause });
  }

  const room = new Room(client, deps, code, role, offsetMs);
  await room.join();
  return room.handle();
}

export function createRoomService(overrides: Partial<RoomDeps> = {}): RoomService {
  const deps: RoomDeps = { ...DEFAULT_DEPS, ...overrides };
  return {
    async createRoom() {
      for (let attempt = 1; ; attempt++) {
        try {
          return await openRoom(deps, generateRoomCode(deps.randomBytes), 'host');
        } catch (error) {
          if (!(error instanceof RoomError) || error.code !== 'room_full' || attempt >= CREATE_ATTEMPTS) throw error;
        }
      }
    },
    async joinRoom(code) {
      const normalized = normalizeRoomCode(code);
      if (!normalized) throw new RoomError('invalid_code');
      return openRoom(deps, normalized, 'guest');
    }
  };
}

const defaultService = createRoomService();

export const createRoom = (): Promise<RoomHandle> => defaultService.createRoom();
export const joinRoom = (code: string): Promise<RoomHandle> => defaultService.joinRoom(code);
