import { describe, expect, it, vi } from 'vitest';
import {
  canStart,
  matchOutcome,
  roomReducer,
  teamScore,
  RoomController,
  type RoomAction,
  type RoomState,
} from './room';
import { RoomError, type RoomEvent, type RoomHandle, type RoomMessage } from '../services/backend/roomChannel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOBBY_CODE = 'AB9A9A';

function makeHandle(overrides: Partial<RoomHandle> = {}): RoomHandle {
  return {
    code: LOBBY_CODE,
    seat: 1,
    role: 'host',
    onEvent: () => () => undefined,
    send: vi.fn(async () => undefined),
    getPeers: () => [],
    scheduleStart: vi.fn(async () => Date.now() + 4000),
    resendStart: vi.fn(async () => undefined),
    localStartTimeFor: (ms) => ms,
    leave: vi.fn(async () => undefined),
    ...overrides,
  };
}

function hostState(): RoomState {
  return roomReducer(
    {
      phase: 'idle', code: null, role: null, myNickname: '', peer: null, song: null,
      myPartId: null, myTrackName: null, myReady: false, localStartTimeMs: null,
      myScore: 0, partnerProgress: null, error: null, closedByHost: false,
    },
    { type: 'opened', handle: makeHandle(), nickname: 'Ana' },
  );
}

function guestState(): RoomState {
  return roomReducer(
    {
      phase: 'idle', code: null, role: null, myNickname: '', peer: null, song: null,
      myPartId: null, myTrackName: null, myReady: false, localStartTimeMs: null,
      myScore: 0, partnerProgress: null, error: null, closedByHost: false,
    },
    { type: 'opened', handle: makeHandle({ seat: 2, role: 'guest' }), nickname: 'Beto' },
  );
}

const SONG = { songId: 1, title: 'Song', artist: 'Band', trackName: 'Lead', partId: 0 };

// ─── Phase transitions ────────────────────────────────────────────────────────

describe('phase transitions', () => {
  it('starts in idle and moves to lobby when opened', () => {
    const state = hostState();
    expect(state.phase).toBe('lobby');
    expect(state.role).toBe('host');
    expect(state.code).toBe(LOBBY_CODE);
    expect(state.myNickname).toBe('Ana');
  });

  it('stays in lobby when peer joins (presence)', () => {
    const state = roomReducer(hostState(), { type: 'peer_joined' });
    expect(state.phase).toBe('lobby');
    expect(state.peer?.online).toBe(true);
    expect(state.peer?.nickname).toBe('');
  });

  it('moves to match on start action', () => {
    const state = roomReducer(hostState(), { type: 'start', localStartTimeMs: 9999 });
    expect(state.phase).toBe('match');
    expect(state.localStartTimeMs).toBe(9999);
  });

  it('moves to closed on closed action', () => {
    const state = roomReducer(hostState(), { type: 'closed' });
    expect(state.phase).toBe('closed');
  });

  it('resets to idle on reset action', () => {
    const state = roomReducer(roomReducer(hostState(), { type: 'peer_joined' }), { type: 'reset' });
    expect(state.phase).toBe('idle');
    expect(state.code).toBeNull();
  });
});

// ─── peer_joined preserves existing data ─────────────────────────────────────

describe('peer_joined preserves existing data', () => {
  it('creates a blank peer on first join', () => {
    const s = roomReducer(hostState(), { type: 'peer_joined' });
    expect(s.peer).not.toBeNull();
    expect(s.peer?.nickname).toBe('');
    expect(s.peer?.online).toBe(true);
  });

  it('preserves nickname, partId and ready on reconnect', () => {
    let s = roomReducer(hostState(), { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 2, trackName: 'Bass', ready: true });
    // Peer leaves
    s = roomReducer(s, { type: 'peer_left' });
    expect(s.peer?.online).toBe(false);
    expect(s.peer?.nickname).toBe('Beto');
    // Peer comes back
    s = roomReducer(s, { type: 'peer_joined' });
    expect(s.peer?.online).toBe(true);
    expect(s.peer?.nickname).toBe('Beto');
    expect(s.peer?.partId).toBe(2);
    // ready is cleared in lobby because peer_left clears it
    expect(s.peer?.ready).toBe(false);
  });

  it('does not change nickname/partId/ready on peer_joined (only online)', () => {
    let s = roomReducer(hostState(), { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 3, trackName: 'Rhythm', ready: false });
    const before = s.peer;
    s = roomReducer(s, { type: 'peer_left' });
    s = roomReducer(s, { type: 'peer_joined' });
    expect(s.peer?.nickname).toBe(before?.nickname);
    expect(s.peer?.partId).toBe(before?.partId);
  });
});

