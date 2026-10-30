import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Trophy, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { closeButton, secondaryButton } from './rankingStyles';
import { useRanking, type LeaderboardTarget } from '../context/ranking';
import { getRankingErrorMessage } from '../context/uiErrors';
import type { LeaderboardEntry, LeaderboardPeriod } from '../services/backend/rankingApi';

const TITLE_ID = 'leaderboard-title';
const PANEL_ID = 'leaderboard-panel';
const LEADERBOARD_SIZE = 50;
const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'all', label: 'Geral' },
  { id: 'week', label: 'Semana' }
];

const MY_POSITION_LABEL = 'px-2 pt-3 pb-1 text-left text-[10px] font-semibold tracking-wider text-amp-300';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

interface LoadedBoard {
  key: string;
  rows: LeaderboardEntry[];
  mine: LeaderboardEntry | null; // the player's row when it is outside `rows`
  error: string | null;
}

const BoardRow: React.FC<{ entry: LeaderboardEntry }> = ({ entry }) => (
  <tr aria-current={entry.isMe ? 'true' : undefined} className={entry.isMe ? 'bg-amp-500/10' : ''}>
    <td className={'px-2 py-2.5 text-right font-mono font-bold ' + (entry.isMe ? 'text-amp-300' : 'text-ink-200')}>{entry.rank}º</td>
    <td className="px-2 py-2.5">
      <p className="flex items-center gap-2 font-semibold text-ink-100">
        <span className="min-w-0 truncate">{entry.nickname}</span>
        {entry.isMe && <span className="shrink-0 rounded bg-amp-400 px-1.5 text-[10px] font-bold text-ink-950">VOCÊ</span>}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-300 sm:hidden">{entry.accuracy}% · combo {entry.maxCombo} · {formatDate(entry.achievedAt)}</p>
    </td>
    <td className="px-2 py-2.5 text-right font-mono font-bold text-amp-300">{entry.score.toLocaleString('pt-BR')}</td>
    <td className="hidden px-2 py-2.5 text-right font-mono text-hit sm:table-cell">{entry.accuracy}%</td>
    <td className="hidden px-2 py-2.5 text-right font-mono text-signal-300 sm:table-cell">{entry.maxCombo}</td>
    <td className="hidden px-2 py-2.5 text-right font-mono text-xs text-ink-300 sm:table-cell">{formatDate(entry.achievedAt)}</td>
  </tr>
);

export interface LeaderboardModalProps {
  target: LeaderboardTarget;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ target }) => {
  const { api, closeLeaderboard } = useRanking();
  const tabRefs = useRef<Partial<Record<LeaderboardPeriod, HTMLButtonElement | null>>>({});
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [attempt, setAttempt] = useState(0);
  const [board, setBoard] = useState<LoadedBoard | null>(null);
  const { songId, partId } = target;
  const boardKey = `${songId}:${partId}:${period}:${attempt}`;
  const current = board?.key === boardKey ? board : null; // null while this board loads

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await api.getLeaderboard({ songId, partId, period, limit: LEADERBOARD_SIZE });
        // Only the extra row can fail here without hiding the ranking itself
        const mine = rows.some((row) => row.isMe) ? null : await api.getMyPosition({ songId, partId, period }).catch(() => null);
        if (!cancelled) setBoard({ key: boardKey, rows, mine, error: null });
      } catch (err) {
        if (!cancelled) setBoard({ key: boardKey, rows: [], mine: null, error: getRankingErrorMessage(err) });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [api, songId, partId, period, boardKey]);

  const handleTabKey = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = period === 'all' ? 'week' : 'all';
    setPeriod(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <ModalFrame titleId={TITLE_ID} onClose={closeLeaderboard} className="flex max-w-2xl flex-col">
      <button type="button" onClick={closeLeaderboard} aria-label="Fechar" className={closeButton}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="flex items-center gap-3 pr-10">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300"><Trophy size={22} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id={TITLE_ID} className="font-display text-xl font-bold">Ranking</h2>
          <p className="truncate text-xs text-ink-300">{target.title} · {target.trackName}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Período do ranking" className="mt-4 inline-flex self-start rounded-xl border border-ink-700 bg-ink-850 p-1">
        {PERIODS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" id={`leaderboard-tab-${id}`} aria-selected={period === id} aria-controls={PANEL_ID}
            tabIndex={period === id ? 0 : -1} ref={(element) => { tabRefs.current[id] = element; }}
            onClick={() => setPeriod(id)} onKeyDown={handleTabKey}
            className={'min-h-10 cursor-pointer rounded-lg px-5 text-xs font-bold transition ' + (period === id ? 'bg-amp-400 text-ink-950' : 'text-ink-300 hover:text-ink-100')}>
            {label}
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`leaderboard-tab-${period}`} className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!current ? (
          <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando o ranking…</p>
        ) : current.error ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-ink-100">{current.error}</p>
            <button type="button" onClick={() => setAttempt(attempt + 1)} className={secondaryButton + ' mx-auto mt-3'}>Tentar novamente</button>
          </div>
        ) : current.rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-300">Ninguém pontuou nesta faixa ainda. Seja o primeiro!</p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{period === 'all' ? 'Ranking geral' : 'Ranking da semana'} de {target.title}, {target.trackName}</caption>
            <thead className="sticky top-0 bg-ink-900 text-left text-[10px] tracking-wider text-ink-300">
              <tr>
                <th scope="col" className="w-12 px-2 py-2 text-right font-semibold">POS.</th>
                <th scope="col" className="px-2 py-2 font-semibold">APELIDO</th>
                <th scope="col" className="w-24 px-2 py-2 text-right font-semibold">PONTOS</th>
                <th scope="col" className="hidden w-20 px-2 py-2 text-right font-semibold sm:table-cell">PRECISÃO</th>
                <th scope="col" className="hidden w-16 px-2 py-2 text-right font-semibold sm:table-cell">COMBO</th>
                <th scope="col" className="hidden w-20 px-2 py-2 text-right font-semibold sm:table-cell">DATA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {current.rows.map((entry) => <BoardRow key={entry.nickname} entry={entry} />)}
            </tbody>
            {current.mine && (
              <tbody className="border-t-2 border-amp-500/40">
                <tr>
                  {/* A colSpan past the visible columns would create empty ones and squeeze the fixed layout */}
                  <th colSpan={3} scope="rowgroup" className={MY_POSITION_LABEL + ' sm:hidden'}>SUA POSIÇÃO</th>
                  <th colSpan={6} scope="rowgroup" className={MY_POSITION_LABEL + ' hidden sm:table-cell'}>SUA POSIÇÃO</th>
                </tr>
                <BoardRow entry={current.mine} />
              </tbody>
            )}
          </table>
        )}
      </div>
    </ModalFrame>
  );
};
