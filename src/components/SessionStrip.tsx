import React, { useEffect, useRef, useState } from 'react';
import { ListChecks, Pause, Play, SkipForward, Star } from 'lucide-react';
import { isLastItem, itemTitle, nextItem, summarizeQueue, TRANSITION_MS, type PracticeQueue } from '../services/practiceSession';

// Shown over a result while a practice session runs: where the session is, what comes next and, a few seconds
// later, the next exercise starting by itself (the player can go now, hold the count or stop).

export interface SessionStripProps {
  queue: PracticeQueue;
  onNext: () => void;
  onEnd: () => void;
}

const TICK_MS = 250;

export const formatElapsed = (ms: number): string => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const secondsLeft = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

const ProgressBar: React.FC<{ done: number; total: number }> = ({ done, total }) => (
  <div role="progressbar" aria-label="Exercícios da sessão" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} de ${total}`}
    className="h-1.5 overflow-hidden rounded-full bg-ink-700">
    <div className="h-full rounded-full bg-signal-400" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
  </div>
);

export const SessionStrip: React.FC<SessionStripProps> = ({ queue, onNext, onEnd }) => {
  const upcoming = nextItem(queue);
  const [remaining, setRemaining] = useState(TRANSITION_MS);
  const [held, setHeld] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!upcoming || held) return;
    const timer = window.setInterval(() => setRemaining((left) => Math.max(0, left - TICK_MS)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [upcoming, held]);

  // The count runs out once: a re-render before the next exercise mounts must not start two
  const fired = useRef(false);
  const go = remaining === 0 && upcoming !== null && !held;
  useEffect(() => {
    if (!go || fired.current) return;
    fired.current = true;
    onNext();
  }, [go, onNext]);

  if (!upcoming || isLastItem(queue)) {
    const summary = summarizeQueue(queue, now);
    return (
      <section aria-labelledby="session-done" className="mb-5 rounded-xl border border-signal-500/40 bg-signal-500/5 px-4 py-3 text-left">
        <h3 id="session-done" className="flex items-center gap-2 font-display text-lg font-bold text-signal-300"><ListChecks size={18} aria-hidden="true" /> Sessão concluída</h3>
        <p className="mt-1 text-sm text-ink-100">
          {summary.played} de {summary.total} {summary.total === 1 ? 'exercício' : 'exercícios'} em {formatElapsed(summary.elapsedMs)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-100">
          <Star size={15} className="shrink-0 fill-amp-300 text-amp-300" aria-hidden="true" />
          {summary.stars} de {summary.maxStars} estrelas{summary.averageAccuracy !== null ? ` · precisão média ${summary.averageAccuracy}%` : ''}
        </p>
        <button type="button" onClick={onEnd} className="mt-3 min-h-11 w-full cursor-pointer rounded-xl bg-signal-400 px-4 text-sm font-bold text-ink-950 hover:bg-signal-300">Terminar sessão</button>
      </section>
    );
  }

  return (
    <section aria-labelledby="session-next" className="mb-5 rounded-xl border border-signal-500/40 bg-signal-500/5 px-4 py-3 text-left">
      <p className="text-xs font-semibold text-signal-300">Sessão · exercício {queue.index + 1} de {queue.items.length}</p>
      <div className="mt-2"><ProgressBar done={queue.index + 1} total={queue.items.length} /></div>
      <h3 id="session-next" className="mt-3 font-display text-base font-bold text-ink-100">A seguir: {itemTitle(upcoming)}</h3>
      <p className="mt-1 text-sm text-ink-300">
        {held ? 'Contagem em pausa.' : <>Começa em <span aria-hidden="true" className="font-mono text-ink-100">{secondsLeft(remaining)}</span><span className="sr-only">alguns segundos</span> s.</>}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onNext} className="col-span-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-signal-400 px-4 text-sm font-bold text-ink-950 hover:bg-signal-300">
          <SkipForward size={16} aria-hidden="true" /> Seguir agora
        </button>
        <button type="button" onClick={() => setHeld((value) => !value)} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-600 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-800">
          {held ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{held ? 'Retomar contagem' : 'Pausar contagem'}
        </button>
        <button type="button" onClick={onEnd} className="min-h-11 cursor-pointer rounded-xl border border-ink-600 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-800">Encerrar sessão</button>
      </div>
    </section>
  );
};
