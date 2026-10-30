// State of the online duo room, kept pure so it can be tested without React or a network. RoomController
// owns the RoomHandle (roomChannel.ts), turns its events into RoomActions and exposes the UI's commands.

import {
  RoomError,
  type HelloMessage,
  type ProgressMessage,
  type RoomErrorCode,
  type RoomEvent,
  type RoomHandle,
  type RoomMessage,
} from '../services/backend/roomChannel';

export type RoomPhase = 'idle' | 'lobby' | 'match' | 'closed';

export interface RoomPeerInfo {
  role: 'host' | 'guest';
  online: boolean;
  nickname: string;
  partId: number | null;
  trackName: string | null;
  ready: boolean;
}

export interface RoomSong {
  songId: number;
  revisionId?: number;
  title: string;
  artist: string;
  trackName: string; // the host's part
  partId: number;
}

export interface PartnerProgress {
  score: number;
  combo: number;
  accuracy: number;
  positionMs: number;
  finished: boolean;
}

export type MatchOutcome =
  | { kind: 'same_part'; result: 'win' | 'lose' | 'tie' }
  | { kind: 'team' };

export interface RoomState {
  phase: RoomPhase;
  code: string | null;
  role: 'host' | 'guest' | null;
  myNickname: string;
  peer: RoomPeerInfo | null;
  song: RoomSong | null;
  myPartId: number | null;
  myTrackName: string | null;
  myReady: boolean;
  localStartTimeMs: number | null;
  myScore: number;
  partnerProgress: PartnerProgress | null;
  error: RoomErrorCode | null;
  closedByHost: boolean;
}

const initialState: RoomState = {
  phase: 'idle',
  code: null,
  role: null,
  myNickname: '',
  peer: null,
  song: null,
  myPartId: null,
  myTrackName: null,
  myReady: false,
  localStartTimeMs: null,
  myScore: 0,
  partnerProgress: null,
  error: null,
  closedByHost: false,
};

export type RoomAction =
  | { type: 'opened'; handle: RoomHandle; nickname: string }
  | { type: 'peer_joined' }
  | { type: 'peer_left' }
  | { type: 'hello'; nickname: string; partId: number | null; trackName: string | null; ready: boolean }
  | { type: 'song_selected'; song: RoomSong }
  | { type: 'part_selected'; partId: number; trackName: string; byPeer: boolean }
  | { type: 'ready_changed'; ready: boolean; byPeer: boolean }
  | { type: 'start'; localStartTimeMs: number }
  | { type: 'partner_progress'; progress: PartnerProgress }
  | { type: 'leave_received' }
  | { type: 'error'; code: RoomErrorCode }
  | { type: 'clear_error' }
  | { type: 'closed' }
  | { type: 'my_score_changed'; score: number }
  | { type: 'back_to_lobby' }
  | { type: 'reset' };

