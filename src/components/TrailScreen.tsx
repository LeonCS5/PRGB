import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ListChecks, Play, Route, Star } from 'lucide-react';
import { LEVEL_NAMES, type Exercise, type ExercisePattern } from '../services/exercises';
import { loadProgress, MAX_STARS } from '../services/progress';
import { summarizeTrail, TRAIL_STEP_COUNT, type ResolvedStep, type StageSummary, type TrailSummary } from '../services/trail';
import { ACCURACY_TEXT, STARS_RULE_TEXT } from './progress/starRules';
import { plural, starsText } from './progress/viewModel';

// A path through the exercise library, easiest first. Everything is read from this browser, nothing is locked and the
// wording says what the player has done, never what is missing.

export interface TrailViewProps {
  summary: TrailSummary;
  onPlay: (exercise: Exercise, key: number, pattern?: ExercisePattern) => void;
  onExit: () => void;
  onSession?: (stageId?: string) => void; // opens the session builder, on a stage when one is given
}

const card = 'rounded-2xl border border-ink-700 bg-ink-900';

const Stars: React.FC<{ count: number }> = ({ count }) => (
  <span aria-hidden="true" className="hidden shrink-0 gap-0.5 sm:flex">
    {Array.from({ length: MAX_STARS }, (_, index) => (
      <Star key={index} size={14} className={index < count ? 'fill-amp-300 text-amp-300' : 'text-ink-400'} />
    ))}
  </span>
);

const PlayButton: React.FC<{ step: ResolvedStep; onPlay: TrailViewProps['onPlay']; primary?: boolean }> = ({ step, onPlay, primary = false }) => (
  <button type="button" onClick={() => onPlay(step.exercise, step.key, step.pattern)} aria-label={`Tocar ${step.title}`}
    className={`flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold sm:px-4 transition ${primary ? 'bg-amp-400 text-ink-950 hover:bg-amp-300' : 'border border-ink-600 text-ink-100 hover:border-ink-400 hover:bg-ink-800'}`}>
    <Play size={15} className={primary ? 'fill-current' : ''} aria-hidden="true" /> Tocar
  </button>
);

const StepRow: React.FC<{ item: StageSummary['steps'][number]; isNext: boolean; onPlay: TrailViewProps['onPlay'] }> = ({ item, isNext, onPlay }) => {
  const { step, progress } = item;
  const detail = [
    LEVEL_NAMES[step.level],
    starsText(progress.stars),
    progress.bestAccuracy !== null ? `melhor precisão ${progress.bestAccuracy}%` : null,
    progress.plays > 0 ? `${progress.plays} ${plural(progress.plays, 'vez', 'vezes')}` : null
  ].filter((part): part is string => part !== null).join(' · ');
  return (
    <li className={`flex min-w-0 items-center gap-2 rounded-xl border px-2 py-2 sm:gap-3 sm:px-3 ${isNext ? 'border-amp-500/50 bg-amp-500/5' : 'border-ink-700'}`}>
      <span aria-hidden="true" className="w-5 shrink-0 text-right font-mono text-xs text-ink-300 sm:w-6">{step.index}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink-100">
          {step.title}
          {isNext && <span className="rounded-full bg-amp-500/15 px-2 py-0.5 text-xs font-bold text-amp-300">Próximo</span>}
        </span>
        <span className="mt-0.5 block text-xs text-ink-300">{detail}</span>
        {step.exercise.description && <span className="mt-0.5 block text-xs text-ink-300">{step.exercise.description}</span>}
      </span>
      <Stars count={progress.stars} />
      <PlayButton step={step} onPlay={onPlay} primary={isNext} />
    </li>
  );
};

