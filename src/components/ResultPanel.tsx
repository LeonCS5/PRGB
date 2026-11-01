import React, { useState } from 'react';
import { ListOrdered, Loader2, Swords, Trophy } from 'lucide-react';
import { accuracyPercent, type ScoreState } from '../services/scoring';
import type { Challenge } from '../services/challenge';
import type { GamePart, RankedSubmission, RunSummary } from '../context/gameSession';
import { useRanking } from '../context/ranking';
import { ChallengeSharePanel } from './ChallengeSharePanel';

const formatPoints = (value: number) => value.toLocaleString('pt-BR');
const formatSpeed = (speed: number) => speed.toLocaleString('pt-BR') + '×';

const primaryButton = 'min-h-11 w-full cursor-pointer rounded-xl bg-amp-400 px-4 font-bold text-ink-950 transition hover:bg-amp-300';
const secondaryButton = 'mt-3 min-h-11 w-full cursor-pointer rounded-xl border border-ink-700 px-4 text-sm text-ink-200 transition hover:border-ink-500';

const JudgementCounts: React.FC<{ score: ScoreState }> = ({ score }) => (
  <dl className="grid grid-cols-3 gap-2 font-mono text-center">
    {[
      { label: 'Perfeito', value: score.perfect, color: 'text-hit' },
      { label: 'Bom', value: score.good, color: 'text-near' },
      { label: 'Errou', value: score.miss, color: 'text-miss' }
    ].map((item) => (
      <div key={item.label} className="rounded-lg bg-ink-850 py-2">
        <dt className="text-[10px] text-ink-300">{item.label}</dt>
        <dd className={'text-lg font-bold ' + item.color}>{item.value}</dd>
      </div>
    ))}
  </dl>
);

const PersonalBestBanner: React.FC<{ summary: RunSummary; score: number }> = ({ summary, score }) => {
  const outcome = summary.personalBest;
  const speedNote = summary.speed !== 1 ? ` em ${formatSpeed(summary.speed)}` : '';
  if (summary.jumped || summary.speedChanged) {
    return (
      <div className="mt-4 text-xs text-ink-300">
        <p>{summary.jumped ? 'Jogada com saltos não conta como recorde.' : 'Trocar a velocidade no meio da música não conta como recorde.'}</p>
        {outcome?.previous && <p className="mt-1">Seu recorde{speedNote}: <span className="font-mono text-ink-100">{formatPoints(outcome.previous.score)}</span></p>}
      </div>
    );
  }
  if (outcome?.isNew) {
    return (
      <div className="mt-5 rounded-xl border border-amp-400/50 bg-amp-500/10 px-4 py-3 shadow-glow-amp">
        <p className="flex items-center justify-center gap-2 font-display text-xl font-bold text-amp-300"><Trophy size={20} aria-hidden="true" /> Novo recorde!</p>
        {outcome.previous && <p className="mt-1 text-xs text-ink-200">{formatPoints(score - outcome.previous.score)} pontos acima do anterior ({formatPoints(outcome.previous.score)}){speedNote}</p>}
        {!outcome.previous && summary.speed !== 1 && <p className="mt-1 text-xs text-ink-200">Recorde separado para a velocidade {formatSpeed(summary.speed)}</p>}
      </div>
    );
  }
  if (outcome?.previous) {
    const gap = outcome.previous.score - score;
    return (
      <p className="mt-5 text-sm text-ink-200">
        Seu recorde{speedNote}: <span className="font-mono font-bold text-amp-300">{formatPoints(outcome.previous.score)}</span>
        <span className="block text-xs text-ink-300">{gap === 0 ? 'Você igualou seu recorde.' : `Faltaram ${formatPoints(gap)} pontos para bater.`}</span>
      </p>
    );
  }
  return null;
};

const ChallengeVerdict: React.FC<{ challenge: Challenge; score: number; counts: boolean }> = ({ challenge, score, counts }) => {
  const rival = challenge.nickname ?? 'Seu amigo';
  let text = 'Para valer no desafio, toque a música inteira em 1×, sem saltos.';
  let color = 'text-ink-300';
  if (counts && score > challenge.score) {
    text = 'Você venceu o desafio!';
    color = 'text-hit';
  } else if (counts && score === challenge.score) {
    text = 'Empate! Mesma pontuação do desafio.';
    color = 'text-near';
  } else if (counts) {
    text = `Faltaram ${formatPoints(challenge.score - score)} pontos.`;
    color = 'text-miss';
  }
  return (
    <div className="mt-5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3">
      <p className="text-xs text-ink-300">Desafio de {rival}: <span className="font-mono text-ink-100">{formatPoints(challenge.score)}</span> pontos</p>
      <p className={'mt-1 font-display text-lg font-bold ' + color}>{text}</p>
    </div>
  );
};

