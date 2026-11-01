import React from 'react';
import { Signal, Users } from 'lucide-react';
import type { PartnerProgress } from '../context/room';

const formatPoints = (value: number) => value.toLocaleString('pt-BR');

export interface OnlineHudProps {
  partnerProgress: PartnerProgress | null;
  teamScore: number;
  partnerName: string;
  durationMs: number;
  notice: string | null;
}

export const OnlineHud: React.FC<OnlineHudProps> = ({ partnerProgress, teamScore, partnerName, durationMs, notice }) => {
  const progressPct = partnerProgress && durationMs > 0
    ? Math.min(100, (partnerProgress.positionMs / durationMs) * 100)
    : 0;

  return (
    <section aria-label="Progresso da dupla online"
      className="my-2 flex items-center gap-3 rounded-xl border border-signal-500/20 bg-signal-500/5 px-3 py-2 font-mono text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Signal size={14} className="shrink-0 text-signal-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-signal-300">{partnerName}</p>
          {partnerProgress ? (
            <>
              <p className="mt-0.5 text-ink-100">
                <span className="font-bold">{formatPoints(partnerProgress.score)}</span>
                <span className="ml-2 text-ink-300">{partnerProgress.combo}× · {Math.round(partnerProgress.accuracy)}%</span>
              </p>
              <div role="progressbar" aria-label="Posição do parceiro na música" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}
                className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-signal-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </>
          ) : (
            <p className="mt-0.5 text-ink-300">Aguardando…</p>
          )}
          {/* Only events are announced: the numbers above change twice a second */}
          <p role="status" className="mt-0.5 text-near empty:hidden">{notice}</p>
        </div>
      </div>

      <div className="shrink-0 rounded-lg border border-amp-500/30 bg-amp-500/10 px-3 py-1 text-center text-amp-300">
        <p className="flex items-center justify-center gap-1 tracking-wider">
          <Users size={12} aria-hidden="true" /> EQUIPE
        </p>
        <p className="font-bold">{formatPoints(teamScore)}</p>
      </div>
    </section>
  );
};