const blankPeer = (state: RoomState): RoomPeerInfo => ({
  role: state.role === 'host' ? 'guest' : 'host',
  online: true,
  nickname: '',
  partId: null,
  trackName: null,
  ready: false,
});

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'opened':
      return {
        ...initialState,
        phase: 'lobby',
        code: action.handle.code,
        role: action.handle.role,
        myNickname: action.nickname,
      };

    case 'peer_joined':
      // Also fires when the peer returns from a dropped connection: what we know about them still holds
      return { ...state, peer: state.peer ? { ...state.peer, online: true } : blankPeer(state) };

    case 'peer_left':
      if (!state.peer) return state;
      return {
        ...state,
        peer: { ...state.peer, online: false, ready: state.phase === 'lobby' ? false : state.peer.ready },
      };

    case 'hello': {
      const known = state.peer ?? blankPeer(state);
      return {
        ...state,
        peer: {
          ...known,
          online: true,
          nickname: action.nickname,
          partId: action.partId,
          trackName: action.trackName,
          ready: state.phase === 'match' ? known.ready : action.ready,
        },
      };
    }

    case 'song_selected': {
      if (state.phase !== 'lobby') return state;
      const { song } = action;
      const sameSong = state.song?.songId === song.songId;
      if (state.role === 'host') {
        // The guest's part only stops making sense when the song itself changes
        const peer = state.peer && !sameSong ? { ...state.peer, partId: null, trackName: null, ready: false } : state.peer;
        return { ...state, song, myPartId: song.partId, myTrackName: song.trackName, myReady: false, peer };
      }
      return {
        ...state,
        song,
        myPartId: sameSong ? state.myPartId : null,
        myTrackName: sameSong ? state.myTrackName : null,
        myReady: sameSong ? state.myReady : false,
        peer: state.peer
          ? { ...state.peer, partId: song.partId, trackName: song.trackName, ready: sameSong ? state.peer.ready : false }
          : null,
      };
    }

    case 'part_selected':
      if (action.byPeer) {
        if (!state.peer) return state;
        return { ...state, peer: { ...state.peer, partId: action.partId, trackName: action.trackName, ready: false } };
      }
      return { ...state, myPartId: action.partId, myTrackName: action.trackName, myReady: false };

    case 'ready_changed':
      if (action.byPeer) {
        if (!state.peer) return state;
        return { ...state, peer: { ...state.peer, ready: action.ready } };
      }
      return { ...state, myReady: action.ready };

    case 'start':
      return {
        ...state,
        phase: 'match',
        localStartTimeMs: action.localStartTimeMs,
        myScore: 0,
        partnerProgress: null,
        // Cleared here and not on the way back: the partner may say ready for a rematch before we return
        myReady: false,
        peer: state.peer ? { ...state.peer, ready: false } : null,
      };

    case 'partner_progress':
      // A retried message can land after we already went back to the lobby
      return state.phase === 'match' ? { ...state, partnerProgress: action.progress } : state;

    case 'leave_received': {
      const closedByHost = state.role === 'guest';
      // The result screen still needs the partner's last score
      if (state.phase === 'match') {
        return { ...state, closedByHost, peer: state.peer ? { ...state.peer, online: false } : null };
      }
      return { ...state, closedByHost, peer: null };
    }

    case 'error':
      return { ...state, error: action.code };

    case 'clear_error':
      return { ...state, error: null };

    case 'closed':
      return { ...state, phase: 'closed' };

    case 'my_score_changed':
      return { ...state, myScore: action.score };

    case 'back_to_lobby':
      if (state.phase !== 'match') return state;
      return { ...state, phase: 'lobby', localStartTimeMs: null, myScore: 0, partnerProgress: null };

    case 'reset':
      return { ...initialState };

    default:
      return state;
  }
}

export const canStart = (state: RoomState): boolean =>
  state.role === 'host'
  && state.phase === 'lobby'
  && state.song !== null
  && state.myReady
  && state.peer !== null
  && state.peer.online
  && state.peer.ready
  && state.peer.partId !== null;

export const teamScore = (state: RoomState): number => state.myScore + (state.partnerProgress?.score ?? 0);

/** null while the partner is still playing. A partner who dropped out before the end leaves no winner. */
export const matchOutcome = (state: RoomState): MatchOutcome | null => {
  const { peer, partnerProgress, myPartId, myScore } = state;
  if (!partnerProgress?.finished) return peer?.online ? null : { kind: 'team' };
  if (myPartId === null || myPartId !== peer?.partId) return { kind: 'team' };
  const partnerScore = partnerProgress.score;
  return { kind: 'same_part', result: myScore > partnerScore ? 'win' : myScore < partnerScore ? 'lose' : 'tie' };
};

export class RoomController {
  private state: RoomState = { ...initialState };
  private readonly listeners = new Set<() => void>();
  private handle: RoomHandle | null = null;
  private removeListener: (() => void) | null = null;

  readonly getState = (): RoomState => this.state;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private dispatch(action: RoomAction): void {
    this.state = roomReducer(this.state, action);
    for (const listener of this.listeners) listener();
  }

  attach(handle: RoomHandle, nickname: string): void {
    this.removeListener?.();
    this.handle = handle;
    this.dispatch({ type: 'opened', handle, nickname });
    this.removeListener = handle.onEvent((event) => this.onEvent(handle, event));
  }

