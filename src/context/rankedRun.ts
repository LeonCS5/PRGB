// One ranked run, free of React so the order of the backend calls can be tested. The rules it keeps: no
// server call before the player has an account on the current terms, the revision of the loaded tab always
// goes with registerPart and startRankedSession, a run only plays once its session exists, and a run with
// jumps or a speed change is never sent. Answers that arrive after the player moved on are dropped.

import { LEGAL_VERSION } from '../content/legal';
import { RankingError, toRankingError, type RankingErrorCode, type RankingProfile, type SubmitScoreInput } from '../services/backend/rankingApi';
import { accuracyPercent, type ScoreState } from '../services/scoring';
import type { GamePart, RankedSubmission } from './gameSession';
import type { RankingApi } from './ranking';
import { getRankingErrorMessage } from './uiErrors';

// off: not ranked. preparing: checking the account and the part. ready: waiting for play.
// starting: opening the server session. running: the run has a session (playing, paused or finished).
export type RankedPhase = 'off' | 'preparing' | 'ready' | 'starting' | 'running';

export interface RankedNotice {
  text: string;
  tone: 'info' | 'error';
}

export interface RankedRunState {
  phase: RankedPhase;
  // The check in `preparing` started by itself when the game opened, not by a click: it stays quiet and can be skipped
  automatic: boolean;
  sessionId: string | null;
  submission: RankedSubmission | null;
  notice: RankedNotice | null;
}

export interface RankedRunDeps {
  api: Pick<RankingApi, 'registerPart' | 'startRankedSession' | 'submitScore'>;
  part: GamePart | null; // null: duo, never ranked
  isReload: boolean; // this tab was already loaded again because the server had a newer revision
  requestAccount: () => Promise<RankingProfile | null>;
  // Looks the account up without opening the entry flow; with it, every lookup is cut off by the timeout
  loadProfile?: () => Promise<RankingProfile | null>;
  forgetAccount: () => void;
  // Loads the tab again, which remounts the game; returns why it couldn't, or null
  reloadTab?: () => Promise<string | null>;
  sessionId?: string | null; // DEV scenes start at the end of a run
}

export interface RunIntegrity {
  jumped: boolean;
  speedChanged: boolean;
}

// The session stays open on the server, so these can be sent again
const RETRYABLE: ReadonlySet<RankingErrorCode> = new Set<RankingErrorCode>(['network', 'unknown', 'rate_limited']);
const ACCOUNT_GONE: ReadonlySet<RankingErrorCode> = new Set<RankingErrorCode>(['not_authenticated', 'profile_required']);

// A server that never answers must not hold the game: past this the call counts as a network failure
export const RANKING_TIMEOUT_MS = 10_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => new Promise<T>((resolve, reject) => {
  const timer = setTimeout(() => reject(new RankingError('network')), ms);
  promise.then(
    (value) => { clearTimeout(timer); resolve(value); },
    (error: unknown) => { clearTimeout(timer); reject(error); }
  );
});

export const RELOADED_NOTICE: RankedNotice = {
  text: 'A tablatura desta música mudou no acervo. Carregamos a versão nova.',
  tone: 'info'
};

export class RankedRunController {
  private state: RankedRunState;
  private readonly listeners = new Set<() => void>();
  private readonly deps: RankedRunDeps;
  // Bumped by whatever makes the answers in flight useless
  private request = 0;
  private lastInput: SubmitScoreInput | null = null;

