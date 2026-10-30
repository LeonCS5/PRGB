import { describe, expect, it, vi } from 'vitest';
import { RankingError, type RankingErrorCode, type RankingProfile, type RegisteredPart, type SubmitScoreResult } from '../services/backend/rankingApi';
import { applyJudgement, createScoreState, type Judgement, type ScoreState } from '../services/scoring';
import type { NormalizedSongTab } from '../services/songsterrApi';
import type { GamePart } from './gameSession';
import { RankedRunController, RELOADED_NOTICE, type RankedRunDeps } from './rankedRun';

const PROFILE: RankingProfile = {
  nickname: 'Ana', ageConfirmedAt: 'x', consentAt: 'x', consentVersion: 'v1', createdAt: 'x', lastSeenAt: 'x'
};
const RESULT: SubmitScoreResult = { accepted: true, personalBest: true, weeklyBest: true, rankAll: 3, rankWeek: 1 };
const PART: GamePart = { tab: { songId: 7 } as NormalizedSongTab, partId: 2, revisionId: 50 };
const DEMO: GamePart = { tab: { songId: -1 } as NormalizedSongTab, partId: 0, revisionId: null };

const registered = (revisionId: number): RegisteredPart => ({
  songId: 7, partId: 2, revisionId, title: 'T', artist: 'A', trackName: 'N', scorableNotes: 10, durationMs: 1000, maxScore: 1500
});

const setup = (overrides: Partial<RankedRunDeps> = {}) => {
  const api = {
    registerPart: vi.fn<RankedRunDeps['api']['registerPart']>(async () => registered(50)),
    startRankedSession: vi.fn<RankedRunDeps['api']['startRankedSession']>(async () => 'session-1'),
    submitScore: vi.fn<RankedRunDeps['api']['submitScore']>(async () => RESULT)
  };
  const requestAccount = vi.fn<RankedRunDeps['requestAccount']>(async () => PROFILE);
  const forgetAccount = vi.fn();
  const controller = new RankedRunController({ api, part: PART, isReload: false, requestAccount, forgetAccount, ...overrides });
  return { api, requestAccount, forgetAccount, controller };
};

const scoreOf = (...judgements: Judgement[]): ScoreState =>
  judgements.reduce((state, judgement) => applyJudgement(state, judgement), createScoreState());

const CLEAN = { jumped: false, speedChanged: false };
const failWith = (code: RankingErrorCode) => async (): Promise<never> => {
  throw new RankingError(code);
};

// Promise whose outcome the test decides, for answers that arrive late
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('preparing a ranked run', () => {
  it('calls nothing on the server until the player has an account', async () => {
    const account = deferred<RankingProfile | null>();
    const { api, controller } = setup({ requestAccount: () => account.promise });
    const turningOn = controller.turnOn();
    expect(controller.getState().phase).toBe('preparing');
    expect(api.registerPart).not.toHaveBeenCalled();
    account.resolve(PROFILE);
    expect(await turningOn).toBe(true);
    expect(controller.getState().phase).toBe('ready');
  });

  it('goes back to off when the player gives up, without calling the server', async () => {
    const { api, controller } = setup({ requestAccount: async () => null });
    expect(await controller.turnOn()).toBe(false);
    expect(controller.getState().phase).toBe('off');
    expect(api.registerPart).not.toHaveBeenCalled();
  });

  it('sends the revision of the loaded tab, and none for the demo', async () => {
    const song = setup();
    await song.controller.turnOn();
    expect(song.api.registerPart).toHaveBeenCalledWith(7, 2, 50);

    const demo = setup({ part: DEMO });
    await demo.controller.turnOn();
    expect(demo.api.registerPart).toHaveBeenCalledWith(-1, 0, undefined);
  });

  it('never prepares a duo', async () => {
    const { requestAccount, controller } = setup({ part: null });
    expect(await controller.turnOn()).toBe(false);
    expect(requestAccount).not.toHaveBeenCalled();
    expect(await controller.beginRun()).toBe(false);
  });

  it('reloads the tab when the server counted another revision, and does not call the run ready', async () => {
    const reloadTab = vi.fn(async () => null);
    const { api, controller } = setup({ reloadTab });
    api.registerPart.mockResolvedValue(registered(51));
    expect(await controller.turnOn()).toBe(false);
    expect(reloadTab).toHaveBeenCalledTimes(1);
    expect(controller.getState().phase).toBe('preparing'); // until the game remounts
  });

  it('shows why the tab could not be reloaded', async () => {
    const { api, controller } = setup({ reloadTab: async () => 'Sem internet.' });
    api.registerPart.mockResolvedValue(registered(51));
    await controller.turnOn();
    expect(controller.getState()).toMatchObject({ phase: 'off', notice: { text: 'Sem internet.', tone: 'error' } });
  });

  it('does not reload in a loop when the new tab is still another revision', async () => {
    const reloadTab = vi.fn(async () => null);
    const { api, controller } = setup({ reloadTab, isReload: true });
    expect(controller.getState().notice).toEqual(RELOADED_NOTICE);
    api.registerPart.mockResolvedValue(registered(52));
    expect(await controller.prepare()).toBe(false);
    expect(reloadTab).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ phase: 'off', notice: { tone: 'error' } });
  });

  it('keeps the notice of a reload while preparing, and clears it when the player turns it on again', async () => {
    const { controller } = setup({ isReload: true });
    await controller.prepare();
    expect(controller.getState()).toMatchObject({ phase: 'ready', notice: RELOADED_NOTICE });
    controller.turnOff();
    expect(controller.getState().notice).toBeNull();
  });

  it('turns off and explains a failure', async () => {
    const { api, forgetAccount, controller } = setup();
    api.registerPart.mockImplementation(failWith('songsterr_unavailable'));
    expect(await controller.turnOn()).toBe(false);
    expect(controller.getState()).toMatchObject({
      phase: 'off', notice: { text: 'O Songsterr não respondeu agora. Tente novamente em instantes.', tone: 'error' }
    });
    expect(forgetAccount).not.toHaveBeenCalled();
  });

  it.each<RankingErrorCode>(['not_authenticated', 'profile_required'])('forgets an account refused with %s', async (code) => {
    const { api, forgetAccount, controller } = setup();
    api.registerPart.mockImplementation(failWith(code));
    await controller.turnOn();
    expect(controller.getState().phase).toBe('off');
    expect(forgetAccount).toHaveBeenCalledTimes(1);
  });

  it('reports a failure to look up the account', async () => {
    const { api, controller } = setup({ requestAccount: failWith('network') });
    await controller.turnOn();
    expect(controller.getState()).toMatchObject({ phase: 'off', notice: { tone: 'error' } });
    expect(api.registerPart).not.toHaveBeenCalled();
  });
});