const RankedResult: React.FC<{ submission: RankedSubmission; onRetry: () => void }> = ({ submission, onRetry }) => {
  if (submission.status === 'sending') {
    return <p className="flex items-center justify-center gap-2 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Enviando ao ranking…</p>;
  }
  if (submission.status === 'skipped') {
    return <p className="text-sm text-ink-200">{submission.reason === 'jumped' ? 'Jogada com saltos não vale para o ranking, por isso não foi enviada.' : 'Jogada com troca de velocidade não vale para o ranking, por isso não foi enviada.'}</p>;
  }
  if (submission.status === 'failed') {
    return (
      <>
        <p className="text-sm text-ink-100">{submission.message}</p>
        <p className="mt-1 text-xs text-ink-300">Sua pontuação não foi perdida: o resultado acima continua valendo neste navegador.</p>
        {submission.canRetry && <button type="button" onClick={onRetry} className="mt-2 min-h-10 cursor-pointer rounded-lg px-3 text-sm font-bold text-signal-300 underline hover:text-signal-200">Tentar enviar de novo</button>}
      </>
    );
  }
  const { personalBest, rankAll, rankWeek } = submission.result;
  return (
    <>
      <p className="flex items-center justify-center gap-2 font-display text-base font-bold text-hit"><Trophy size={16} aria-hidden="true" /> Enviado ao ranking</p>
      {personalBest && <p className="mt-1 text-sm font-semibold text-amp-300">Novo recorde no ranking!</p>}
      <p className="mt-1 font-mono text-sm text-ink-100">{personalBest ? 'Sua posição' : 'Sua melhor posição'}: {rankAll}º no geral · {rankWeek}º na semana</p>
    </>
  );
};

