import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Music,
  Play,
  Sliders,
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Check,
  Guitar,
  Heart,
  Headphones,
  PlugZap,
  Target,
  Volume2,
  Zap,
  Loader2,
  Users
} from 'lucide-react';
import { getDemoSong, DEMO_SONG_ID } from './services/demoSong';
import { ErrorNotice } from './components/ErrorNotice';
import { ChallengeCard } from './components/ChallengeCard';
import { LocalRecords } from './components/LocalRecords';
import { DuoSetupModal } from './components/DuoSetupModal';
import { LegalPage } from './components/LegalPage';
import { readHash, resolveLegalRoute, subscribeToHash } from './context/legalRoute';
import { gameDevPreset, readDevScene } from './components/devScenes';
import { CHALLENGE_PARAM, readChallengeFromSearch, type Challenge } from './services/challenge';
import { BrandMark } from './components/BrandMark';
import { getSongMetadata, loadSongTrack } from './context/uiErrors';
import { PracticeGame } from './components/PracticeGame';
import { SongSearchModal } from './components/SongSearchModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { Tone3000AmpRack } from './components/Tone3000AmpRack';
import { AudioSessionProvider, useAudioSession, useLatestPitch } from './context/AudioSessionContext';
import { ModalsProvider, useModals } from './context/ModalsContext';
import { readPreferences, savePreferences } from './context/preferences';
import { DEFAULT_PLAYER_NAMES, nextSessionKey, type GamePart, type GameSession } from './context/gameSession';

const supportUrl = import.meta.env.VITE_SUPPORT_URL?.trim();
const supportHref = supportUrl || 'https://github.com/LeonCS5/PRGB';
const supportLabel = supportUrl ? 'Apoie o projeto' : 'Apoie com uma estrela no GitHub';
const currentYear = new Date().getFullYear();

const PracticePreview: React.FC = () => (
  <figure className="relative min-w-0 lg:-mr-8" aria-label="Ilustração do modo de prática: seis cordas, notas e pontuação em tempo real">
    <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-signal-500/5 blur-3xl" />
    <div className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-ink-700 bg-ink-850 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border border-amp-500/25 bg-amp-500/10 text-amp-400"><Guitar size={20} /></span>
          <div><p className="text-sm font-bold text-ink-100">Creeping Death</p><p className="mt-1 text-xs text-ink-300">Metallica · Guitarra rítmica</p></div>
        </div>
        <span className="rounded-md border border-signal-500/25 bg-signal-500/10 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-signal-300">PRÁTICA</span>
      </div>
      <div className="flex items-center justify-between px-4 pt-5 font-mono text-xs sm:px-6">
        <span className="text-ink-300">PONTUAÇÃO <span className="ml-1 text-ink-100">2.450</span></span>
        <span className="text-amp-300">12× COMBO</span>
      </div>
      <svg viewBox="0 0 560 300" fill="none" className="my-2 w-full" aria-hidden="true">
        <path d="M104 24V276" className="stroke-amp-400" strokeWidth="2" />
        <path d="M96 24H112V276H96Z" className="fill-amp-500/10" />
        {[65, 150, 235, 320, 405, 490].map((x) => <path key={x} d={`M${x} 40V268`} className="stroke-ink-700" strokeDasharray="3 7" />)}
        {[60, 98, 136, 174, 212, 250].map((y, index) => (
          <g key={y}>
            <text x="26" y={y + 4} className="fill-ink-300 font-mono text-[12px]">{['e', 'B', 'G', 'D', 'A', 'E'][index]}</text>
            <path d={`M52 ${y}H540`} className="stroke-signal-500/30" strokeWidth={1 + index * 0.25} />
          </g>
        ))}
        {[[104, 212, '5'], [104, 250, '0'], [203, 250, '0'], [271, 250, '0'], [339, 212, '7'], [339, 174, '9'], [437, 250, '0'], [505, 212, '5']].map(([x, y, fret], index) => (
          <g key={index}>
            <rect x={Number(x) - 16} y={Number(y) - 13} width="32" height="26" rx="6" className={index < 2 ? 'fill-amp-400' : 'fill-signal-300'} />
            <text x={x} y={Number(y) + 5} textAnchor="middle" className="fill-ink-950 font-mono text-[14px] font-bold">{fret}</text>
          </g>
        ))}
        <text x="104" y="22" textAnchor="middle" className="fill-amp-300 font-mono text-[10px]">TOQUE AQUI</text>
        <text x="206" y="194" className="fill-hit font-display text-[17px] font-bold">Perfeito!</text>
      </svg>
      <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-4 py-4 text-xs text-ink-300 sm:px-6">
        <span className="flex items-center gap-2"><AudioLines size={16} className="text-signal-400" /> Sua guitarra. Suas notas.</span>
        <span className="font-mono text-ink-300">01:24 / 06:36</span>
      </div>
    </div>
    <figcaption className="mt-4 text-center font-mono text-[10px] tracking-widest text-ink-300">UMA PRÉVIA DO SEU PRÓXIMO RIFF</figcaption>
  </figure>
);

