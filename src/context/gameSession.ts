import type { Challenge } from '../services/challenge';
import type { RunResult } from '../services/records';
import type { ScoreState } from '../services/scoring';
import type { NormalizedSongTab } from '../services/songsterrApi';

// A loaded part of a song. The tab doesn't carry its Songsterr partId, which records and challenges need.
export interface GamePart {
  tab: NormalizedSongTab;
  partId: number;
}

export interface SoloSession {
  mode: 'solo';
  key: number; // a new key remounts the game, so every session starts clean
  part: GamePart;
  challenge: Challenge | null;
}

export interface DuoSession {
  mode: 'duo';
  key: number;
  parts: [GamePart, GamePart]; // player 1 (channel 1) first
  names: [string, string];
}

export type GameSession = SoloSession | DuoSession;

export interface PersonalBestOutcome {
  isNew: boolean;
  previous: RunResult | null;
}

export interface RunSummary {
  scores: ScoreState[]; // one per player
  speed: number;
  // Seeking or changing speed mid-run: the result is shown but counts for no record and no challenge
  jumped: boolean;
  speedChanged: boolean;
  personalBest: PersonalBestOutcome | null; // solo only
}

export const DEFAULT_PLAYER_NAMES: [string, string] = ['Jogador 1', 'Jogador 2'];

let lastSessionKey = 0;
export const nextSessionKey = (): number => ++lastSessionKey;
