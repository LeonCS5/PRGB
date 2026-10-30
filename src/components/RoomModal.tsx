// Dupla online: criar ou entrar em sala, escolher música e faixa, ficar pronto e iniciar juntos.
// O apelido vem do perfil: a sala exige conta, e ele já passou pela moderação.

import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, LogIn, Mic, Signal, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { ErrorNotice } from './ErrorNotice';
import { SongSearchModal } from './SongSearchModal';
import { closeButton, primaryButton, secondaryButton, textInput } from './rankingStyles';
import { useRoom } from '../context/useRoom';
import { useRanking } from '../context/ranking';
import { useAudioSession } from '../context/AudioSessionContext';
import { getRoomErrorByCode, getRoomErrorMessage, getSongMetadata, loadSongTrack } from '../context/uiErrors';
import { canStart } from '../context/room';
import type { GamePart } from '../context/gameSession';
import type { SongsterrMeta } from '../services/songsterrApi';

export interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (part: GamePart, partnerName: string, startAtMs: number) => void;
}

const ROLE_LABEL: Record<'host' | 'guest', string> = { host: 'Anfitrião', guest: 'Convidado' };

const CodeDisplay: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-xl border border-amp-500/40 bg-amp-500/10 px-4 py-2 font-mono text-2xl font-bold tracking-[0.25em] text-amp-300">
        {code}
      </span>
      <button type="button" onClick={copyCode} aria-label="Copiar código da sala"
        className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
};

