import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Circle, Dumbbell, Star } from 'lucide-react';
import { saveWeeklyGoal } from '../context/progressStore';
import { ACHIEVEMENTS } from '../services/achievements';
import {
  levelFor, loadProgress, MAX_STARS, weeklyProgress, type Progress, type WeeklyGoal
} from '../services/progress';
import { OptionGroup } from './appearance/controls';
import type { Option } from './appearance/options';
import {
  CONTENT_PAGE_SIZE, contentTitle, formatDate, hasProgress, playedContents, plural, starsText, weekDays
} from './progress/viewModel';

// Everything here is read from this browser. The wording says what the player did, never what is missing.

const GOAL_OPTIONS: readonly Option<number>[] = [
  { value: 3, label: '3 dias', hint: 'Um ritmo leve.' },
  { value: 5, label: '5 dias', hint: 'Quase todo dia útil.' },
  { value: 7, label: '7 dias', hint: 'Toda a semana.' },
  { value: 0, label: 'Sem meta', hint: 'Só acompanhar os dias.' }
];

const card = 'rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:p-5';
const sectionTitle = 'font-display text-lg font-bold text-ink-100';

export interface ProgressViewProps {
  progress: Progress;
  now: number;
  onGoalChange: (goal: WeeklyGoal | null) => void;
  onExit: () => void;
  onOpenExercises: () => void;
  announcement?: string;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ progress, now, onGoalChange, onExit, onOpenExercises, announcement = '' }) => {
  const [visibleContents, setVisibleContents] = useState(CONTENT_PAGE_SIZE);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const level = levelFor(progress);
  const weekly = weeklyProgress(progress, now);
  const days = weekDays(progress, now);
  const contents = playedContents(progress);
  const shown = contents.slice(0, visibleContents);
  const unlockedCount = ACHIEVEMENTS.filter((item) => item.id in progress.achievements).length;
  const empty = !hasProgress(progress);

  const weekText = weekly.goal === null
    ? `${weekly.daysDone} ${plural(weekly.daysDone, 'dia', 'dias')} de ensaio nesta semana.`
    : weekly.completed
      ? `Meta cumprida: ${weekly.daysDone} ${plural(weekly.daysDone, 'dia', 'dias')} de ensaio nesta semana.`
      : `${weekly.daysDone} de ${weekly.goal} dias de ensaio nesta semana.`;

  return (
    <main className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-8">
        <button type="button" onClick={onExit} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-ink-200 hover:bg-ink-800">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar ao início
        </button>
        <h1 ref={heading} tabIndex={-1} className="mt-4 font-display text-3xl font-bold">Meu progresso</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">Estrelas, palhetas e dias de ensaio ficam guardados só neste navegador.</p>
        <p role="status" className="sr-only">{announcement}</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section aria-labelledby="progress-level" className={card}>
            <h2 id="progress-level" className={sectionTitle}>Nível</h2>
            <p className="mt-3 font-display text-2xl font-bold text-amp-300">{level.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-100">
              <Star size={16} className="shrink-0 fill-amp-300 text-amp-300" aria-hidden="true" />
              <span><span className="font-mono">{level.stars}</span> {plural(level.stars, 'estrela', 'estrelas')} no total</span>
            </p>
            <p className="mt-2 text-sm text-ink-300">
              {level.nextName !== null && level.starsToNext !== null
                ? `Próximo nível: ${level.nextName}, com mais ${level.starsToNext} ${plural(level.starsToNext, 'estrela', 'estrelas')}.`
                : 'Você chegou ao último nível.'}
            </p>
          </section>

          <section aria-labelledby="progress-week" className={card}>
            <h2 id="progress-week" className={sectionTitle}>Ensaio da semana</h2>
            <ol aria-label="Dias desta semana" className="mt-3 grid grid-cols-7 gap-1 sm:gap-2">
              {days.map((day) => (
                <li key={day.key} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-0.5 py-2 text-xs sm:px-1 ${day.done ? 'border-amp-400 bg-amp-500/10 text-amp-300' : 'border-ink-700 text-ink-200'}`}>
                  <span aria-hidden="true" className="font-semibold">{day.label}</span>
                  <span className="sr-only">{day.name}: {day.done ? 'ensaiou' : 'sem ensaio'}{day.isToday ? ', hoje' : ''}</span>
                  {day.done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} className="text-ink-500" aria-hidden="true" />}
                  <span aria-hidden="true" className="h-3 text-[10px] leading-3 text-ink-300">{day.isToday ? 'hoje' : ''}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-100">{weekText}</p>
            <div className="mt-4">
              <OptionGroup<number>
                legend="Meta de dias por semana"
                name="weekly-goal"
                options={GOAL_OPTIONS}
                value={weekly.goal ?? 0}
                onChange={(value) => onGoalChange(value === 0 ? null : (value as WeeklyGoal))}
                columns="grid-cols-2 sm:grid-cols-4"
              />
            </div>
            <p className="mt-3 text-xs text-ink-300">Um dia conta como ensaiado com pelo menos 1 minuto tocado.</p>
          </section>
        </div>

        {empty ? (
          <section aria-labelledby="progress-empty" className={`${card} mt-5 text-center`}>
            <h2 id="progress-empty" className={sectionTitle}>Sua coleção começa aqui</h2>
            <p className="mt-2 text-sm text-ink-200">Toque um exercício para começar a colecionar estrelas e palhetas.</p>
            <button type="button" onClick={onOpenExercises}
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amp-400 px-5 font-bold text-ink-950 transition hover:bg-amp-300">
              <Dumbbell size={18} aria-hidden="true" /> Abrir os exercícios
            </button>
          </section>
        ) : (
          <section aria-labelledby="progress-contents" className={`${card} mt-5`}>
            <h2 id="progress-contents" className={sectionTitle}>Conteúdo tocado</h2>
            {contents.length === 0 ? (
              <p className="mt-2 text-sm text-ink-300">Os exercícios e as peças que você tocar aparecem aqui, com as estrelas de cada um.</p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-ink-700">
                  {shown.map(({ key, songId, partId, content }) => (
                    <li key={key} className="py-3">
                      <p className="break-words text-sm font-semibold text-ink-100">{contentTitle(songId, partId)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-200">
                        <span className="flex items-center gap-1">
                          <span aria-hidden="true" className="flex">
                            {Array.from({ length: MAX_STARS }, (_, index) => (
                              <Star key={index} size={14} className={index < content.stars ? 'fill-amp-300 text-amp-300' : 'text-ink-500'} />
                            ))}
                          </span>
                          {starsText(content.stars)}
                        </span>
                        <span>Melhor precisão: <span className="font-mono">{Math.round(content.bestAccuracy)}%</span></span>
                        <span>Tocou <span className="font-mono">{content.plays}</span> {plural(content.plays, 'vez', 'vezes')}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                {contents.length > shown.length && (
                  <button type="button" onClick={() => setVisibleContents((count) => count + CONTENT_PAGE_SIZE)}
                    className="mt-2 min-h-11 cursor-pointer rounded-lg border border-ink-600 px-4 text-sm font-semibold text-ink-100 transition hover:border-ink-400 hover:bg-ink-800">
                    Ver mais ({contents.length - shown.length})
                  </button>
                )}
              </>
            )}
          </section>
        )}

        <section aria-labelledby="progress-picks" className={`${card} mt-5`}>
          <h2 id="progress-picks" className={sectionTitle}>Palhetas</h2>
          <p className="mt-1 text-sm text-ink-300">{unlockedCount} de {ACHIEVEMENTS.length} palhetas conquistadas.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((item) => {
              const at = progress.achievements[item.id];
              const got = at !== undefined;
              return (
                <li key={item.id} className={`rounded-xl border p-3 ${got ? 'border-amp-400/60 bg-amp-500/10' : 'border-ink-700 bg-ink-850'}`}>
                  <p className={`flex items-center gap-2 text-sm font-bold ${got ? 'text-amp-300' : 'text-ink-100'}`}>
                    {got ? <Check size={16} className="shrink-0" aria-hidden="true" /> : <Circle size={16} className="shrink-0 text-ink-500" aria-hidden="true" />}
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-200">{item.description}</p>
                  <p className="mt-2 text-xs font-semibold text-ink-300">{got ? `Conquistada em ${formatDate(at)}` : 'Ainda não conquistada'}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
};

export interface ProgressScreenProps {
  onExit: () => void;
  onOpenExercises: () => void;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ onExit, onOpenExercises }) => {
  const [progress, setProgress] = useState(() => loadProgress());
  const [now] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');

  const handleGoalChange = (goal: WeeklyGoal | null) => {
    setProgress(saveWeeklyGoal(goal));
    setAnnouncement(goal === null ? 'Sem meta de dias por semana.' : `Meta de ${goal} dias por semana.`);
  };

  return <ProgressView progress={progress} now={now} onGoalChange={handleGoalChange} onExit={onExit} onOpenExercises={onOpenExercises} announcement={announcement} />;
};
