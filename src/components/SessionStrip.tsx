import React, { useState } from 'react';
import { ListChecks, Star } from 'lucide-react';
import { summarizeQueue, type PracticeQueue, type SessionResult } from '../services/practiceSession';
import { formatElapsed } from './sessionFormat';

// Shown over the result of the last exercise of a practice session: what the whole session came to. The exercises
// before it go straight into the next one, so this is the only place their results appear.

export interface SessionStripProps {
  queue: PracticeQueue;
  onEnd: () => void;
}

export const SessionStrip: React.FC<SessionStripProps> = ({ queue, onEnd }) => {
  const [now] = useState(() => Date.now());
  const summary = summarizeQueue(queue, now);
  const results = queue.results.filter((result): result is SessionResult => result !== undefined);
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
      {results.length > 1 && (
        <ol aria-label="Resultado de cada exercício" className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-ink-700 pt-2 text-xs text-ink-200">
          {results.map((result, index) => (
            <li key={index} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{result.title}</span>
              <span className="shrink-0 font-mono text-ink-300">{result.stars}★ · {result.accuracy}%</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={onEnd} className="mt-3 min-h-11 w-full cursor-pointer rounded-xl bg-signal-400 px-4 text-sm font-bold text-ink-950 hover:bg-signal-300">Terminar sessão</button>
    </section>
  );
};
