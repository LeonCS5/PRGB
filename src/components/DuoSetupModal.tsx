import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Cable, Check, Music, Play, Users, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { ErrorNotice } from './ErrorNotice';
import type { PlayerSlot } from '../services/audioEngine';
import { NICKNAME_ERROR_MESSAGES, validateNickname } from '../services/nickname';
import { useAudioSession, useLatestPitch } from '../context/AudioSessionContext';
import { DEFAULT_PLAYER_NAMES } from '../context/gameSession';

export interface DuoSetupModalProps {
  onCancel: () => void;
  onPlayDemo: (names: [string, string]) => void;
  onSearchSong: (names: [string, string]) => void;
}

const TITLE_ID = 'duo-setup-title';
const PLAYER_COLORS: [string, string] = ['text-signal-300', 'text-note-violet'];
const primaryButton = 'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amp-400 px-5 font-bold text-ink-950 transition hover:bg-amp-300 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 transition hover:border-ink-400 disabled:opacity-50';

const StepHeading: React.FC<{ step: number; label: string; title: string }> = ({ step, label, title }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Moving between steps replaces the content: take focus to the new heading for keyboard and screen reader users
  useEffect(() => {
    if (step > 1) headingRef.current?.focus();
  }, [step]);
  return (
    <>
      <p className="font-mono text-xs tracking-widest text-amp-300">PASSO {step} DE 3 · {label}</p>
      <h2 id={TITLE_ID} ref={headingRef} tabIndex={-1} className="mt-2 pr-10 font-display text-2xl font-bold focus:outline-none!">{title}</h2>
    </>
  );
};

const DuoTuner: React.FC<{ player: PlayerSlot }> = ({ player }) => {
  const pitch = useLatestPitch(player);
  const [wasHeard, setWasHeard] = useState(false);
  if (pitch && !wasHeard) setWasHeard(true);
  const level = pitch ? Math.min(100, Math.round(pitch.volume * 250)) : 0;
  const inTune = pitch !== null && Math.abs(pitch.cents) <= 6;
  return (
    <section aria-label={`Afinador do jogador ${player + 1}`} className="rounded-xl border border-ink-700 bg-ink-950 p-4">
      <p className={'text-xs font-bold ' + PLAYER_COLORS[player]}>Jogador {player + 1} · canal {player + 1}</p>
      <div className="mt-2 flex items-baseline gap-2 font-mono">
        <span className="text-3xl font-bold text-ink-100">{pitch ? pitch.noteName : '--'}</span>
        <span className={'text-xs ' + (inTune ? 'text-hit' : 'text-ink-300')}>
          {pitch ? (inTune ? 'afinado' : `${pitch.cents > 0 ? '+' : ''}${pitch.cents} cents`) : 'Toque uma corda'}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-gradient-to-r from-hit to-amp-400 transition-all duration-75" style={{ width: `${level}%` }} />
      </div>
      <p className={'mt-2 flex items-center gap-1.5 text-xs ' + (wasHeard ? 'text-hit' : 'text-ink-300')}>
        {wasHeard ? <><Check size={13} aria-hidden="true" /> Ouvindo este canal</> : 'Ainda não ouvimos este canal'}
      </p>
    </section>
  );
};

