import { ModalFrame } from './ModalFrame';
import React, { useMemo, useRef, useState } from 'react';
import { Search, Music, Disc, Loader2, Sparkles, X, ChevronRight, Trophy, User, Users } from 'lucide-react';
import { SongsterrApi, type SongsterrSearchResult, type SongsterrMeta, type NormalizedSongTab } from '../services/songsterrApi';
import type { SavedSong } from '../context/preferences';
import { ErrorNotice } from './ErrorNotice';
import { getSongMetadata, loadSongTrack } from '../context/uiErrors';
import { getPersonalBest } from '../services/records';
import type { GamePart } from '../context/gameSession';

interface SongSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (tab: NormalizedSongTab, song: SavedSong, revisionId: number) => void;
  // Duo: set when the players are ready (names); each picks a part of the chosen song.
  // onSelectDuo must close the modal: onClose means the duo was given up
  duoNames?: [string, string] | null;
  onChooseMode?: (mode: 'solo' | 'duo') => void;
  onSelectDuo?: (parts: [GamePart, GamePart]) => void;
}

const modeButton = 'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-xs font-bold transition';

const FEATURED_SONGS = [
  { title: 'Creeping Death', artist: 'Metallica', id: 5194 },
  { title: 'Master of Puppets', artist: 'Metallica', id: 550 },
  { title: 'Back In Black', artist: 'AC/DC', id: 104 },
  { title: 'Come As You Are', artist: 'Nirvana', id: 89 },
  { title: 'Iron Man', artist: 'Black Sabbath', id: 25 },
  { title: 'The Trooper', artist: 'Iron Maiden', id: 102 }
];

