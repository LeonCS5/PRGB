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
import { useLatestPitch } from '../context/AudioSessionContext';
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
  const tone3000 = audioEngine.getTone3000();
  const [toneSettings, setToneSettings] = useState<Tone3000Settings | null>(
    tone3000 ? tone3000.getSettings() : null
  );

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    audioEngine.getAudioInputDevices().then((devs) => {
      setDevices(devs);
      setLoading(false);
    });

    if (tone3000) {
      setToneSettings(tone3000.getSettings());
      const unsub = tone3000.subscribe((s) => setToneSettings(s));
      return () => unsub();
    }
  }, [isOpen, audioEngine, tone3000]);

  if (!isOpen) return null;

  const isMonitoring = toneSettings?.isMonitoringEnabled ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl text-neutral-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-lg shadow-cyan-500/20">
            <Mic className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Interface de Áudio & Guitarra</h2>
            <p className="text-xs text-neutral-400">
              Modo RAW 48kHz de baixa latência + Motor TONE3000
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* TONE3000 Guitar Monitoring Card */}
          <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/40 via-neutral-900 to-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Zap size={18} className="fill-cyan-400" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    Ouvir Som da Guitarra (TONE3000)
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Monitoramento em tempo real nos fones/caixas
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => tone3000?.setMonitoringEnabled(!isMonitoring)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  isMonitoring
                    ? 'border-emerald-500/80 bg-emerald-950/60 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'border-rose-900 bg-rose-950/40 text-rose-400'
                }`}
              >
                {isMonitoring ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {isMonitoring ? 'LIGADO' : 'MUTADO'}
              </button>
            </div>

            {/* Quick Amp Presets */}
            <div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Timbre / Amplificador</span>
                {onOpenTone3000Rack && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTone3000Rack();
                    }}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
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
                          ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300'
                          : 'border-neutral-800 bg-neutral-800 text-neutral-400 hover:text-white'
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
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Volume de Monitoramento</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {Math.round((toneSettings?.masterVolume ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={toneSettings?.masterVolume ?? 0.75}
                onChange={(e) => tone3000?.setMasterVolume(Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Device Selector */}
          <div>
            <label className="text-sm font-semibold text-neutral-300 block mb-2">
              Dispositivo de Entrada
            </label>
            {loading ? (
              <div className="text-xs text-neutral-400">Procurando interfaces de áudio...</div>
            ) : (
              <select
                value={currentDeviceId}
                onChange={(e) => onDeviceChange(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
            <label className="text-sm font-semibold text-neutral-300 block mb-2 flex items-center gap-2">
              <Sliders size={16} />
              Canal de Entrada da Guitarra
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChannelModeChange('ch1')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'ch1'
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/30'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                Canal 1 (Esq)
              </button>
              <button
                type="button"
                onClick={() => onChannelModeChange('ch2')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'ch2'
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/30'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                Canal 2 (Dir)
              </button>
              <button
                type="button"
                onClick={() => onChannelModeChange('both')}
                className={`rounded-xl py-2.5 px-3 text-xs font-semibold border transition cursor-pointer ${
                  currentChannelMode === 'both'
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/30'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                Ambos / Mono
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5">
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
              className="flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
            >
              <Zap size={14} />
              Configurar Rack TONE3000
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition cursor-pointer ml-auto"
          >
            Pronto para Tocar
          </button>
        </div>
      </div>
    </div>
  );
};

const AudioInputMeter: React.FC = () => {
  const latestPitch = useLatestPitch();
  const volumePercent = latestPitch ? Math.round(latestPitch.volume * 100) : 0;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-neutral-400">
          <Volume2 size={15} />
          Sinal de Entrada da Interface (VU Meter)
        </span>
        <span className="font-mono font-bold text-cyan-400">{volumePercent}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-800 p-0.5">
        <div
          className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
          style={{ width: `${Math.min(100, volumePercent * 2.5)}%` }}
        />
      </div>

      {/* Live Tuner Pitch Display */}
      <div className="mt-2 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold block">
            Afinador em Tempo Real
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black font-mono text-white">
              {latestPitch ? latestPitch.noteName : '--'}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {latestPitch ? `${latestPitch.frequency} Hz` : 'Toque uma corda'}
            </span>
          </div>
        </div>

        {latestPitch && (
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                Math.abs(latestPitch.cents) <= 5
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50'
                  : 'bg-neutral-800 text-neutral-300'
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