  constructor(deps: RankedRunDeps) {
    this.deps = deps;
    const sessionId = deps.sessionId ?? null;
    this.state = {
      phase: sessionId ? 'running' : 'off',
      automatic: false,
      sessionId,
      submission: null,
      notice: deps.isReload ? RELOADED_NOTICE : null
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): RankedRunState => this.state;

  private update(changes: Partial<RankedRunState>): void {
    // Leaving the check leaves its automatic mode too
    const automatic = changes.automatic ?? (changes.phase === undefined || changes.phase === 'preparing' ? this.state.automatic : false);
    this.state = { ...this.state, ...changes, automatic };
    for (const listener of this.listeners) listener();
  }

  private fail(error: unknown, phase: RankedPhase, quiet = false): void {
    const { code } = toRankingError(error);
    const accountGone = ACCOUNT_GONE.has(code);
    // A check nobody asked for stays quiet about the network: the game works without the ranking
    if (quiet && code === 'network') {
      this.update({ phase: 'off', sessionId: null });
      return;
    }
    this.update({
      phase: accountGone ? 'off' : phase,
      sessionId: null,
      notice: { text: getRankingErrorMessage(error), tone: 'error' }
    });
    if (accountGone) this.deps.forgetAccount();
  }

  // False when the run can't go on with this tab: the game is being remounted, or the reason is on screen
  private async register(part: GamePart, request: number): Promise<boolean> {
    const { tab, partId, revisionId } = part;
    const registered = await withTimeout(this.deps.api.registerPart(tab.songId, partId, revisionId ?? undefined), RANKING_TIMEOUT_MS);
    if (request !== this.request) return false;
    if (revisionId === null || registered.revisionId === revisionId) return true;
    if (this.deps.isReload || !this.deps.reloadTab) throw new RankingError('revision_mismatch');
    const failure = await this.deps.reloadTab();
    if (failure && request === this.request) this.update({ phase: 'off', notice: { text: failure, tone: 'error' } });
    return false;
  }

  // The account on the current terms, or null. An automatic check never opens the entry or reaccept flow.
  private async account(automatic: boolean): Promise<RankingProfile | null> {
    const { loadProfile, requestAccount } = this.deps;
    if (!loadProfile) return requestAccount();
    const profile = await withTimeout(loadProfile(), RANKING_TIMEOUT_MS);
    if (profile?.consentVersion === LEGAL_VERSION) return profile;
    return automatic ? null : requestAccount();
  }

  /** Account and part checks. True once the switch is on and the run can start. */
  async prepare(automatic = false): Promise<boolean> {
    const { part } = this.deps;
    if (!part) return false;
    const request = ++this.request;
    this.update({ phase: 'preparing', automatic });
    try {
      const profile = await this.account(automatic);
      if (request !== this.request) return false;
      if (!profile) {
        this.update({ phase: 'off' });
        return false;
      }
      if (!(await this.register(part, request))) return false;
      this.update({ phase: 'ready' });
      return true;
    } catch (error) {
      if (request === this.request) this.fail(error, 'off', automatic);
      return false;
    }
  }

  /** The player wants to play before the automatic check ends: the run goes on without the ranking. */
  abandonAutomatic(): void {
    if (this.state.phase !== 'preparing' || !this.state.automatic) return;
    this.request += 1;
    this.update({ phase: 'off' });
  }

  turnOn(): Promise<boolean> {
    this.update({ notice: null });
    return this.prepare();
  }

  turnOff(): void {
    this.request += 1;
    this.lastInput = null;
    this.update({ phase: 'off', sessionId: null, submission: null, notice: null });
  }

  /** The account is gone (deleted in the panel, or refused by the server): the switch goes off. */
  accountLost(): void {
    this.request += 1;
    this.update({ phase: 'off', sessionId: null, submission: null });
  }

  /** Opens the server session of a new run. True: start playing. */
  async beginRun(): Promise<boolean> {
    const { part, api } = this.deps;
    if (!part) return false;
    const request = ++this.request;
    const { tab, partId, revisionId } = part;
    const open = () => withTimeout(api.startRankedSession(tab.songId, partId, revisionId ?? undefined), RANKING_TIMEOUT_MS);
    this.update({ phase: 'starting', sessionId: null, submission: null, notice: null });
    try {
      let sessionId: string;
      try {
        sessionId = await open();
      } catch (error) {
        const { code } = toRankingError(error);
        if (code !== 'revision_mismatch' && code !== 'part_unregistered') throw error;
        // Someone else's registration moved the part on since this tab was checked
        if (request !== this.request || !(await this.register(part, request))) return false;
        sessionId = await open();
      }
      if (request !== this.request) return false;
      this.update({ phase: 'running', sessionId });
      return true;
    } catch (error) {
      if (request === this.request) this.fail(error, 'ready');
      return false;
    }
  }

  /** The run was reset: its session is left behind, the next one needs a new session. */
  clearRun(): void {
    const { phase } = this.state;
    const hadRun = phase === 'starting' || phase === 'running';
    if (hadRun) this.request += 1;
    this.lastInput = null;
    this.update({ phase: hadRun ? 'ready' : phase, sessionId: null, submission: null });
  }

  /** The song reached its end. Does nothing for a run without a session. */
  submitRun(score: ScoreState, { jumped, speedChanged }: RunIntegrity): void {
    const { sessionId } = this.state;
    if (!sessionId) return;
    if (jumped || speedChanged) {
      this.update({ submission: { status: 'skipped', reason: jumped ? 'jumped' : 'speedChanged' } });
      return;
    }
    void this.send({
      sessionId,
      score: score.score,
      perfect: score.perfect,
      good: score.good,
      miss: score.miss,
      maxCombo: score.maxCombo,
      accuracy: accuracyPercent(score)
    });
  }

  retrySubmission = (): void => {
    if (this.lastInput) void this.send(this.lastInput);
  };

  private async send(input: SubmitScoreInput): Promise<void> {
    const request = this.request;
    this.lastInput = input;
    this.update({ submission: { status: 'sending' } });
    try {
      const result = await this.deps.api.submitScore(input);
      if (request === this.request) this.update({ submission: { status: 'sent', result } });
    } catch (error) {
      if (request !== this.request) return;
      this.update({
        submission: {
          status: 'failed',
          message: getRankingErrorMessage(error),
          canRetry: RETRYABLE.has(toRankingError(error).code)
        }
      });
    }
  }

  /** The game is leaving: nothing that arrives from now on may touch it. */
  dispose(): void {
    this.request += 1;
  }
}