export interface ResultPanelProps {
  titleId: string;
  summary: RunSummary;
  parts: GamePart[];
  names: [string, string] | null; // duo only
  challenge: Challenge | null;
  initialShareOpen?: boolean;
  ranked?: RankedSubmission | null;
  onRetryRanked?: () => void;
  onPlayAgain: () => void;
  onChooseSong: () => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = (props) =>
  props.names && props.parts.length > 1
    ? <DuoResult {...props} names={props.names} />
    : <SoloResult {...props} />;

const SoloResult: React.FC<ResultPanelProps> = ({ titleId, summary, parts, challenge, initialShareOpen = false, ranked = null, onRetryRanked, onPlayAgain, onChooseSong }) => {
  const { isConfigured, openLeaderboard } = useRanking();
  const [isSharing, setIsSharing] = useState(initialShareOpen);
  const { tab, partId } = parts[0];
  const score = summary.scores[0];
  const accuracy = accuracyPercent(score);
  // A challenge has no speed field, so only full 1× runs can be sent or answered
  const counts = !summary.jumped && !summary.speedChanged;
  const canChallenge = counts && summary.speed === 1;

  if (isSharing && canChallenge) {
    return (
      <>
        <h2 id={titleId} className="sr-only">Resultado: {formatPoints(score.score)} pontos</h2>
        <ChallengeSharePanel isReply={challenge !== null} onBack={() => setIsSharing(false)}
          challenge={{ v: 1, songId: tab.songId, partId, title: tab.title, artist: tab.artist, trackName: tab.trackName, score: score.score, accuracy }} />
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-amp-300">MAIS UM RIFF NO CAMINHO</p>
      <h2 id={titleId} className="mt-3 font-display text-3xl font-bold">Prática concluída</h2>
      <p className="mt-2 text-sm text-ink-300">{tab.title} · {tab.trackName}{summary.speed !== 1 ? ` · ${formatSpeed(summary.speed)}` : ''}</p>
      <div aria-live="polite"><PersonalBestBanner summary={summary} score={score.score} /></div>
      <p className="mt-6 font-mono text-5xl font-bold text-amp-300">{formatPoints(score.score)}</p><p className="mt-2 text-xs text-ink-300">PONTOS</p>
      <div className="my-5 grid grid-cols-2 gap-3 font-mono"><div><p className="text-2xl text-hit">{accuracy}%</p><p className="text-xs text-ink-300">Precisão</p></div><div><p className="text-2xl text-signal-300">{score.maxCombo}</p><p className="text-xs text-ink-300">Max combo</p></div></div>
      <JudgementCounts score={score} />
      {challenge && <ChallengeVerdict challenge={challenge} score={score.score} counts={canChallenge} />}
      <div role="status" aria-live="polite" className={ranked ? 'mt-5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3' : ''}>
        {ranked && <RankedResult submission={ranked} onRetry={() => onRetryRanked?.()} />}
      </div>
      <div className="mt-6">
        {isConfigured && (
          <button type="button" onClick={() => openLeaderboard({ songId: tab.songId, partId, title: tab.title, trackName: tab.trackName })}
            className={secondaryButton + ' mt-0 mb-3 flex items-center justify-center gap-2 font-semibold'}>
            <ListOrdered size={16} aria-hidden="true" /> Ver ranking
          </button>
        )}
        {canChallenge ? (
          <button type="button" onClick={() => setIsSharing(true)} className={secondaryButton + ' mt-0 mb-3 flex items-center justify-center gap-2 border-amp-500/40 font-semibold text-amp-300'}>
            <Swords size={16} aria-hidden="true" /> {challenge ? 'Responder ao desafio' : 'Desafiar um amigo'}
          </button>
        ) : (
          <p className="mb-3 text-xs text-ink-300">
            {counts ? `Desafios valem só na velocidade 1×. Toque em 1× para ${challenge ? 'responder' : 'desafiar um amigo'}.` : summary.jumped ? 'Jogada com saltos não vale para desafio.' : 'Jogada com troca de velocidade não vale para desafio.'}
          </p>
        )}
        <button type="button" onClick={onPlayAgain} className={primaryButton}>Tocar de novo</button>
        <button type="button" onClick={onChooseSong} className={secondaryButton}>Escolher outra música</button>
      </div>
    </>
  );
};

const PLAYER_COLORS: [string, string] = ['text-signal-300', 'text-note-violet'];

const DuoResult: React.FC<ResultPanelProps & { names: [string, string] }> = ({ titleId, summary, parts, names, onPlayAgain, onChooseSong }) => {
  const [first, second] = summary.scores;
  const team = first.score + second.score;
  const leader = first.score === second.score ? null : first.score > second.score ? names[0] : names[1];
  return (
    <>
      <p className="font-mono text-xs tracking-widest text-amp-300">DUPLA NO MESMO COMPUTADOR</p>
      <h2 id={titleId} className="mt-3 font-display text-3xl font-bold">Fim da música</h2>
      <p className="mt-2 text-sm text-ink-300">{parts[0].tab.title}</p>
      <p className="mt-6 font-mono text-5xl font-bold text-amp-300">{formatPoints(team)}</p><p className="mt-2 text-xs text-ink-300">PLACAR DA EQUIPE</p>
      <p className="mt-4 flex items-center justify-center gap-2 font-display text-lg font-bold text-ink-100">
        <Trophy size={18} className="text-amp-300" aria-hidden="true" /> {leader ? `${leader} fez mais pontos!` : 'Empate!'}
      </p>
      <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
        {[first, second].map((score, index) => (
          <section key={index} aria-label={names[index]} className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <p className={'truncate text-sm font-bold ' + PLAYER_COLORS[index]}>{names[index]}</p>
            <p className="truncate text-xs text-ink-300">{parts[index].tab.trackName}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-ink-100">{formatPoints(score.score)}</p>
            <p className="mb-3 font-mono text-xs text-ink-300"><span className="text-hit">{accuracyPercent(score)}%</span> · max combo <span className="text-signal-300">{score.maxCombo}</span></p>
            <JudgementCounts score={score} />
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-300">Resultados em dupla não entram nos recordes pessoais deste navegador.</p>
      <div className="mt-5">
        <button type="button" onClick={onPlayAgain} className={primaryButton}>Tocar de novo</button>
        <button type="button" onClick={onChooseSong} className={secondaryButton}>Escolher outra música</button>
      </div>
    </>
  );
};
