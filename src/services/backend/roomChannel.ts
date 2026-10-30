// Online duel rooms (host + guest) over Supabase Realtime: Broadcast carries the game messages and Presence
// tells who is in the room, on the private channel room:<CODE> (policies in the _room_realtime migration).
// RPCs admit two server-owned seats; Presence only reports whether the other seat is online. No user id
// is shared over Realtime. A session and profile must already exist; this service never creates an account.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { validateNickname } from '../nickname';
import { getServerTime as fetchServerTime, toRankingError, type ServerTime } from './rankingApi';
import { getSupabaseClient } from './supabaseClient';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CAPACITY = 2;
export const START_LEAD_MS = 4000;
export const PROGRESS_INTERVAL_MS = 500; // at most 2 progress messages per second
export const JOIN_TIMEOUT_MS = 5000;

const BROADCAST_EVENT = 'room';
const TEXT_MAX = 200;
const BACKLOG_MAX = 50;
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export type RoomRole = 'host' | 'guest';

export type RoomErrorCode =
  | 'not_configured'
  | 'not_authenticated' // no session, or Realtime refused it
  | 'profile_required'
  | 'rate_limited'
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

/** The other player; `id` is the seat number, never an account id. */
export interface RoomPeer {
  id: string;
  role: RoomRole;
}

export type RoomEvent =
  | { type: 'peer_joined'; peer: RoomPeer } // also when the peer comes back after a dropped connection
  | { type: 'peer_left'; peer: RoomPeer } // a dropped connection too; a `leave` message comes first when they quit
  | { type: 'message'; from: RoomPeer; message: RoomMessage }
  // network: connection lost, Realtime keeps retrying (see reconnected)
  | { type: 'error'; code: RoomErrorCode }
  | { type: 'reconnected' }
  | { type: 'closed' };

export interface RoomHandle {
  readonly code: string;
  readonly seat: 1 | 2;
  readonly role: RoomRole;
  /** Returns a function that removes the listener. The first listener also gets what happened before it. */
  onEvent(listener: (event: RoomEvent) => void): () => void;
  /**
   * Validates and broadcasts. Progress is throttled to 2 per second (finished: true goes at once), retained
   * until acknowledged and retried on reconnection. Other messages reject with `network` while offline.
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
  /** Opens a room with a code and host seat assigned by create_room. Requires an existing profile. */
  createRoom(): Promise<RoomHandle>;
  /** join_room assigns a seat, or returns the same seat on reentry (including the host's). */
  joinRoom(code: string): Promise<RoomHandle>;
}

export interface RoomDeps {
  getClient: () => Promise<SupabaseClient | null>;
  getServerTime: () => Promise<ServerTime>;
  joinTimeoutMs: number;
}

const DEFAULT_DEPS: RoomDeps = {
  getClient: getSupabaseClient,
  getServerTime: fetchServerTime,
  joinTimeoutMs: JOIN_TIMEOUT_MS
};

// Codes ---------------------------------------------------------------------------------------------------

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

// Room ----------------------------------------------------------------------------------------------------

class Room {
  readonly code: string;
  readonly seat: 1 | 2;
  readonly role: RoomRole;
  readonly userId: string;
  readonly #client: SupabaseClient;
  readonly #channel: RealtimeChannel;
  readonly #deps: RoomDeps;
  readonly #other: RoomPeer;
  readonly #onClosed: () => void;
  readonly #listeners = new Set<(event: RoomEvent) => void>();
  readonly #backlog: RoomEvent[] = [];
  readonly #handle: RoomHandle;
  #offsetMs: number;
  #peer: RoomPeer | null = null;
  #joined = false;
  #connected = false;
  #closed = false;
  #connectionVersion = 0;
  #lastProgressAt = Number.NEGATIVE_INFINITY;
  #queuedProgress: ProgressMessage | null = null;
  #progressTimer: ReturnType<typeof setTimeout> | null = null;
  #progressFlight: Promise<void> | null = null;
  #closePromise: Promise<void> | null = null;
  #settleJoin: ((error?: RoomError) => void) | null = null;

