import React, { useMemo, useState } from 'react';
import { ArrowLeft, AudioWaveform, Compass, ListChecks, Drum, Flame, Grid3x3, Hand, Info, Pentagon, Play, Repeat, TrendingUp, type LucideIcon } from 'lucide-react';
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
import { KEYS, keyName } from '../services/musicTheory';
import { getPersonalBest } from '../services/records';
import { expandItem, formatMinutes, KEY_CYCLES, sessionDurationMs, type KeyCycle, type SessionItem } from '../services/practiceSession';

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
  onSession?: () => void; // opens the practice session builder
  onPlayAll?: (items: SessionItem[]) => void; // plays every variation of one exercise in a row
  initialPlayAll?: boolean; // starts with the library set to play all the variations (tests)
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
  hint?: string; // a plain sentence under the legend, for words the player may not know
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const ChipGroup: React.FC<ChipGroupProps> = ({ legend, hint, name, value, options, onChange }) => (
  <fieldset className="min-w-0">
    <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-300">{legend}</legend>
    {hint && <p className="-mt-1 mb-2 text-xs leading-5 text-ink-300">{hint}</p>}
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
  playAll: PlayAll | null; // set while the library plays every variation instead of one
}

// What a click on a card plays when the library is set to "all the variations": the keys and ways to play it
interface PlayAll {
  keys: KeyCycle;
  start: (items: SessionItem[]) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, keyIndex, pattern, showsKey, onPlay, playAll }) => {
  const { seconds, best } = useMemo(() => {
    const tab = buildExerciseTab(exercise, keyIndex, pattern);
    return {
      seconds: Math.round(tab.totalDurationMs / 1000),
      best: getPersonalBest(tab.songId, exercise.keyed ? keyIndex : 0, 1)?.score ?? null
    };
  }, [exercise, keyIndex, pattern]);

  // The chosen number of keys (a fourth apart) and every way to play each, one after the other
  const variations = useMemo(() => (playAll ? expandItem({ code: exercise.code, key: keyIndex }, { keys: playAll.keys, allPatterns: true }) : []), [exercise, keyIndex, playAll]);
  const sequence = playAll !== null && variations.length > 1;
  const sequenceMinutes = useMemo(() => (sequence ? formatMinutes(sessionDurationMs(variations)) : ''), [sequence, variations]);

  return (
    <button type="button" onClick={sequence && playAll ? () => playAll.start(variations) : onPlay}
      className={'group flex min-h-32 w-full cursor-pointer flex-col rounded-2xl border bg-ink-900 p-4 text-left transition hover:bg-ink-800 ' + (sequence ? 'border-signal-500/50 hover:border-signal-400' : 'border-ink-700 hover:border-amp-500/60')}>
      <span className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-bold leading-snug text-ink-100">{exercise.title}</span>
        <span className={'flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 transition ' + (sequence ? 'text-signal-300 group-hover:bg-signal-400 group-hover:text-ink-950' : 'text-amp-300 group-hover:bg-amp-400 group-hover:text-ink-950')}>
          {sequence ? <ListChecks size={15} aria-hidden="true" /> : <Play size={15} className="fill-current" aria-hidden="true" />}
        </span>
      </span>
      <span className="mt-1.5 flex-1 text-sm leading-5 text-ink-300">{exercise.description}</span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-300">
        <LevelMark level={exercise.level} />
        {sequence
          ? <span className="font-mono font-semibold text-signal-300">Sequência de {variations.length} exercícios · {sequenceMinutes}</span>
          : <span className="font-mono">{seconds} s · {exercise.bpm} bpm</span>}
        {showsKey && !exercise.keyed && <span>Tom fixo</span>}
        {!sequence && best !== null && <span className="font-mono text-amp-300">Recorde {formatPoints(best)}</span>}
      </span>
    </button>
  );
};

const KEY_CYCLE_LABELS: Record<KeyCycle, string> = { 1: 'Só este tom', 3: '3 tons', 6: '6 tons', 12: '12 tons' };
const PLAY_MODE_LABELS = { one: 'Tocar só este', all: 'Tocar todas as versões (tons e jeitos)' } as const;

interface ControlsProps {
  category: ExerciseCategory;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  pattern?: ExercisePattern;
  // Present when the library can play a sequence: the choice between one variation and all of them, and the keys
  sequence?: { all: boolean; onAllChange: (all: boolean) => void; keys: KeyCycle; onKeysChange: (keys: KeyCycle) => void };
}