const ConnectStep: React.FC<{ onCancel: () => void; onNext: () => void }> = ({ onCancel, onNext }) => {
  const { audioEngine, isAudioRunning, channelMode, selectedDeviceId, startAudio, audioError, dismissAudioError } = useAudioSession();
  const deviceSelectId = useId();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  // Re-rendering on every note of either guitar keeps the channel checks below current (the mirror
  // check needs both guitars playing for about a second before it can say anything)
  useLatestPitch(0);
  useLatestPitch(1);
  const isDuoLive = isAudioRunning && channelMode === 'duo';
  const channelCount = isDuoLive ? audioEngine.getInputChannelCount() : 0;
  const isMirrored = isDuoLive && channelCount >= 2 && audioEngine.areDuoChannelsMirrored();
  const canContinue = isDuoLive && channelCount >= 2 && !isMirrored;

  useEffect(() => {
    let cancelled = false;
    // Device names only show up after the microphone permission, so list again once connected
    void audioEngine.getAudioInputDevices().then((list) => { if (!cancelled) setDevices(list); });
    return () => { cancelled = true; };
  }, [audioEngine, isDuoLive]);

  const connect = async (deviceId?: string) => {
    setIsConnecting(true);
    try {
      await startAudio(deviceId, 'duo');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <StepHeading step={1} label="CONEXÃO" title="Dupla no mesmo computador" />
      <p className="mt-3 text-sm leading-6 text-ink-300">
        Ligue a <strong className="text-ink-100">guitarra 1 no canal 1</strong> e a <strong className="text-ink-100">guitarra 2 no canal 2</strong> da
        mesma interface de áudio (por exemplo, Focusrite Scarlett 2i2 ou Behringer UMC202HD). Cada jogador é julgado só pelo próprio canal.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={deviceSelectId} className="mb-1.5 block text-xs font-semibold text-ink-200">Interface de áudio</label>
          <select id={deviceSelectId} value={selectedDeviceId} disabled={isConnecting}
            onChange={(event) => void connect(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 text-sm text-ink-100 focus:border-amp-500 focus:outline-none">
            <option value="">Dispositivo padrão do sistema</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || `Interface ${device.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void connect()} disabled={isConnecting} aria-busy={isConnecting} className={primaryButton}>
          <Cable size={18} aria-hidden="true" /> {isConnecting ? 'Conectando…' : isDuoLive ? 'Reconectar' : 'Conectar'}
        </button>
      </div>

      {audioError && (
        <div className="mt-4"><ErrorNotice message={audioError} onDismiss={dismissAudioError} /></div>
      )}
      {isDuoLive && channelCount < 2 && (
        <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-miss/40 bg-miss/5 p-3 text-sm text-ink-100">
          <AlertTriangle size={18} className="shrink-0 text-miss" aria-hidden="true" />
          Esta entrada tem um canal só. Para jogar em dupla, use uma interface com duas entradas (canal 1 e canal 2) e escolha-a acima.
        </p>
      )}
      {isMirrored && (
        <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-miss/40 bg-miss/5 p-3 text-sm text-ink-100">
          <AlertTriangle size={18} className="shrink-0 text-miss" aria-hidden="true" />
          Sua interface está copiando o mesmo sinal para os dois canais, então o jogo não consegue separar as duas guitarras. Confira se cada guitarra está na sua entrada (1 e 2) e desligue qualquer modo mono ou de espelhamento da interface.
        </p>
      )}
      {isDuoLive && channelCount >= 2 && (
        <>
          <p className="mt-5 text-sm text-ink-200">Cada um toca uma corda: o afinador do seu canal deve mostrar a nota.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <DuoTuner player={0} />
            <DuoTuner player={1} />
          </div>
        </>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancelar</button>
        <button type="button" onClick={onNext} disabled={!canContinue} className={primaryButton}>Continuar</button>
      </div>
    </>
  );
};

const NamesStep: React.FC<{ names: [string, string]; onChange: (names: [string, string]) => void; onBack: () => void; onNext: () => void }> = ({ names, onChange, onBack, onNext }) => {
  const baseId = useId();
  const errors = names.map((name) => {
    if (!name.trim()) return null;
    const result = validateNickname(name);
    return result.ok ? null : NICKNAME_ERROR_MESSAGES[result.error];
  });
  return (
    <>
      <StepHeading step={2} label="JOGADORES" title="Quem vai tocar?" />
      <p className="mt-3 text-sm text-ink-300">Os nomes aparecem no placar. São opcionais e não saem deste computador.</p>
      <div className="mt-5 space-y-4">
        {([0, 1] as const).map((player) => {
          const inputId = `${baseId}-${player}`;
          return (
            <div key={player}>
              <label htmlFor={inputId} className={'block text-sm font-semibold ' + PLAYER_COLORS[player]}>
                Nome do jogador {player + 1} <span className="font-normal text-ink-300">(canal {player + 1}, opcional)</span>
              </label>
              <input id={inputId} type="text" value={names[player]} maxLength={40} placeholder={DEFAULT_PLAYER_NAMES[player]}
                onChange={(event) => onChange(player === 0 ? [event.target.value, names[1]] : [names[0], event.target.value])}
                aria-invalid={errors[player] ? true : undefined} aria-describedby={errors[player] ? `${inputId}-error` : undefined}
                className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm text-ink-100 placeholder-ink-400 focus:border-amp-500 focus:outline-none focus:ring-1 focus:ring-amp-500" />
              {errors[player] && <p id={`${inputId}-error`} className="mt-1.5 text-xs text-miss">{errors[player]}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryButton}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
        <button type="button" onClick={onNext} disabled={errors.some(Boolean)} className={primaryButton}>Continuar</button>
      </div>
    </>
  );
};

const SongStep: React.FC<{ onBack: () => void; onSearch: () => void; onDemo: () => void }> = ({ onBack, onSearch, onDemo }) => (
  <>
    <StepHeading step={3} label="MÚSICA" title="Escolham a música" />
    <p className="mt-3 text-sm leading-6 text-ink-300">
      Na busca, escolham a parte de cada um: a mesma parte, para competir, ou partes diferentes, como base e solo. Faixas de baixo também funcionam.
    </p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onSearch} className="flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-amp-500/40 bg-amp-500/10 p-4 text-left transition hover:bg-amp-500/15">
        <Music size={22} className="shrink-0 text-amp-300" aria-hidden="true" />
        <span><span className="block font-bold text-ink-100">Buscar música</span><span className="mt-1 block text-xs text-ink-300">Acervo do Songsterr, uma parte para cada jogador</span></span>
      </button>
      <button type="button" onClick={onDemo} className="flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-signal-500/30 bg-signal-500/5 p-4 text-left transition hover:bg-signal-500/10">
        <Play size={22} className="shrink-0 text-signal-300" aria-hidden="true" />
        <span><span className="block font-bold text-ink-100">Exercício demo</span><span className="mt-1 block text-xs text-ink-300">Os dois tocam a pentatônica, sem internet</span></span>
      </button>
    </div>
    <div className="mt-6">
      <button type="button" onClick={onBack} className={secondaryButton}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
    </div>
  </>
);

export const DuoSetupModal: React.FC<DuoSetupModalProps> = ({ onCancel, onPlayDemo, onSearchSong }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const resolvedNames = (): [string, string] => {
    const resolve = (name: string, player: PlayerSlot) => {
      const result = validateNickname(name);
      return result.ok ? result.value : DEFAULT_PLAYER_NAMES[player];
    };
    return [resolve(names[0], 0), resolve(names[1], 1)];
  };

  return (
    <ModalFrame titleId={TITLE_ID} onClose={onCancel} className="max-w-2xl overflow-y-auto">
      <button type="button" onClick={onCancel} aria-label="Fechar"
        className="absolute right-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100">
        <X size={20} aria-hidden="true" />
      </button>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300">
        <Users size={22} aria-hidden="true" />
      </div>
      {step === 1 && <ConnectStep onCancel={onCancel} onNext={() => setStep(2)} />}
      {step === 2 && <NamesStep names={names} onChange={setNames} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <SongStep onBack={() => setStep(2)} onSearch={() => onSearchSong(resolvedNames())} onDemo={() => onPlayDemo(resolvedNames())} />}
    </ModalFrame>
  );
};