// ─── peer_left in lobby vs match ─────────────────────────────────────────────

describe('peer_left in lobby and match', () => {
  it('in lobby: sets online=false and clears ready', () => {
    let s = roomReducer(hostState(), { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: null, trackName: null, ready: true });
    s = roomReducer(s, { type: 'peer_left' });
    expect(s.phase).toBe('lobby');
    expect(s.peer?.online).toBe(false);
    expect(s.peer?.ready).toBe(false);
  });

  it('in match: sets online=false but preserves ready and progress', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1234 });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 2, trackName: 'Bass', ready: false });
    s = roomReducer(s, { type: 'partner_progress', progress: { score: 100, combo: 2, accuracy: 80, positionMs: 1000, finished: false } });
    s = roomReducer(s, { type: 'peer_left' });
    expect(s.phase).toBe('match');
    expect(s.peer?.online).toBe(false);
    expect(s.partnerProgress?.score).toBe(100);
  });
});

// ─── hello ────────────────────────────────────────────────────────────────────

describe('hello', () => {
  it('fills in nickname, partId, trackName and ready', () => {
    let s = roomReducer(hostState(), { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 2, trackName: 'Bass', ready: true });
    expect(s.peer?.nickname).toBe('Beto');
    expect(s.peer?.partId).toBe(2);
    expect(s.peer?.trackName).toBe('Bass');
    expect(s.peer?.ready).toBe(true);
  });

  it('creates peer if none exists', () => {
    const s = roomReducer(hostState(), { type: 'hello', nickname: 'Beto', partId: null, trackName: null, ready: false });
    expect(s.peer?.nickname).toBe('Beto');
  });

  it('ignores ready in match phase', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 2, trackName: 'Bass', ready: true });
    expect(s.peer?.ready).toBe(false);
  });
});

// ─── select_song idempotent vs nova música ────────────────────────────────────

describe('select_song', () => {
  it('sets song and host keeps their part', () => {
    const s = roomReducer(hostState(), { type: 'song_selected', song: SONG });
    expect(s.song?.title).toBe('Song');
    expect(s.myPartId).toBe(0);
  });

  it('ignored outside of lobby', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    expect(s.song).toBeNull();
  });

  it('idempotent for guest (same songId): keeps myPartId and myReady', () => {
    let s = guestState();
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'part_selected', partId: 2, trackName: 'Bass', byPeer: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    // Same song again (e.g. host rebroadcasts on peer_joined)
    const before = s;
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    expect(s.myPartId).toBe(before.myPartId);
    expect(s.myReady).toBe(before.myReady);
  });

  it('different songId: resets myReady and peer.ready; guest clears myPartId', () => {
    let s = guestState();
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Ana', partId: 0, trackName: 'Lead', ready: true });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    const newSong = { ...SONG, songId: 2, title: 'Other' };
    s = roomReducer(s, { type: 'song_selected', song: newSong });
    expect(s.myReady).toBe(false);
    expect(s.myPartId).toBeNull();
    expect(s.peer?.ready).toBe(false);
  });
});

// ─── ready sem fase 'ready' ───────────────────────────────────────────────────

describe('ready without a ready phase', () => {
  it('setReady does not advance phase', () => {
    let s = roomReducer(hostState(), { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: true });
    expect(s.phase).toBe('lobby');
    expect(s.myReady).toBe(true);
    expect(s.peer?.ready).toBe(true);
  });
});