const Controls: React.FC<ControlsProps> = ({ category, view, onViewChange, pattern, sequence }) => {
  const hasKeys = category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed));
  const canSequence = sequence !== undefined && (hasKeys || category.patterns.length > 1);
  if (!hasKeys && category.patterns.length === 0) return null;
  const all = canSequence && sequence.all;
  return (
    <div className="mt-6 grid gap-5 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
      {canSequence && (
        <ChipGroup legend="Ao tocar um exercício" name="exercise-play-mode" value={all ? 'all' : 'one'}
          options={[{ value: 'one', label: PLAY_MODE_LABELS.one }, { value: 'all', label: PLAY_MODE_LABELS.all }]}
          onChange={(value) => sequence.onAllChange(value === 'all')} />
      )}
      {hasKeys && (
        <ChipGroup legend={all ? 'Começar no tom' : 'Tom'} hint="Nota em que o exercício começa. Se não sabe, deixe em Lá." name="exercise-key" value={String(view.key)}
          options={KEYS.map((_, index) => ({ value: String(index), label: keyName(index) }))}
          onChange={(value) => onViewChange({ ...view, key: Number(value) })} />
      )}
      {all && hasKeys && (
        <ChipGroup legend="Quantos tons" hint="Sobe o exercício para outros tons, para treinar o braço todo." name="exercise-cycle" value={String(sequence.keys)}
          options={KEY_CYCLES.map((count) => ({ value: String(count), label: KEY_CYCLE_LABELS[count] }))}
          onChange={(value) => sequence.onKeysChange(Number(value) as KeyCycle)} />
      )}
      {!all && category.patterns.length > 0 && pattern && (
        <ChipGroup legend="Jeito de tocar" name="exercise-pattern" value={pattern}
          options={category.patterns.map((id) => ({ value: id, label: patternName(category, id) }))}
          onChange={(value) => onViewChange({ ...view, patterns: { ...view.patterns, [category.id]: value as ExercisePattern } })} />
      )}
      {all && category.patterns.length > 1 && <p className="text-xs leading-5 text-ink-300">Cada tom toca de todos os jeitos de tocar: {category.patterns.map((id) => patternName(category, id)).join(', ')}.</p>}
    </div>
  );
};

export const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ view, onViewChange, onPlay, onExit, onSession, onPlayAll, initialPlayAll = false }) => {
  const category = EXERCISE_CATEGORIES.find((item) => item.id === view.categoryId) ?? EXERCISE_CATEGORIES[0];
  const pattern = view.patterns[category.id] ?? category.patterns[0];
  const hasKeys = category.groups.some((group) => group.exercises.some((exercise) => exercise.keyed));
  const [playAllMode, setPlayAllMode] = useState(initialPlayAll);
  const [keys, setKeys] = useState<KeyCycle>(3);
  const sequence = onPlayAll ? { all: playAllMode, onAllChange: setPlayAllMode, keys, onKeysChange: setKeys } : undefined;
  const canSequence = sequence !== undefined && (hasKeys || category.patterns.length > 1);
  const playAll: PlayAll | null = onPlayAll && canSequence && playAllMode ? { keys, start: onPlayAll } : null;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-5 sm:px-8 lg:px-12">
          <button type="button" onClick={onExit} aria-label="PRGB: voltar ao início" className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg">
            <ArrowLeft size={18} aria-hidden="true" /><BrandMark size={28} className="[&>span]:hidden [&>span]:text-lg sm:[&>span]:inline" />
          </button>
          <h1 className="font-display text-xl font-bold tracking-tight">Exercícios</h1>
          {onSession && (
            <button type="button" onClick={onSession} aria-label="Montar sessão" title="Montar sessão" className="ml-auto flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-ink-600 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-800">
              <ListChecks size={16} className="text-signal-300" aria-hidden="true" /><span className="hidden min-[360px]:inline">Montar sessão</span>
            </button>
          )}
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
          <Controls category={category} view={view} onViewChange={onViewChange} pattern={pattern} sequence={sequence} />
          {category.groups.map((group) => (
            <section key={group.title} aria-label={group.title} className="mt-8">
              <h3 className="font-display text-lg font-bold">{group.title}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.exercises.map((exercise) => (
                  <ExerciseCard key={exercise.code} exercise={exercise} keyIndex={view.key} pattern={pattern} showsKey={hasKeys}
                    onPlay={() => onPlay(exercise, view.key, pattern)} playAll={playAll} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};
