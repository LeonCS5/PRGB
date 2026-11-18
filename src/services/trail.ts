// The learning path: the exercise library in the order a player meets it, from the open strings to the hardest
// material. Every step is one exercise in one key (and, where there are several, one way of playing it), so progress
// and personal bests are the same ones the library already saves. Nothing here locks a step: the order is advice.
//
// How the order was set (see docs/trilha.md): beginners start with the open strings, a few fretted notes and the
// first chords, then rhythm; scales, pentatonic boxes and barre chords come once the hands are steady; speed,
// symmetric scales and altered chords come last. Inside a stage the steps never get easier than the one before.

import { exerciseByCode, exerciseVariant, type Exercise, type ExerciseLevel, type ExercisePattern } from './exercises';
import { contentKey, MAX_STARS, type ContentProgress, type Progress } from './progress';

export interface TrailStep {
  code: number;
  key: number; // the tonic (0 = C); ignored by exercises that have a fixed place on the neck
  pattern?: ExercisePattern;
}

export interface TrailStage {
  id: string;
  title: string;
  goal: string; // what the player can do after it, said as something to look forward to
  steps: TrailStep[];
}

const C = 0;
const D = 2;
const E = 4;
const F = 5;
const G = 7;
const A = 9;

const step = (code: number, key = C, pattern?: ExercisePattern): TrailStep => ({ code, key, pattern });

export const TRAIL: TrailStage[] = [
  {
    id: 'primeiros-sons',
    title: 'Primeiros sons',
    goal: 'Conhecer as cordas e fazer cada nota soar limpa.',
    steps: [step(188), step(189), step(9), step(1), step(7), step(160)]
  },
  {
    id: 'primeiros-acordes',
    title: 'Primeiros acordes',
    goal: 'Trocar entre os acordes abertos mais comuns no tempo.',
    steps: [step(114), step(110), step(108), step(109), step(102), step(101), step(100), step(116), step(115)]
  },
  {
    id: 'ritmo-e-progressoes',
    title: 'Ritmo e primeiras progressões',
    goal: 'Manter a batida firme e tocar uma sequência de acordes do começo ao fim.',
    steps: [
      step(161), step(169), step(170), step(113, E), step(124, E), step(29),
      step(130, G), step(136, C), step(131, D), step(132, C), step(133, G), step(140, A), step(145, E)
    ]
  },
  {
    id: 'notas-e-escalas',
    title: 'Notas e primeiras escalas',
    goal: 'Achar as notas no braço e tocar uma escala inteira, subindo e descendo.',
    steps: [step(190), step(191), step(185), step(186, C), step(60, C), step(61, A), step(80, C), step(81, A), step(20), step(21), step(24), step(2)]
  },
  {
    id: 'pentatonica-menor',
    title: 'Pentatônica menor',
    goal: 'Improvisar com as cinco posições da pentatônica, a escala mais usada para solar.',
    steps: [step(40, A), step(54, A), step(41, A), step(55, A), step(56, A), step(42, A), step(50, A), step(43, A), step(44, A)]
  },
  {
    id: 'acordes-abertos',
    title: 'Mais acordes abertos',
    goal: 'Tocar acordes com sétima, suspensos e o F com pestana, em trocas de um compasso.',
    steps: [step(104), step(117), step(118), step(119), step(103), step(105), step(121), step(106), step(107)]
  },
  {
    id: 'pestana-e-blues',
    title: 'Pestana e blues',
    goal: 'Levar uma forma de acorde por todo o braço e tocar um blues completo.',
    steps: [step(111, G), step(112, C), step(125, G), step(126, A), step(153, A), step(154, A), step(150, A), step(151, A), step(152, A)]
  },
  {
    id: 'pentatonica-maior',
    title: 'Pentatônica maior e tom maior',
    goal: 'Soar doce em tom maior e conduzir progressões com mais de quatro acordes.',
    steps: [step(45, G), step(58, G), step(59, G), step(46, G), step(47, G), step(48, G), step(49, G), step(51, G), step(137, C), step(138, G), step(139, C)]
  },
  {
    id: 'escalas-e-modos',
    title: 'Escalas e modos',
    goal: 'Tocar as escalas maiores, menores e os modos em duas oitavas.',
    steps: [step(62, A), step(63, A), step(64, D), step(65, E), step(66, F), step(67, G), step(200, C), step(201, C), step(206, A), step(207, A), step(187, C)]
  },
  {
    id: 'tecnicas',
    title: 'Técnicas da mão',
    goal: 'Ligados, slides, bends, vibrato e palhetada alternada sob controle.',
    steps: [
      step(22), step(3), step(4), step(5), step(12), step(10), step(11), step(14), step(15),
      step(25), step(26), step(27), step(28), step(30), step(31)
    ]
  },
  {
    id: 'ritmos',
    title: 'Ritmos e levadas',
    goal: 'Segurar contratempo, síncope, shuffle e tercinas.',
    steps: [step(162), step(163), step(164), step(165), step(166), step(171)]
  },
  {
    id: 'harmonia',
    title: 'Sétimas, arpejos e cadências',
    goal: 'Ouvir e tocar as cadências do jazz e do blues com sétimas.',
    steps: [step(84, C), step(85, C), step(134, C), step(135, C), step(86, C), step(87, G), step(88, A), step(142, A), step(143, A), step(146, A), step(147, A)]
  },
  {
    id: 'braco-inteiro',
    title: 'Braço inteiro',
    goal: 'Percorrer o braço todo com as escalas de três notas por corda.',
    steps: [step(202, C), step(203, C), step(204, C), step(205, C), step(208, A), step(209, A), step(210, A), step(211, A), step(52, A), step(53, G)]
  },
  {
    id: 'velocidade',
    title: 'Velocidade e precisão',
    goal: 'Tocar notas rápidas, saltos e ligados difíceis, sempre em cima do tempo.',
    steps: [step(13), step(167), step(168), step(172), step(32), step(57, A), step(8), step(6), step(23)]
  },
  {
    id: 'simetrias',
    title: 'Harmonia avançada',
    goal: 'Dominar acordes alterados, o modo lócrio e as escalas simétricas.',
    steps: [step(89, C), step(90, C), step(144, A), step(148, C), step(68, A), step(69, C), step(70, C), step(71, C)]
  }
];

