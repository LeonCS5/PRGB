import React, { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Music,
  Play,
  Sliders,
  ArrowRight,
  AudioLines,
  Check,
  Guitar,
  Heart,
  Headphones,
  PlugZap,
  Target,
  UserRound,
  Volume2,
  Zap,
  Users,
  Wifi,
  X,
  MessageSquareWarning,
  type LucideIcon
} from 'lucide-react';
import { getDemoSong, DEMO_SONG_ID } from './services/demoSong';
import { ErrorNotice } from './components/ErrorNotice';
import { ChallengeCard } from './components/ChallengeCard';
import { LocalRecords } from './components/LocalRecords';
import { DuoSetupModal } from './components/DuoSetupModal';
import { LegalPage } from './components/LegalPage';
import { readHash, resolveLegalRoute, subscribeToHash } from './context/legalRoute';
import { consumeLocalDataCleared } from './context/localData';
import { gameDevPreset, readDevScene } from './components/devScenes';
import { rankingDevSetup } from './components/devRanking';
import { RankingModals } from './components/RankingModals';
import { CHALLENGE_PARAM, readChallengeFromSearch, type Challenge } from './services/challenge';
import { BrandMark } from './components/BrandMark';
import { getSongMetadata, loadSongTrack } from './context/uiErrors';
import { PracticeGame } from './components/PracticeGame';
import { FreePlay } from './components/FreePlay';
import { OnlinePracticeGame } from './components/OnlinePracticeGame';
import { RoomModal } from './components/RoomModal';
import { SongSearchModal } from './components/SongSearchModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { AmpRack } from './components/AmpRack';
import { AudioSessionProvider, useAudioSession, useLatestPitch } from './context/AudioSessionContext';
import { ModalsProvider, useModals } from './context/ModalsContext';
import { FeedbackModal } from './components/FeedbackModal';
import { StorageNotice } from './components/StorageNotice';
import { LEGAL_CONTACT } from './content/legal';
import { AudioChip, HeaderNav, TabBar } from './components/SiteNav';
import { readPreferences, savePreferences } from './context/preferences';
import { DEFAULT_PLAYER_NAMES, nextSessionKey, type GamePart, type GameSession, type RankedStart, type SoloSession } from './context/gameSession';
import { RankingProvider } from './context/RankingProvider';
import { RoomProvider } from './context/RoomProvider';
import { useRanking } from './context/ranking';
import { useRoom } from './context/useRoom';

const supportUrl = import.meta.env.VITE_SUPPORT_URL?.trim();
const supportHref = supportUrl || 'https://github.com/LeonCS5/PRGB';
const supportLabel = supportUrl ? 'Apoie o projeto' : 'Apoie com uma estrela no GitHub';
const SITE_TITLE = 'PRGB · Toque guitarra de verdade no navegador'; // same as index.html
const currentYear = new Date().getFullYear();
// Read once per page load (erasing local data reloads the page to confirm it here)
const localDataWasCleared = consumeLocalDataCleared();