const PlayerCard: React.FC<{
  name: string;
  role: 'host' | 'guest';
  partName: string | null;
  online: boolean;
  ready: boolean;
  isMe: boolean;
}> = ({ name, role, partName, online, ready, isMe }) => (
  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${online ? 'border-ink-700 bg-ink-950' : 'border-dashed border-ink-700 bg-ink-950 opacity-60'}`}>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-ink-100">
        {name}
        {isMe && <span className="ml-2 text-xs text-ink-300">(você)</span>}
      </p>
      <p className="text-xs text-ink-300">
        {ROLE_LABEL[role]}
        {partName ? ` · ${partName}` : ''}
        {!online && ' · desconectado'}
      </p>
    </div>
    {ready && (
      <span className="flex items-center gap-1 rounded-full bg-hit/15 px-2 py-0.5 text-xs font-bold text-hit">
        <Check size={11} aria-hidden="true" /> Pronto
      </span>
    )}
  </div>
);

// Remounted with `key` when the song changes
const PartSelector: React.FC<{
  songId: number;
  currentPartId: number | null;
  onSelect: (partId: number, trackName: string) => void;
}> = ({ songId, currentPartId, onSelect }) => {
  const [meta, setMeta] = useState<SongsterrMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const selectId = useId();

  useEffect(() => {
    let cancelled = false;
    getSongMetadata(songId).then((loaded) => {
      if (!cancelled) setMeta(loaded);
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar as faixas.');
    });
    return () => { cancelled = true; };
  }, [songId, loadAttempt]);

  // Dismissing retries too: with no tracks loaded there would be nothing left to show
  const retry = () => {
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (loadError) return (
    <div className="mt-4">
      <ErrorNotice message={loadError} onDismiss={retry} actionLabel="Tentar novamente" onAction={retry} />
    </div>
  );
  if (!meta) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-300">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Carregando faixas…
      </p>
    );
  }

  return (
    <div className="mt-4">
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-ink-200">Sua faixa</label>
      <select id={selectId} value={currentPartId !== null ? String(currentPartId) : ''}
        onChange={(event) => {
          const track = meta.tracks.find((candidate) => String(candidate.partId) === event.target.value);
          if (track) onSelect(track.partId, track.name || track.instrument);
        }}
        className="min-h-11 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 text-sm text-ink-100 focus:border-amp-500 focus:outline-none">
        <option value="" disabled>Escolha sua faixa…</option>
        {meta.tracks.map((track) => (
          <option key={track.partId} value={String(track.partId)}>
            {track.name || track.instrument} · {track.instrument}
          </option>
        ))}
      </select>
    </div>
  );
};

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onStartGame }) => {
  const { state, controller, openRoom, enterRoom, parseCode, leaveRoom } = useRoom();
  const { requestAccount } = useRanking();
  const { isAudioRunning, audioError, dismissAudioError, startAudio } = useAudioSession();

  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loadedPart, setLoadedPart] = useState<GamePart | null>(null);
  const [partError, setPartError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const startedForRef = useRef<number | null>(null);
  const titleId = useId();
  const codeId = useId();

  const songId = state.song?.songId ?? null;
  const { myPartId, phase, localStartTimeMs } = state;
  const myPart = loadedPart && loadedPart.tab.songId === songId && loadedPart.partId === myPartId ? loadedPart : null;
  const hasSelection = songId !== null && myPartId !== null;

  // The tab comes down before "Estou pronto": fetching it after the start could eat the whole countdown
  useEffect(() => {
    if (songId === null || myPartId === null || myPart) return;
    let cancelled = false;
    const load = async () => {
      try {
        const meta = await getSongMetadata(songId);
        const trackIndex = meta.tracks.findIndex((track) => track.partId === myPartId);
        const tab = await loadSongTrack(meta, trackIndex);
        if (!cancelled) setLoadedPart({ tab, partId: myPartId, revisionId: meta.revisionId });
      } catch (error) {
        if (!cancelled) setPartError(error instanceof Error ? error.message : 'Não foi possível carregar a faixa.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [songId, myPartId, myPart, loadAttempt]);

  const partnerName = state.peer?.nickname || 'Parceiro';
  useEffect(() => {
    if (phase !== 'match' || !myPart || localStartTimeMs === null) return;
    if (startedForRef.current === localStartTimeMs) return;
    startedForRef.current = localStartTimeMs;
    onStartGame(myPart, partnerName, localStartTimeMs);
  }, [phase, myPart, localStartTimeMs, partnerName, onStartGame]);

  if (!isOpen) return null;

  const enter = async (open: (nickname: string) => Promise<void>) => {
    setIsBusy(true);
    setModalError(null);
    try {
      const profile = await requestAccount();
      if (profile) {
        await open(profile.nickname);
        setIsJoining(false);
        setJoinCode('');
      }
    } catch (error) {
      setModalError(getRoomErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = () => {
    const code = parseCode(joinCode);
    if (!code) {
      setModalError('Código inválido. Use os 6 caracteres exatos do código da sala.');
      return;
    }
    void enter((nickname) => enterRoom(code, nickname));
  };

  const leave = async () => {
    startedForRef.current = null;
    setModalError(null);
    await leaveRoom();
  };

  const handleClose = async () => {
    await leave();
    setIsJoining(false);
    onClose();
  };

  const header = (subtitle: string) => (
    <>
      <button type="button" onClick={() => void handleClose()} aria-label="Fechar" className={closeButton}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300">
          <Signal size={22} aria-hidden="true" />
        </div>
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">Dupla online</h2>
          <p className="text-xs text-ink-300">{subtitle}</p>
        </div>
      </div>
    </>
  );

  if (phase === 'closed') {
    return (
      <ModalFrame titleId={titleId} onClose={() => void handleClose()} className="max-w-md">
        {header('Sala encerrada')}
        <p className="text-sm text-ink-300">{state.closedByHost ? 'O anfitrião encerrou a sala.' : 'A sala foi encerrada.'}</p>
        <button type="button" onClick={() => void handleClose()} className={primaryButton + ' mt-6 w-full'}>Voltar</button>
      </ModalFrame>
    );
  }

  if (phase === 'lobby' || phase === 'match') {
    const isHost = state.role === 'host';
    const readyBlocker = !myPart ? 'Carregando sua faixa…' : !isAudioRunning ? 'Conecte a guitarra para ficar pronto' : null;
    const errorText = state.error ? getRoomErrorByCode(state.error) : null;

    const lobby = (
      <ModalFrame titleId={titleId} onClose={() => void handleClose()} className="max-w-lg overflow-y-auto">
        {header('Sala ativa')}

        <div className="space-y-3 empty:hidden">
          {errorText && <ErrorNotice message={errorText} onDismiss={() => controller.clearError()} />}
          {audioError && <ErrorNotice message={audioError} onDismiss={dismissAudioError} />}
          {partError && (
            <ErrorNotice message={partError} onDismiss={() => setPartError(null)} actionLabel="Tentar novamente"
              onAction={() => { setPartError(null); setLoadAttempt((attempt) => attempt + 1); }} />
          )}
        </div>

        {state.code && (isHost ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-ink-300">Compartilhe o código com seu parceiro:</p>
            <CodeDisplay code={state.code} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-ink-300">Sala <span className="font-mono font-bold text-ink-100">{state.code}</span></p>
        ))}

        <div className="mt-4 space-y-2">
          <PlayerCard name={state.myNickname} role={state.role ?? 'host'} partName={state.myTrackName} online ready={state.myReady} isMe />
          {state.peer ? (
            <PlayerCard name={partnerName} role={state.peer.role} partName={state.peer.trackName}
              online={state.peer.online} ready={state.peer.ready} isMe={false} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-950 px-4 py-3 text-sm text-ink-300">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Aguardando o parceiro entrar…
            </div>
          )}
        </div>

        {state.song ? (
          <div className="mt-5 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3">
            <p className="text-xs font-semibold text-ink-300">Música selecionada</p>
            <p className="mt-1 font-bold text-ink-100">{state.song.title}</p>
            <p className="text-xs text-ink-300">{state.song.artist}</p>
            {isHost && (
              <button type="button" onClick={() => setIsSearchOpen(true)} className="mt-3 cursor-pointer text-xs text-amp-300 underline hover:text-amp-200">
                Mudar música
              </button>
            )}
          </div>
        ) : isHost ? (
          <div className="mt-5">
            <p className="mb-2 text-sm text-ink-300">Você é o anfitrião: escolha a música que os dois vão tocar.</p>
            <button type="button" onClick={() => setIsSearchOpen(true)} className={primaryButton + ' w-full'}>Escolher música</button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink-300">Aguardando o anfitrião escolher a música…</p>
        )}

        {state.song && !isHost && (
          <PartSelector key={state.song.songId} songId={state.song.songId} currentPartId={myPartId}
            onSelect={(partId, trackName) => { setPartError(null); controller.selectPart(partId, trackName); }} />
        )}

        {phase === 'match' ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-amp-300">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> A partida começou: carregando sua faixa…
          </p>
        ) : (
          <>
            {!isAudioRunning && (
              <button type="button" onClick={() => void startAudio()} className={secondaryButton + ' mt-4 w-full'}>
                <Mic size={16} aria-hidden="true" /> Conectar guitarra
              </button>
            )}
            {hasSelection && (
              <button type="button" disabled={isBusy || readyBlocker !== null} onClick={() => controller.setReady(!state.myReady)}
                className={primaryButton + ' mt-4 w-full'}>
                {readyBlocker ?? (state.myReady ? <><Check size={16} aria-hidden="true" /> Pronto! Clique para cancelar</> : 'Estou pronto')}
              </button>
            )}
            {canStart(state) && (
              <button type="button" disabled={isBusy} aria-busy={isBusy}
                onClick={() => {
                  setIsBusy(true);
                  void controller.scheduleStart().finally(() => setIsBusy(false));
                }}
                className={primaryButton + ' mt-3 w-full'}>
                {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Signal size={16} aria-hidden="true" />}
                Começar partida
              </button>
            )}
          </>
        )}

        <p role="status" className="sr-only">{state.peer && !state.peer.online ? 'Parceiro desconectado' : ''}</p>

        <button type="button" onClick={() => void leave()} className={secondaryButton + ' mt-6 w-full'}>Sair da sala</button>
      </ModalFrame>
    );

    return (
      <>
        {lobby}
        <SongSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)}
          onSelectSong={(tab, song, revisionId) => {
            setLoadedPart({ tab, partId: song.partId, revisionId });
            setPartError(null);
            controller.selectSong({
              songId: song.songId, revisionId, title: tab.title, artist: tab.artist,
              trackName: tab.trackName, partId: song.partId,
            });
            setIsSearchOpen(false);
          }} />
      </>
    );
  }

  return (
    <ModalFrame titleId={titleId} onClose={() => void handleClose()} className="max-w-lg overflow-y-auto">
      {header('Toque junto com alguém em outro computador')}

      {modalError && <div className="mb-4"><ErrorNotice message={modalError} onDismiss={() => setModalError(null)} /></div>}

      {isJoining ? (
        <div className="space-y-4">
          <button type="button" onClick={() => { setIsJoining(false); setModalError(null); }}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300 hover:text-ink-100">
            <ArrowLeft size={14} aria-hidden="true" /> Voltar
          </button>
          <div>
            <label htmlFor={codeId} className="mb-1.5 block text-sm font-semibold text-ink-200">Código da sala (6 caracteres)</label>
            <input id={codeId} type="text" value={joinCode} maxLength={8} placeholder="Ex: AB9A9A" autoComplete="off"
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              className={textInput + ' font-mono tracking-widest'} />
          </div>
          <button type="button" onClick={handleJoin} disabled={isBusy || !joinCode.trim()} aria-busy={isBusy} className={primaryButton + ' w-full'}>
            {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
            Entrar na sala
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm leading-6 text-ink-300">Crie uma sala e passe o código de 6 caracteres para o seu parceiro, ou entre com o código dele.</p>
          <p className="mt-1 text-xs text-ink-300">Exige conta no ranking (18+). Vocês não se ouvem: só o placar é compartilhado.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void enter(openRoom)} disabled={isBusy} aria-busy={isBusy}
              className="flex min-h-24 cursor-pointer flex-col items-start gap-1 rounded-xl border border-amp-500/30 bg-amp-500/10 p-4 text-left transition hover:bg-amp-500/15 disabled:cursor-wait disabled:opacity-70">
              {isBusy ? <Loader2 size={22} className="animate-spin text-amp-300" aria-hidden="true" /> : <Signal size={22} className="text-amp-300" aria-hidden="true" />}
              <span className="block font-bold text-ink-100">Criar sala</span>
              <span className="text-xs text-ink-300">Você é o anfitrião e compartilha o código</span>
            </button>
            <button type="button" onClick={() => { setIsJoining(true); setModalError(null); }}
              className="flex min-h-24 cursor-pointer flex-col items-start gap-1 rounded-xl border border-ink-700 bg-ink-900 p-4 text-left transition hover:bg-ink-800">
              <LogIn size={22} className="text-signal-300" aria-hidden="true" />
              <span className="block font-bold text-ink-100">Entrar com código</span>
              <span className="text-xs text-ink-300">Seu parceiro compartilhou um código</span>
            </button>
          </div>
        </>
      )}
    </ModalFrame>
  );
};
