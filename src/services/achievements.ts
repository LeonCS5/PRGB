// Picks (achievements): data plus rules. Each has a stable id (saved in the player's browser: never rename or
// reuse one), a pt-BR name and description, and a pure `check`. Wording is about what the player did, never
// about what they missed: no pressure, no "you lost", no countdowns.

import { EXERCISE_CATEGORIES, type ExerciseCategoryId } from './exercises';
import { isExerciseSongId, parseExerciseSongId } from './exerciseIds';
import type { Progress, WeeklyProgress } from './progress';
import type { ScoreState } from './scoring';

// What the game reports from outside a run
export type AchievementEvent = { type: 'latencyTestSaved' };

// A finished run on own content that was not seeked and did not change speed
export interface AchievementRun {
  songId: number;
  partId: number;
  stars: number; // stars earned by this run (0 when it was not rated)
  score: ScoreState;
  laps: number;
}

export interface AchievementContext {
  progress: Progress; // already includes the run
  run: AchievementRun | null;
  event: AchievementEvent | null;
  weekly: WeeklyProgress;
  twoStarContents: number; // distinct exercises or songs with at least 2 stars
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  check: (ctx: AchievementContext) => boolean;
}

const CATEGORY_BY_CODE = new Map<number, ExerciseCategoryId>(
  EXERCISE_CATEGORIES.flatMap((category) => category.groups.flatMap((group) =>
    group.exercises.map((item) => [item.code, category.id] as const)))
);

const categoryOfRun = (run: AchievementRun | null): ExerciseCategoryId | null =>
  run && isExerciseSongId(run.songId) ? CATEGORY_BY_CODE.get(parseExerciseSongId(run.songId).code) ?? null : null;

const HOUR_MS = 3_600_000;

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'primeira-palhetada',
    name: 'Primeira palhetada',
    description: 'Tocou o primeiro exercício até o fim.',
    check: ({ run }) => run !== null && run.score.perfect + run.score.good + run.score.miss > 0
  },
  {
    id: 'pentatonica-no-braco',
    name: 'Pentatônica no braço',
    description: 'Tocou uma pentatônica inteira.',
    check: ({ run }) => categoryOfRun(run) === 'pentatonicas' && run !== null && run.stars >= 1
  },
  {
    id: 'escala-tres-estrelas',
    name: 'Escala redonda',
    description: 'Tirou 3 estrelas numa escala.',
    check: ({ run }) => categoryOfRun(run) === 'escalas' && run !== null && run.stars === 3
  },
  {
    id: 'primeiro-acorde',
    name: 'Mão no acorde',
    description: 'Tocou um exercício de acordes até o fim.',
    check: ({ run }) => categoryOfRun(run) === 'acordes' && run !== null && run.stars >= 1
  },
  {
    id: 'cinquenta-seguidas',
    name: 'Cinquenta de primeira',
    description: 'Acertou 50 notas seguidas.',
    check: ({ run }) => run !== null && run.score.maxCombo >= 50
  },
  {
    id: 'tres-estrelas',
    name: 'Noite redonda',
    description: 'Tirou 3 estrelas num exercício.',
    check: ({ run }) => run !== null && run.stars === 3
  },
  {
    id: 'cinco-bem-tocados',
    name: 'Cinco bem tocados',
    description: 'Tirou 2 estrelas ou mais em 5 exercícios diferentes.',
    check: ({ twoStarContents }) => twoStarContents >= 5
  },
  {
    id: 'dez-voltas',
    name: 'Volta e meia',
    description: 'Deu 10 voltas no modo treino.',
    check: ({ progress }) => progress.totals.trainingLaps >= 10
  },
  {
    id: 'mao-no-tempo',
    name: 'Mão no tempo',
    description: 'Fez o teste de latência e salvou o ajuste.',
    check: ({ event }) => event?.type === 'latencyTestSaved'
  },
  {
    id: 'tres-dias-na-semana',
    name: 'Três dias na semana',
    description: 'Ensaiou em 3 dias da mesma semana.',
    check: ({ weekly }) => weekly.daysDone >= 3
  },
  {
    id: 'meta-da-semana',
    name: 'Ensaio da semana',
    description: 'Chegou à meta de dias de ensaio de uma semana.',
    check: ({ weekly }) => weekly.completed
  },
  {
    id: 'uma-hora-de-palheta',
    name: 'Uma hora de palheta',
    description: 'Somou uma hora de ensaio.',
    check: ({ progress }) => progress.totals.practiceMs >= HOUR_MS
  }
];

/** Ids of the picks whose rule is met now and are not yet unlocked. Never returns one twice. */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS
    .filter((item) => !Object.prototype.hasOwnProperty.call(ctx.progress.achievements, item.id) && item.check(ctx))
    .map((item) => item.id);
}
