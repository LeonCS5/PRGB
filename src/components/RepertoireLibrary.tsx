import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Search } from 'lucide-react';
import { SONG_CATALOG } from '../content/songs';
import type { GamePart } from '../context/gameSession';
import { isAcervoEnabled } from '../services/acervoFlag';
import { getPersonalBest } from '../services/records';
import { songSongId } from '../services/songIds';
import { findSongPart } from '../services/songs';

export interface RepertoireLibraryProps {
  onPlay: (part: GamePart) => void;
  onSearch: () => void;
  onExit: () => void;
}

export const RepertoireLibrary: React.FC<RepertoireLibraryProps> = ({ onPlay, onSearch, onExit }) => {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    return () => { request.current += 1; };
  }, []);

  const play = async (songId: number) => {
    const token = ++request.current;
    setLoadingId(songId);
    setError(null);
    try {
      const part = await findSongPart(songId, 0);
      if (token !== request.current) return;
      if (!part) throw new Error('unavailable');
      onPlay(part);
    } catch {
      if (token === request.current) setError('Não foi possível carregar a peça. Tente tocar novamente.');
    } finally {
      if (token === request.current) setLoadingId(null);
    }
  };

  return (
    <main className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-12">
        <button type="button" onClick={onExit} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-ink-200 hover:bg-ink-800">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar ao início
        </button>
        <h1 ref={heading} tabIndex={-1} className="mt-5 font-display text-3xl font-bold">Repertório do PRGB</h1>
        <p className="mt-2 text-sm leading-6 text-ink-300">Domínio público — arranjo PRGB</p>
        {error && <p role="alert" className="mt-4 text-sm text-miss">{error}</p>}
        <p role="status" className="mt-3 text-sm text-ink-300">{loadingId !== null ? 'Carregando peça…' : ''}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SONG_CATALOG.map(({ info }) => (
            <article key={info.code} className="min-w-0 rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <h2 className="font-display text-xl font-bold">{info.title}</h2>
              <p className="mt-2 text-sm text-ink-200">{info.composer}</p>
              <p className="mt-1 text-xs text-ink-300">{info.composerDeathYear === null ? (info.composer === 'PRGB' ? 'Obra original do PRGB' : 'Melodia tradicional, domínio público') : `Falecimento do compositor: ${info.composerDeathYear}`}</p>
              <p className="mt-3 text-sm text-ink-300">Nível {info.level} de 3 · {info.bpm} bpm</p>
              {info.parts.map((part) => {
                const songId = songSongId(info.code, part.code);
                const bests = [1, 0.75, 0.5].flatMap((speed) => {
                  const best = getPersonalBest(songId, 0, speed);
                  return best ? [best] : [];
                });
                return (
                  <div key={part.code} className="mt-4">
                    {bests.map((best) => <p key={best.speed} className="mb-2 text-sm text-amp-300">Recorde a {best.speed.toLocaleString('pt-BR')}×: {best.score.toLocaleString('pt-BR')} pontos</p>)}
                    <button type="button" disabled={loadingId !== null} onClick={() => void play(songId)}
                      aria-label={`Tocar ${info.title} — ${part.name}`}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amp-400 px-4 py-3 text-sm font-bold text-ink-950 hover:bg-amp-300 disabled:cursor-wait disabled:opacity-70">
                      <Play size={16} aria-hidden="true" /> {loadingId === songId ? 'Carregando…' : `Tocar ${part.name}`}
                    </button>
                  </div>
                );
              })}
            </article>
          ))}
        </div>
        {isAcervoEnabled() && <button type="button" onClick={onSearch} disabled={loadingId !== null}
          className="mt-8 flex min-h-11 items-center gap-2 rounded-xl border border-ink-600 px-4 py-3 text-left text-sm text-ink-200 hover:bg-ink-800 disabled:opacity-70">
          <Search size={18} className="shrink-0" aria-hidden="true" /> Buscar no acervo (experimental)
        </button>}
      </div>
    </main>
  );
};
