import { ModalFrame } from './ModalFrame';
import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Zap,
  Flame,
  Radio,
  Sliders,
  Sparkles,
  ShieldAlert,
  X,
  RotateCcw
} from 'lucide-react';
import {
  Tone3000AmpEngine,
  AMP_PRESETS,
  type AmpPresetId,
  type CabSimType,
  type Tone3000Settings
} from '../services/tone3000Amp';

interface Tone3000AmpRackProps {
  isOpen: boolean;
  onClose: () => void;
  tone3000: Tone3000AmpEngine | null;
}

export const Tone3000AmpRack: React.FC<Tone3000AmpRackProps> = ({
  isOpen,
  onClose,
  tone3000
}) => {
  const [settings, setSettings] = useState<Tone3000Settings | null>(
    tone3000 ? tone3000.getSettings() : null
  );
  const [outputLevel, setOutputLevel] = useState<number>(0);

  // Sync settings whenever tone3000 updates
  useEffect(() => {
    if (!tone3000) return;
    setSettings(tone3000.getSettings());
    const unsubscribe = tone3000.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsubscribe();
  }, [tone3000]);

  // Output level polling animation when rack is open
  useEffect(() => {
    if (!isOpen || !tone3000) return;
    let animId: number;
    const poll = () => {
      setOutputLevel(tone3000.getOutputLevel());
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, tone3000]);

  if (!isOpen) return null;

  const currentPreset = settings?.preset || 'metal';
  const isMonitoring = settings?.isMonitoringEnabled ?? true;

  return (
    <ModalFrame titleId="Tone3000AmpRack-title" onClose={onClose} className="max-w-3xl overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="min-h-10 absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Header with TONE3000 Branding and Master Monitor Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8 border-b border-ink-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amp-600 to-amp-600 shadow-lg shadow-amp-500/25 border border-amp-400/30">
              <Zap className="text-ink-100 fill-ink-100" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="Tone3000AmpRack-title" className="font-display text-2xl font-black tracking-tight text-ink-100">
                  TONE3000
                </h2>
                <span className="rounded-full bg-amp-500/10 border border-amp-500/30 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amp-300">
                  Motor DSP
                </span>
              </div>
              <p className="text-xs text-ink-300">
                Monitoramento da guitarra em tempo real com emulação de amplificador e gabinete
              </p>
            </div>
          </div>

          {/* Quick Monitor On/Off Master Switch */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => tone3000?.setMonitoringEnabled(!isMonitoring)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs border transition shadow-md cursor-pointer ${
                isMonitoring
                  ? 'border-hit/60 bg-hit/10 text-hit shadow-hit/20'
                  : 'border-amp-700/60 bg-amp-700/40 text-amp-400'
              }`}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isMonitoring ? 'bg-hit shadow-sm shadow-hit animate-pulse' : 'bg-amp-500'
                }`}
              />
              {isMonitoring ? (
                <>
                  <Volume2 size={16} />
                  <span>SOM DA GUITARRA: LIGADO</span>
                </>
              ) : (
                <>
                  <VolumeX size={16} />
                  <span>SOM MUTADO</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Headphone Safety Tip */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amp-500/20 bg-amp-500/5 px-3.5 py-2 text-xs text-amp-300/90">
          <ShieldAlert size={16} className="text-amp-400 shrink-0" />
          <span>
            <strong>Dica de estúdio:</strong> Use fones de ouvido para tocar sem microfonia e com a melhor definição sonora.
          </span>
        </div>

        {/* Amp Presets Selector */}
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-300 mb-2.5 flex items-center gap-1.5">
            <Radio size={14} className="text-amp-400" />
            Modelos de Amplificador (TONE3000 Presets)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(AMP_PRESETS) as AmpPresetId[]).map((pid) => {
              const p = AMP_PRESETS[pid];
              const isSelected = currentPreset === pid;
              return (
                <button
                  key={pid}
                  aria-pressed={isSelected}
                  onClick={() => tone3000?.setPreset(pid)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition cursor-pointer ${
                    isSelected
                      ? 'border-amp-500 bg-gradient-to-b from-amp-700/60 to-ink-900 text-ink-100 shadow-lg shadow-amp-500/20 ring-1 ring-amp-500'
                      : 'border-ink-800 bg-ink-900/60 text-ink-300 hover:border-ink-700 hover:text-ink-100'
                  }`}
                >
                  <span className="text-xs font-bold whitespace-normal w-full">{p.badge}</span>
                  <span className="text-[10px] text-ink-400 mt-0.5 whitespace-normal">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amp Faceplate & Knobs Rack */}
        <div className="mt-5 rounded-2xl border border-ink-800 bg-gradient-to-b from-ink-900 via-ink-950 to-black p-5 shadow-inner">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-ink-800/80 text-xs">
            <div className="flex items-center gap-2 text-ink-200 font-mono font-bold">
              <Sliders size={14} className="text-amp-400" />
              <span>PAINEL DE CONTROLE VALVULADO (TONE STACK)</span>
            </div>
            {settings && (
              <button
                onClick={() => tone3000?.setPreset(settings.preset)}
                className="flex items-center gap-1 text-[11px] text-ink-300 hover:text-amp-300 transition cursor-pointer"
                title="Resetar controles para o padrão do preset atual"
              >
                <RotateCcw size={12} />
                Resetar Preset
              </button>
            )}
          </div>

          {/* Knobs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {/* GAIN */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-ink-200 uppercase mb-1">Ganho</span>
              <input
                type="range"
                aria-label="Ganho"
                min={0}
                max={100}
                value={settings?.gain ?? 50}
                onChange={(e) => tone3000?.setGain(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-amp-400 mt-2">
                {settings?.gain ?? 50}%
              </span>
            </div>

            {/* BASS */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-ink-200 uppercase mb-1">Graves</span>
              <input
                type="range"
                aria-label="Graves"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.bass ?? 0}
                onChange={(e) => tone3000?.setBass(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-ink-200 mt-2">
                {settings?.bass ? `${settings.bass > 0 ? '+' : ''}${settings.bass} dB` : '0 dB'}
              </span>
            </div>

            {/* MIDDLE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-ink-200 uppercase mb-1">Médios</span>
              <input
                type="range"
                aria-label="Médios"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.mid ?? 0}
                onChange={(e) => tone3000?.setMid(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-ink-200 mt-2">
                {settings?.mid ? `${settings.mid > 0 ? '+' : ''}${settings.mid} dB` : '0 dB'}
              </span>
            </div>

            {/* TREBLE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-ink-200 uppercase mb-1">Agudos</span>
              <input
                type="range"
                aria-label="Agudos"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.treble ?? 0}
                onChange={(e) => tone3000?.setTreble(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-ink-200 mt-2">
                {settings?.treble ? `${settings.treble > 0 ? '+' : ''}${settings.treble} dB` : '0 dB'}
              </span>
            </div>

            {/* PRESENCE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-ink-200 uppercase mb-1">Presença</span>
              <input
                type="range"
                aria-label="Presença"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.presence ?? 0}
                onChange={(e) => tone3000?.setPresence(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-ink-200 mt-2">
                {settings?.presence ? `${settings.presence > 0 ? '+' : ''}${settings.presence} dB` : '0 dB'}
              </span>
            </div>

            {/* MASTER VOLUME */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-ink-900/80 border border-ink-800">
              <span className="text-[11px] font-bold text-hit uppercase mb-1">Volume</span>
              <input
                type="range"
                aria-label="Volume principal"
                min={0}
                max={1}
                step={0.01}
                value={settings?.masterVolume ?? 0.75}
                onChange={(e) => tone3000?.setMasterVolume(Number(e.target.value))}
                className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-hit mt-2">
                {Math.round((settings?.masterVolume ?? 0.75) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Rack Effects (Cabinet Simulation, Noise Gate, Studio Room Reverb) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Cabinet Simulator */}
          <div className="p-3.5 rounded-2xl border border-ink-800 bg-ink-900/60">
            <label className="text-xs font-bold text-ink-200 block mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amp-400" />
              Gabinete & Alto-falante
            </label>
            <select
              aria-label="Gabinete e alto-falante"
              value={settings?.cabSim ?? '4x12_metal'}
              onChange={(e) => tone3000?.setCabSim(e.target.value as CabSimType)}
              className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-ink-100 focus:border-amp-500 focus:outline-none"
            >
              <option value="4x12_metal">4x12 Modern Metal (Celestion V30)</option>
              <option value="4x12_vintage">4x12 Vintage 30 (American Lead)</option>
              <option value="2x12_british">2x12 British Greenback (Plexi)</option>
              <option value="1x12_tweed">1x12 California Tweed (Clean)</option>
              <option value="bypass">Bypass Cab Sim (Sinal Direto)</option>
            </select>
          </div>

          {/* Noise Gate */}
          <div className="p-3.5 rounded-2xl border border-ink-800 bg-ink-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-200 flex items-center gap-1.5">
                <Flame size={14} className="text-amp-400" />
                Noise Gate (Supressor de Ruído)
              </span>
              <span className="text-xs font-mono text-amp-400">
                {settings?.gateThreshold ?? -45} dB
              </span>
            </div>
            <input
              type="range"
                aria-label="Supressor de ruído"
              min={-80}
              max={-20}
              value={settings?.gateThreshold ?? -45}
              onChange={(e) => tone3000?.setGateThreshold(Number(e.target.value))}
              className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-ink-400 mt-1">
              Corta ruídos e chiados de captadores quando você não está tocando.
            </p>
          </div>

          {/* Studio Room Reverb */}
          <div className="p-3.5 rounded-2xl border border-ink-800 bg-ink-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-200 flex items-center gap-1.5">
                <Volume2 size={14} className="text-amp-400" />
                Ambiência de Estúdio (Reverb)
              </span>
              <span className="text-xs font-mono text-amp-400">
                {Math.round((settings?.reverbMix ?? 0.15) * 100)}%
              </span>
            </div>
            <input
              type="range"
                aria-label="Reverb"
              min={0}
              max={1}
              step={0.02}
              value={settings?.reverbMix ?? 0.15}
              onChange={(e) => tone3000?.setReverbMix(Number(e.target.value))}
              className="w-full accent-amp-400 h-1.5 bg-ink-700 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-ink-400 mt-1">
              Simula a acústica natural de uma sala de estúdio profissional.
            </p>
          </div>
        </div>

        {/* Live Output VU Meter & Actions */}
        <div className="mt-5 pt-4 border-t border-ink-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-ink-300 mb-1.5">
              <span>Nível de Saída do Amplificador (VU Meter)</span>
              <span className="font-mono text-hit font-bold">
                {Math.round(outputLevel * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-hit via-amp-400 to-amp-500"
                style={{ width: `${Math.min(100, outputLevel * 160)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="min-h-10 rounded-xl bg-gradient-to-r from-amp-500 to-amp-600 px-6 py-2.5 text-sm font-bold text-ink-100 shadow-lg shadow-amp-500/25 hover:from-amp-400 hover:to-amp-500 transition cursor-pointer"
            >
              Aplicar & Tocar
            </button>
          </div>
        </div>
    </ModalFrame>
  );
};
