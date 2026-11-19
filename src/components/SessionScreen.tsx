import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ListChecks, Play, Plus, Trash2 } from 'lucide-react';
import { categoryOf, EXERCISE_CATEGORIES, exerciseByCode, LEVEL_NAMES, patternName, type ExerciseCategory } from '../services/exercises';
import { KEYS } from '../services/musicTheory';
import { loadProgress, type Progress } from '../services/progress';
import {
  customSession, formatMinutes, itemTitle, KEY_CYCLES, MAX_SESSION_ITEMS, SESSION_MINUTES, sessionDurationMs, stageSession, timedSession,
  type ExpandOptions, type SessionItem, type SessionMinutes
} from '../services/practiceSession';
import { RESOLVED_TRAIL, summarizeTrail } from '../services/trail';
import { OptionGroup } from './appearance/controls';
import type { Option } from './appearance/options';

// Builds the list of exercises for a practice session: from a trail stage, by time or by hand. Nothing here is saved:
// the list lives while the screen is open.

export type SessionMode = 'etapa' | 'tempo' | 'minha';

const MODES: readonly Option<SessionMode>[] = [
  { value: 'etapa', label: 'Etapa da trilha', hint: 'Todos os exercícios de uma etapa, na ordem.' },
  { value: 'tempo', label: 'Por tempo', hint: 'O PRGB monta a partir de onde você está na trilha.' },
  { value: 'minha', label: 'Montar a minha', hint: 'Você escolhe os exercícios e a ordem.' }
];

const KEY_OPTIONS: readonly Option<number>[] = KEY_CYCLES.map((count) => ({
  value: count,
  label: count === 1 ? '1 tom' : `${count} tons`,
  hint: count === 1 ? 'Só o tom do exercício.' : count === 12 ? 'Passa pelos 12 tons.' : 'Sobe o exercício para outros tons, para treinar o braço todo.'
}));

const MINUTE_OPTIONS: readonly Option<SessionMinutes>[] = SESSION_MINUTES.map((minutes) => ({
  value: minutes,
  label: `${minutes} minutos`,
  hint: minutes === 10 ? 'Uma passada rápida.' : minutes === 15 ? 'O tamanho de um ensaio curto.' : 'Uma prática completa.'
}));

const PREVIEW_LIMIT = 40;

const field = 'min-h-11 w-full min-w-0 rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm text-ink-100';
const card = 'rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:p-5';
const iconButton = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-ink-600 text-ink-100 hover:bg-ink-800 disabled:cursor-default disabled:opacity-40';

const itemLabel = (item: SessionItem): string => {
  const exercise = exerciseByCode(item.code);
  if (!exercise) return itemTitle(item);
  const category = categoryOf(exercise);
  return item.pattern && category.patterns.length > 1 ? `${itemTitle(item)} · ${patternName(category, item.pattern)}` : itemTitle(item);
};

const patternsOf = (category: ExerciseCategory) => category.patterns.length > 1 ? category.patterns : [];

export interface SessionViewProps {
  progress: Progress;
  now: number;
  onStart: (items: SessionItem[]) => void;
  onExit: () => void;
  initialMode?: SessionMode;
  initialStageId?: string;
}

