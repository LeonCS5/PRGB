// DEV-only stand-in for the ranking backend: fictional data for the ?tela=ranking-... scenes, so the real
// components and flows run without an account or a network. It answers like the server where the UI cares
// (it refuses a run without points). Only reachable behind import.meta.env.DEV, dropped from production builds.

import { LEGAL_VERSION } from '../content/legal';
import type { LeaderboardTarget, RankingApi, RankingDevSetup } from '../context/ranking';
import { RankingError, type LeaderboardEntry, type RankingProfile } from '../services/backend/rankingApi';
import { DEMO_SONG_ID } from '../services/demoSong';
import type { DevScene } from './devScenes';

const NOW = '2026-10-29T21:15:00.000Z';
const DEMO_TARGET: LeaderboardTarget = { songId: DEMO_SONG_ID, partId: 0, title: 'Pentatônica em Lá menor', trackName: 'Exercício' };

const row = (rank: number, nickname: string, score: number, accuracy: number, maxCombo: number, isMe = false): LeaderboardEntry =>
  ({ rank, nickname, score, accuracy, maxCombo, achievedAt: NOW, isMe });

const ALL_TIME: LeaderboardEntry[] = [
  row(1, 'Palheta de Ouro', 19450, 100, 41),
  row(2, 'Riffeiro_92', 18300, 98, 37),
  row(3, 'Trastes Tortos', 17150, 95, 33, true),
  row(4, 'Pedal Quebrado', 15900, 93, 28),
  row(5, 'Cordas.de.Aço', 12850, 88, 19),
  row(6, 'Solo no Quintal', 9400, 76, 12)
];
const THIS_WEEK = ALL_TIME.slice(0, 2);
const MY_WEEK_POSITION = row(57, 'Trastes Tortos', 3200, 54, 6, true);

const PROFILE: RankingProfile = {
  nickname: 'Trastes Tortos', ageConfirmedAt: NOW, consentAt: NOW, consentVersion: LEGAL_VERSION, createdAt: NOW, lastSeenAt: NOW
};

const createDevApi = (initial: { profile: RankingProfile | null; rows: LeaderboardEntry[] }): RankingApi => {
  let profile = initial.profile;
  const requireProfile = (): RankingProfile => {
    if (!profile) throw new RankingError('profile_required');
    return profile;
  };
  return {
    hasStoredSession: () => profile !== null,
    getMyProfile: async () => profile,
    ensureAnonymousSession: async () => ({ userId: 'cena-dev', isAnonymous: true }),
    touchLastSeen: async () => undefined,
    createProfile: async ({ nickname }) => {
      if (nickname.toLowerCase() === 'riffeiro_92') throw new RankingError('nickname_taken');
      profile = { ...PROFILE, nickname };
      return profile;
    },
    reacceptTerms: async ({ consentVersion }) => {
      profile = { ...requireProfile(), consentVersion };
      return profile;
    },
    updateNickname: async (nickname) => {
      profile = { ...requireProfile(), nickname };
      return profile;
    },
    deleteMyAccount: async () => {
      profile = null;
    },
    exportMyData: async () => ({
      exported_at: NOW, account: null, profile: null, scores_best: [], scores_weekly: [], play_sessions: [],
      registered_parts: [], register_part_quota: []
    }),
    registerPart: async (songId, partId, revisionId = 0) => {
      requireProfile();
      return { songId, partId, revisionId, title: DEMO_TARGET.title, artist: 'Exercício PRGB', trackName: DEMO_TARGET.trackName, scorableNotes: 41, durationMs: 18667, maxScore: 20100 };
    },
    startRankedSession: async () => {
      requireProfile();
      return 'sessao-dev';
    },
    submitScore: async ({ score }) => {
      if (score < 1) throw new RankingError('empty_run');
      return { accepted: true, personalBest: true, weeklyBest: true, rankAll: 3, rankWeek: 1 };
    },
    getLeaderboard: async ({ period = 'all' }) => period === 'all' ? initial.rows : initial.rows.slice(0, THIS_WEEK.length),
    getMyPosition: async ({ period = 'all' }) => period === 'week' && initial.rows.length > 0 && profile ? MY_WEEK_POSITION : null
  };
};

export const rankingDevSetup = (scene: DevScene | null): RankingDevSetup | null => {
  const signedIn = createDevApi({ profile: PROFILE, rows: ALL_TIME });
  switch (scene) {
    case 'ranking-entrada':
      return { api: createDevApi({ profile: null, rows: ALL_TIME }), entryMode: 'create' };
    case 'ranking-reaceite':
      return { api: createDevApi({ profile: { ...PROFILE, consentVersion: '2026-01-01' }, rows: ALL_TIME }), entryMode: 'reaccept' };
    case 'ranking-conta':
      return { api: signedIn, accountOpen: true };
    case 'ranking-lista':
      return { api: signedIn, leaderboardTarget: DEMO_TARGET };
    case 'ranking-vazio':
      return { api: createDevApi({ profile: PROFILE, rows: [] }), leaderboardTarget: DEMO_TARGET };
    case 'ranking-partida':
    case 'ranking-resultado':
    case 'ranking-apagar':
      return { api: signedIn };
    default:
      return null;
  }
};
