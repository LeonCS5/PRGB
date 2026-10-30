// DEV-only shortcuts (?tela=...) to open screens that are hard to reach without a guitar, for screenshots
// and manual checks. import.meta.env.DEV is false in production builds, so this code is dropped there.

import { applyJudgement, createScoreState, type Judgement, type ScoreState } from '../services/scoring';

export type DevScene =
  | 'resultado' | 'desafio' | 'dupla-assistente' | 'dupla' | 'dupla-resultado'
  | 'ranking-entrada' | 'ranking-reaceite' | 'ranking-conta' | 'ranking-lista' | 'ranking-vazio' | 'ranking-partida'
  | 'ranking-resultado' | 'ranking-apagar';

const SCENES: readonly DevScene[] = [
  'resultado', 'desafio', 'dupla-assistente', 'dupla', 'dupla-resultado',
  'ranking-entrada', 'ranking-reaceite', 'ranking-conta', 'ranking-lista', 'ranking-vazio', 'ranking-partida',
  'ranking-resultado', 'ranking-apagar'
];

export interface GameDevPreset {
  positionMs: number;
  playing: boolean;
  scores: ScoreState[];
  shareOpen?: boolean;
  rankedSessionId?: string;
}

export const readDevScene = (): DevScene | null => {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get('tela');
  return SCENES.find((scene) => scene === value) ?? null;
};

// A plausible run: the judgements go through the real scoring rules
const sampleScore = (pattern: string): ScoreState => {
  const byLetter: Record<string, Judgement> = { p: 'perfect', g: 'good', m: 'miss' };
  return Array.from(pattern).reduce((state, letter) => applyJudgement(state, byLetter[letter]), createScoreState());
};

export const gameDevPreset = (scene: DevScene, durationMs: number): GameDevPreset | null => {
  const solo = sampleScore('ppppgppppppmpppgpppppppppgppppmpppppppp');
  const second = sampleScore('pgpgppmpppgpppmppgpppppgpmppppgpp');
  switch (scene) {
    case 'resultado':
      return { positionMs: durationMs, playing: true, scores: [solo, createScoreState()] };
    case 'desafio':
      return { positionMs: durationMs, playing: true, scores: [solo, createScoreState()], shareOpen: true };
    case 'dupla':
      return { positionMs: 9000, playing: false, scores: [sampleScore('ppppgpppppppgpp'), sampleScore('pgpppmppgpp')] };
    case 'dupla-resultado':
      return { positionMs: durationMs, playing: true, scores: [solo, second] };
    case 'ranking-resultado':
      return { positionMs: durationMs, playing: true, scores: [solo, createScoreState()], rankedSessionId: 'sessao-dev' };
    default:
      return null;
  }
};