// ─── canStart ─────────────────────────────────────────────────────────────────

describe('canStart', () => {
  function readyLobby(): RoomState {
    let s = hostState();
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: true });
    return s;
  }

  it('returns true when all conditions are met', () => {
    expect(canStart(readyLobby())).toBe(true);
  });

  it('false when myReady is cancelled', () => {
    let s = readyLobby();
    s = roomReducer(s, { type: 'ready_changed', ready: false, byPeer: false });
    expect(canStart(s)).toBe(false);
  });

  it('false when peer goes offline', () => {
    let s = readyLobby();
    s = roomReducer(s, { type: 'peer_left' });
    expect(canStart(s)).toBe(false);
  });

  it('false for guest', () => {
    let s = guestState();
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Ana', partId: 0, trackName: 'Lead', ready: true });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: true });
    expect(canStart(s)).toBe(false);
  });

  it('false when peer.partId is null', () => {
    let s = hostState();
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: null, trackName: null, ready: true });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    expect(canStart(s)).toBe(false);
  });
});

// ─── start resets ready ───────────────────────────────────────────────────────

describe('start resets ready for rematch', () => {
  it('clears myReady and peer.ready on start', () => {
    let s = hostState();
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true });
    s = roomReducer(s, { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: false });
    s = roomReducer(s, { type: 'start', localStartTimeMs: 9999 });
    expect(s.myReady).toBe(false);
    expect(s.peer?.ready).toBe(false);
  });
});

// ─── back_to_lobby preserves peer.ready ──────────────────────────────────────

describe('back_to_lobby', () => {
  it('preserves peer.ready and does not touch it', () => {
    let s = hostState();
    s = roomReducer(s, { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: false });
    // Peer signals ready for rematch
    s = roomReducer(s, { type: 'ready_changed', ready: true, byPeer: true });
    s = roomReducer(s, { type: 'back_to_lobby' });
    expect(s.phase).toBe('lobby');
    expect(s.peer?.ready).toBe(true);
    expect(s.myScore).toBe(0);
    expect(s.partnerProgress).toBeNull();
  });
});

// ─── leave_received ───────────────────────────────────────────────────────────

describe('leave_received', () => {
  it('in lobby: sets peer=null', () => {
    let s = roomReducer(hostState(), { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: null, trackName: null, ready: false });
    s = roomReducer(s, { type: 'leave_received' });
    expect(s.peer).toBeNull();
    expect(s.closedByHost).toBe(false); // host left, we are host
  });

  it('in match as guest: marks closedByHost=true', () => {
    let s = guestState();
    s = roomReducer(s, { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'leave_received' });
    expect(s.closedByHost).toBe(true);
  });

  it('in match: preserves partnerProgress', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'partner_progress', progress: { score: 500, combo: 3, accuracy: 90, positionMs: 2000, finished: false } });
    s = roomReducer(s, { type: 'leave_received' });
    expect(s.partnerProgress?.score).toBe(500);
  });
});

// ─── teamScore ────────────────────────────────────────────────────────────────

describe('teamScore selector', () => {
  it('is zero initially', () => {
    expect(teamScore(hostState())).toBe(0);
  });

  it('sums myScore and partner progress score', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'my_score_changed', score: 1500 });
    s = roomReducer(s, { type: 'partner_progress', progress: { score: 800, combo: 3, accuracy: 90, positionMs: 4000, finished: false } });
    expect(teamScore(s)).toBe(2300);
  });

  it('does not dispatch when score unchanged (notifyMyScore)', () => {
    const ctrl = new RoomController();
    ctrl.attach(makeHandle(), 'Ana');
    ctrl.notifyMyScore(100);
    const s1 = ctrl.getState();
    ctrl.notifyMyScore(100); // same value: no dispatch
    const s2 = ctrl.getState();
    expect(s1).toBe(s2); // reference equality: state object not replaced
  });
});

// ─── matchOutcome ─────────────────────────────────────────────────────────────