const demoPart = (): GamePart => ({ tab: getDemoSong(), partId: 0 });

const soloSession = (part: GamePart, challenge: Challenge | null = null): GameSession =>
  ({ mode: 'solo', key: nextSessionKey(), part, challenge });

const duoSession = (parts: [GamePart, GamePart], names: [string, string]): GameSession =>
  ({ mode: 'duo', key: nextSessionKey(), parts, names });

const initialSession = (devScene: ReturnType<typeof readDevScene>): GameSession | null => {
  if (devScene === 'dupla' || devScene === 'dupla-resultado') {
    const demo = demoPart();
    return duoSession([demo, demo], ['Ana', 'Beto']);
  }
  if (devScene === 'resultado' || devScene === 'desafio' || new URLSearchParams(window.location.search).has('demo')) {
    return soloSession(demoPart());
  }
  return null;
};

// Drops ?desafio= from the address bar without reloading, keeping any other parameter
const clearChallengeParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete(CHALLENGE_PARAM);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
};

const LandingPitch: React.FC = () => {
  const latestPitch = useLatestPitch();
  if (!latestPitch) return null;
  return (
    <div className="text-xs font-mono text-signal-300 flex items-center justify-center gap-1.5">
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

  const [devScene] = useState(readDevScene);
  const [session, setSession] = useState<GameSession | null>(() => initialSession(devScene));
  const [devSessionKey] = useState(() => session?.key ?? null);
  const [isDuoSetupOpen, setIsDuoSetupOpen] = useState(() => devScene === 'dupla-assistente');
  // Player names while the duo picks a song in the search modal (it's in duo mode while set)
  const [duoSearchNames, setDuoSearchNames] = useState<[string, string] | null>(null);
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  const [savedSong] = useState(() => readPreferences().lastSong);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<Challenge | null>(() => readChallengeFromSearch(window.location.search));
  const [openedWithChallenge] = useState(() => pendingChallenge !== null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const songSelectionVersion = useRef(0);
  const hash = useSyncExternalStore(subscribeToHash, readHash);
  const legalRoute = useMemo(() => resolveLegalRoute(hash), [hash]);

  const sessionParts = useMemo<GamePart[]>(
    () => !session ? [] : session.mode === 'solo' ? [session.part] : session.parts,
    [session]
  );

  useEffect(() => {
    sessionParts.forEach((part, player) => audioEngine.setTuning(part.tab.tuning, player === 0 ? 0 : 1));
  }, [sessionParts, audioEngine]);

  useEffect(() => {
    // A challenge link opens on the landing card instead of jumping into the last song
    if (!savedSong || savedSong.songId === DEMO_SONG_ID || openedWithChallenge || devScene || new URLSearchParams(window.location.search).has('demo')) return;
    let cancelled = false;
    const version = songSelectionVersion.current;
    const restoreSong = async () => {
      try {
        const meta = await getSongMetadata(savedSong.songId);
        const trackIndex = meta.tracks.findIndex((track) => track.partId === savedSong.partId);
        if (trackIndex < 0) throw new Error('A faixa salva não está mais disponível.');
        const normalized = await loadSongTrack(meta, trackIndex);
        if (!cancelled && version === songSelectionVersion.current) setSession(soloSession({ tab: normalized, partId: savedSong.partId }));
      } catch (err) {
        if (!cancelled && version === songSelectionVersion.current) {
          setRestoreError(`Não foi possível restaurar a última música. ${err instanceof Error ? err.message : 'Busque uma música para continuar.'}`);
        }
      }
    };
    void restoreSong();
    return () => { cancelled = true; };
  }, [savedSong, restoreAttempt, openedWithChallenge, devScene]);

  // Duo is a session mode: leaving it restores the input channel saved in the preferences
  const soloChannelMode = () => channelMode === 'duo' ? readPreferences().channelMode : channelMode;

  const exitDuoAudio = () => {
    if (channelMode === 'duo') void handleChannelModeChange(readPreferences().channelMode);
  };

  // Solo songs connect the audio if needed, in the solo channel mode
  const ensureSoloAudio = () => {
    if (!isAudioRunning || channelMode === 'duo') void handleStartAudio(undefined, soloChannelMode());
  };

  const startDuo = (parts: [GamePart, GamePart], names: [string, string]) => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    setDefaultError(null);
    setDuoSearchNames(null);
    setSession(duoSession(parts, names));
  };

  const handleLoadDemo = () => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    setDefaultError(null);
    exitDuoAudio();
    setSession(soloSession(demoPart()));
  };

  const handleAcceptChallenge = async (challenge: Challenge) => {
    clearChallengeParam();
    songSelectionVersion.current += 1;
    const version = songSelectionVersion.current;
    setRestoreError(null);
    setDefaultError(null);
    setChallengeError(null);
    setIsLoadingChallenge(true);
    ensureSoloAudio();
    try {
      let part: GamePart;
      if (challenge.songId === DEMO_SONG_ID) {
        part = demoPart();
      } else {
        const meta = await getSongMetadata(challenge.songId);
        const trackIndex = meta.tracks.findIndex((track) => track.partId === challenge.partId);
        if (trackIndex < 0) throw new Error('A faixa deste desafio não está mais disponível no Songsterr. Escolha outra música.');
        part = { tab: await loadSongTrack(meta, trackIndex), partId: challenge.partId };
      }
      if (version !== songSelectionVersion.current) return;
      setPendingChallenge(null);
      setSession(soloSession(part, challenge));
      if (part.tab.songId !== DEMO_SONG_ID) savePreferences({ lastSong: { songId: part.tab.songId, partId: part.partId } });
    } catch (err) {
      if (version === songSelectionVersion.current) {
        setChallengeError(err instanceof Error ? err.message : 'Não foi possível carregar a música do desafio.');
      }
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  const handleDismissChallenge = () => {
    clearChallengeParam();
    setPendingChallenge(null);
    setChallengeError(null);
  };

  // Load default song (Metallica - Creeping Death)
  const handleLoadDefaultSong = async () => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    setDefaultError(null);
    setIsLoadingDefault(true);
    try {
      // Connect audio if not running
      if (!isAudioRunning || channelMode === 'duo') {
        await handleStartAudio(undefined, soloChannelMode());
      }

      const songId = 5194; // Creeping Death
      const meta = await getSongMetadata(songId);
      // Track index 3: James Hetfield Rhythm Guitar
      const trackIndex = meta.tracks.length > 3 ? 3 : 0;
      const track = meta.tracks[trackIndex];

      const normalized = await loadSongTrack(meta, trackIndex);
      setSession(soloSession({ tab: normalized, partId: track.partId }));
      savePreferences({ lastSong: { songId: meta.songId, partId: track.partId } });
    } catch (err) {
      setDefaultError(err instanceof Error ? err.message : 'Não foi possível carregar a música padrão. Busque outra música.');
    } finally {
      setIsLoadingDefault(false);
    }
  };

  return (
    <div className="h-dvh w-full overflow-hidden bg-ink-950 font-sans text-ink-100">
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
        {challengeError && pendingChallenge && (
          <ErrorNotice message={challengeError} onDismiss={() => setChallengeError(null)}
            actionLabel="Tentar novamente" onAction={() => void handleAcceptChallenge(pendingChallenge)} actionDisabled={isLoadingChallenge} />
        )}
      </div>
      {session ? (
        /* Practice mode */
        <>
          <PracticeGame
            key={session.key}
            parts={sessionParts}
            playerNames={session.mode === 'duo' ? session.names : null}
            challenge={session.mode === 'solo' ? session.challenge : null}
            devPreset={import.meta.env.DEV && devScene && session.key === devSessionKey ? gameDevPreset(devScene, Math.max(...sessionParts.map((part) => part.tab.totalDurationMs))) : null}
            onExit={() => {
              songSelectionVersion.current += 1;
              if (session.mode === 'duo') exitDuoAudio();
              setSession(null);
              window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            }}
            onOpenSearch={() => {
              setDuoSearchNames(session.mode === 'duo' ? session.names : null);
              setIsSearchOpen(true);
            }}
            onOpenAudioSettings={() => setIsSettingsOpen(true)}
            tone3000={tone3000}
            onOpenTone3000Rack={() => setIsTone3000RackOpen(true)}
          />
        </>
      ) : legalRoute ? (
        <LegalPage document={legalRoute.document} sectionId={legalRoute.sectionId} />
      ) : (
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <header className="fixed inset-x-0 top-0 z-40 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
              <BrandMark />
              <div className="flex items-center gap-3 sm:gap-6">
                <span role="status" className="flex items-center gap-2 text-xs text-ink-300">
                  <span aria-hidden="true" className={`size-2 rounded-full ${isAudioRunning ? 'bg-hit' : 'bg-ink-400'}`} />
                  <span className="hidden sm:inline">Áudio {isAudioRunning ? 'conectado' : 'desconectado'}</span>
                  <span className="sr-only sm:hidden">Áudio {isAudioRunning ? 'conectado' : 'desconectado'}</span>
                </span>
                <a href={supportHref} target="_blank" rel="noopener noreferrer" aria-label={supportLabel} className="flex min-h-11 max-w-48 items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-ink-200 transition hover:bg-ink-800 hover:text-amp-300 sm:max-w-none sm:text-sm">
                  <Heart size={16} className="shrink-0 text-amp-400" aria-hidden="true" /><span className="sm:hidden">Apoiar</span><span className="hidden sm:inline">{supportLabel}</span>
                </a>
              </div>
            </div>
          </header>

          <main id="main-content" className="pt-20">
            <section aria-labelledby="hero-title" className="relative isolate mx-auto max-w-7xl px-5 pb-14 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-20 lg:pt-24">
              <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-0 -z-10 size-96 rounded-full bg-amp-500/5 blur-3xl" />
              {pendingChallenge && (
                <ChallengeCard challenge={pendingChallenge} isLoading={isLoadingChallenge}
                  onAccept={() => void handleAcceptChallenge(pendingChallenge)} onDismiss={handleDismissChallenge} />
              )}
              <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
                <div>
                  <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amp-500/25 bg-amp-500/5 px-3 py-1.5 text-xs font-medium text-amp-300">
                    <span className="size-1.5 rounded-full bg-amp-400" aria-hidden="true" /> Grátis. Sem instalar. Só tocar.
                  </p>
                  <h1 id="hero-title" className="max-w-2xl font-display text-[2.75rem] leading-[1.08] font-bold tracking-[-0.045em] sm:text-6xl lg:text-[4.25rem]">
                    Guitarra de verdade.<br /><span className="text-amp-400">Direto no navegador.</span>
                  </h1>
                  <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-300 sm:text-lg">
                    Conecte sua guitarra, encontre seu timbre e toque suas músicas favoritas. Cada nota é um passo no seu próximo riff.
                  </p>
                  <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
                    <button onClick={() => void handleLoadDefaultSong()} disabled={isLoadingDefault} aria-busy={isLoadingDefault}
                      className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl bg-amp-400 px-6 py-3 text-ink-950 shadow-glow-amp transition hover:bg-amp-300 disabled:cursor-wait disabled:opacity-70">
                      {isLoadingDefault ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <Play size={22} className="fill-current" aria-hidden="true" />}
                      <span className="text-left"><span className="block text-base font-bold">{isLoadingDefault ? 'Carregando música…' : 'Tocar agora'}</span><span className="mt-0.5 block text-xs font-medium">Creeping Death - Metallica</span></span>
                    </button>
                    <button onClick={() => {
                      ensureSoloAudio();
                      setIsSearchOpen(true);
                    }} className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900 px-6 py-3 text-sm font-semibold text-ink-100 transition hover:border-ink-400 hover:bg-ink-800">
                      <Music size={18} aria-hidden="true" /> Buscar música
                    </button>
                    <button onClick={handleLoadDemo} className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl border border-signal-500/30 bg-signal-500/5 px-5 py-3 text-signal-300 transition hover:bg-signal-500/10">
                      <Play size={18} aria-hidden="true" /><span className="text-left"><span className="block text-sm font-bold">Experimentar demo</span><span className="mt-1 block text-xs text-ink-300">Exercício offline - ~20 s</span></span>
                    </button>
                    <button onClick={() => setIsDuoSetupOpen(true)} className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl border border-ink-600 bg-ink-900 px-5 py-3 text-ink-100 transition hover:border-ink-400 hover:bg-ink-800">
                      <Users size={18} className="text-amp-300" aria-hidden="true" /><span className="text-left"><span className="block text-sm font-bold">Jogar em dupla</span><span className="mt-1 block text-xs text-ink-300">Duas guitarras, um computador</span></span>
                    </button>
                  </div>
                  <p className="mt-5 flex items-center gap-2 text-xs text-ink-300"><Check size={14} className="text-hit" aria-hidden="true" /> Sem cadastro. O palco é seu.</p>
                </div>
                <PracticePreview />
              </div>

              <div aria-label="Controles de áudio" className="mt-12 grid divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-panel sm:mt-16 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <button onClick={() => void handleStartAudio()} disabled={isAudioRunning} className="group flex min-h-24 cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-ink-800 disabled:cursor-default">
                  <PlugZap size={23} className={isAudioRunning ? 'text-hit' : 'text-amp-400'} aria-hidden="true" />
                  <span className="flex-1"><span className="block text-sm font-semibold">{isAudioRunning ? 'Guitarra conectada' : 'Conectar guitarra'}</span><span className="mt-1 block text-xs text-ink-300">{isAudioRunning ? 'Entrada de áudio ativa' : 'Interface não conectada'}</span></span>
                  <span aria-hidden="true" className={`size-2 rounded-full ${isAudioRunning ? 'bg-hit' : 'bg-ink-400'}`} />
                </button>
                <button onClick={() => setIsSettingsOpen(true)} className="flex min-h-24 cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-ink-800">
                  <Sliders size={23} className="text-signal-400" aria-hidden="true" />
                  <span className="flex-1"><span className="block text-sm font-semibold">Entrada & afinador</span><span className="mt-1 block text-xs text-ink-300">Tudo pronto para afinar</span></span><ArrowUpRight size={16} className="text-ink-300" aria-hidden="true" />
                </button>
                <button onClick={() => {
                  if (!isAudioRunning) void handleStartAudio();
                  setIsTone3000RackOpen(true);
                }} className="flex min-h-24 cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-ink-800">
                  <Zap size={23} className="text-amp-400" aria-hidden="true" />
                  <span className="flex-1"><span className="block text-sm font-semibold">Timbre do amp</span><span className="mt-1 block text-xs text-ink-300">Motor TONE3000</span></span><ArrowUpRight size={16} className="text-ink-300" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4"><LandingPitch /></div>
            </section>

            <LocalRecords />

            <section aria-labelledby="features-title" className="border-y border-ink-700/70 bg-ink-900/50">
              <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
                <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div><p className="mb-3 font-mono text-xs tracking-[0.16em] text-amp-300">SEU SETUP, SIMPLIFICADO</p><h2 id="features-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Menos ajustes. Mais música.</h2></div>
                  <p className="max-w-xs text-sm leading-relaxed text-ink-300">Do primeiro acorde ao riff que não sai da cabeça. Tudo no mesmo lugar.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { icon: Zap, label: '01 / TIMBRE', title: 'O calor das válvulas.', description: 'Amp valvulado em tempo real com TONE3000. Ajuste o ganho, o gabinete e o reverb até encontrar o seu som.', detail: 'TONE3000 · Amp + gabinete + reverb', color: 'text-amp-300', surface: 'bg-amp-500/10 border-amp-500/20' },
                    { icon: AudioLines, label: '02 / ENTRADA', title: 'Plugue. Afine. Toque.', description: 'Escolha sua interface e use o afinador integrado. Entrada de baixa latência para acompanhar cada movimento da palheta.', detail: 'Sua guitarra no centro de tudo', color: 'text-signal-300', surface: 'bg-signal-500/10 border-signal-500/20' },
                    { icon: Target, label: '03 / PRÁTICA', title: 'Cada nota conta.', description: 'Acompanhe as tablaturas, acerte as notas e construa seu combo. Perfeito, Bom ou Errou: veja seu progresso enquanto toca.', detail: 'Tablaturas e metadados via Songsterr', color: 'text-hit', surface: 'bg-hit/10 border-hit/20' }
                  ].map(({ icon: Icon, label, title, description, detail, color, surface }) => (
                    <article key={label} className="flex flex-col rounded-2xl border border-ink-700 bg-ink-850 p-6 sm:p-7">
                      <span className={`mb-7 flex size-12 items-center justify-center rounded-xl border ${color} ${surface}`}><Icon size={24} aria-hidden="true" /></span>
                      <p className={`mb-3 font-mono text-[10px] tracking-widest ${color}`}>{label}</p>
                      <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
                      <p className="mt-3 mb-6 flex-1 text-sm leading-7 text-ink-300">{description}</p>
                      <p className="border-t border-ink-700 pt-4 text-xs text-ink-300">{detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section aria-labelledby="steps-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
              <p className="mb-3 font-mono text-xs tracking-[0.16em] text-amp-300">COMO FUNCIONA</p>
              <h2 id="steps-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Do cabo ao primeiro riff.</h2>
              <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
                {[
                  { icon: PlugZap, title: 'Plugue a interface', description: 'Conecte a guitarra à sua interface USB e permita o acesso ao áudio no navegador.' },
                  { icon: Music, title: 'Escolha a música', description: 'Comece com Metallica ou busque sua próxima música nas tablaturas do Songsterr.' },
                  { icon: Headphones, title: 'Dê o play. Toque.', description: 'Coloque os fones, ajuste seu timbre e siga as notas. Repita aquele trecho até sair.' }
                ].map(({ icon: Icon, title, description }, index) => (
                  <li key={title} className="relative border-t border-ink-600 pt-6">
                    <div className="mb-5 flex items-center justify-between"><span className="font-display text-4xl font-medium text-amp-300">0{index + 1}</span><Icon size={22} className="text-ink-300" aria-hidden="true" /></div>
                    <h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-7 text-ink-300">{description}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-14 flex flex-col items-start justify-between gap-5 rounded-2xl border border-amp-500/20 bg-amp-500/5 p-6 sm:flex-row sm:items-center sm:p-8">
                <div><p className="font-display text-xl font-bold">Feito para quem quer tocar.</p><p className="mt-2 text-sm text-ink-300">PRGB é grátis. Seu apoio ajuda o projeto a seguir em frente.</p></div>
                <a href={supportHref} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg py-2 text-sm font-semibold text-amp-300 hover:text-amp-200"><Heart size={17} className="shrink-0" aria-hidden="true" /><span>{supportLabel}</span><ArrowRight size={16} className="shrink-0" aria-hidden="true" /></a>
              </div>
            </section>
          </main>

          <footer className="border-t border-ink-700 bg-ink-900">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 lg:px-12">
              <div className="flex flex-wrap items-center justify-between gap-4"><BrandMark size={28} /><span className="font-mono text-[10px] tracking-widest text-ink-300">PLAY REAL GUITAR IN BROWSER</span></div>
              <p className="max-w-3xl text-xs leading-6 text-ink-300">Tablaturas e metadados via Songsterr. PRGB não é afiliado ao Songsterr, Metallica ou outros artistas; todas as marcas pertencem aos seus donos.</p>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-5 text-xs text-ink-300">
                <span>© {currentYear} PRGB</span>
                <nav aria-label="Documentos legais" className="flex gap-5">
                  <a href="#privacidade" className="rounded py-2 hover:text-amp-300">Privacidade</a>
                  <a href="#termos" className="rounded py-2 hover:text-amp-300">Termos</a>
                </nav>
                <a href={supportHref} target="_blank" rel="noopener noreferrer" className="rounded py-2 hover:text-amp-300">{supportLabel} ↗</a>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Songsterr Search Modal */}
      <SongSearchModal
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          // Gave up picking a duo song from the landing: back to the solo input
          if (duoSearchNames && session?.mode !== 'duo') exitDuoAudio();
          setDuoSearchNames(null);
        }}
        duoNames={duoSearchNames}
        onChooseMode={(mode) => {
          if (mode === 'solo') {
            setDuoSearchNames(null);
          } else if (!duoSearchNames) {
            // The duo needs its connection check and names first
            setIsSearchOpen(false);
            setIsDuoSetupOpen(true);
          }
        }}
        onSelectDuo={(parts) => startDuo(parts, duoSearchNames ?? DEFAULT_PLAYER_NAMES)}
        onSelectSong={(tab, song) => {
          songSelectionVersion.current += 1;
          setRestoreError(null);
          setDefaultError(null);
          ensureSoloAudio();
          setSession(soloSession({ tab, partId: song.partId }));
          if (song.songId !== DEMO_SONG_ID) savePreferences({ lastSong: song });
        }}
      />

      {isDuoSetupOpen && (
        <DuoSetupModal
          onCancel={() => {
            setIsDuoSetupOpen(false);
            if (session?.mode !== 'duo') exitDuoAudio();
          }}
          onPlayDemo={(names) => {
            setIsDuoSetupOpen(false);
            const demo = demoPart();
            startDuo([demo, demo], names);
          }}
          onSearchSong={(names) => {
            setIsDuoSetupOpen(false);
            setDuoSearchNames(names);
            setIsSearchOpen(true);
          }}
        />
      )}

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
