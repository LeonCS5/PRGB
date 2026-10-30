import React, { useMemo, useRef, useState } from 'react';
import { LEGAL_VERSION } from '../content/legal';
import {
  createProfile,
  deleteMyAccount,
  ensureAnonymousSession,
  exportMyData,
  getLeaderboard,
  getMyPosition,
  getMyProfile,
  reacceptTerms,
  registerPart,
  startRankedSession,
  submitScore,
  toRankingError,
  touchLastSeen,
  updateNickname,
  type RankingProfile
} from '../services/backend/rankingApi';
import { isBackendConfigured } from '../services/backend/supabaseClient';
import { hasRankingSession } from './localData';
import { RankingContext, type LeaderboardTarget, type RankingApi, type RankingDevSetup, type RankingEntryMode, type RankingValue } from './ranking';

const liveApi: RankingApi = {
  createProfile,
  deleteMyAccount,
  ensureAnonymousSession,
  exportMyData,
  getLeaderboard,
  getMyPosition,
  getMyProfile,
  reacceptTerms,
  registerPart,
  startRankedSession,
  submitScore,
  touchLastSeen,
  updateNickname,
  hasStoredSession: hasRankingSession
};

export interface RankingProviderProps {
  children: React.ReactNode;
  dev?: RankingDevSetup | null;
}

// Nothing here talks to the backend on its own: every call starts from something the player opened
export const RankingProvider: React.FC<RankingProviderProps> = ({ children, dev = null }) => {
  const api = dev?.api ?? liveApi;
  const isConfigured = dev !== null || isBackendConfigured();
  const [hasAccount, setHasAccount] = useState(() => isConfigured && api.hasStoredSession());
  const [accountLossCount, setAccountLossCount] = useState(0);
  const [profile, setProfile] = useState<RankingProfile | null>(null);
  const [entryMode, setEntryMode] = useState<RankingEntryMode | null>(dev?.entryMode ?? null);
  const [isAccountOpen, setIsAccountOpen] = useState(dev?.accountOpen ?? false);
  const [leaderboardTarget, setLeaderboardTarget] = useState<LeaderboardTarget | null>(dev?.leaderboardTarget ?? null);
  const entryWaiterRef = useRef<((profile: RankingProfile | null) => void) | null>(null);
  const touchedRef = useRef(false);

  const actions = useMemo(() => {
    const touch = () => {
      if (touchedRef.current || !api.hasStoredSession()) return;
      touchedRef.current = true;
      // Best effort: it only feeds the 12-month inactivity rule, and start_session marks activity too
      api.touchLastSeen().catch(() => { touchedRef.current = false; });
    };

    const forgetAccount = () => {
      setProfile(null);
      setHasAccount(api.hasStoredSession());
      setAccountLossCount((count) => count + 1);
    };

    const loadProfile = async (): Promise<RankingProfile | null> => {
      if (!api.hasStoredSession()) {
        setProfile(null);
        return null;
      }
      try {
        const found = await api.getMyProfile();
        setProfile(found);
        if (found) touch();
        return found;
      } catch (error) {
        // The stored session belongs to an account that no longer exists: the same as having none
        if (toRankingError(error).code !== 'not_authenticated') throw error;
        setProfile(null);
        return null;
      }
    };

    const requestAccount = async (): Promise<RankingProfile | null> => {
      const found = await loadProfile();
      if (found?.consentVersion === LEGAL_VERSION) return found;
      return new Promise((resolve) => {
        entryWaiterRef.current?.(null);
        entryWaiterRef.current = resolve;
        setEntryMode(found ? 'reaccept' : 'create');
      });
    };

    const finishEntry = (done: RankingProfile | null) => {
      setHasAccount(api.hasStoredSession());
      if (done) setProfile(done);
      // create_profile answered profile_exists and the existing account is on older terms
      if (done && done.consentVersion !== LEGAL_VERSION) {
        setEntryMode('reaccept');
        return;
      }
      setEntryMode(null);
      const waiter = entryWaiterRef.current;
      entryWaiterRef.current = null;
      if (waiter) waiter(done);
      else if (done) setIsAccountOpen(true);
    };

    const openAccount = () => {
      if (api.hasStoredSession()) setIsAccountOpen(true);
      else setEntryMode('create');
    };

    const deleteAccount = async () => {
      await api.deleteMyAccount();
      forgetAccount();
    };

    const openLeaderboard = (target: LeaderboardTarget) => {
      touch();
      setLeaderboardTarget(target);
    };

    return {
      loadProfile,
      requestAccount,
      finishEntry,
      openAccount,
      deleteAccount,
      forgetAccount,
      openLeaderboard,
      saveProfile: setProfile,
      openEntry: setEntryMode,
      closeAccount: () => setIsAccountOpen(false),
      closeLeaderboard: () => setLeaderboardTarget(null)
    };
  }, [api]);

  const value = useMemo<RankingValue>(() => ({
    isConfigured, api, hasAccount, accountLossCount, profile, entryMode, isAccountOpen, leaderboardTarget, ...actions
  }), [isConfigured, api, hasAccount, accountLossCount, profile, entryMode, isAccountOpen, leaderboardTarget, actions]);

  return <RankingContext.Provider value={value}>{children}</RankingContext.Provider>;
};
