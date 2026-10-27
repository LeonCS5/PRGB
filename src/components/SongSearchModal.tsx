import React, { useState } from 'react';
import { Search, Music, Disc, Loader2, Sparkles, X, ChevronRight } from 'lucide-react';
import { SongsterrApi, type SongsterrSearchResult, type SongsterrMeta, type NormalizedSongTab } from '../services/songsterrApi';
import type { SavedSong } from '../context/preferences';

interface SongSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (tab: NormalizedSongTab, song: SavedSong) => void;
}

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
  onSelectSong
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongsterrSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSongMeta, setSelectedSongMeta] = useState<SongsterrMeta | null>(null);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setSelectedSongMeta(null);

    try {
      const data = await SongsterrApi.searchSongs(query);
      setResults(data);
      if (data.length === 0) {
        setError('Nenhuma música encontrada com esse nome no Songsterr.');
      }
    } catch (err: any) {
      setError(`Erro na busca: ${err.message || 'Falha ao conectar com o Songsterr'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSong = async (songId: number) => {
    setIsLoadingTab(true);
    setError(null);
    try {
      const meta = await SongsterrApi.getSongMeta(songId);
      setSelectedSongMeta(meta);
    } catch (err: any) {
      setError(`Falha ao obter dados da música: ${err.message}`);
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleSelectTrack = async (trackIndex: number) => {
    if (!selectedSongMeta) return;

    setIsLoadingTab(true);
    setError(null);

    try {
      const track = selectedSongMeta.tracks[trackIndex];
      const rawTab = await SongsterrApi.getTrackTabJson(
        selectedSongMeta.songId,
        selectedSongMeta.revisionId,
        selectedSongMeta.image,
        track.partId
      );

      const normalized = SongsterrApi.normalizeTab(rawTab, selectedSongMeta, trackIndex);
      onSelectSong(normalized, { songId: selectedSongMeta.songId, partId: track.partId });
      onClose();
    } catch (err: any) {
      setError(`Falha ao carregar a tablatura do CDN: ${err.message}`);
    } finally {
      setIsLoadingTab(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl text-neutral-100 max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-lg shadow-rose-500/20">
            <Music className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Acervo de Músicas do Songsterr</h2>
            <p className="text-xs text-neutral-400">
              Mais de 1.000.000 de tablaturas interativas prontas para tocar
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome de uma música ou banda (ex: Metallica, Nirvana, AC/DC)..."
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/90 pl-11 pr-24 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={18} />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-2 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:from-rose-400 hover:to-amber-400 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Track Selection Step */}
          {selectedSongMeta ? (
            <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div>
                  <h3 className="font-bold text-white text-base">{selectedSongMeta.title}</h3>
                  <p className="text-xs text-neutral-400">{selectedSongMeta.artist}</p>
                </div>
                <button
                  onClick={() => setSelectedSongMeta(null)}
                  className="text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  Voltar à lista
                </button>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Escolha o Instrumento / Pista para Tocar:
              </div>

              <div className="space-y-2">
                {selectedSongMeta.tracks.map((track, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTrack(idx)}
                    disabled={isLoadingTab}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:border-rose-500/60 hover:bg-neutral-800 transition text-left group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-rose-300 transition">
                        {track.name || track.instrument}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {track.instrument} • {track.tuning.length} cordas
                        {track.difficulty ? ` • Nível ${track.difficulty}/5` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
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
            </div>
          ) : results.length > 0 ? (
            /* Search Results */
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Resultados ({results.length}):
              </div>
              {results.map((song) => (
                <button
                  key={song.songId}
                  onClick={() => handleSelectSong(song.songId)}
                  disabled={isLoadingTab}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-800/40 hover:border-neutral-600 hover:bg-neutral-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Disc className="text-neutral-500" size={20} />
                    <div>
                      <div className="text-sm font-semibold text-white">{song.title}</div>
                      <div className="text-xs text-neutral-400">{song.artist}</div>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    {song.tracks.length} pistas <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Featured Songs / Suggestions */
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <Sparkles size={14} className="text-amber-400" />
                Músicas em Destaque para Treinar:
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {FEATURED_SONGS.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectSong(song.id)}
                    disabled={isLoadingTab}
                    className="flex flex-col p-3 rounded-xl border border-neutral-800 bg-neutral-800/30 hover:border-amber-500/50 hover:bg-neutral-800 transition text-left cursor-pointer"
                  >
                    <span className="text-sm font-bold text-white">{song.title}</span>
                    <span className="text-xs text-neutral-400">{song.artist}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