  private onEvent(handle: RoomHandle, event: RoomEvent): void {
    switch (event.type) {
      case 'peer_joined':
        this.dispatch({ type: 'peer_joined' });
        this.announce();
        break;
      case 'peer_left':
        this.dispatch({ type: 'peer_left' });
        break;
      case 'reconnected':
        this.dispatch({ type: 'clear_error' });
        break;
      case 'error':
        this.dispatch({ type: 'error', code: event.code });
        break;
      case 'closed':
        this.dispatch({ type: 'closed' });
        break;
      case 'message':
        this.onMessage(handle, event.message);
        break;
    }
  }

  private onMessage(handle: RoomHandle, message: RoomMessage): void {
    switch (message.type) {
      case 'hello':
        this.dispatch({
          type: 'hello',
          nickname: message.nickname,
          partId: message.partId ?? null,
          trackName: message.trackName ?? null,
          ready: message.ready,
        });
        break;
      case 'select_song': {
        const { type: _type, ...song } = message;
        this.dispatch({ type: 'song_selected', song });
        break;
      }
      case 'select_part':
        this.dispatch({ type: 'part_selected', partId: message.partId, trackName: message.trackName, byPeer: true });
        break;
      case 'ready':
        this.dispatch({ type: 'ready_changed', ready: message.ready, byPeer: true });
        break;
      case 'start':
        this.dispatch({ type: 'start', localStartTimeMs: handle.localStartTimeFor(message.startAtServerMs) });
        break;
      case 'progress': {
        const { type: _type, ...progress } = message;
        this.dispatch({ type: 'partner_progress', progress });
        break;
      }
      case 'leave':
        this.dispatch({ type: 'leave_received' });
        break;
    }
  }

  private report(cause: unknown): void {
    if (this.handle) this.dispatch({ type: 'error', code: cause instanceof RoomError ? cause.code : 'network' });
  }

  private post(message: RoomMessage): void {
    this.handle?.send(message).catch((cause: unknown) => this.report(cause));
  }

  // Whoever just arrived missed everything sent before. The song goes first so the hello's part applies to it.
  private announce(): void {
    const { role, song, myNickname, myPartId, myTrackName, myReady } = this.state;
    if (role === 'host' && song) this.post({ type: 'select_song', ...song });
    const hello: HelloMessage = {
      type: 'hello',
      nickname: myNickname,
      ready: myReady,
      ...(myPartId !== null ? { partId: myPartId } : {}),
      ...(myTrackName !== null ? { trackName: myTrackName } : {}),
    };
    this.post(hello);
  }

  selectSong(song: RoomSong): void {
    if (!this.handle) return;
    this.dispatch({ type: 'song_selected', song });
    this.announce();
  }

  selectPart(partId: number, trackName: string): void {
    if (!this.handle) return;
    this.dispatch({ type: 'part_selected', partId, trackName, byPeer: false });
    this.post({ type: 'select_part', partId, trackName });
  }

  setReady(ready: boolean): void {
    if (!this.handle) return;
    this.dispatch({ type: 'ready_changed', ready, byPeer: false });
    this.post({ type: 'ready', ready });
  }

  // A lost progress message is replaced by the next one, so it isn't worth an error on screen
  sendProgress(message: ProgressMessage): void {
    this.handle?.send(message).catch(() => undefined);
  }

  notifyMyScore(score: number): void {
    if (score !== this.state.myScore) this.dispatch({ type: 'my_score_changed', score });
  }

  async scheduleStart(): Promise<void> {
    const { handle } = this;
    if (!handle || !canStart(this.state)) return;
    try {
      // self:false hides our own broadcast, so the host starts from the returned time
      const localStartTimeMs = await handle.scheduleStart();
      if (this.handle === handle) this.dispatch({ type: 'start', localStartTimeMs });
    } catch (cause) {
      this.report(cause);
    }
  }

  clearError(): void {
    this.dispatch({ type: 'clear_error' });
  }

  backToLobby(): void {
    this.dispatch({ type: 'back_to_lobby' });
  }

  async leave(): Promise<void> {
    this.removeListener?.();
    this.removeListener = null;
    const { handle } = this;
    this.handle = null;
    await handle?.leave().catch(() => undefined);
    this.dispatch({ type: 'reset' });
  }
}