describe('matchOutcome', () => {
  function matchState(myScore: number, peerScore: number, myPartId: number, peerPartId: number, peerFinished = true, peerOnline = true): RoomState {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: peerPartId, trackName: 'X', ready: false });
    s = { ...s, myPartId, myScore };
    s = roomReducer(s, { type: 'partner_progress', progress: { score: peerScore, combo: 1, accuracy: 80, positionMs: 5000, finished: peerFinished } });
    if (!peerOnline) s = roomReducer(s, { type: 'peer_left' });
    return s;
  }

  it('returns null while partner has not finished and is connected', () => {
    const s = matchState(100, 50, 0, 0, false, true);
    expect(matchOutcome(s)).toBeNull();
  });

  it('same_part win', () => {
    const s = matchState(200, 100, 0, 0);
    expect(matchOutcome(s)).toEqual({ kind: 'same_part', result: 'win' });
  });

  it('same_part lose', () => {
    const s = matchState(50, 200, 0, 0);
    expect(matchOutcome(s)).toEqual({ kind: 'same_part', result: 'lose' });
  });

  it('same_part tie', () => {
    const s = matchState(100, 100, 0, 0);
    expect(matchOutcome(s)).toEqual({ kind: 'same_part', result: 'tie' });
  });

  it('team when different parts', () => {
    const s = matchState(100, 200, 0, 1);
    expect(matchOutcome(s)).toEqual({ kind: 'team' });
  });

  it('team when peer is null/offline', () => {
    const s = matchState(100, 200, 0, 0, false, false);
    expect(matchOutcome(s)).toEqual({ kind: 'team' });
  });
});

// ─── RoomController ───────────────────────────────────────────────────────────

function fakeRoom(role: 'host' | 'guest' = 'host') {
  const sent: RoomMessage[] = [];
  let listener: ((event: RoomEvent) => void) | null = null;
  const send = vi.fn(async (message: RoomMessage) => { sent.push(message); });
  const handle = makeHandle({
    seat: role === 'host' ? 1 : 2,
    role,
    onEvent: (next) => {
      listener = next;
      return () => { listener = null; };
    },
    send,
  });
  const emit = (event: RoomEvent) => listener?.(event);
  const peer = { id: role === 'host' ? '2' : '1', role: role === 'host' ? 'guest' : 'host' } as const;
  return { handle, sent, send, emit, peer };
}

const types = (messages: RoomMessage[]) => messages.map((message) => message.type);

describe('RoomController announcements', () => {
  it('sends the song before the hello when a peer arrives', () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');
    ctrl.selectSong(SONG);
    room.sent.length = 0;

    room.emit({ type: 'peer_joined', peer: room.peer });

    expect(types(room.sent)).toEqual(['select_song', 'hello']);
  });

  it('sends only the hello while the host has no song', () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');

    room.emit({ type: 'peer_joined', peer: room.peer });

    expect(types(room.sent)).toEqual(['hello']);
  });

  it('tells the partner the host is no longer ready after changing the part', () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');
    ctrl.selectSong(SONG);
    ctrl.setReady(true);
    room.sent.length = 0;

    ctrl.selectSong({ ...SONG, partId: 3, trackName: 'Rhythm' });

    expect(room.sent.at(-1)).toMatchObject({ type: 'hello', ready: false, partId: 3 });
  });

  it('introduces a guest to a host that was already there', () => {
    const room = fakeRoom('guest');
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Beto');

    room.emit({ type: 'peer_joined', peer: room.peer });

    expect(room.sent[0]).toMatchObject({ type: 'hello', nickname: 'Beto' });
  });
});

