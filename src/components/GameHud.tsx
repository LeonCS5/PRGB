import React from 'react';
import { accuracyPercent, comboMultiplier, type ScoreState } from '../services/scoring';
import type { PlayerSlot } from '../services/audioEngine';
import { useLatestPitch } from '../context/AudioSessionContext';

const formatPoints = (value: number) => value.toLocaleString('pt-BR');

export interface SoloHudProps {
  score: ScoreState;
  goal?: number | null; // score of the accepted challenge
}

export const SoloHud: React.FC<SoloHudProps> = ({ score, goal }) => (
  <div className="mt-3 grid grid-cols-4 gap-3 border-t border-ink-700 pt-3 font-mono [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:pt-1">
    {[
      { label: 'PONTUAÇÃO', value: formatPoints(score.score), color: 'text-amp-300' },
      { label: 'COMBO', value: score.combo + ' ×' + comboMultiplier(score.combo), color: 'text-near' },
      { label: 'PRECISÃO', value: accuracyPercent(score) + '%', color: 'text-hit' },
      { label: 'MAX COMBO', value: score.maxCombo, color: 'text-signal-300' }
    ].map(item => <div key={item.label}>
      <p className="text-[9px] tracking-wider text-ink-300 sm:text-[10px]">{item.label}</p>
      <p className={'mt-0.5 text-xl font-bold sm:text-2xl ' + item.color}>{item.value}</p>
      {item.label === 'PONTUAÇÃO' && goal != null && <p className="truncate text-[10px] text-amp-200 sm:text-xs">Meta: {formatPoints(goal)}</p>}
    </div>)}
  </div>
);

const PLAYER_TEXT_COLORS: [string, string] = ['text-signal-300', 'text-note-violet'];

const PlayerScore: React.FC<{ name: string; score: ScoreState; player: PlayerSlot }> = ({ name, score, player }) => (
  <div className={'min-w-0 ' + (player === 1 ? 'text-right' : '')}>
    <p className={'truncate text-[10px] font-bold tracking-wider sm:text-xs ' + PLAYER_TEXT_COLORS[player]}>{name}</p>
    <p className="mt-0.5 text-lg font-bold text-ink-100 sm:text-2xl">{formatPoints(score.score)}</p>
    <p className="truncate text-[10px] text-ink-300 sm:text-xs">
      <span className="text-near">{score.combo} ×{comboMultiplier(score.combo)}</span> · <span className="text-hit">{accuracyPercent(score)}%</span>
    </p>
  </div>
);

export interface DuoHudProps {
  scores: ScoreState[];
  names: [string, string];
}

export const DuoHud: React.FC<DuoHudProps> = ({ scores, names }) => (
  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-ink-700 pt-3 font-mono [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:pt-1">
    <PlayerScore name={names[0]} score={scores[0]} player={0} />
    <div className="rounded-xl border border-amp-500/30 bg-amp-500/10 px-3 py-1 text-center sm:px-6">
      <p className="text-[9px] tracking-wider text-amp-300 sm:text-[10px]">PLACAR DA EQUIPE</p>
      <p className="text-2xl font-bold text-amp-300 sm:text-3xl">{formatPoints(scores[0].score + scores[1].score)}</p>
    </div>
    <PlayerScore name={names[1]} score={scores[1]} player={1} />
  </div>
);

export interface LiveTunerProps {
  player?: PlayerSlot;
  label?: string;
}

export const LiveTuner: React.FC<LiveTunerProps> = ({ player = 0, label }) => {
  const latestPitch = useLatestPitch(player);
  return <div aria-label={label ? `Afinador de ${label}` : 'Afinador'} className="flex shrink-0 items-center gap-2 rounded-xl border border-signal-500/20 bg-signal-500/5 px-2 py-2 font-mono sm:px-4">
    {label && <span className={'text-[10px] font-bold ' + PLAYER_TEXT_COLORS[player]}>{label}</span>}
    <span className="text-lg font-bold text-signal-300">{latestPitch ? latestPitch.noteName : '--'}</span>
    <span className="hidden text-xs text-ink-300 sm:inline">{latestPitch ? latestPitch.frequency + ' Hz' : 'Toque uma corda'}</span>
    {latestPitch && <span className={'size-2 rounded-full ' + (Math.abs(latestPitch.cents) <= 6 ? 'bg-hit' : 'bg-signal-400')} />}
  </div>;
};
