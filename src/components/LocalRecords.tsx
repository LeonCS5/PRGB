import React, { useState } from 'react';
import { History, Trophy } from 'lucide-react';
import { getHistory, getPersonalBest, type RunResult } from '../services/records';
import { LocalDataControls } from './LocalDataControls';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface RecentRun {
  run: RunResult;
  isBest: boolean;
}

const readRecentRuns = (): RecentRun[] => getHistory(5).map((run) => ({
  run,
  isBest: getPersonalBest(run.songId, run.partId, run.speed)?.playedAt === run.playedAt
}));

// Landing section, shown only once there is a history in this browser
export const LocalRecords: React.FC = () => {
  const [runs, setRuns] = useState(readRecentRuns);
  const [wasCleared, setWasCleared] = useState(false);
  if (runs.length === 0 && !wasCleared) return null;

  return (
    <section aria-labelledby="records-title" className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 lg:px-12">
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-panel sm:p-7">
        <div className="flex items-center gap-3">
          <History size={20} className="text-amp-400" aria-hidden="true" />
          <h2 id="records-title" className="font-display text-2xl font-bold tracking-tight">Seus recordes</h2>
        </div>
        {runs.length > 0 && (
          <>
            <p className="mt-2 text-sm text-ink-300">Suas últimas jogadas neste navegador.</p>
            <ol className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
              {runs.map(({ run, isBest }) => (
                <li key={run.playedAt + run.songId + run.partId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-100">{run.title}</p>
                    <p className="truncate text-xs text-ink-300">{run.trackName}{run.speed !== 1 ? ` · ${run.speed.toLocaleString('pt-BR')}×` : ''}</p>
                  </div>
                  <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-amp-300">
                    {isBest && <Trophy size={14} aria-label="Recorde pessoal" />}
                    {run.score.toLocaleString('pt-BR')} <span className="text-xs font-normal text-ink-300">pts · {run.accuracy}%</span>
                  </p>
                  <time dateTime={run.playedAt} className="w-full font-mono text-xs text-ink-300 sm:w-auto">{dateFormat.format(new Date(run.playedAt))}</time>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="mt-5">
          <LocalDataControls onCleared={() => { setRuns([]); setWasCleared(true); }} />
        </div>
      </div>
    </section>
  );
};
