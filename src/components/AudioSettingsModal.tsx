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
import { AudioRouteNotice, InputLevelMeter } from './AudioRouting';
import { AdvancedAudioOptions, AudioRoutePanel, SignalControls } from './AudioRoutePanel';
import { AMP_PRESETS, type AmpPresetId, type AmpSettings } from '../services/ampEngine';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioEngine: AudioEngine;
  currentDeviceId: string;
  currentChannelMode: InputChannelMode;
  onDeviceChange: (deviceId: string) => void;
  onChannelModeChange: (mode: InputChannelMode) => void;
  onOpenAmpRack?: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  audioEngine,
  currentDeviceId,
  currentChannelMode,
  onDeviceChange,
  onChannelModeChange,
  onOpenAmpRack
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { isAudioRunning, startAudio, audioError, dismissAudioError } = useAudioSession();
  const ampEngine = audioEngine.getAmp();
  const [toneSettings, setToneSettings] = useState<AmpSettings | null>(
    ampEngine ? ampEngine.getSettings() : null
  );

  useEffect(() => {
    if (!isOpen || !ampEngine) return;
    setToneSettings(ampEngine.getSettings());
    return ampEngine.subscribe((s) => setToneSettings(s));
  }, [isOpen, ampEngine]);

  if (!isOpen) return null;

  // Duo routes channel 1 and channel 2 to one player each; the choice comes back when the duo ends
  const isDuoMode = currentChannelMode === 'duo';
  const isMonitoring = toneSettings?.isMonitoringEnabled ?? true;

  return (
    <ModalFrame titleId="AudioSettingsModal-title" onClose={onClose} className="max-w-5xl overflow-y-auto">
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
            <h2 id="AudioSettingsModal-title" className="font-display text-xl font-bold">Áudio</h2>
            <p className="text-xs text-ink-300">
              Entrada, saída, timbre e afinador
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {audioError && <ErrorNotice message={audioError} onDismiss={dismissAudioError} />}
          <AudioRouteNotice />
          {!isAudioRunning && (
            <button type="button" disabled={isConnecting} onClick={async () => {
              setIsConnecting(true);
              try {
                await startAudio();
              } finally {
                setIsConnecting(false);
              }
            }} className="min-h-11 rounded-xl bg-amp-500 px-4 py-2 text-sm font-bold text-ink-950 hover:bg-amp-400 disabled:opacity-50 cursor-pointer">
              {isConnecting ? 'Conectando...' : 'Conectar / tentar novamente'}
            </button>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <AudioRoutePanel currentDeviceId={currentDeviceId} onDeviceChange={onDeviceChange} />

              {/* Channel Routing */}
              <div role="group" aria-labelledby="audio-channel-title">
                <p id="audio-channel-title" className="text-sm font-semibold text-ink-200 mb-2 flex items-center gap-2">
                  <Sliders size={16} aria-hidden="true" />
                  Canal de entrada
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onChannelModeChange('ch1')}
                    disabled={isDuoMode}
                    className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
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
                    disabled={isDuoMode}
                    className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
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
                    disabled={isDuoMode}
                    className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      currentChannelMode === 'both'
                        ? 'border-amp-500 bg-amp-700/60 text-amp-300 shadow-sm shadow-amp-500/30'
                        : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-500'
                    }`}
                  >
                    Ambos / Mono
                  </button>
                </div>
                <p className="text-[11px] text-ink-400 mt-1.5">
                  {isDuoMode
                    ? 'Modo dupla: guitarra 1 no Canal 1 e guitarra 2 no Canal 2. Saia da dupla para trocar o canal.'
                    : 'A guitarra costuma chegar no Canal 1 ou no Canal 2. Se o nível não subir, troque aqui.'}
                </p>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {/* PRGB Amp monitoring Card */}
              <div className="rounded-2xl border border-amp-500/40 bg-gradient-to-b from-amp-700/40 via-ink-900 to-ink-900 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amp-500/20 text-amp-400 border border-amp-500/30">
                      <Zap size={18} className="fill-amp-400" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-ink-100 block">
                        Ouvir som da guitarra
                      </span>
                      <span className="text-[11px] text-ink-300">
                        O PRGB Amp nos fones ou nas caixas
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => ampEngine?.setMonitoringEnabled(!isMonitoring)}
                    className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-bold border transition flex shrink-0 items-center gap-1.5 cursor-pointer ${
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
                    <span>Timbre</span>
                    {onOpenAmpRack && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAmpRack();
                        }}
                        className="min-h-8 text-[11px] text-amp-400 hover:underline flex items-center gap-1 font-semibold normal-case tracking-normal cursor-pointer"
                      >
                        <Sliders size={12} />
                        Abrir rack completo
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
                          onClick={() => ampEngine?.setPreset(pid)}
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
                    <span>Volume</span>
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
                    onChange={(e) => ampEngine?.setMasterVolume(Number(e.target.value))}
                    className="w-full accent-amp-400 h-1.5 bg-ink-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <AudioInputMeter />
              <SignalControls />
            </div>
          </div>

          <AdvancedAudioOptions />
        </div>

        {/* Long on a phone: the way out stays on screen */}
        <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-5 flex justify-end border-t border-ink-700 bg-ink-900 px-5 py-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl bg-amp-500 px-6 py-2.5 text-sm font-bold text-ink-950 shadow-lg shadow-amp-500/25 hover:bg-amp-400 transition cursor-pointer"
          >
            Pronto para tocar
          </button>
        </div>
    </ModalFrame>
  );
};

const AudioInputMeter: React.FC = () => {
  const latestPitch = useLatestPitch();
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950 p-4 space-y-3">
      {/* Live Tuner Pitch Display */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-ink-300 font-bold block">
            Afinador
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

      <div className="pt-3 border-t border-ink-800/80">
        <p className="flex items-center gap-1.5 text-xs text-ink-300 mb-2">
          <Volume2 size={15} />
          Nível de entrada
        </p>
        <InputLevelMeter />
      </div>
    </div>
  );
};