describe('starting a run', () => {
  it('opens the session with the revision of the loaded tab', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    expect(await controller.beginRun()).toBe(true);
    expect(api.startRankedSession).toHaveBeenCalledWith(7, 2, 50);
    expect(controller.getState()).toMatchObject({ phase: 'running', sessionId: 'session-1' });
  });

  it('opens the demo session without a revision', async () => {
    const { api, controller } = setup({ part: DEMO });
    await controller.turnOn();
    await controller.beginRun();
    expect(api.startRankedSession).toHaveBeenCalledWith(-1, 0, undefined);
  });

  it('stays ready to try again when the session can not be opened', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockImplementationOnce(failWith('network'));
    expect(await controller.beginRun()).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: 'ready', sessionId: null, notice: { tone: 'error' } });
    expect(await controller.beginRun()).toBe(true);
    expect(controller.getState().notice).toBeNull();
  });

  it.each<RankingErrorCode>(['revision_mismatch', 'part_unregistered'])('counts the part again once after %s', async (code) => {
    const { api, controller } = setup();
    await controller.turnOn();
    api.registerPart.mockClear();
    api.startRankedSession.mockImplementationOnce(failWith(code));
    expect(await controller.beginRun()).toBe(true);
    expect(api.registerPart).toHaveBeenCalledTimes(1);
    expect(api.startRankedSession).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second refusal', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockImplementation(failWith('revision_mismatch'));
    expect(await controller.beginRun()).toBe(false);
    expect(api.startRankedSession).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ phase: 'ready', notice: { tone: 'error' } });
  });

  it('reloads the tab when the part moved to a newer revision before the start', async () => {
    const reloadTab = vi.fn(async () => null);
    const { api, controller } = setup({ reloadTab });
    await controller.turnOn();
    api.startRankedSession.mockImplementationOnce(failWith('revision_mismatch'));
    api.registerPart.mockResolvedValue(registered(51));
    expect(await controller.beginRun()).toBe(false);
    expect(reloadTab).toHaveBeenCalledTimes(1);
    expect(api.startRankedSession).toHaveBeenCalledTimes(1);
  });

  it('turns off when the account is gone', async () => {
    const { api, forgetAccount, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockImplementation(failWith('profile_required'));
    await controller.beginRun();
    expect(controller.getState().phase).toBe('off');
    expect(forgetAccount).toHaveBeenCalledTimes(1);
  });

  it('drops the session of a run the player left while it was opening', async () => {
    const opening = deferred<string>();
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockReturnValueOnce(opening.promise);
    const beginning = controller.beginRun();
    controller.turnOff();
    opening.resolve('late');
    expect(await beginning).toBe(false);
    expect(controller.getState()).toMatchObject({ phase: 'off', sessionId: null });
  });

  it('keeps only the newest session when the player restarts while one is opening', async () => {
    const opening = deferred<string>();
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockReturnValueOnce(opening.promise);
    const first = controller.beginRun();
    controller.clearRun();
    const second = controller.beginRun();
    opening.resolve('old');
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(controller.getState().sessionId).toBe('session-1');
  });

  it('needs a new session after a reset', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    await controller.beginRun();
    controller.clearRun();
    expect(controller.getState()).toMatchObject({ phase: 'ready', sessionId: null });
    api.startRankedSession.mockResolvedValueOnce('session-2');
    await controller.beginRun();
    expect(controller.getState().sessionId).toBe('session-2');
  });

  it('ignores answers after the game left', async () => {
    const opening = deferred<string>();
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockReturnValueOnce(opening.promise);
    const beginning = controller.beginRun();
    controller.dispose();
    opening.resolve('late');
    expect(await beginning).toBe(false);
  });
});