export const SongSearchModal: React.FC<SongSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSong,
  duoNames = null,
  onChooseMode,
  onSelectDuo
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongsterrSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSongMeta, setSelectedSongMeta] = useState<SongsterrMeta | null>(null);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [duoTracks, setDuoTracks] = useState<[number, number]>([0, 0]);
  // Bumped on close and on each tab load: a load that finishes after it was superseded or the modal
  // was closed (Esc while loading) is dropped instead of starting a game nobody is waiting for
  const loadTokenRef = useRef(0);
  // Personal best at 1× of each part; re-read whenever the modal opens, a run may have just ended
  const trackBests = useMemo(
    () => isOpen && selectedSongMeta ? selectedSongMeta.tracks.map((track) => getPersonalBest(selectedSongMeta.songId, track.partId, 1)) : [],
    [isOpen, selectedSongMeta]
  );

  if (!isOpen) return null;

  const close = () => {
    loadTokenRef.current += 1;
    onClose();
  };

  const handleSearch = async (e?: React.FormEvent, searchQuery = query) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setRetry(null);
    setSelectedSongMeta(null);

    try {
      const data = await SongsterrApi.searchSongs(searchQuery);
      setResults(data);
      if (data.length === 0) {
        setError('Nenhuma música encontrada com esse nome no Songsterr.');
      }
    } catch {
      setResults([]);
      setError('Não foi possível buscar músicas no Songsterr. Verifique sua conexão e tente novamente.');
      setRetry(() => () => void handleSearch(undefined, searchQuery));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSong = async (songId: number) => {
    setIsLoadingTab(true);
    setError(null);
    setRetry(null);
    try {
      const meta = await getSongMetadata(songId);
      setSelectedSongMeta(meta);
      setDuoTracks([0, 0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível obter os dados da música no Songsterr.');
      setRetry(() => () => void handleSelectSong(songId));
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleSelectTrack = async (trackIndex: number) => {
    if (!selectedSongMeta) return;
    const token = ++loadTokenRef.current;

    setIsLoadingTab(true);
    setError(null);
    setRetry(null);

    try {
      const track = selectedSongMeta.tracks[trackIndex];
      const normalized = await loadSongTrack(selectedSongMeta, trackIndex);
      if (token !== loadTokenRef.current) return;
      onSelectSong(normalized, { songId: selectedSongMeta.songId, partId: track.partId }, selectedSongMeta.revisionId);
      onClose();
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a tablatura. Escolha outra faixa.');
      setRetry(() => () => void handleSelectTrack(trackIndex));
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleStartDuo = async () => {
    if (!selectedSongMeta || !onSelectDuo) return;
    const [first, second] = duoTracks;
    const token = ++loadTokenRef.current;
    setIsLoadingTab(true);
    setError(null);
    setRetry(null);
    try {
      const firstTab = await loadSongTrack(selectedSongMeta, first);
      // Same part for both (competition): one download, one tab
      const secondTab = second === first ? firstTab : await loadSongTrack(selectedSongMeta, second);
      if (token !== loadTokenRef.current) return;
      // No onClose here: closing the search while picking a duo song means giving up the duo, so the
      // caller closes the modal itself when the duo starts
      const { revisionId } = selectedSongMeta;
      onSelectDuo([
        { tab: firstTab, partId: selectedSongMeta.tracks[first].partId, revisionId },
        { tab: secondTab, partId: selectedSongMeta.tracks[second].partId, revisionId }
      ]);
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as tablaturas. Escolha outras faixas.');
      setRetry(() => () => void handleStartDuo());
    } finally {
      setIsLoadingTab(false);
    }
  };

  return (
    <ModalFrame titleId="SongSearchModal-title" onClose={close} className="max-w-2xl flex flex-col">
        <button
          onClick={close}
          aria-label="Fechar modal"
          className="min-h-10 absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 pr-10 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amp-500 to-amp-500 shadow-lg shadow-amp-500/20">
            <Music className="text-ink-100" size={24} />
          </div>
          <div>
            <h2 id="SongSearchModal-title" className="font-display text-xl font-bold">Acervo de Músicas do Songsterr</h2>
            <p className="text-xs text-ink-300">
              Mais de 1.000.000 de tablaturas interativas prontas para tocar
            </p>
          </div>
        </div>

        {onChooseMode && (
          <div className="mb-4">
            <div role="group" aria-label="Modo de jogo" className="inline-flex rounded-xl border border-ink-700 bg-ink-850 p-1">
              <button type="button" aria-pressed={!duoNames} onClick={() => onChooseMode('solo')}
                className={modeButton + (duoNames ? ' text-ink-300 hover:text-ink-100' : ' bg-amp-400 text-ink-950')}>
                <User size={14} aria-hidden="true" /> Solo
              </button>
              <button type="button" aria-pressed={Boolean(duoNames)} onClick={() => onChooseMode('duo')}
                className={modeButton + (duoNames ? ' bg-amp-400 text-ink-950' : ' text-ink-300 hover:text-ink-100')}>
                <Users size={14} aria-hidden="true" /> Dupla
              </button>
            </div>
            {duoNames && (
              <p className="mt-2 text-xs text-ink-300">
                <span className="text-signal-300">{duoNames[0]}</span> (canal 1) e <span className="text-note-violet">{duoNames[1]}</span> (canal 2): escolham a música e a parte de cada um.
              </p>
            )}
          </div>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <input
            type="text"
            aria-label="Nome da música ou banda"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome de uma música ou banda (ex: Metallica, Nirvana, AC/DC)..."
            className="w-full rounded-xl border border-ink-700 bg-ink-800/90 pl-11 pr-24 py-3 text-sm text-ink-100 placeholder-ink-400 focus:border-amp-500 focus:outline-none focus:ring-1 focus:ring-amp-500"
          />
          <Search className="absolute left-3.5 top-3.5 text-ink-300" size={18} />
          <button
            type="submit"
            disabled={isSearching || isLoadingTab}
            className="min-h-10 absolute right-2 top-1 rounded-lg bg-gradient-to-r from-amp-500 to-amp-500 px-4 py-1.5 text-xs font-bold text-ink-100 shadow-md hover:from-amp-400 hover:to-amp-400 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
          </button>
        </form>

        {error && (
          <div className="mb-4">
            <ErrorNotice message={error} onDismiss={() => { setError(null); setRetry(null); }}
              actionLabel="Tentar novamente" onAction={retry ?? undefined} actionDisabled={isSearching || isLoadingTab} />
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Track Selection Step */}
          {selectedSongMeta ? (
            <div className="rounded-xl border border-ink-700 bg-ink-950 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-ink-800">
                <div>
                  <h3 className="font-bold text-ink-100 text-base">{selectedSongMeta.title}</h3>
                  <p className="text-xs text-ink-300">{selectedSongMeta.artist}</p>
                </div>
                <button
                  onClick={() => { setSelectedSongMeta(null); setError(null); setRetry(null); }}
                  disabled={isLoadingTab}
                  className="text-xs text-amp-400 hover:underline cursor-pointer"
                >
                  Voltar à lista
                </button>
              </div>

              {duoNames ? (
                <div className="space-y-4">
                  {([0, 1] as const).map((player) => (
                    <label key={player} className="block">
                      <span className={'text-xs font-semibold ' + (player === 0 ? 'text-signal-300' : 'text-note-violet')}>
                        Parte de {duoNames[player]} (canal {player + 1})
                      </span>
                      <select value={duoTracks[player]} disabled={isLoadingTab}
                        onChange={(event) => {
                          const index = Number(event.target.value);
                          setDuoTracks(player === 0 ? [index, duoTracks[1]] : [duoTracks[0], index]);
                        }}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 text-sm text-ink-100 focus:border-amp-500 focus:outline-none">
                        {selectedSongMeta.tracks.map((track, idx) => (
                          <option key={idx} value={idx}>{track.name || track.instrument} · {track.instrument} · {track.tuning.length} cordas</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <p className="text-xs text-ink-300">
                    {duoTracks[0] === duoTracks[1]
                      ? 'Mesma parte: vocês competem nas mesmas notas.'
                      : 'Partes diferentes: cada um toca a sua, e o placar da equipe soma as duas.'}
                  </p>
                  <button type="button" onClick={() => void handleStartDuo()} disabled={isLoadingTab}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amp-400 px-4 font-bold text-ink-950 transition hover:bg-amp-300 disabled:cursor-wait disabled:opacity-70">
                    {isLoadingTab ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}
                    Começar dupla
                  </button>
                </div>
              ) : (
              <>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Escolha o Instrumento / Pista para Tocar:
              </div>

              <div className="space-y-2">
                {selectedSongMeta.tracks.map((track, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTrack(idx)}
                    disabled={isLoadingTab}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-900/80 hover:border-amp-500/60 hover:bg-ink-800 transition text-left group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink-100 group-hover:text-amp-300 transition">
                        {track.name || track.instrument}
                      </div>
                      <div className="text-xs text-ink-400">
                        {track.instrument} • {track.tuning.length} cordas
                        {track.difficulty ? ` • Nível ${track.difficulty}/5` : ''}
                      </div>
                      {trackBests[idx] && (
                        <div className="mt-1 flex items-center gap-1 font-mono text-xs text-amp-300">
                          <Trophy size={12} aria-hidden="true" /> Seu recorde: {trackBests[idx].score.toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-amp-400 font-semibold text-xs">
                      {isLoadingTab ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          Carregar <ChevronRight size={16} />
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              </>
              )}
            </div>
          ) : results.length > 0 ? (
            /* Search Results */
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-300 mb-2">
                Resultados ({results.length}):
              </div>
              {results.map((song) => (
                <button
                  key={song.songId}
                  onClick={() => handleSelectSong(song.songId)}
                  disabled={isLoadingTab || isSearching}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-800/40 hover:border-ink-500 hover:bg-ink-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Disc className="text-ink-400" size={20} />
                    <div>
                      <div className="text-sm font-semibold text-ink-100">{song.title}</div>
                      <div className="text-xs text-ink-300">{song.artist}</div>
                    </div>
                  </div>
                  <span className="text-xs text-ink-400 flex items-center gap-1">
                    {song.tracks.length} pistas <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Featured Songs / Suggestions */
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-300">
                <Sparkles size={14} className="text-amp-400" />
                Músicas em Destaque para Treinar:
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {FEATURED_SONGS.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectSong(song.id)}
                    disabled={isLoadingTab || isSearching}
                    className="flex flex-col p-3 rounded-xl border border-ink-800 bg-ink-800/30 hover:border-amp-500/50 hover:bg-ink-800 transition text-left cursor-pointer"
                  >
                    <span className="text-sm font-bold text-ink-100">{song.title}</span>
                    <span className="text-xs text-ink-300">{song.artist}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
    </ModalFrame>
  );
};
