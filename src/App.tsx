import React, { useEffect, useRef, useState } from 'react';
import {
  Music,
  Play,
  Sliders,
  Sparkles,
  Volume2,
  Zap,
  Loader2
} from 'lucide-react';
import type { NormalizedSongTab } from './services/songsterrApi';
import { ErrorNotice } from './components/ErrorNotice';
import { getSongMetadata, loadSongTrack } from './context/uiErrors';
import { YousicianGame } from './components/YousicianGame';
import { SongSearchModal } from './components/SongSearchModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { Tone3000AmpRack } from './components/Tone3000AmpRack';
import { AudioSessionProvider, useAudioSession, useLatestPitch } from './context/AudioSessionContext';
import { ModalsProvider, useModals } from './context/ModalsContext';
import { readPreferences, savePreferences } from './context/preferences';

const LandingPitch: React.FC = () => {
  const latestPitch = useLatestPitch();
  if (!latestPitch) return null;
  return (
    <div className="text-xs font-mono text-cyan-300 flex items-center justify-center gap-1.5">
      <Volume2 size={13} />
      Última nota ouvida: <strong>{latestPitch.noteName}</strong> ({latestPitch.frequency} Hz)
    </div>
  );
};

const AppContent: React.FC = () => {
  const {
    audioEngine,
    tone3000,
    isAudioRunning,
    audioError,
    dismissAudioError,
    selectedDeviceId,
    channelMode,
    startAudio: handleStartAudio,
    changeDevice: handleDeviceChange,
    changeChannelMode: handleChannelModeChange
  } = useAudioSession();
  const {
    isSearchOpen,
    isSettingsOpen,
    isTone3000RackOpen,
    setSearchOpen: setIsSearchOpen,
    setSettingsOpen: setIsSettingsOpen,
    setTone3000RackOpen: setIsTone3000RackOpen
  } = useModals();

  const [activeTab, setActiveTab] = useState<NormalizedSongTab | null>(null);
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  const [savedSong] = useState(() => readPreferences().lastSong);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const songSelectionVersion = useRef(0);

  useEffect(() => {
    if (activeTab) audioEngine.setTuning(activeTab.tuning);
  }, [activeTab, audioEngine]);

  useEffect(() => {
    if (!savedSong) return;
    let cancelled = false;
    const version = songSelectionVersion.current;
    const restoreSong = async () => {
      try {
        const meta = await getSongMetadata(savedSong.songId);
        const trackIndex = meta.tracks.findIndex((track) => track.partId === savedSong.partId);
        if (trackIndex < 0) throw new Error('A faixa salva não está mais disponível.');
        const normalized = await loadSongTrack(meta, trackIndex);
        if (!cancelled && version === songSelectionVersion.current) setActiveTab(normalized);
      } catch (err) {
        if (!cancelled && version === songSelectionVersion.current) {
          setRestoreError(`Não foi possível restaurar a última música. ${err instanceof Error ? err.message : 'Busque uma música para continuar.'}`);
        }
      }
    };
    void restoreSong();
    return () => { cancelled = true; };
  }, [savedSong, restoreAttempt]);

  // Load default song (Metallica - Creeping Death)
  const handleLoadDefaultSong = async () => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    setDefaultError(null);
    setIsLoadingDefault(true);
    try {
      // Connect audio if not running
      if (!isAudioRunning) {
        await handleStartAudio();
      }

      const songId = 5194; // Creeping Death
      const meta = await getSongMetadata(songId);
      // Track index 3: James Hetfield Rhythm Guitar
      const trackIndex = meta.tracks.length > 3 ? 3 : 0;
      const track = meta.tracks[trackIndex];

      const normalized = await loadSongTrack(meta, trackIndex);
      setActiveTab(normalized);
      savePreferences({ lastSong: { songId: meta.songId, partId: track.partId } });
    } catch (err) {
      setDefaultError(err instanceof Error ? err.message : 'Não foi possível carregar a música padrão. Busque outra música.');
    } finally {
      setIsLoadingDefault(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-white font-sans overflow-hidden">
      <div className="fixed inset-x-4 top-4 z-[100] mx-auto max-h-[50vh] max-w-xl space-y-3 overflow-y-auto">
        {audioError && (
          <ErrorNotice message={audioError} onDismiss={dismissAudioError}
            actionLabel="Abrir configurações de áudio" onAction={() => {
              setIsSearchOpen(false);
              setIsTone3000RackOpen(false);
              setIsSettingsOpen(true);
              dismissAudioError();
            }} />
        )}
        {restoreError && (
          <ErrorNotice message={restoreError} onDismiss={() => setRestoreError(null)}
            actionLabel="Tentar novamente" onAction={() => {
              setRestoreError(null);
              setRestoreAttempt((attempt) => attempt + 1);
            }} />
        )}
        {defaultError && (
          <ErrorNotice message={defaultError} onDismiss={() => setDefaultError(null)}
            actionLabel="Tentar novamente" onAction={() => void handleLoadDefaultSong()} actionDisabled={isLoadingDefault} />
        )}
      </div>
      {activeTab ? (
        /* Yousician In-Game Interactive Mode */
        <>
          {!isAudioRunning && (
            <button
              onClick={() => void handleStartAudio()}
              className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 cursor-pointer"
            >
              Conectar guitarra
            </button>
          )}
          <YousicianGame
            tab={activeTab}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAudioSettings={() => setIsSettingsOpen(true)}
            tone3000={tone3000}
            onOpenTone3000Rack={() => setIsTone3000RackOpen(true)}
          />
        </>
      ) : (
        /* Welcome / Landing Screen */
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-600/15 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-rose-600/15 blur-3xl" />

          {/* Header Title */}
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur">
              <Sparkles size={14} className="text-cyan-400" />
              Yousician Engine + Motor TONE3000 + Songsterr
            </div>

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              Toque e ouça a{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-rose-400 to-amber-400 bg-clip-text text-transparent">
                sua guitarra real
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              Escute o som da sua guitarra com timbre valvulado em tempo real pelo <strong>TONE3000</strong> e
              acerte notas com baixa latência em mais de 1 milhão de músicas.
            </p>

            {/* Quick Actions */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleLoadDefaultSong}
                disabled={isLoadingDefault}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition cursor-pointer"
              >
                {isLoadingDefault ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Play size={20} className="fill-white" />
                    Tocar Metallica (Creeping Death)
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (!isAudioRunning) handleStartAudio();
                  setIsSearchOpen(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-6 py-4 text-base font-bold text-slate-200 transition cursor-pointer"
              >
                <Music size={20} className="text-rose-400" />
                Buscar Outra Música no Songsterr
              </button>
            </div>

            {/* Audio Interface & TONE3000 Status Bar */}
            <div className="pt-8 flex flex-col items-center gap-2.5">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur text-xs flex-wrap justify-center">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isAudioRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-slate-300">
                  {isAudioRunning
                    ? 'Interface Conectada (48kHz RAW Ativo)'
                    : 'Interface Pronta para Conectar'}
                </span>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="ml-1 flex items-center gap-1 font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  <Sliders size={13} />
                  Entrada & Afinador
                </button>

                <span className="text-slate-600">|</span>

                <button
                  onClick={() => {
                    if (!isAudioRunning) handleStartAudio();
                    setIsTone3000RackOpen(true);
                  }}
                  className="flex items-center gap-1.5 font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  <Zap size={13} className="fill-emerald-400" />
                  Timbre TONE3000 (Amplificador)
                </button>
              </div>

              <LandingPitch />
            </div>
          </div>
        </div>
      )}

      {/* Songsterr Search Modal */}
      <SongSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectSong={(tab, song) => {
          songSelectionVersion.current += 1;
          setRestoreError(null);
          setDefaultError(null);
          if (!isAudioRunning) handleStartAudio();
          setActiveTab(tab);
          savePreferences({ lastSong: song });
        }}
      />

      {/* Audio Interface Settings Modal */}
      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        audioEngine={audioEngine}
        currentDeviceId={selectedDeviceId}
        currentChannelMode={channelMode}
        onDeviceChange={handleDeviceChange}
        onChannelModeChange={handleChannelModeChange}
        onOpenTone3000Rack={() => setIsTone3000RackOpen(true)}
      />

      {/* TONE3000 Guitar Amp Modeler & Monitoring Rack */}
      <Tone3000AmpRack
        isOpen={isTone3000RackOpen}
        onClose={() => setIsTone3000RackOpen(false)}
        tone3000={tone3000}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <AudioSessionProvider>
    <ModalsProvider>
      <AppContent />
    </ModalsProvider>
  </AudioSessionProvider>
);

export default App;
