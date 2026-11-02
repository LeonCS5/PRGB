import React, { useMemo } from 'react';
import { ArrowLeft, AudioWaveform, Compass, Drum, Flame, Grid3x3, Hand, Info, Pentagon, Play, Repeat, TrendingUp, type LucideIcon } from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  EXERCISE_CATEGORIES,
  LEVEL_NAMES,
  buildExerciseTab,
  exerciseCount,
  patternName,
  type Exercise,
  type ExerciseCategory,
  type ExerciseCategoryId,
  type ExerciseLevel,
  type ExercisePattern
} from '../services/exercises';
import { KEYS } from '../services/musicTheory';
import { getPersonalBest } from '../services/records';

export interface LibraryView {
  categoryId: ExerciseCategoryId;
  key: number;
  patterns: Partial<Record<ExerciseCategoryId, ExercisePattern>>;
}

export interface ExerciseLibraryProps {
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  onPlay: (exercise: Exercise, key: number, pattern?: ExercisePattern) => void;
  onExit: () => void;
}

const CATEGORY_ICONS: Record<ExerciseCategoryId, LucideIcon> = {
  aquecimento: Flame,
  tecnicas: Hand,
  pentatonicas: Pentagon,
  escalas: TrendingUp,
  arpejos: AudioWaveform,
  acordes: Grid3x3,
  progressoes: Repeat,
  ritmo: Drum,
  braco: Compass
};

export const CategoryIcon: React.FC<{ id: ExerciseCategoryId; size: number; className?: string }> = ({ id, size, className }) => {
  const Icon = CATEGORY_ICONS[id];
  return <Icon size={size} className={className} aria-hidden="true" />;
};

const formatPoints = (value: number) => value.toLocaleString('pt-BR');

interface ChipGroupProps {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const ChipGroup: React.FC<ChipGroupProps> = ({ legend, name, value, options, onChange }) => (
  <fieldset className="min-w-0">
    <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-300">{legend}</legend>
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} className="peer sr-only" />
          <span className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 px-3 text-sm font-semibold text-ink-200 transition hover:border-ink-500 peer-checked:border-amp-400 peer-checked:bg-amp-400 peer-checked:text-ink-950 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-400">{option.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

const LevelMark: React.FC<{ level: ExerciseLevel }> = ({ level }) => (
  <span className="flex items-center gap-1.5">
    <span aria-hidden="true" className="flex gap-0.5">
      {[1, 2, 3].map((step) => <span key={step} className={`size-1.5 rounded-full ${step <= level ? 'bg-amp-400' : 'bg-ink-600'}`} />)}
    </span>
    {LEVEL_NAMES[level]}
  </span>
);

interface ExerciseCardProps {
  exercise: Exercise;
  keyIndex: number;
  pattern?: ExercisePattern;
  showsKey: boolean; // the category has keys, so a card without them must say so
  onPlay: () => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, keyIndex, pattern, showsKey, onPlay }) => {
  const { seconds, best } = useMemo(() => {
    const tab = buildExerciseTab(exercise, keyIndex, pattern);
    return {
      seconds: Math.round(tab.totalDurationMs / 1000),
      best: getPersonalBest(tab.songId, exercise.keyed ? keyIndex : 0, 1)?.score ?? null
    };
  }, [exercise, keyIndex, pattern]);

  return (
    <button type="button" onClick={onPlay}
      className="group flex min-h-32 w-full cursor-pointer flex-col rounded-2xl border border-ink-700 bg-ink-900 p-4 text-left transition hover:border-amp-500/60 hover:bg-ink-800">
      <span className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-bold leading-snug text-ink-100">{exercise.title}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-amp-300 transition group-hover:bg-amp-400 group-hover:text-ink-950"><Play size={15} className="fill-current" aria-hidden="true" /></span>
      </span>
      <span className="mt-1.5 flex-1 text-sm leading-5 text-ink-300">{exercise.description}</span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-300">
        <LevelMark level={exercise.level} />
        <span className="font-mono">{seconds} s · {exercise.bpm} bpm</span>
        {showsKey && !exercise.keyed && <span>Tom fixo</span>}
        {best !== null && <span className="font-mono text-amp-300">Recorde {formatPoints(best)}</span>}
      </span>
    </button>
  );
};