describe('RoomController errors', () => {
  it('sends a failed message to state.error', async () => {
    const room = fakeRoom();
    room.send.mockRejectedValue(new RoomError('network'));
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');

    ctrl.selectPart(1, 'Bass');
    await vi.waitFor(() => expect(ctrl.getState().error).toBe('network'));
  });

  it('keeps a lost progress message off the screen', async () => {
    const room = fakeRoom();
    room.send.mockRejectedValue(new RoomError('network'));
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');

    ctrl.sendProgress({ type: 'progress', score: 1, combo: 1, accuracy: 100, positionMs: 1, finished: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.getState().error).toBeNull();
  });

  it('forgets the connection error once reconnected', () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');

    room.emit({ type: 'error', code: 'network' });
    expect(ctrl.getState().error).toBe('network');
    room.emit({ type: 'reconnected' });
    expect(ctrl.getState().error).toBeNull();
  });
});

describe('RoomController match flow', () => {
  const readyHost = () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');
    ctrl.selectSong(SONG);
    ctrl.setReady(true);
    room.emit({ type: 'peer_joined', peer: room.peer });
    room.emit({ type: 'message', from: room.peer, message: { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true } });
    return { room, ctrl };
  };

  it('only schedules the start when both are ready', async () => {
    const { room, ctrl } = readyHost();
    room.emit({ type: 'message', from: room.peer, message: { type: 'ready', ready: false } });

    await ctrl.scheduleStart();
    expect(room.handle.scheduleStart).not.toHaveBeenCalled();

    room.emit({ type: 'message', from: room.peer, message: { type: 'ready', ready: true } });
    await ctrl.scheduleStart();
    expect(room.handle.scheduleStart).toHaveBeenCalledOnce();
    expect(ctrl.getState().phase).toBe('match');
  });

  it('reports a failed start and stays in the lobby', async () => {
    const { room, ctrl } = readyHost();
    vi.mocked(room.handle.scheduleStart).mockRejectedValue(new RoomError('network'));

    await ctrl.scheduleStart();

    expect(ctrl.getState().phase).toBe('lobby');
    expect(ctrl.getState().error).toBe('network');
  });

  it('does not start a room left while the start was on its way', async () => {
    const { room, ctrl } = readyHost();
    const pending = ctrl.scheduleStart();
    await ctrl.leave();
    await pending;

    expect(ctrl.getState().phase).toBe('idle');
    expect(room.handle.leave).toHaveBeenCalledOnce();
  });

  it('survives a dropped connection in the middle of a match', async () => {
    const { room, ctrl } = readyHost();
    await ctrl.scheduleStart();

    room.emit({ type: 'peer_left', peer: room.peer });
    expect(ctrl.getState().peer?.online).toBe(false);

    room.sent.length = 0;
    room.emit({ type: 'peer_joined', peer: room.peer });

    const state = ctrl.getState();
    expect(state.phase).toBe('match');
    expect(state.peer).toMatchObject({ online: true, nickname: 'Beto', partId: 1 });
    expect(types(room.sent)).toContain('hello');
  });

  it('plays a rematch in the same room', async () => {
    const { room, ctrl } = readyHost();
    await ctrl.scheduleStart();
    ctrl.notifyMyScore(500);
    // The partner said ready again before we left the result screen
    room.emit({ type: 'message', from: room.peer, message: { type: 'ready', ready: true } });

    ctrl.backToLobby();
    ctrl.setReady(true);

    const state = ctrl.getState();
    expect(state).toMatchObject({ phase: 'lobby', myScore: 0, localStartTimeMs: null });
    expect(state.song).toEqual(SONG);
    expect(canStart(state)).toBe(true);
  });

  it('closes for the guest when the host leaves', () => {
    const room = fakeRoom('guest');
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Beto');
    room.emit({ type: 'peer_joined', peer: room.peer });

    room.emit({ type: 'message', from: room.peer, message: { type: 'leave' } });
    room.emit({ type: 'peer_left', peer: room.peer });
    room.emit({ type: 'closed' });

    expect(ctrl.getState()).toMatchObject({ phase: 'closed', closedByHost: true });
  });

  it('leaves a closed room behind so a new one can be opened', async () => {
    const room = fakeRoom('guest');
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Beto');
    room.emit({ type: 'closed' });

    await ctrl.leave();

    expect(ctrl.getState().phase).toBe('idle');
  });
});

