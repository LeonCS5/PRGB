import { useEffect, useState, useSyncExternalStore } from 'react';
import { RankedRunController, type RankedRunState } from './rankedRun';
import { useRanking } from './ranking';
import type { GamePart, RankedStart } from './gameSession';

export interface RankedRunOptions {
  part: GamePart | null; // null: duo, never ranked
  start: RankedStart | null;
  reloadTab?: () => Promise<string | null>;
  devSessionId?: string | null;
}

export interface RankedRun extends RankedRunState {
  controller: RankedRunController;
  isAvailable: boolean; // the switch exists: solo game, backend configured
  isOn: boolean;
  isBusy: boolean; // waiting for the server: the run can't start yet
}

// The parts and the callbacks are fixed for a game's lifetime (it remounts for each session)
export const useRankedRun = ({ part, start, reloadTab, devSessionId = null }: RankedRunOptions): RankedRun => {
  const { api, isConfigured, hasAccount, requestAccount, forgetAccount, accountLossCount } = useRanking();
  const [controller] = useState(() => new RankedRunController({
    api, part, requestAccount, forgetAccount, reloadTab, sessionId: devSessionId, isReload: start === 'reloaded'
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  // With an account the run is ranked from the start; without one, nothing is asked until the player enters
  const [rankedFromStart] = useState(hasAccount);

  useEffect(() => {
    if ((start || rankedFromStart) && !devSessionId) void controller.prepare();
    return () => controller.dispose();
  }, [controller, start, rankedFromStart, devSessionId]);

  const [lossesAtStart] = useState(accountLossCount);
  useEffect(() => {
    if (accountLossCount !== lossesAtStart) controller.accountLost();
  }, [controller, accountLossCount, lossesAtStart]);

  return {
    ...state,
    controller,
    isAvailable: isConfigured && part !== null,
    isOn: state.phase !== 'off',
    isBusy: state.phase === 'preparing' || state.phase === 'starting'
  };
};
