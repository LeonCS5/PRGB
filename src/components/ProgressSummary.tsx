import React from 'react';
import { Star } from 'lucide-react';
import { formatCountedTime, type RunProgress } from '../context/progressStore';
import { ACHIEVEMENTS } from '../services/achievements';
import { MAX_STARS } from '../services/progress';

// Gentle wording on purpose: it says what the player did, never what they missed. No motion here.

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const starsText = (progress: RunProgress): string => {
  const { stars, starsGained, rated } = progress.report;
  if (!rated) return 'Esta jogada não conta estrelas (salto, troca de velocidade ou modo treino), mas o tempo conta.';
  if (stars === 0) return 'Sem estrela desta vez. Peças com 8 notas ou mais e 70% de precisão dão a primeira.';
  const earned = `${stars} de ${MAX_STARS} ${plural(stars, 'estrela', 'estrelas')}`;
  return starsGained > 0
    ? `${earned}: ${starsGained} ${plural(starsGained, 'estrela nova', 'estrelas novas')} neste exercício.`
    : `${earned}. Você já tinha essas estrelas.`;
};

export const ProgressSummary: React.FC<{ progress: RunProgress }> = ({ progress }) => {
  const { report, countedMs } = progress;
  const { weekly, level } = report;
  const unlocked = report.newAchievements.flatMap((id) => ACHIEVEMENTS.find((item) => item.id === id) ?? []);
  const weekText = weekly.goal !== null
    ? weekly.completed
      ? `Ensaio da semana: meta cumprida, ${weekly.daysDone} ${plural(weekly.daysDone, 'dia', 'dias')}.`
      : `Ensaio da semana: ${weekly.daysDone} de ${weekly.goal} dias.`
    : weekly.daysDone > 0 ? `Ensaio da semana: ${weekly.daysDone} ${plural(weekly.daysDone, 'dia', 'dias')}.` : null;

  return (
    <section aria-label="Seu progresso" className="mt-4 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-left">
      <h3 className="font-display text-sm font-bold text-ink-100">Seu progresso</h3>
      {report.ownContent && (
        <div className="mt-2">
          <p className="flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: MAX_STARS }, (_, index) => (
              <Star key={index} size={22} className={index < report.stars ? 'fill-amp-300 text-amp-300' : 'text-ink-500'} />
            ))}
          </p>
          <p className="mt-1 text-sm text-ink-100">{starsText(progress)}</p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-300">Tempo contado: <span className="font-mono text-ink-100">{formatCountedTime(countedMs)}</span></p>
      {!report.ownContent && <p className="mt-1 text-xs text-ink-300">Músicas do acervo externo contam o tempo de ensaio, sem estrelas.</p>}
      {unlocked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {unlocked.map((item) => (
            <li key={item.id} className="rounded-lg border border-amp-400/40 bg-amp-500/10 px-3 py-2">
              <p className="text-sm font-bold text-amp-300">Palheta nova: {item.name}</p>
              <p className="text-xs text-ink-200">{item.description}</p>
            </li>
          ))}
        </ul>
      )}
      {weekText && <p className="mt-3 text-sm text-ink-100">{weekText}</p>}
      <p className="mt-2 text-xs text-ink-300">
        Nível: <span className="font-semibold text-ink-100">{level.name}</span>
        {report.levelChanged && ' (nível novo!)'}
        {level.nextName !== null && level.starsToNext !== null && ` · próximo: ${level.nextName}, com mais ${level.starsToNext} ${plural(level.starsToNext, 'estrela', 'estrelas')}`}
      </p>
    </section>
  );
};