describe('song selection on the host', () => {
  it('drops the guest part and ready when the song changes', () => {
    let s = roomReducer(hostState(), { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true });

    s = roomReducer(s, { type: 'song_selected', song: { ...SONG, songId: 2 } });

    expect(s.peer).toMatchObject({ partId: null, trackName: null, ready: false });
  });

  it('keeps the guest part and ready when only the host part changes', () => {
    let s = roomReducer(hostState(), { type: 'song_selected', song: SONG });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true });

    s = roomReducer(s, { type: 'song_selected', song: { ...SONG, partId: 3, trackName: 'Rhythm' } });

    expect(s.peer).toMatchObject({ partId: 1, ready: true });
    expect(s).toMatchObject({ myPartId: 3, myReady: false });
  });
});

describe('late messages', () => {
  it('ignores partner progress that arrives back in the lobby', () => {
    const progress = { score: 9, combo: 1, accuracy: 100, positionMs: 1, finished: true };
    const s = roomReducer(hostState(), { type: 'partner_progress', progress });
    expect(s.partnerProgress).toBeNull();
  });

  it('keeps the outcome of a partner who finished and then dropped', () => {
    let s = roomReducer(hostState(), { type: 'start', localStartTimeMs: 1 });
    s = roomReducer(s, { type: 'peer_joined' });
    s = roomReducer(s, { type: 'hello', nickname: 'Beto', partId: 0, trackName: 'X', ready: false });
    s = { ...s, myPartId: 0, myScore: 300 };
    s = roomReducer(s, { type: 'partner_progress', progress: { score: 100, combo: 1, accuracy: 80, positionMs: 5000, finished: true } });
    s = roomReducer(s, { type: 'peer_left' });

    expect(matchOutcome(s)).toEqual({ kind: 'same_part', result: 'win' });
  });
});

