import React, { useId } from 'react';
import { Trophy, Users } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { primaryButton, secondaryButton } from './rankingStyles';
import type { MatchOutcome, PartnerProgress } from '../context/room';

const formatPoints = (value: number) => value.toLocaleString('pt-BR');

const OUTCOME_LABELS: Record<'win' | 'lose' | 'tie', string> = { win: 'Vitória!', lose: 'Derrota', tie: 'Empate!' };
const OUTCOME_COLORS: Record<'win' | 'lose' | 'tie', string> = { win: 'text-hit', lose: 'text-miss', tie: 'text-near' };

export interface OnlineResultPanelProps {
  myScore: number;
  myAccuracy: number;
  partnerName: string;
  partnerProgress: PartnerProgress | null;
  teamScore: number;
  outcome: MatchOutcome | null;
  isRoomActive: boolean;
  onBackToRoom: () => void;
  onExit: () => void;
}

export const OnlineResultPanel: React.FC<OnlineResultPanelProps> = ({
  myScore,
  myAccuracy,
  partnerName,
  partnerProgress,
  teamScore,
  outcome,
  isRoomActive,
  onBackToRoom,
  onExit,
}) => {
  const titleId = useId();

  return (
    <ModalFrame titleId={titleId} onClose={isRoomActive ? onBackToRoom : onExit} className="max-w-md overflow-y-auto text-center">
      <h2 id={titleId} className="mb-5 font-display text-2xl font-bold">Resultado da dupla</h2>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
          <p className="mb-1 text-xs text-ink-300">Você</p>
          <p className="font-mono text-2xl font-bold text-ink-100">{formatPoints(myScore)}</p>
          <p className="mt-1 text-xs text-ink-300">{Math.round(myAccuracy)}% de precisão</p>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
          <p className="mb-1 truncate text-xs text-ink-300">{partnerName}</p>
          {partnerProgress ? (
            <>
              <p className="font-mono text-2xl font-bold text-ink-100">{formatPoints(partnerProgress.score)}</p>
              <p className="mt-1 text-xs text-ink-300">{Math.round(partnerProgress.accuracy)}% de precisão</p>
            </>
          ) : (
            <p className="font-mono text-2xl font-bold text-ink-300">–</p>
          )}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-amp-500/30 bg-amp-500/10 p-4">
        <p className="flex items-center justify-center gap-2 text-xs font-semibold text-amp-300">
          <Users size={14} aria-hidden="true" /> Placar da equipe
        </p>
        <p className="mt-1 font-mono text-3xl font-bold text-amp-300">{formatPoints(teamScore)}</p>
      </div>

      <div role="status" className="mb-5">
        {outcome === null ? (
          <p className="text-sm text-ink-300">Aguardando {partnerName} terminar…</p>
        ) : outcome.kind === 'same_part' ? (
          <p className={`flex items-center justify-center gap-2 font-display text-2xl font-bold ${OUTCOME_COLORS[outcome.result]}`}>
            {outcome.result === 'win' && <Trophy size={22} aria-hidden="true" />}
            {OUTCOME_LABELS[outcome.result]}
          </p>
        ) : (
          <p className="text-sm text-ink-300">Aqui o que vale é o placar da equipe.</p>
        )}
      </div>

      <div className="space-y-2">
        {isRoomActive && <button type="button" onClick={onBackToRoom} className={primaryButton + ' w-full'}>Voltar para a sala</button>}
        <button type="button" onClick={onExit} className={secondaryButton + ' w-full'}>Sair</button>
      </div>
    </ModalFrame>
  );
};