export const SessionView: React.FC<SessionViewProps> = ({ progress, now, onStart, onExit, initialMode = 'tempo', initialStageId }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const ids = useId();

  const [mode, setMode] = useState<SessionMode>(initialMode);
  const [keys, setKeys] = useState<number>(1);
  const [allPatterns, setAllPatterns] = useState(false);
  const [minutes, setMinutes] = useState<SessionMinutes>(15);
  const [stageId, setStageId] = useState(() => initialStageId ?? summarizeTrail(progress).nextStageId ?? RESOLVED_TRAIL[0].stage.id);
  const [entries, setEntries] = useState<SessionItem[]>([]);
  const [categoryId, setCategoryId] = useState(EXERCISE_CATEGORIES[0].id);
  const [key, setKey] = useState(9); // Lá, the same start as the exercise library
  const [pattern, setPattern] = useState<string>('');
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef<HTMLElement>(null);

  const category = EXERCISE_CATEGORIES.find((entry) => entry.id === categoryId) ?? EXERCISE_CATEGORIES[0];
  const choosable = patternsOf(category);
  const options = useMemo<ExpandOptions>(() => ({ keys, allPatterns }), [keys, allPatterns]);

  const items = useMemo(() => {
    if (mode === 'etapa') return stageSession(stageId, options);
    if (mode === 'tempo') return timedSession(minutes, progress, options, now);
    return customSession(entries, options);
  }, [mode, stageId, minutes, progress, options, now, entries]);
  const totalMs = useMemo(() => sessionDurationMs(items), [items]);

  const add = (code: number) => {
    const exercise = exerciseByCode(code);
    if (!exercise) return;
    const chosen = choosable.find((entry) => entry === pattern) ?? undefined;
    setEntries((list) => [...list, { code, key, pattern: chosen }]);
    setAnnouncement(`${exercise.title} adicionado: ${entries.length + 1} na lista.`);
  };
  const move = (index: number, by: -1 | 1) => setEntries((list) => {
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    return next;
  });
  const remove = (index: number) => {
    setAnnouncement(`${itemTitle(entries[index])} removido.`);
    setEntries((list) => list.filter((_, position) => position !== index));
  };

  const hasLongOptions = keys > 1 || allPatterns;

  return (
    <main className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-8">
        <button type="button" onClick={onExit} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-ink-200 hover:bg-ink-800">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar ao início
        </button>
        <h1 ref={heading} tabIndex={-1} className="mt-4 flex items-center gap-3 font-display text-3xl font-bold">
          <ListChecks size={28} className="shrink-0 text-signal-300" aria-hidden="true" /> Sessão de prática
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
          Vários exercícios um depois do outro, sem voltar ao menu. Cada um começa assim que o anterior termina; o resultado de todos aparece no fim. Para parar antes, use Encerrar.
        </p>
        <p role="status" className="sr-only">{announcement}</p>

        <div className="mt-5 grid gap-5">
          <section aria-labelledby={`${ids}-how`} className={card}>
            <h2 id={`${ids}-how`} className="sr-only">Como montar</h2>
            <OptionGroup legend="Como montar a sessão" name={`${ids}-mode`} options={MODES} value={mode} onChange={setMode} columns="sm:grid-cols-3" />

            {mode === 'etapa' && (
              <div className="mt-4">
                <label htmlFor={`${ids}-stage`} className="text-sm font-semibold text-ink-100">Etapa</label>
                <select id={`${ids}-stage`} value={stageId} onChange={(event) => setStageId(event.target.value)} className={`${field} mt-2`}>
                  {RESOLVED_TRAIL.map(({ stage, steps }, index) => <option key={stage.id} value={stage.id}>Etapa {index + 1}: {stage.title} ({steps.length})</option>)}
                </select>
              </div>
            )}

            {mode === 'tempo' && (
              <div className="mt-4">
                <OptionGroup legend="Duração aproximada" name={`${ids}-minutes`} options={MINUTE_OPTIONS} value={minutes} onChange={setMinutes} columns="sm:grid-cols-3" />
                <p className="mt-2 text-xs leading-5 text-ink-300">Começa pelo aquecimento e passa por técnica, notas, acordes e ritmo, com exercícios perto do ponto em que você está na trilha.</p>
              </div>
            )}

            {mode === 'minha' && (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`${ids}-category`} className="text-sm font-semibold text-ink-100">Categoria</label>
                    <select id={`${ids}-category`} value={categoryId} onChange={(event) => { setCategoryId(event.target.value as ExerciseCategory['id']); setPattern(''); }} className={`${field} mt-2`}>
                      {EXERCISE_CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${ids}-key`} className="text-sm font-semibold text-ink-100">Tom</label>
                    <select id={`${ids}-key`} value={key} onChange={(event) => setKey(Number(event.target.value))} className={`${field} mt-2`}>
                      {KEYS.map((name, index) => <option key={name} value={index}>{name}</option>)}
                    </select>
                  </div>
                  {choosable.length > 0 && (
                    <div>
                      <label htmlFor={`${ids}-pattern`} className="text-sm font-semibold text-ink-100">Jeito de tocar</label>
                      <select id={`${ids}-pattern`} value={pattern} onChange={(event) => setPattern(event.target.value)} className={`${field} mt-2`}>
                        <option value="">{patternName(category, choosable[0])}</option>
                        {choosable.slice(1).map((entry) => <option key={entry} value={entry}>{patternName(category, entry)}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-xs leading-5 text-ink-300">Tom é a nota em que o exercício começa; se não sabe, deixe em Lá. Vale para os exercícios que mudam de tom; os de lugar fixo no braço ignoram. {category.summary}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-100">
                  <span><span className="font-mono">{entries.length}</span> na lista</span>
                  {entries.length > 0 && <button type="button" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-semibold text-signal-300 underline hover:text-signal-200">Ver a lista</button>}
                </p>
                <ul aria-label={`Exercícios de ${category.title}`} className="grid gap-2">
                  {category.groups.flatMap((group) => group.exercises).map((exercise) => (
                    <li key={exercise.code} className="flex items-center gap-3 rounded-xl border border-ink-700 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-100">{exercise.title}</span>
                        <span className="block text-xs text-ink-300">{LEVEL_NAMES[exercise.level]}</span>
                      </span>
                      <button type="button" onClick={() => add(exercise.code)} aria-label={`Adicionar ${exercise.title}`} className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-800">
                        <Plus size={15} aria-hidden="true" /> Adicionar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby={`${ids}-long`} className={card}>
            <h2 id={`${ids}-long`} className="font-display text-lg font-bold text-ink-100">Deixar mais longa</h2>
            <p className="mt-1 text-sm text-ink-300">Cada exercício rende mais sem virar uma repetição da mesma coisa.</p>
            <div className="mt-4 grid gap-4">
              <OptionGroup legend="Tons por exercício" name={`${ids}-keys`} options={KEY_OPTIONS} value={keys} onChange={setKeys} columns="grid-cols-2 sm:grid-cols-4" />
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-ink-600 p-3">
                <input type="checkbox" checked={allPatterns} onChange={(event) => setAllPatterns(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-amp-400" />
                <span>
                  <span className="block text-sm font-semibold text-ink-100">Todos os jeitos de tocar</span>
                  <span className="block text-xs leading-5 text-ink-300">Cada exercício é tocado de todos os jeitos de tocar que tem. Nas escalas: sobe e desce, grupos de 3, grupos de 4, terças e 3 por corda. Nos acordes: batida e dedilhado.</span>
                </span>
              </label>
            </div>
          </section>

          {mode === 'minha' && (
            <section ref={listRef} aria-labelledby={`${ids}-mine`} className={card}>
              <h2 id={`${ids}-mine`} className="font-display text-lg font-bold text-ink-100">Sua lista</h2>
              {entries.length === 0 ? (
                <p className="mt-2 text-sm text-ink-300">Nada por aqui ainda. Escolha exercícios acima e toque em Adicionar.</p>
              ) : (
                <>
                  <ol aria-label="Exercícios escolhidos" className="mt-3 grid gap-2">
                    {entries.map((entry, index) => (
                      <li key={`${index}-${entry.code}-${entry.key}-${entry.pattern ?? ''}`} className="flex items-center gap-2 rounded-xl border border-ink-700 px-3 py-2">
                        <span aria-hidden="true" className="w-5 shrink-0 text-right font-mono text-xs text-ink-300">{index + 1}</span>
                        <span className="min-w-0 flex-1 text-sm font-semibold text-ink-100">{itemLabel(entry)}</span>
                        <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${itemTitle(entry)}`} className={iconButton}><ArrowUp size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => move(index, 1)} disabled={index === entries.length - 1} aria-label={`Descer ${itemTitle(entry)}`} className={iconButton}><ArrowDown size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => remove(index)} aria-label={`Remover ${itemTitle(entry)}`} className={iconButton}><Trash2 size={16} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={() => { setEntries([]); setAnnouncement('Lista limpa.'); }} className="mt-3 min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-ink-200 underline hover:text-ink-100">Limpar a lista</button>
                </>
              )}
            </section>
          )}

          <section aria-labelledby={`${ids}-preview`} className={card}>
            <h2 id={`${ids}-preview`} className="font-display text-lg font-bold text-ink-100">Sua sessão</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-ink-300">{mode === 'minha' ? 'Adicione ao menos um exercício para começar.' : 'Não há exercícios para esta escolha.'}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-100">
                  <span className="font-mono">{items.length}</span> {items.length === 1 ? 'exercício' : 'exercícios'} · cerca de <span className="font-mono">{formatMinutes(totalMs)}</span>
                  {items.length >= MAX_SESSION_ITEMS ? ` (o máximo é ${MAX_SESSION_ITEMS})` : ''}
                </p>
                {hasLongOptions && <p className="mt-1 text-xs text-ink-300">Já com os tons e jeitos escolhidos.</p>}
                <ol aria-label="Ordem da sessão" className="mt-3 grid gap-1 text-sm text-ink-200">
                  {items.slice(0, PREVIEW_LIMIT).map((item, index) => (
                    <li key={`${index}-${item.code}-${item.key}-${item.pattern ?? ''}`} className="flex gap-2">
                      <span aria-hidden="true" className="w-6 shrink-0 text-right font-mono text-xs text-ink-300">{index + 1}</span>
                      <span className="min-w-0">{itemLabel(item)}</span>
                    </li>
                  ))}
                </ol>
                {items.length > PREVIEW_LIMIT && <p className="mt-2 text-xs text-ink-300">E mais {items.length - PREVIEW_LIMIT} no mesmo ritmo.</p>}
              </>
            )}
            <button type="button" disabled={items.length === 0} onClick={() => onStart(items)}
              className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amp-400 px-4 text-base font-bold text-ink-950 shadow-glow-amp hover:bg-amp-300 disabled:cursor-default disabled:opacity-50 disabled:shadow-none sm:w-auto">
              <Play size={18} className="fill-current" aria-hidden="true" /> Começar a sessão
            </button>
          </section>
        </div>
      </div>
    </main>
  );
};

export interface SessionScreenProps {
  onStart: (items: SessionItem[]) => void;
  onExit: () => void;
  initialMode?: SessionMode;
  initialStageId?: string;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ onStart, onExit, initialMode, initialStageId }) => {
  const [progress] = useState(() => loadProgress());
  const [now] = useState(() => Date.now());
  return <SessionView progress={progress} now={now} onStart={onStart} onExit={onExit} initialMode={initialMode} initialStageId={initialStageId} />;
};