describe('staying in sync after a loss', () => {
  const guestWithTrack = () => {
    const room = fakeRoom('guest');
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Beto');
    room.emit({ type: 'peer_joined', peer: room.peer });
    room.emit({ type: 'message', from: room.peer, message: { type: 'select_song', ...SONG } });
    ctrl.selectPart(1, 'Bass');
    ctrl.setReady(true);
    room.sent.length = 0;
    return { room, ctrl };
  };

  const hostInMatch = async () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');
    ctrl.selectSong(SONG);
    ctrl.setReady(true);
    room.emit({ type: 'peer_joined', peer: room.peer });
    room.emit({ type: 'message', from: room.peer, message: { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true } });
    await ctrl.scheduleStart();
    vi.mocked(room.handle.resendStart).mockClear();
    room.sent.length = 0;
    return { room, ctrl };
  };

  it('tells the partner our state again after reconnecting', () => {
    const { room } = guestWithTrack();

    room.emit({ type: 'reconnected' });

    expect(room.sent).toEqual([{ type: 'hello', nickname: 'Beto', ready: true, partId: 1, trackName: 'Bass' }]);
  });

  it('repeats the start for a guest who says hello in the middle of a match', async () => {
    const { room } = await hostInMatch();

    room.emit({ type: 'message', from: room.peer, message: { type: 'hello', nickname: 'Beto', partId: 1, trackName: 'Bass', ready: true } });

    expect(room.handle.resendStart).toHaveBeenCalledOnce();
    expect(room.sent).toEqual([]);
  });

  it('repeats the start when the guest comes back in the middle of a match', async () => {
    const { room } = await hostInMatch();

    room.emit({ type: 'peer_left', peer: room.peer });
    room.emit({ type: 'peer_joined', peer: room.peer });

    expect(room.handle.resendStart).toHaveBeenCalledOnce();
  });

  it('lets a guest who lost the start join the match late', () => {
    const { room, ctrl } = guestWithTrack();

    room.emit({ type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 1000 } });

    expect(ctrl.getState()).toMatchObject({ phase: 'match', localStartTimeMs: 1000 });
  });

  it('never replays a match the guest already played', () => {
    const { room, ctrl } = guestWithTrack();
    const start = { type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 1000 } } as const;
    room.emit(start);
    ctrl.notifyMyScore(300);

    room.emit(start);
    expect(ctrl.getState().myScore).toBe(300);

    ctrl.backToLobby();
    room.emit(start);
    expect(ctrl.getState().phase).toBe('lobby');
  });

  it('accepts the start of the next match', () => {
    const { room, ctrl } = guestWithTrack();
    room.emit({ type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 1000 } });
    ctrl.backToLobby();

    room.emit({ type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 2000 } });

    expect(ctrl.getState()).toMatchObject({ phase: 'match', localStartTimeMs: 2000 });
  });

  it('keeps a guest with no track out of a match', () => {
    const room = fakeRoom('guest');
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Beto');
    room.emit({ type: 'message', from: room.peer, message: { type: 'select_song', ...SONG } });

    room.emit({ type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 1000 } });

    expect(ctrl.getState().phase).toBe('lobby');
  });

  it('learns the rematch song when back from the result screen', () => {
    const { room, ctrl } = guestWithTrack();
    room.emit({ type: 'message', from: room.peer, message: { type: 'start', startAtServerMs: 1000 } });
    const songB = { ...SONG, songId: 2, title: 'Outra' };
    // The host changes the song while we are still on the result screen: too early to apply it
    room.emit({ type: 'message', from: room.peer, message: { type: 'select_song', ...songB } });
    expect(ctrl.getState().song?.songId).toBe(SONG.songId);
    room.sent.length = 0;

    ctrl.backToLobby();
    expect(room.sent[0]).toMatchObject({ type: 'hello', nickname: 'Beto' });
    room.emit({ type: 'message', from: room.peer, message: { type: 'select_song', ...songB } });

    expect(ctrl.getState()).toMatchObject({ song: songB, myPartId: null, myReady: false });
  });

  it('answers a hello in the lobby with the song, and never with a hello', () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    ctrl.attach(room.handle, 'Ana');
    ctrl.selectSong(SONG);
    room.sent.length = 0;

    room.emit({ type: 'message', from: room.peer, message: { type: 'hello', nickname: 'Beto', ready: false } });

    expect(types(room.sent)).toEqual(['select_song']);
  });

  it('does not answer a hello as a guest', () => {
    const { room } = guestWithTrack();

    room.emit({ type: 'message', from: room.peer, message: { type: 'hello', nickname: 'Ana', partId: 0, trackName: 'Lead', ready: false } });

    expect(room.sent).toEqual([]);
  });
});

describe('giving up while connecting', () => {
  it('leaves the room as soon as the connection arrives', async () => {
    const room = fakeRoom();
    const ctrl = new RoomController();
    let connected = (_handle: RoomHandle) => undefined as void;
    const opening = ctrl.open(() => new Promise<RoomHandle>((resolve) => { connected = resolve; }), 'Ana');

    await ctrl.leave();
    connected(room.handle);
    await opening;

    expect(ctrl.getState().phase).toBe('idle');
    expect(room.handle.leave).toHaveBeenCalledOnce();
  });

  it('opens the room when nobody gave up', async () => {
    const room = fakeRoom();
    const ctrl = new RoomController();

    await ctrl.open(async () => room.handle, 'Ana');

    expect(ctrl.getState()).toMatchObject({ phase: 'lobby', myNickname: 'Ana' });
    expect(room.handle.leave).not.toHaveBeenCalled();
  });

  it('lets the failure reach the caller', async () => {
    const ctrl = new RoomController();

    await expect(ctrl.open(async () => { throw new RoomError('room_full'); }, 'Ana')).rejects.toMatchObject({ code: 'room_full' });
    expect(ctrl.getState().phase).toBe('idle');
  });
});

// ─── RoomAction tipos conhecidos ──────────────────────────────────────────────

describe('unknown actions', () => {
  it('unknown action type returns state unchanged', () => {
    const state = hostState();
    // @ts-expect-error intentionally invalid
    const next = roomReducer(state, { type: 'UNKNOWN_TYPE' } as RoomAction);
    expect(next).toBe(state);
  });
});
