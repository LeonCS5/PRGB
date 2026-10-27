import { ModalFrame } from './ModalFrame';
import React, { useEffect, useState } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sliders,
  Zap,
  X
} from 'lucide-react';
import { AudioEngine, type InputChannelMode } from '../services/audioEngine';
import { useAudioSession, useLatestPitch } from '../context/AudioSessionContext';
import { ErrorNotice } from './ErrorNotice';
import { getAudioErrorMessage } from '../context/uiErrors';
import { AMP_PRESETS, type AmpPresetId, type Tone3000Settings } from '../services/tone3000Amp';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioEngine: AudioEngine;
  currentDeviceId: string;
  currentChannelMode: InputChannelMode;
  onDeviceChange: (deviceId: string) => void;
  onChannelModeChange: (mode: InputChannelMode) => void;
  onOpenTone3000Rack?: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  audioEngine,
  currentDeviceId,
  currentChannelMode,
  onDeviceChange,
  onChannelModeChange,
  onOpenTone3000Rack
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceAttempt, setDeviceAttempt] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const { isAudioRunning, startAudio } = useAudioSession();
  const tone3000 = audioEngine.getTone3000();
  const [toneSettings, setToneSettings] = useState<Tone3000Settings | null>(
    tone3000 ? tone3000.getSettings() : null
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setDeviceError(null);
    audioEngine.getAudioInputDevices().then((devs) => {
      if (cancelled) return;
      setDevices(devs);
      if (devs.length === 0) {
        setDeviceError('Nenhuma entrada de áudio pôde ser listada. Conecte sua interface e confira a permissão de microfone no navegador.');
      }
    }).catch((err: unknown) => {
      if (!cancelled) setDeviceError(getAudioErrorMessage(err));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    let unsubscribe: (() => void) | undefined;
    if (tone3000) {
      setToneSettings(tone3000.getSettings());
      unsubscribe = tone3000.subscribe((s) => setToneSettings(s));
    }
    return () => { cancelled = true; unsubscribe?.(); };
  }, [isOpen, audioEngine, tone3000, deviceAttempt]);

  if (!isOpen) return null;

  const isMonitoring = toneSettings?.isMonitoringEnabled ?? true;

  return (
    <ModalFrame titleId="AudioSettingsModal-title" onClose={onClose} className="max-w-lg overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="min-h-10 absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 pr-10 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amp-600 to-amp-500 shadow-lg shadow-amp-500/20">
            <Mic className="text-ink-100" size={24} />
          </div>
          <div>
            <h2 id="AudioSettingsModal-title" className="font-display text-xl font-bold">Interface de Áudio & Guitarra</h2>
            <p className="text-xs text-ink-300">
              Modo RAW 48kHz de baixa latência + Motor TONE3000
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {deviceError && (
            <ErrorNotice message={deviceError} onDismiss={() => setDeviceError(null)}
              actionLabel="Atualizar dispositivos" onAction={() => setDeviceAttempt((attempt) => attempt + 1)}
              actionDisabled={loading} />
          )}
          {!isAudioRunning && (
            <button type="button" disabled={isConnecting} onClick={async () => {
              setIsConnecting(true);
              try {
                await startAudio();
                setDeviceAttempt((attempt) => attempt + 1);
              } finally {
                setIsConnecting(false);
              }
            }} className="rounded-xl bg-amp-600 px-4 py-2 text-sm font-bold text-ink-100 hover:bg-amp-500 disabled:opacity-50 cursor-pointer">
              {isConnecting ? 'Conectando...' : 'Conectar / tentar novamente'}
            </button>
          )}
          {/* TONE3000 Guitar Monitoring Card */}
          <div className="rounded-2xl border border-amp-500/40 bg-gradient-to-b from-amp-700/40 via-ink-900 to-ink-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amp-500/20 text-amp-400 border border-amp-500/30">
                  <Zap size={18} className="fill-amp-400" />
                </div>
                <div>
                  <span className="text-sm font-bold text-ink-100 block">
                    Ouvir Som da Guitarra (TONE3000)
                  </span>
                  <span className="text-[11px] text-ink-300">
                    Monitoramento em tempo real nos fones/caixas
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => tone3000?.setMonitoringEnabled(!isMonitoring)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  isMonitoring
                    ? 'border-hit/80 bg-hit/10 text-hit shadow-sm shadow-hit/20'
                    : 'border-amp-700 bg-amp-700/40 text-amp-400'
                }`}
              >
                {isMonitoring ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {isMonitoring ? 'LIGADO' : 'MUTADO'}
              </button>
            </div>

            {/* Quick Amp Presets */}
            <div>
              <div className="text-[11px] font-bold text-ink-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Timbre / Amplificador</span>
                {onOpenTone3000Rack && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTone3000Rack();
                    }}
                    className="text-[11px] text-amp-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Sliders size={12} />
                    Abrir Rack Completo
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['metal', 'crunch', 'clean'] as AmpPresetId[]).map((pid) => {
                  const p = AMP_PRESETS[pid];
                  const isSel = toneSettings?.preset === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => tone3000?.setPreset(pid)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition truncate cursor-pointer ${
                        isSel
                          ? 'border-amp-500 bg-amp-700/60 text-amp-300'
                          : 'border-ink-800 bg-ink-800 text-ink-300 hover:text-ink-100'
                      }`}
                    >
                      {p.badge}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Monitor Volume Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-ink-300 mb-1">
                <span>Volume de Monitoramento</span>
                <span className="font-mono text-hit font-bold">
                  {Math.round((toneSettings?.masterVolume ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Volume de monitoramento"
                min={0}
                max={1}
                step={0.01}
                value={toneSettings?.masterVolume ?? 0.75}
                onChange={(e) => tone3000?.setMasterVolume(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Device Selector */}
          <div>
            <label className="text-sm font-semibold text-ink-200 block mb-2">
              Dispositivo de Entrada
            </label>
            {loading ? (
              <div className="text-xs text-ink-300">Procurando interfaces de áudio...</div>
            ) : (
              <select
                aria-label="Dispositivo de entrada"
                value={currentDeviceId}
                onChange={(e) => onDeviceChange(e.target.value)}
                className="w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm text-ink-100 focus:border-amp-500 focus:outline-none focus:ring-1 focus:ring-amp-500"
              >
                <option value="">Dispositivo Padrão do Sistema</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microfone / Interface ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Channel Routing */}
          <div>
            <label className="text-sm font-semibold text-ink-200 block mb-2 flex items-center gap-2">
              <Sliders size={16} />
              Canal de Entrada da Guitarra
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChannelModeChange('ch1')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'ch1'
                    ? 'border-amp-500 bg-amp-700/60 text-amp-300 shadow-sm shadow-amp-500/30'
                    : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-500'
                }`}
              >
                Canal 1 (Esq)
              </button>
              <button
                type="button"
                onClick={() => onChannelModeChange('ch2')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'ch2'
                    ? 'border-amp-500 bg-amp-700/60 text-amp-300 shadow-sm shadow-amp-500/30'
                    : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-500'
                }`}
              >
                Canal 2 (Dir)
              </button>
              <button
                type="button"
                onClick={() => onChannelModeChange('both')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'both'
                    ? 'border-amp-500 bg-amp-700/60 text-amp-300 shadow-sm shadow-amp-500/30'
                    : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-500'
                }`}
              >
                Ambos / Mono
              </button>
            </div>
            <p className="text-[11px] text-ink-400 mt-1.5">
              Interfaces como Focusrite, Behringer ou Realtek costumam ter a guitarra no Canal 1 ou Canal 2.
            </p>
          </div>

          {/* Live Level VU Meter */}
          <AudioInputMeter />
        </div>

        <div className="mt-6 flex items-center justify-between">
          {onOpenTone3000Rack && (
            <button
              onClick={() => {
                onClose();
                onOpenTone3000Rack();
              }}
              className="flex items-center gap-2 text-xs font-bold text-amp-400 hover:text-amp-300 transition cursor-pointer"
            >
              <Zap size={14} />
              Configurar Rack TONE3000
            </button>
          )}

          <button
            onClick={onClose}
            className="min-h-10 rounded-xl bg-gradient-to-r from-amp-500 to-amp-600 px-6 py-2.5 text-sm font-semibold text-ink-100 shadow-lg shadow-amp-500/25 hover:from-amp-400 hover:to-amp-500 transition cursor-pointer ml-auto"
          >
            Pronto para Tocar
          </button>
        </div>
    </ModalFrame>
  );
};

const AudioInputMeter: React.FC = () => {
  const latestPitch = useLatestPitch();
  const volumePercent = latestPitch ? Math.round(latestPitch.volume * 100) : 0;
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-300">
          <Volume2 size={15} />
          Sinal de Entrada da Interface (VU Meter)
        </span>
        <span className="font-mono font-bold text-amp-400">{volumePercent}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-ink-800 p-0.5">
        <div
          className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-hit via-amp-400 to-amp-500"
          style={{ width: `${Math.min(100, volumePercent * 2.5)}%` }}
        />
      </div>

      {/* Live Tuner Pitch Display */}
      <div className="mt-2 pt-3 border-t border-ink-800/80 flex items-center justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-ink-400 font-bold block">
            Afinador em Tempo Real
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black font-mono text-ink-100">
              {latestPitch ? latestPitch.noteName : '--'}
            </span>
            <span className="text-xs text-ink-300 font-mono">
              {latestPitch ? `${latestPitch.frequency} Hz` : 'Toque uma corda'}
            </span>
          </div>
        </div>

        {latestPitch && (
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                Math.abs(latestPitch.cents) <= 5
                  ? 'bg-hit/10 text-hit border border-hit/50'
                  : 'bg-ink-800 text-ink-200'
              }`}
            >
              {Math.abs(latestPitch.cents) <= 5 ? (
                <>
                  <CheckCircle2 size={13} /> AFINADO
                </>
              ) : (
                `${latestPitch.cents > 0 ? '+' : ''}${latestPitch.cents} cents`
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