const PracticePreview: React.FC = () => (
  <figure className="relative min-w-0 lg:-mr-8" aria-label="Ilustração do modo de prática: seis cordas, notas e pontuação em tempo real">
    <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-signal-500/5 blur-3xl" />
    <div className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-ink-700 bg-ink-850 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border border-amp-500/25 bg-amp-500/10 text-amp-400"><Guitar size={20} /></span>
          <div><p className="text-sm font-bold text-ink-100">Exercício PRGB</p><p className="mt-1 text-xs text-ink-300">Pentatônica · Guitarra</p></div>
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

const demoPart = (): GamePart => ({ tab: getDemoSong(), partId: 0, revisionId: null });

// The demo has a single part (0): a demo challenge for any other part can't be played, so it's
// ignored like any other invalid link
const readValidChallenge = (): Challenge | null => {
  const challenge = readChallengeFromSearch(window.location.search);
  return challenge && challenge.songId === DEMO_SONG_ID && challenge.partId !== 0 ? null : challenge;
};

const soloSession = (part: GamePart, challenge: Challenge | null = null, rankedStart: RankedStart | null = null): GameSession =>
  ({ mode: 'solo', key: nextSessionKey(), part, challenge, rankedStart });

const duoSession = (parts: [GamePart, GamePart], names: [string, string]): GameSession =>
  ({ mode: 'duo', key: nextSessionKey(), parts, names });

const initialSession = (devScene: ReturnType<typeof readDevScene>): GameSession | null => {
  if (devScene === 'dupla' || devScene === 'dupla-resultado') {
    const demo = demoPart();
    return duoSession([demo, demo], ['Ana', 'Beto']);
  }
  if (devScene === 'ranking-partida') return soloSession(demoPart(), null, 'on');
  if (devScene === 'resultado' || devScene === 'desafio' || devScene === 'ranking-resultado' || new URLSearchParams(window.location.search).has('demo')) {
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

// An entry in the browser's history marks each screen above the landing, so going back leaves the game and not the site
const isScreenEntry = (): boolean => (window.history.state as { prgbScreen?: boolean } | null)?.prgbScreen === true;

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

const AMP_TONE = 'border-amp-500/25 bg-amp-500/10 text-amp-300';
const SIGNAL_TONE = 'border-signal-500/25 bg-signal-500/10 text-signal-300';
const HIT_TONE = 'border-hit/25 bg-hit/10 text-hit';

interface ActionRowProps {
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ icon: Icon, tone, title, description, disabled = false, onClick }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="group flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-left transition enabled:hover:border-ink-500 enabled:hover:bg-ink-800 disabled:cursor-default">
    <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}><Icon size={21} aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink-100">{title}</span><span className="mt-0.5 block text-xs text-ink-300">{description}</span></span>
    {!disabled && <ArrowRight size={16} className="shrink-0 text-ink-300 transition group-hover:text-amp-300" aria-hidden="true" />}
  </button>
);

const AppContent: React.FC = () => {
  const {
    audioEngine,
    ampEngine,
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
    isAmpRackOpen,
    isFeedbackOpen,
    setSearchOpen: setIsSearchOpen,
    setSettingsOpen: setIsSettingsOpen,
    setAmpRackOpen: setIsAmpRackOpen,
    setFeedbackOpen: setIsFeedbackOpen
  } = useModals();
  const { isConfigured: isRankingOn, hasAccount, openAccount, openLeaderboard } = useRanking();
  const { leaveRoom } = useRoom();
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isFreePlayOpen, setIsFreePlayOpen] = useState(false);
  const [onlineSession, setOnlineSession] = useState<{ part: GamePart; partnerName: string; startAtMs: number; sessionKey: number } | null>(null);

  const [devScene] = useState(readDevScene);
  const [session, setSession] = useState<GameSession | null>(() => initialSession(devScene));
  const [devSessionKey] = useState(() => session?.key ?? null);
  const [isDuoSetupOpen, setIsDuoSetupOpen] = useState(() => devScene === 'dupla-assistente');
  // Player names while the duo picks a song in the search modal (it's in duo mode while set)
  const [duoSearchNames, setDuoSearchNames] = useState<[string, string] | null>(null);
  const [savedSong] = useState(() => readPreferences().lastSong);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [pendingChallenge, setPendingChallenge] = useState<Challenge | null>(readValidChallenge);
  const [openedWithChallenge] = useState(() => pendingChallenge !== null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [showClearedNotice, setShowClearedNotice] = useState(localDataWasCleared);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const songSelectionVersion = useRef(0);
  const hash = useSyncExternalStore(subscribeToHash, readHash);
  const legalRoute = useMemo(() => resolveLegalRoute(hash), [hash]);
  const [openedOnLegalPage] = useState(() => legalRoute !== null);

  const sessionParts = useMemo<GamePart[]>(
    () => !session ? [] : session.mode === 'solo' ? [session.part] : session.parts,
    [session]
  );

  useEffect(() => {
    sessionParts.forEach((part, player) => audioEngine.setTuning(part.tab.tuning, player === 0 ? 0 : 1));
  }, [sessionParts, audioEngine]);

  useEffect(() => {
    // A challenge link opens on the landing card instead of jumping into the last song, and a legal page
    // (the consent form opens them in a new tab) stays on screen while it is being read
    if (!savedSong || savedSong.songId === DEMO_SONG_ID || openedWithChallenge || openedOnLegalPage || devScene || new URLSearchParams(window.location.search).has('demo')) return;
    let cancelled = false;
    const version = songSelectionVersion.current;
    const restoreSong = async () => {
      try {
        const meta = await getSongMetadata(savedSong.songId);
        const trackIndex = meta.tracks.findIndex((track) => track.partId === savedSong.partId);
        if (trackIndex < 0) throw new Error('A faixa salva não está mais disponível.');
        const normalized = await loadSongTrack(meta, trackIndex);
        if (!cancelled && version === songSelectionVersion.current) setSession(soloSession({ tab: normalized, partId: savedSong.partId, revisionId: meta.revisionId }));
      } catch (err) {
        if (!cancelled && version === songSelectionVersion.current) {
          setRestoreError(`Não foi possível restaurar a última música. ${err instanceof Error ? err.message : 'Busque uma música para continuar.'}`);
        }
      }
    };
    void restoreSong();
    return () => { cancelled = true; };
  }, [savedSong, restoreAttempt, openedWithChallenge, openedOnLegalPage, devScene]);

  const screen = onlineSession ? 'sala' : isFreePlayOpen ? 'play_free' : session ? 'jogo' : 'inicio';
  const isOnScreen = screen !== 'inicio';
  const wasOnScreen = useRef(false);

  useEffect(() => {
    if (isOnScreen && !isScreenEntry()) {
      // Whatever the address carried (?demo) belongs to the screen, so the landing's own entry drops it
      const address = window.location.href;
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
      window.history.pushState({ prgbScreen: true }, '', address);
    } else if (!isOnScreen && wasOnScreen.current && isScreenEntry()) {
      window.history.back(); // closed by a button: the entry would turn into a back press that does nothing
    }
    wasOnScreen.current = isOnScreen;
  }, [isOnScreen]);

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
    setDuoSearchNames(null);
    setSession(duoSession(parts, names));
  };

  const leaveGame = () => {
    songSelectionVersion.current += 1;
    if (session?.mode === 'duo') exitDuoAudio();
    setSession(null);
  };

  const closeScreen = useEffectEvent(() => {
    if (onlineSession) {
      void leaveRoom();
      setOnlineSession(null);
    } else if (isFreePlayOpen) {
      setIsFreePlayOpen(false);
    } else {
      leaveGame();
    }
  });

  useEffect(() => {
    if (!isOnScreen) return;
    const onPopState = () => {
      if (!isScreenEntry()) closeScreen();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isOnScreen]);

  const handleOpenFreePlay = () => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    ensureSoloAudio();
    setIsFreePlayOpen(true);
  };

  const handleOpenSearch = () => {
    ensureSoloAudio();
    setIsSearchOpen(true);
  };

  const handleOpenAudio = () => {
    if (!isAudioRunning) void handleStartAudio();
    setIsSettingsOpen(true);
  };

  // Every player can reach the exercise, so its board is the one all of them share
  const handleOpenRanking = () => {
    const { title, trackName } = getDemoSong();
    openLeaderboard({ songId: DEMO_SONG_ID, partId: 0, title, trackName });
  };

  const handleLoadDemo = () => {
    songSelectionVersion.current += 1;
    setRestoreError(null);
    exitDuoAudio();
    setSession(soloSession(demoPart()));
  };

  const handleAcceptChallenge = async (challenge: Challenge) => {
    clearChallengeParam();
    songSelectionVersion.current += 1;
    const version = songSelectionVersion.current;
    setRestoreError(null);
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
        if (trackIndex < 0) throw new Error('A faixa deste desafio não está mais disponível. Escolha outra música.');
        part = { tab: await loadSongTrack(meta, trackIndex), partId: challenge.partId, revisionId: meta.revisionId };
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

  // The server counted a newer revision of this tab: a ranked run needs that one, so the game remounts with it
  const reloadOutdatedPart = async ({ part, challenge }: SoloSession): Promise<string | null> => {
    songSelectionVersion.current += 1;
    const version = songSelectionVersion.current;
    const { tab, partId } = part;
    try {
      const meta = await getSongMetadata(tab.songId);
      const trackIndex = meta.tracks.findIndex((track) => track.partId === partId);
      if (trackIndex < 0) return 'Esta faixa não está mais disponível. Escolha outra música.';
      const reloaded = await loadSongTrack(meta, trackIndex);
      if (version === songSelectionVersion.current) {
        setSession(soloSession({ tab: reloaded, partId, revisionId: meta.revisionId }, challenge, 'reloaded'));
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível recarregar a tablatura. Tente novamente.';
    }
  };

  const navProps = {
    isAudioRunning,
    onPlay: handleLoadDemo,
    onSearch: handleOpenSearch,
    onAudio: handleOpenAudio,
    onRanking: isRankingOn ? handleOpenRanking : null
  };

  const pageName = onlineSession ? 'Dupla online' : isFreePlayOpen ? 'Play Free' : session ? sessionParts[0].tab.title : legalRoute?.document.title;

  return (
    <div className="h-dvh w-full overflow-hidden bg-ink-950 font-sans text-ink-100">
      <title>{pageName ? `${pageName} · PRGB` : SITE_TITLE}</title>
      <div className="fixed inset-x-4 top-4 z-[100] mx-auto max-h-[50vh] max-w-xl space-y-3 overflow-y-auto">
        {audioError && (
          <ErrorNotice message={audioError} onDismiss={dismissAudioError}
            actionLabel="Abrir configurações de áudio" onAction={() => {
              setIsSearchOpen(false);
              setIsAmpRackOpen(false);
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
        {showClearedNotice && (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-hit/40 bg-ink-900 p-4 text-sm text-ink-100 shadow-panel">
            <Check size={20} className="shrink-0 text-hit" aria-hidden="true" />
            <p className="flex-1">Seus dados locais foram apagados.</p>
            <button type="button" onClick={() => setShowClearedNotice(false)} aria-label="Dispensar aviso"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-ink-800">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {challengeError && pendingChallenge && (
          <ErrorNotice message={challengeError} onDismiss={() => setChallengeError(null)}
            actionLabel="Tentar novamente" onAction={() => void handleAcceptChallenge(pendingChallenge)} actionDisabled={isLoadingChallenge} />
        )}
      </div>
      {onlineSession ? (
        <OnlinePracticeGame
          key={onlineSession.sessionKey}
          myPart={onlineSession.part}
          partnerName={onlineSession.partnerName}
          startAtMs={onlineSession.startAtMs}
          onExit={() => setOnlineSession(null)}
          onBackToRoom={() => {
            setOnlineSession(null);
            setIsRoomModalOpen(true);
          }}
          onOpenAudioSettings={() => setIsSettingsOpen(true)}
          ampEngine={ampEngine}
          onOpenAmpRack={() => setIsAmpRackOpen(true)}
        />
      ) : isFreePlayOpen ? (
        <FreePlay onExit={() => setIsFreePlayOpen(false)} onOpenAudioSettings={() => setIsSettingsOpen(true)}
          onOpenAmpRack={() => setIsAmpRackOpen(true)} />
      ) : session ? (
        /* Practice mode */
        <>
          <PracticeGame
            key={session.key}
            parts={sessionParts}
            playerNames={session.mode === 'duo' ? session.names : null}
            challenge={session.mode === 'solo' ? session.challenge : null}
            devPreset={import.meta.env.DEV && devScene && session.key === devSessionKey ? gameDevPreset(devScene, Math.max(...sessionParts.map((part) => part.tab.totalDurationMs))) : null}
            onExit={leaveGame}
            onOpenSearch={() => {
              setDuoSearchNames(session.mode === 'duo' ? session.names : null);
              setIsSearchOpen(true);
            }}
            onOpenAudioSettings={() => setIsSettingsOpen(true)}
            ampEngine={ampEngine}
            onOpenAmpRack={() => setIsAmpRackOpen(true)}
            rankedStart={session.mode === 'solo' ? session.rankedStart : null}
            onRankedTabOutdated={session.mode === 'solo' ? () => reloadOutdatedPart(session) : undefined}
          />
        </>
      ) : legalRoute ? (
        <LegalPage document={legalRoute.document} sectionId={legalRoute.sectionId} />
      ) : (
        <div className="h-full scroll-smooth overflow-y-auto overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] motion-reduce:scroll-auto lg:pb-0">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink-800 focus:px-3 focus:py-2 focus:text-sm">Pular para o conteúdo</a>
          <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
              <div className="flex items-center gap-4 lg:gap-8">
                <BrandMark size={32} />
                <HeaderNav {...navProps} />
              </div>
              <div className="flex items-center gap-1 lg:gap-2">
                <span role="status" className="sr-only">Áudio {isAudioRunning ? 'conectado' : 'desconectado'}</span>
                <AudioChip isAudioRunning={isAudioRunning} onAudio={handleOpenAudio} />
                {isRankingOn && (
                  <button type="button" onClick={openAccount} aria-label={hasAccount ? 'Minha conta do ranking' : 'Entrar no ranking'}
                    className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-200 transition hover:bg-ink-800 hover:text-amp-300">
                    <UserRound size={18} className="shrink-0 text-amp-400" aria-hidden="true" /><span className="hidden xl:inline">{hasAccount ? 'Minha conta' : 'Entrar'}</span>
                  </button>
                )}
                <a href={supportHref} target="_blank" rel="noopener noreferrer" title={supportLabel} className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-200 transition hover:bg-ink-800 hover:text-amp-300">
                  <Heart size={18} className="shrink-0 text-amp-400" aria-hidden="true" /><span className="sr-only xl:not-sr-only">Apoiar</span>
                </a>
              </div>
            </div>
          </header>
          <TabBar {...navProps} />
          <StorageNotice />

          <main id="main-content" className="scroll-mt-16">
            <section aria-labelledby="hero-title" className="relative isolate mx-auto max-w-7xl px-5 pb-10 pt-8 sm:px-8 sm:pt-12 lg:px-12 lg:pb-14">
              <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-0 -z-10 size-96 rounded-full bg-amp-500/5 blur-3xl" />
              {pendingChallenge && (
                <ChallengeCard challenge={pendingChallenge} isLoading={isLoadingChallenge}
                  onAccept={() => void handleAcceptChallenge(pendingChallenge)} onDismiss={handleDismissChallenge} />
              )}
              <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amp-500/25 bg-amp-500/5 px-3 py-1.5 text-xs font-medium text-amp-300">
                    <span className="size-1.5 rounded-full bg-amp-400" aria-hidden="true" /> Grátis. Sem instalar. Só tocar.
                  </p>
                  <h1 id="hero-title" className="max-w-2xl font-display text-[2.5rem] leading-[1.08] font-bold tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-[2.75rem] xl:text-[3.5rem]">
                    Guitarra de verdade.<br /><span className="text-amp-400">Direto no navegador.</span>
                  </h1>
                  <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-300 sm:text-lg">
                    Conecte sua guitarra, encontre seu timbre e toque suas músicas favoritas. Cada nota é um passo no seu próximo riff.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={handleLoadDemo}
                      className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl bg-amp-400 px-6 py-3 text-ink-950 shadow-glow-amp transition hover:bg-amp-300">
                      <Play size={22} className="fill-current" aria-hidden="true" />
                      <span className="text-left"><span className="block text-base font-bold">Tocar agora</span><span className="mt-0.5 block text-xs font-medium">Exercício original · ~20 s</span></span>
                    </button>
                    <button type="button" onClick={handleOpenSearch} className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900 px-6 py-3 text-sm font-semibold text-ink-100 transition hover:border-ink-400 hover:bg-ink-800">
                      <Music size={18} aria-hidden="true" /> Buscar música
                    </button>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-xs text-ink-300"><Check size={14} className="text-hit" aria-hidden="true" /> Sem cadastro para tocar. O ranking é opcional.</p>
                </div>
                <div className="hidden min-w-0 lg:block"><PracticePreview /></div>
              </div>
            </section>

            <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:pb-16">
              <section id="modos" aria-labelledby="modes-title" className="scroll-mt-20">
                <h2 id="modes-title" className="font-display text-2xl font-bold tracking-tight">Modos de jogo</h2>
                <div className="mt-4 grid gap-3">
                  <ActionRow icon={Guitar} tone={AMP_TONE} title="Play Free" description="Só ouvir a guitarra e ver as notas" onClick={handleOpenFreePlay} />
                  <ActionRow icon={Users} tone={AMP_TONE} title="Jogar em dupla" description="Duas guitarras, um computador" onClick={() => setIsDuoSetupOpen(true)} />
                  {isRankingOn && <ActionRow icon={Wifi} tone={SIGNAL_TONE} title="Dupla online" description="Toque junto a distância" onClick={() => setIsRoomModalOpen(true)} />}
                </div>
              </section>

              <section aria-labelledby="setup-title">
                <h2 id="setup-title" className="font-display text-2xl font-bold tracking-tight">Prepare a guitarra</h2>
                <div className="mt-4 grid gap-3">
                  <ActionRow icon={PlugZap} tone={isAudioRunning ? HIT_TONE : AMP_TONE} title={isAudioRunning ? 'Guitarra conectada' : 'Conectar guitarra'}
                    description={isAudioRunning ? 'Entrada de áudio ativa' : 'Interface não conectada'} disabled={isAudioRunning} onClick={() => void handleStartAudio()} />
                  <ActionRow icon={Sliders} tone={SIGNAL_TONE} title="Áudio e afinador" description="Entrada, saída, buffer e latência" onClick={() => setIsSettingsOpen(true)} />
                  <ActionRow icon={Zap} tone={AMP_TONE} title="Timbre do amp" description="Motor PRGB Amp" onClick={() => {
                    if (!isAudioRunning) void handleStartAudio();
                    setIsAmpRackOpen(true);
                  }} />
                </div>
                <div className="mt-3"><LandingPitch /></div>
              </section>
            </div>

            <LocalRecords />

            <div className="mx-auto max-w-2xl px-5 pb-12 sm:px-8 lg:hidden"><PracticePreview /></div>

            <section aria-labelledby="features-title" className="border-y border-ink-700/70 bg-ink-900/50">
              <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
                <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div><p className="mb-2 font-mono text-xs tracking-[0.16em] text-amp-300">SEU SETUP, SIMPLIFICADO</p><h2 id="features-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Menos ajustes. Mais música.</h2></div>
                  <p className="max-w-xs text-sm leading-relaxed text-ink-300">Do primeiro acorde ao riff que não sai da cabeça. Tudo no mesmo lugar.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                  {[
                    { icon: Zap, label: '01 / TIMBRE', title: 'Encontre o seu timbre.', description: 'Simulador de amplificador em tempo real, o PRGB Amp. Ajuste o ganho, o gabinete e o reverb até achar o seu som.', detail: 'PRGB Amp · Simulador + gabinete + reverb', color: 'text-amp-300', surface: 'bg-amp-500/10 border-amp-500/20' },
                    { icon: AudioLines, label: '02 / ENTRADA', title: 'Plugue. Afine. Toque.', description: 'Escolha sua interface, monte a rota de áudio e use o afinador integrado. A latência depende do seu navegador e do seu equipamento.', detail: 'Sua guitarra no centro de tudo', color: 'text-signal-300', surface: 'bg-signal-500/10 border-signal-500/20' },
                    { icon: Target, label: '03 / PRÁTICA', title: 'Cada nota conta.', description: 'Acompanhe as tablaturas, acerte as notas e construa seu combo. Perfeito, Bom ou Errou: veja seu progresso enquanto toca.', detail: 'Exercício próprio e busca em acervo externo', color: 'text-hit', surface: 'bg-hit/10 border-hit/20' }
                  ].map(({ icon: Icon, label, title, description, detail, color, surface }) => (
                    <article key={label} className="grid grid-cols-[auto_1fr] items-center gap-x-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:p-6 md:grid-rows-[auto_auto_1fr_auto]">
                      <span className={`flex size-10 items-center justify-center rounded-xl border ${color} ${surface}`}><Icon size={20} aria-hidden="true" /></span>
                      <p className={`hidden font-mono text-[10px] tracking-widest md:block ${color}`}>{label}</p>
                      <h3 className="font-display text-xl font-bold tracking-tight md:col-span-2 md:mt-4">{title}</h3>
                      <p className="col-span-2 mt-2 self-start text-sm leading-6 text-ink-300 md:mb-4">{description}</p>
                      <p className="col-span-2 hidden border-t border-ink-700 pt-3 text-xs text-ink-300 md:block">{detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section aria-labelledby="steps-title" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
              <p className="mb-2 font-mono text-xs tracking-[0.16em] text-amp-300">COMO FUNCIONA</p>
              <h2 id="steps-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Do cabo ao primeiro riff.</h2>
              <ol className="mt-7 grid gap-6 md:grid-cols-3 md:gap-10">
                {[
                  { icon: PlugZap, title: 'Plugue a interface', description: 'Conecte a guitarra à sua interface USB e permita o acesso ao áudio no navegador.' },
                  { icon: Music, title: 'Escolha a música', description: 'Comece pelo exercício do PRGB ou busque sua próxima música no acervo.' },
                  { icon: Headphones, title: 'Dê o play. Toque.', description: 'Coloque os fones, ajuste seu timbre e siga as notas. Repita aquele trecho até sair.' }
                ].map(({ icon: Icon, title, description }, index) => (
                  <li key={title} className="relative border-t border-ink-600 pt-4">
                    <div className="mb-2 flex items-center justify-between"><span className="font-display text-2xl font-medium text-amp-300">0{index + 1}</span><Icon size={20} className="text-ink-300" aria-hidden="true" /></div>
                    <h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-ink-300">{description}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-amp-500/20 bg-amp-500/5 p-5 sm:flex-row sm:items-center sm:p-7">
                <div><p className="font-display text-xl font-bold">Feito para quem quer tocar.</p><p className="mt-2 text-sm text-ink-300">PRGB é grátis. Seu apoio ajuda o projeto a seguir em frente.</p></div>
                <a href={supportHref} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg py-2 text-sm font-semibold text-amp-300 hover:text-amp-200"><Heart size={17} className="shrink-0" aria-hidden="true" /><span>{supportLabel}</span><ArrowRight size={16} className="shrink-0" aria-hidden="true" /></a>
              </div>
            </section>
          </main>

          <footer className="border-t border-ink-700 bg-ink-900">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 lg:px-12">
              <div className="flex flex-wrap items-center justify-between gap-4"><BrandMark size={28} /><span className="font-mono text-[10px] tracking-widest text-ink-300">PLAY REAL GUITAR IN BROWSER</span></div>
              <p className="max-w-3xl text-xs leading-6 text-ink-300">Tablaturas e metadados vêm de um provedor externo. O PRGB não é afiliado a esse provedor, a artistas ou a gravadoras; todas as marcas pertencem aos seus donos.</p>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-5 text-xs text-ink-300">
                <span>© {currentYear} PRGB</span>
                <nav aria-label="Documentos legais" className="flex gap-5">
                  <a href="#privacidade" className="rounded py-2 hover:text-amp-300">Privacidade</a>
                  <a href="#termos" className="rounded py-2 hover:text-amp-300">Termos</a>
                  <a href="/licencas-terceiros.md" target="_blank" rel="noopener noreferrer" className="rounded py-2 hover:text-amp-300">Licenças</a>
                  <a href={`mailto:${LEGAL_CONTACT.email}`} className="rounded py-2 hover:text-amp-300">Contato</a>
                </nav>
                <button type="button" onClick={() => setIsFeedbackOpen(true)} className="flex cursor-pointer items-center gap-2 rounded py-2 hover:text-amp-300"><MessageSquareWarning size={15} aria-hidden="true" /> Reportar problema</button>
                <a href={supportHref} target="_blank" rel="noopener noreferrer" className="rounded py-2 hover:text-amp-300">{supportLabel} ↗</a>
              </div>
            </div>
          </footer>
        </div>
      )}

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} screen={screen} />

      {/* Song Search Modal */}
      <SongSearchModal
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          // Left the search without a duo playing (gave up, or switched to Solo): back to the solo input
          if (channelMode === 'duo' && session?.mode !== 'duo') exitDuoAudio();
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
        onSelectDuo={(parts) => {
          setIsSearchOpen(false);
          startDuo(parts, duoSearchNames ?? DEFAULT_PLAYER_NAMES);
        }}
        onSelectSong={(tab, song, revisionId) => {
          songSelectionVersion.current += 1;
          setRestoreError(null);
          ensureSoloAudio();
          setSession(soloSession({ tab, partId: song.partId, revisionId }));
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
        onOpenAmpRack={() => setIsAmpRackOpen(true)}
      />

      {/* PRGB Amp & Monitoring Rack */}
      <AmpRack
        isOpen={isAmpRackOpen}
        onClose={() => setIsAmpRackOpen(false)}
        ampEngine={ampEngine}
      />

      <RankingModals />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        onStartGame={(part, partnerName, startAtMs) => {
          songSelectionVersion.current += 1;
          setOnlineSession({ part, partnerName, startAtMs, sessionKey: nextSessionKey() });
          setIsRoomModalOpen(false);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  const [rankingDev] = useState(() => import.meta.env.DEV ? rankingDevSetup(readDevScene()) : null);
  return (
    <AudioSessionProvider>
      <ModalsProvider>
        <RankingProvider dev={rankingDev}>
          <RoomProvider>
            <AppContent />
          </RoomProvider>
        </RankingProvider>
      </ModalsProvider>
    </AudioSessionProvider>
  );
};

export default App;
