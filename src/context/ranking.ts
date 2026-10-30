import { createContext, useContext } from 'react';
import type * as rankingApi from '../services/backend/rankingApi';
import type { RankingProfile } from '../services/backend/rankingApi';

// What the UI uses of rankingApi.ts. DEV scenes swap it for fictional data (components/devRanking.ts).
export type RankingApi = Pick<
  typeof rankingApi,
  | 'createProfile' | 'deleteMyAccount' | 'ensureAnonymousSession' | 'exportMyData' | 'getLeaderboard' | 'getMyPosition'
  | 'getMyProfile' | 'reacceptTerms' | 'registerPart' | 'startRankedSession' | 'submitScore' | 'touchLastSeen'
  | 'updateNickname'
> & { hasStoredSession: () => boolean };

export interface LeaderboardTarget {
  songId: number;
  partId: number;
  title: string;
  trackName: string;
}

export type RankingEntryMode = 'create' | 'reaccept';

export interface RankingDevSetup {
  api: RankingApi;
  entryMode?: RankingEntryMode;
  accountOpen?: boolean;
  leaderboardTarget?: LeaderboardTarget;
}

export interface RankingValue {
  isConfigured: boolean; // false: no ranking UI at all, the game works the same
  api: RankingApi;
  hasAccount: boolean; // a ranking session is stored in this browser
  accountLossCount: number; // goes up when the account is deleted or turns out to be gone
  profile: RankingProfile | null; // known after the first lookup; null also while nobody asked
  entryMode: RankingEntryMode | null;
  isAccountOpen: boolean;
  leaderboardTarget: LeaderboardTarget | null;
  loadProfile: () => Promise<RankingProfile | null>;
  // Resolves with a profile on the current terms, going through the entry flow if needed; null if the player gave up
  requestAccount: () => Promise<RankingProfile | null>;
  saveProfile: (profile: RankingProfile) => void;
  openEntry: (mode: RankingEntryMode) => void;
  finishEntry: (profile: RankingProfile | null) => void;
  openAccount: () => void;
  closeAccount: () => void;
  deleteAccount: () => Promise<void>;
  forgetAccount: () => void;
  openLeaderboard: (target: LeaderboardTarget) => void;
  closeLeaderboard: () => void;
}

export const RankingContext = createContext<RankingValue | null>(null);

export const useRanking = (): RankingValue => {
  const ctx = useContext(RankingContext);
  if (!ctx) throw new Error('useRanking must be used within RankingProvider');
  return ctx;
};
