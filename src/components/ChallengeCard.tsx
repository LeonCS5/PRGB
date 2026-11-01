import React from 'react';
import { Loader2, Swords } from 'lucide-react';
import type { Challenge } from '../services/challenge';

export interface ChallengeCardProps {
  challenge: Challenge;
  isLoading: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

// Received through a ?desafio= link; the data is forgeable by design, so it's shown as the friend's claim
export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, isLoading, onAccept, onDismiss }) => {
  const who = challenge.nickname ?? 'Alguém';
  const song = challenge.trackName ? `${challenge.title} · ${challenge.trackName}` : challenge.title;
  return (
    <section aria-labelledby="challenge-title" className="mb-10 rounded-2xl border border-amp-500/40 bg-amp-500/10 p-5 shadow-glow-amp sm:p-6">
      <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-amp-300"><Swords size={14} aria-hidden="true" /> DESAFIO RECEBIDO</p>
      <h2 id="challenge-title" className="mt-3 font-display text-xl font-bold leading-snug sm:text-2xl">
        {who} fez {challenge.score.toLocaleString('pt-BR')} pontos ({challenge.accuracy}%) em {song}. Topa?
      </h2>
      {challenge.artist && <p className="mt-1 text-sm text-ink-300">{challenge.artist}</p>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onAccept} disabled={isLoading} aria-busy={isLoading}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amp-400 px-5 font-bold text-ink-950 transition hover:bg-amp-300 disabled:cursor-wait disabled:opacity-70">
          {isLoading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {isLoading ? 'Carregando música…' : 'Aceitar desafio'}
        </button>
        <button type="button" onClick={onDismiss} disabled={isLoading}
          className="min-h-11 cursor-pointer rounded-xl border border-ink-600 px-5 text-sm font-semibold text-ink-100 transition hover:border-ink-400 disabled:opacity-50">
          Agora não
        </button>
      </div>
    </section>
  );
};