export const TrailView: React.FC<TrailViewProps> = ({ summary, onPlay, onExit, onSession }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const { next, withStars, totalStars, maxStars } = summary;
  const percent = Math.round((withStars / TRAIL_STEP_COUNT) * 100);

  return (
    <main className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-8">
        <button type="button" onClick={onExit} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-ink-200 hover:bg-ink-800">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar ao início
        </button>
        <h1 ref={heading} tabIndex={-1} className="mt-4 flex items-center gap-3 font-display text-3xl font-bold">
          <Route size={28} className="shrink-0 text-amp-400" aria-hidden="true" /> Trilha
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
          {TRAIL_STEP_COUNT} exercícios em {summary.stages.length} etapas, do primeiro som até o material mais difícil. Siga a ordem ou toque o que quiser: nada fica bloqueado. As estrelas ficam só neste navegador.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-ink-300">{STARS_RULE_TEXT} {ACCURACY_TEXT}</p>

        <section aria-labelledby="trail-summary" className={`${card} mt-5 p-4 sm:p-5`}>
          <h2 id="trail-summary" className="font-display text-lg font-bold text-ink-100">Seu caminho</h2>
          <p className="mt-2 text-sm text-ink-100">
            <span className="font-mono">{withStars}</span> de <span className="font-mono">{TRAIL_STEP_COUNT}</span> exercícios com estrela · <span className="font-mono">{totalStars}</span> de <span className="font-mono">{maxStars}</span> estrelas
          </p>
          <div role="progressbar" aria-label="Exercícios da trilha com estrela" aria-valuemin={0} aria-valuemax={TRAIL_STEP_COUNT} aria-valuenow={withStars} aria-valuetext={`${withStars} de ${TRAIL_STEP_COUNT}`}
            className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-amp-400" style={{ width: `${percent}%` }} />
          </div>
          {next ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-200">{withStars === 0 ? 'Comece por aqui: ' : 'Continue daqui: '}<span className="font-semibold text-ink-100">{next.title}</span></p>
              <PlayButton step={next} onPlay={onPlay} primary />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-200">Você já tem estrela em todos os exercícios da trilha. Volte a qualquer um deles para melhorar a precisão.</p>
          )}
          {onSession && (
            <button type="button" onClick={() => onSession()} className="mt-4 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">
              <ListChecks size={16} className="text-signal-300" aria-hidden="true" /> Montar sessão
            </button>
          )}
        </section>

        <div className="mt-5 grid gap-3">
          {summary.stages.map((item, stageIndex) => (
            <details key={item.stage.stage.id} open={item.stage.stage.id === summary.nextStageId} className={`${card} group`}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amp-500/40 font-mono text-sm font-bold text-amp-300">{stageIndex + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold text-ink-100">Etapa {stageIndex + 1}: {item.stage.stage.title}</span>
                  <span className="block text-xs text-ink-300">{item.withStars} de {item.steps.length} com estrela</span>
                </span>
              </summary>
              <div className="px-4 pb-4">
                <p className="text-sm leading-6 text-ink-300">{item.stage.stage.goal}</p>
                {onSession && (
                  <button type="button" onClick={() => onSession(item.stage.stage.id)} className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-signal-500/40 px-3 text-sm font-semibold text-signal-300 hover:bg-signal-500/10">
                    <ListChecks size={16} aria-hidden="true" /> Tocar a etapa em sequência
                  </button>
                )}
                <ol aria-label={`Exercícios da etapa ${stageIndex + 1}`} className="mt-3 grid gap-2">
                  {item.steps.map((row) => <StepRow key={row.step.index} item={row} isNext={next?.index === row.step.index} onPlay={onPlay} />)}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
};

export interface TrailScreenProps {
  onPlay: TrailViewProps['onPlay'];
  onExit: () => void;
  onSession?: TrailViewProps['onSession'];
}

export const TrailScreen: React.FC<TrailScreenProps> = ({ onPlay, onExit, onSession }) => {
  const [summary] = useState(() => summarizeTrail(loadProgress()));
  return <TrailView summary={summary} onPlay={onPlay} onExit={onExit} onSession={onSession} />;
};