export interface ResolvedStep {
  stageId: string;
  index: number; // 1-based, across the whole trail
  exercise: Exercise;
  key: number;
  pattern?: ExercisePattern;
  songId: number;
  partId: number;
  title: string;
  trackName: string;
  level: ExerciseLevel;
}

export interface ResolvedStage {
  stage: TrailStage;
  steps: ResolvedStep[];
}

const resolveStep = (stageId: string, index: number, { code, key, pattern }: TrailStep): ResolvedStep => {
  const exercise = exerciseByCode(code);
  if (!exercise) throw new Error(`Trail step with an unknown exercise: ${code}`);
  return { stageId, index, exercise, key, pattern, level: exercise.level, ...exerciseVariant(exercise, key, pattern) };
};

export const RESOLVED_TRAIL: ResolvedStage[] = (() => {
  let index = 0;
  return TRAIL.map((stage) => ({ stage, steps: stage.steps.map((item) => resolveStep(stage.id, ++index, item)) }));
})();

export const TRAIL_STEP_COUNT = RESOLVED_TRAIL.reduce((total, { steps }) => total + steps.length, 0);

export interface StepProgress {
  stars: number;
  bestAccuracy: number | null;
  plays: number;
}

const NOT_PLAYED: StepProgress = { stars: 0, bestAccuracy: null, plays: 0 };

export function stepProgress(progress: Progress, item: ResolvedStep): StepProgress {
  const saved: ContentProgress | undefined = progress.contents[contentKey(item.songId, item.partId)];
  if (!saved) return NOT_PLAYED;
  return { stars: saved.stars, bestAccuracy: saved.plays > 0 ? saved.bestAccuracy : null, plays: saved.plays };
}

export interface StageSummary {
  stage: ResolvedStage;
  withStars: number; // steps with at least one star
  steps: { step: ResolvedStep; progress: StepProgress }[];
}

export interface TrailSummary {
  stages: StageSummary[];
  withStars: number;
  totalStars: number;
  maxStars: number;
  next: ResolvedStep | null; // the first step without stars, where to go on from; null when all have stars
  nextStageId: string | null;
}

export function summarizeTrail(progress: Progress): TrailSummary {
  const stages = RESOLVED_TRAIL.map((stage): StageSummary => {
    const steps = stage.steps.map((item) => ({ step: item, progress: stepProgress(progress, item) }));
    return { stage, steps, withStars: steps.filter(({ progress: done }) => done.stars > 0).length };
  });
  const first = stages.flatMap((summary) => summary.steps).find(({ progress: done }) => done.stars === 0);
  return {
    stages,
    withStars: stages.reduce((total, { withStars }) => total + withStars, 0),
    totalStars: stages.reduce((total, { steps }) => total + steps.reduce((sum, { progress: done }) => sum + done.stars, 0), 0),
    maxStars: TRAIL_STEP_COUNT * MAX_STARS,
    next: first?.step ?? null,
    nextStageId: first?.step.stageId ?? null
  };
}