const Controls: React.FC<{ category: ExerciseCategory; view: LibraryView; onViewChange: (view: LibraryView) => void; pattern?: ExercisePattern }> = ({ category, view, onViewChange, pattern }) => {
  const hasKeys = category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed));
  if (!hasKeys && category.patterns.length === 0) return null;
  return (
    <div className="mt-6 grid gap-5 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
      {hasKeys && (
        <ChipGroup legend="Tom" name="exercise-key" value={String(view.key)}
          options={KEYS.map((name, index) => ({ value: String(index), label: name }))}
          onChange={(value) => onViewChange({ ...view, key: Number(value) })} />
      )}
      {category.patterns.length > 0 && pattern && (
        <ChipGroup legend="Como tocar" name="exercise-pattern" value={pattern}
          options={category.patterns.map((id) => ({ value: id, label: patternName(category, id) }))}
          onChange={(value) => onViewChange({ ...view, patterns: { ...view.patterns, [category.id]: value as ExercisePattern } })} />
      )}
    </div>
  );
};

export const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ view, onViewChange, onPlay, onExit }) => {
  const category = EXERCISE_CATEGORIES.find((item) => item.id === view.categoryId) ?? EXERCISE_CATEGORIES[0];
  const pattern = view.patterns[category.id] ?? category.patterns[0];
  const hasKeys = category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed));

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-5 sm:px-8 lg:px-12">
          <button type="button" onClick={onExit} aria-label="PRGB: voltar ao início" className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg">
            <ArrowLeft size={18} aria-hidden="true" /><BrandMark size={28} className="[&>span]:hidden [&>span]:text-lg sm:[&>span]:inline" />
          </button>
          <h1 className="font-display text-xl font-bold tracking-tight">Exercícios</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:px-12 lg:py-8">
        <nav aria-label="Categorias de exercício" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-1 lg:gap-1">
            {EXERCISE_CATEGORIES.map((item) => {
              const isCurrent = item.id === category.id;
              return (
                <li key={item.id}>
                  <button type="button" aria-current={isCurrent ? 'true' : undefined} onClick={() => onViewChange({ ...view, categoryId: item.id })}
                    className={`flex min-h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-semibold transition lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:border-transparent lg:px-3 lg:text-sm ${isCurrent ? 'border-amp-400 bg-amp-500/10 text-amp-300 lg:border-amp-500/40' : 'border-ink-700 bg-ink-900 text-ink-200 hover:border-ink-500 lg:bg-transparent lg:hover:bg-ink-800'}`}>
                    <CategoryIcon id={item.id} size={18} className="shrink-0" />
                    <span className="min-w-0 lg:flex-1 lg:text-left">{item.title}</span>
                    <span className="hidden font-mono text-xs text-ink-300 lg:inline">{exerciseCount(item)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0">
          <h2 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight">
            <CategoryIcon id={category.id} size={26} className="shrink-0 text-amp-400" /> {category.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300 sm:text-base">{category.summary}</p>
          {category.note && (
            <p className="mt-3 flex max-w-2xl gap-2 text-sm leading-6 text-signal-300"><Info size={16} className="mt-1 shrink-0" aria-hidden="true" /> {category.note}</p>
          )}
          <Controls category={category} view={view} onViewChange={onViewChange} pattern={pattern} />
          {category.groups.map((group) => (
            <section key={group.title} aria-label={group.title} className="mt-8">
              <h3 className="font-display text-lg font-bold">{group.title}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.exercises.map((exercise) => (
                  <ExerciseCard key={exercise.code} exercise={exercise} keyIndex={view.key} pattern={pattern} showsKey={hasKeys}
                    onPlay={() => onPlay(exercise, view.key, pattern)} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};