describe('sending the result', () => {
  const finishedRun = async (overrides: Partial<RankedRunDeps> = {}) => {
    const context = setup(overrides);
    await context.controller.turnOn();
    await context.controller.beginRun();
    return context;
  };

  it('sends whole numbers from the score', async () => {
    const { api, controller } = await finishedRun();
    controller.submitRun(scoreOf('perfect', 'good', 'miss'), CLEAN);
    expect(api.submitScore).toHaveBeenCalledWith({
      sessionId: 'session-1', score: 250, perfect: 1, good: 1, miss: 1, maxCombo: 2, accuracy: 67
    });
    expect(controller.getState().submission).toEqual({ status: 'sending' });
    await vi.waitFor(() => expect(controller.getState().submission).toEqual({ status: 'sent', result: RESULT }));
  });

  it('never sends a run with jumps or a speed change', async () => {
    const { api, controller } = await finishedRun();
    controller.submitRun(scoreOf('perfect'), { jumped: true, speedChanged: false });
    expect(controller.getState().submission).toEqual({ status: 'skipped', reason: 'jumped' });
    controller.submitRun(scoreOf('perfect'), { jumped: false, speedChanged: true });
    expect(controller.getState().submission).toEqual({ status: 'skipped', reason: 'speedChanged' });
    expect(api.submitScore).not.toHaveBeenCalled();
  });

  it('does nothing for a run without a session', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    controller.submitRun(scoreOf('perfect'), CLEAN);
    expect(api.submitScore).not.toHaveBeenCalled();
    expect(controller.getState().submission).toBeNull();
  });

  it('does not send a run the player took out of the ranking midway', async () => {
    const { api, controller } = await finishedRun();
    controller.turnOff();
    controller.submitRun(scoreOf('perfect'), CLEAN);
    expect(api.submitScore).not.toHaveBeenCalled();
  });

  it('can send again after a network failure, with the same numbers', async () => {
    const { api, controller } = await finishedRun();
    api.submitScore.mockImplementationOnce(failWith('network'));
    controller.submitRun(scoreOf('perfect'), CLEAN);
    await vi.waitFor(() => expect(controller.getState().submission).toMatchObject({ status: 'failed', canRetry: true }));
    controller.retrySubmission();
    await vi.waitFor(() => expect(controller.getState().submission).toEqual({ status: 'sent', result: RESULT }));
    expect(api.submitScore.mock.calls[1]).toEqual(api.submitScore.mock.calls[0]);
  });

  it.each<[RankingErrorCode, string]>([
    ['empty_run', 'Nenhuma nota foi acertada nesta jogada, por isso ela não entrou no ranking.'],
    ['session_too_short', 'A partida durou menos que a música, por isso não entrou no ranking.'],
    ['session_expired', 'A partida ficou aberta por mais de 2 horas e expirou. Toque de novo para valer.'],
    ['already_submitted', 'Esta jogada já foi enviada ao ranking.']
  ])('explains %s without offering to send it again', async (code, message) => {
    const { api, controller } = await finishedRun();
    api.submitScore.mockImplementationOnce(failWith(code));
    controller.submitRun(scoreOf('perfect'), CLEAN);
    await vi.waitFor(() => expect(controller.getState().submission).toEqual({ status: 'failed', message, canRetry: false }));
  });

  it('drops the answer of a run already reset', async () => {
    const sending = deferred<SubmitScoreResult>();
    const { api, controller } = await finishedRun();
    api.submitScore.mockReturnValueOnce(sending.promise);
    controller.submitRun(scoreOf('perfect'), CLEAN);
    controller.clearRun();
    sending.resolve(RESULT);
    await sending.promise;
    expect(controller.getState().submission).toBeNull();
  });
});

describe('losing the account', () => {
  it('turns off and keeps the explanation on screen', async () => {
    const { api, controller } = setup();
    await controller.turnOn();
    api.startRankedSession.mockImplementation(failWith('not_authenticated'));
    await controller.beginRun();
    const { notice } = controller.getState();
    controller.accountLost();
    expect(controller.getState()).toMatchObject({ phase: 'off', sessionId: null, notice });
  });
});

it('starts from the session of a DEV scene', () => {
  const { controller } = setup({ sessionId: 'dev' });
  expect(controller.getState()).toMatchObject({ phase: 'running', sessionId: 'dev' });
});

it('notifies subscribers until they leave', async () => {
  const { controller } = setup();
  const listener = vi.fn();
  const unsubscribe = controller.subscribe(listener);
  await controller.turnOn();
  expect(listener).toHaveBeenCalled();
  listener.mockClear();
  unsubscribe();
  controller.turnOff();
  expect(listener).not.toHaveBeenCalled();
});