  constructor(client: SupabaseClient, deps: RoomDeps, admission: RoomAdmission, userId: string,
    offsetMs: number, onClosed: () => void) {
    this.#client = client;
    this.#deps = deps;
    this.code = admission.code;
    this.seat = admission.seat;
    this.role = admission.seat === 1 ? 'host' : 'guest';
    this.userId = userId;
    this.#offsetMs = offsetMs;
    this.#onClosed = onClosed;
    this.#other = { id: this.seat === 1 ? '2' : '1', role: this.role === 'host' ? 'guest' : 'host' };
    this.#channel = client.channel(`room:${this.code}`, {
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: String(this.seat) } }
    });
    this.#handle = {
      code: this.code,
      seat: this.seat,
      role: this.role,
      onEvent: (listener) => {
        if (this.#closed) return () => undefined;
        this.#listeners.add(listener);
        if (this.#backlog.length > 0) {
          queueMicrotask(() => {
            if (!this.#closed && this.#listeners.size > 0) {
              for (const event of this.#backlog.splice(0)) this.#emit(event);
            }
          });
        }
        return () => this.#listeners.delete(listener);
      },
      send: (message) => this.send(message),
      getPeers: () => (this.#peer ? [{ ...this.#peer }] : []),
      scheduleStart: (leadMs = START_LEAD_MS) => this.scheduleStart(leadMs),
      localStartTimeFor: (startAtServerMs) => this.localStartTimeFor(startAtServerMs),
      leave: () => this.close(true, true)
    };
  }

  get closed(): boolean { return this.#closed; }

  handle(): RoomHandle { return this.#handle; }

  /** The RPC already assigned the seat; an offline peer does not prevent subscribing. */
  join(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.#settleJoin?.(new RoomError('network')), this.#deps.joinTimeoutMs);
      this.#settleJoin = (error) => {
        clearTimeout(timer);
        this.#settleJoin = null;
        if (error) reject(error);
        else {
          this.#joined = true;
          resolve();
        }
      };
      try {
        this.#channel
          .on('presence', { event: 'sync' }, () => this.#onPresence())
          .on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => this.#onBroadcast(payload))
          .subscribe((status, error) => {
            if (this.#closed) return;
            if (status === 'SUBSCRIBED') {
              void this.#onSubscribed();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              const refused = /unauthori[sz]ed|permission|forbidden|jwt|token.*expired/i.test(error?.message ?? '');
              this.#onConnectionLost(new RoomError(refused ? 'not_authenticated' : 'network', { cause: error }));
            } else if (status === 'CLOSED') {
              this.#onConnectionLost(new RoomError('network'));
              void this.close(false, true).catch(() => undefined);
            }
          });
      } catch (cause) {
        this.#settleJoin?.(toRoomError(cause));
      }
    });
  }

  async #onSubscribed(): Promise<void> {
    if (this.#closed || this.#connected) return;
    const reconnected = this.#joined;
    const version = this.#connectionVersion;
    this.#connected = true;
    try {
      const result = await this.#channel.track({ seat: this.seat });
      if (this.#closed || version !== this.#connectionVersion) return;
      if (result !== 'ok') throw new RoomError('network');
      this.#settleJoin?.();
      if (reconnected) {
        this.#emit({ type: 'reconnected' });
        void this.#flushProgress(true).catch(() => undefined);
      }
    } catch (cause) {
      if (version === this.#connectionVersion) this.#onConnectionLost(toRoomError(cause));
    }
  }

  #onConnectionLost(error: RoomError): void {
    if (this.#closed) return;
    const wasConnected = this.#connected;
    this.#connected = false;
    this.#connectionVersion++;
    this.#cancelProgressTimer();
    if (this.#settleJoin) this.#settleJoin(error);
    else if (wasConnected) this.#emit({ type: 'error', code: error.code });
  }

  #emit(event: RoomEvent): void {
    if (this.#listeners.size === 0) {
      if (!this.#closed && this.#backlog.length < BACKLOG_MAX) this.#backlog.push(event);
      return;
    }
    for (const listener of [...this.#listeners]) listener(event);
  }

  #onPresence(): void {
    if (this.#closed || !this.#connected) return;
    const state = this.#channel.presenceState<{ seat?: unknown }>();
    const online = state[this.#other.id]?.some((meta) => meta.seat === Number(this.#other.id)) ?? false;
    if (online === (this.#peer !== null)) return;
    this.#peer = online ? this.#other : null;
    this.#emit({ type: online ? 'peer_joined' : 'peer_left', peer: { ...this.#other } });
  }

  #onBroadcast(payload: unknown): void {
    if (this.#closed || !this.#connected || !isRecord(payload)) return;
    // self:false suppresses our broadcasts. Admission restricts the other sender to the opposite seat;
    // neither a claimed sender id nor Presence metadata can grant host privileges.
    if (payload.role !== undefined && payload.role !== this.#other.role) return;
    const message = parseRoomMessage(payload.message);
    if (!message || (HOST_ONLY.has(message.type) && this.role !== 'guest')) return;
    this.#emit({ type: 'message', from: { ...this.#other }, message });
    if (message.type === 'leave' && this.role === 'guest') {
      if (this.#peer) {
        this.#peer = null;
        this.#emit({ type: 'peer_left', peer: { ...this.#other } });
      }
      void this.close(false, true).catch(() => undefined);
    }
  }

  async #broadcast(message: RoomMessage): Promise<void> {
    // With the socket down, send() would fall back to REST. Progress must wait for the socket instead.
    if (!this.#connected) throw new RoomError('network');
    try {
      const result = await this.#channel.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: { message } });
      if (result !== 'ok') throw new RoomError('network');
    } catch (cause) {
      throw toRoomError(cause);
    }
  }

  #queueProgress(message: ProgressMessage): Promise<void> {
    // A late animation frame cannot replace a final result that is still awaiting acknowledgement.
    if (this.#queuedProgress?.finished && !message.finished) return Promise.resolve();
    this.#queuedProgress = message;
    return this.#flushProgress();
  }

  #cancelProgressTimer(): void {
    if (this.#progressTimer !== null) clearTimeout(this.#progressTimer);
    this.#progressTimer = null;
  }

  #flushProgress(force = false): Promise<void> {
    if (this.#closed || !this.#connected || !this.#queuedProgress) return Promise.resolve();
    if (this.#progressFlight) return this.#progressFlight;
    const wait = this.#lastProgressAt + PROGRESS_INTERVAL_MS - Date.now();
    if (!force && !this.#queuedProgress.finished && wait > 0) {
      this.#progressTimer ??= setTimeout(() => {
        this.#progressTimer = null;
        void this.#flushProgress().catch(() => undefined);
      }, wait);
      return Promise.resolve();
    }
    this.#cancelProgressTimer();
    const queued = this.#queuedProgress;
    const version = this.#connectionVersion;
    this.#lastProgressAt = Date.now();
    this.#progressFlight = this.#broadcast(queued).then(() => {
      // An ACK from before a disconnect cannot acknowledge a retry in the new connection.
      if (this.#connected && version === this.#connectionVersion && this.#queuedProgress === queued) {
        this.#queuedProgress = null;
      }
    }, (cause: unknown) => {
      const error = toRoomError(cause);
      if (version === this.#connectionVersion) this.#onConnectionLost(error);
      throw error;
    }).finally(() => {
      this.#progressFlight = null;
      if (this.#connected && this.#queuedProgress) void this.#flushProgress().catch(() => undefined);
    });
    return this.#progressFlight;
  }

  /** releaseSeat=false is used after a successful RPC has already moved this user to another room. */
  close(sendLeave: boolean, releaseSeat: boolean): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#closed = true;
    this.#settleJoin?.(new RoomError('room_closed'));
    this.#cancelProgressTimer();
    this.#queuedProgress = null;
    this.#closePromise = (async () => {
      try {
        if (sendLeave && this.#connected) await this.#broadcast({ type: 'leave' }).catch(() => undefined);
        if (releaseSeat) await roomRpc(this.#client, 'leave_room', { p_code: this.code });
      } finally {
        this.#connected = false;
        this.#peer = null;
        try {
          await this.#channel.untrack().catch(() => undefined);
        } finally {
          await this.#client.removeChannel(this.#channel).catch(() => undefined);
          this.#onClosed();
          this.#emit({ type: 'closed' });
          this.#listeners.clear();
          this.#backlog.length = 0;
        }
      }
    })();
    return this.#closePromise;
  }

  async send(message: RoomMessage): Promise<void> {
    if (this.#closed) throw new RoomError('room_closed');
    const clean = parseRoomMessage(message);
    if (!clean || (HOST_ONLY.has(clean.type) && this.role !== 'host')) throw new RoomError('invalid_message');
    if (clean.type === 'leave') return this.close(true, true);
    if (clean.type === 'progress') return this.#queueProgress(clean);
    return this.#broadcast(clean);
  }

  async scheduleStart(leadMs: number): Promise<number> {
    if (this.role !== 'host') throw new RoomError('invalid_message');
    try {
      this.#offsetMs = (await this.#deps.getServerTime()).offsetMs;
    } catch {
      // The offset measured when joining is still good enough.
    }
    const startAtServerMs = Math.round(Date.now() + this.#offsetMs + leadMs);
    await this.send({ type: 'start', startAtServerMs });
    return this.localStartTimeFor(startAtServerMs);
  }

  localStartTimeFor(startAtServerMs: number): number {
    return startAtServerMs - this.#offsetMs;
  }
}

interface RoomAdmission {
  code: string;
  seat: 1 | 2;
}

const RPC_CODES: ReadonlySet<string> = new Set<RoomErrorCode>([
  'not_authenticated', 'profile_required', 'rate_limited', 'invalid_code', 'room_not_found', 'room_full'
]);

function toRoomError(cause: unknown): RoomError {
  if (cause instanceof RoomError) return cause;
  if (isRecord(cause) && typeof cause.message === 'string' && RPC_CODES.has(cause.message)) {
    return new RoomError(cause.message as RoomErrorCode, { cause });
  }
  const code = toRankingError(cause).code;
  return new RoomError(code === 'not_authenticated' || code === 'rate_limited' ? code : 'network', { cause });
}

async function roomRpc(client: SupabaseClient, name: string, params?: { p_code: string }): Promise<unknown> {
  try {
    const { data, error } = await client.rpc(name, params);
    if (error) throw error;
    return data;
  } catch (cause) {
    throw toRoomError(cause);
  }
}

function parseAdmission(data: unknown, requestedCode?: string): RoomAdmission {
  if (!isRecord(data) || typeof data.code !== 'string' || normalizeRoomCode(data.code) !== data.code
    || (data.seat !== 1 && data.seat !== 2) || (requestedCode && data.code !== requestedCode)
    || (!requestedCode && data.seat !== 1)) throw new RoomError('network');
  return { code: data.code, seat: data.seat };
}

interface ClientRooms {
  current: Room | null;
  opening: Map<string, Promise<RoomHandle>>;
  tail: Promise<unknown>;
}

// RealtimeClient.channel() reuses a topic's existing channel. Share openings across service instances so
// attaching a second set of listeners can never throw and remove the channel used by the first instance.
const CLIENT_ROOMS = new WeakMap<SupabaseClient, ClientRooms>();

async function openRoom(deps: RoomDeps, requestedCode?: string): Promise<RoomHandle> {
  let client: SupabaseClient | null;
  try {
    client = await deps.getClient();
  } catch (cause) {
    throw toRoomError(cause);
  }
  if (!client) throw new RoomError('not_configured');
  const activeClient = client;
  let registry = CLIENT_ROOMS.get(client);
  if (!registry) {
    registry = { current: null, opening: new Map(), tail: Promise.resolve() };
    CLIENT_ROOMS.set(client, registry);
  }
  const rooms = registry;
  const key = requestedCode ?? 'create';
  const pending = rooms.opening.get(key);
  if (pending) return pending;

  const opening = rooms.tail.then(async () => {
    let session;
    try {
      const { data, error } = await activeClient.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (cause) {
      throw toRoomError(cause);
    }
    if (!session?.access_token) throw new RoomError('not_authenticated');
    const previous = rooms.current;
    if (requestedCode && previous?.code === requestedCode && previous.userId === session.user.id && !previous.closed) {
      return previous.handle();
    }
    if (previous?.closed) await previous.close(false, false).catch(() => undefined);
    // A channel not owned by this service must never be removed by our failure cleanup.
    const hasForeignChannel = (code: string) => activeClient.getChannels?.()
      .some((channel) => channel.topic === `realtime:room:${code}` || channel.topic === `room:${code}`);
    if (requestedCode && hasForeignChannel(requestedCode)) throw new RoomError('room_closed');

    let offsetMs: number;
    try {
      offsetMs = (await deps.getServerTime()).offsetMs;
      await activeClient.realtime.setAuth(session.access_token);
    } catch (cause) {
      throw toRoomError(cause);
    }
    const admission = parseAdmission(await roomRpc(activeClient, requestedCode ? 'join_room' : 'create_room',
      requestedCode ? { p_code: requestedCode } : undefined), requestedCode);
    if (previous && !previous.closed) await previous.close(true, false);
    if (hasForeignChannel(admission.code)) throw new RoomError('room_closed');
    let room: Room | undefined;
    try {
      room = new Room(activeClient, deps, admission, session.user.id, offsetMs, () => {
        if (rooms.current === room) rooms.current = null;
      });
      rooms.current = room;
      await room.join();
      return room.handle();
    } catch (cause) {
      if (room) await room.close(false, true).catch(() => undefined);
      else await roomRpc(activeClient, 'leave_room', { p_code: admission.code }).catch(() => undefined);
      throw toRoomError(cause);
    }
  });
  rooms.opening.set(key, opening);
  rooms.tail = opening.catch(() => undefined);
  try {
    return await opening;
  } finally {
    if (rooms.opening.get(key) === opening) rooms.opening.delete(key);
  }
}

export function createRoomService(overrides: Partial<RoomDeps> = {}): RoomService {
  const deps: RoomDeps = { ...DEFAULT_DEPS, ...overrides };
  return {
    createRoom: () => openRoom(deps),
    async joinRoom(code) {
      const normalized = normalizeRoomCode(code);
      if (!normalized) throw new RoomError('invalid_code');
      return openRoom(deps, normalized);
    }
  };
}

const defaultService = createRoomService();

export const createRoom = (): Promise<RoomHandle> => defaultService.createRoom();
export const joinRoom = (code: string): Promise<RoomHandle> => defaultService.joinRoom(code);
