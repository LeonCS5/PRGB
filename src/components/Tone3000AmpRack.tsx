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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl border border-neutral-700/80 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 text-neutral-100 overflow-hidden">
        
        {/* Glow ambient background accents */}
        <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Header with TONE3000 Branding and Master Monitor Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/25 border border-cyan-400/30">
              <Zap className="text-white fill-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                  TONE3000
                </h2>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-cyan-300">
                  DSP Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400">
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
                  ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300 shadow-emerald-500/20'
                  : 'border-rose-900/60 bg-rose-950/40 text-rose-400'
              }`}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isMonitoring ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-rose-500'
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
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2 text-xs text-amber-300/90">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span>
            <strong>Dica de estúdio:</strong> Use fones de ouvido para tocar sem microfonia e com a melhor definição sonora.
          </span>
        </div>

        {/* Amp Presets Selector */}
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center gap-1.5">
            <Radio size={14} className="text-cyan-400" />
            Modelos de Amplificador (TONE3000 Presets)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(Object.keys(AMP_PRESETS) as AmpPresetId[]).map((pid) => {
              const p = AMP_PRESETS[pid];
              const isSelected = currentPreset === pid;
              return (
                <button
                  key={pid}
                  onClick={() => tone3000?.setPreset(pid)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 bg-gradient-to-b from-cyan-950/60 to-neutral-900 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold truncate w-full">{p.badge}</span>
                  <span className="text-[10px] text-neutral-500 mt-0.5 line-clamp-1">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amp Faceplate & Knobs Rack */}
        <div className="mt-5 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-5 shadow-inner">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800/80 text-xs">
            <div className="flex items-center gap-2 text-neutral-300 font-mono font-bold">
              <Sliders size={14} className="text-cyan-400" />
              <span>PAINEL DE CONTROLE VALVULADO (TONE STACK)</span>
            </div>
            {settings && (
              <button
                onClick={() => tone3000?.setPreset(settings.preset)}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-cyan-300 transition cursor-pointer"
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
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-300 uppercase mb-1">Gain</span>
              <input
                type="range"
                min={0}
                max={100}
                value={settings?.gain ?? 50}
                onChange={(e) => tone3000?.setGain(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-cyan-400 mt-2">
                {settings?.gain ?? 50}%
              </span>
            </div>

            {/* BASS */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-300 uppercase mb-1">Bass</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.bass ?? 0}
                onChange={(e) => tone3000?.setBass(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-neutral-200 mt-2">
                {settings?.bass ? `${settings.bass > 0 ? '+' : ''}${settings.bass} dB` : '0 dB'}
              </span>
            </div>

            {/* MIDDLE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-300 uppercase mb-1">Middle</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.mid ?? 0}
                onChange={(e) => tone3000?.setMid(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-neutral-200 mt-2">
                {settings?.mid ? `${settings.mid > 0 ? '+' : ''}${settings.mid} dB` : '0 dB'}
              </span>
            </div>

            {/* TREBLE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-300 uppercase mb-1">Treble</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.treble ?? 0}
                onChange={(e) => tone3000?.setTreble(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-neutral-200 mt-2">
                {settings?.treble ? `${settings.treble > 0 ? '+' : ''}${settings.treble} dB` : '0 dB'}
              </span>
            </div>

            {/* PRESENCE */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-300 uppercase mb-1">Presence</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings?.presence ?? 0}
                onChange={(e) => tone3000?.setPresence(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-neutral-200 mt-2">
                {settings?.presence ? `${settings.presence > 0 ? '+' : ''}${settings.presence} dB` : '0 dB'}
              </span>
            </div>

            {/* MASTER VOLUME */}
            <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <span className="text-[11px] font-bold text-emerald-400 uppercase mb-1">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings?.masterVolume ?? 0.75}
                onChange={(e) => tone3000?.setMasterVolume(Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 mt-2">
                {Math.round((settings?.masterVolume ?? 0.75) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Rack Effects (Cabinet Simulation, Noise Gate, Studio Room Reverb) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Cabinet Simulator */}
          <div className="p-3.5 rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <label className="text-xs font-bold text-neutral-300 block mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-400" />
              Gabinete & Alto-falante
            </label>
            <select
              value={settings?.cabSim ?? '4x12_metal'}
              onChange={(e) => tone3000?.setCabSim(e.target.value as CabSimType)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="4x12_metal">4x12 Modern Metal (Celestion V30)</option>
              <option value="4x12_vintage">4x12 Vintage 30 (American Lead)</option>
              <option value="2x12_british">2x12 British Greenback (Plexi)</option>
              <option value="1x12_tweed">1x12 California Tweed (Clean)</option>
              <option value="bypass">Bypass Cab Sim (Sinal Direto)</option>
            </select>
          </div>

          {/* Noise Gate */}
          <div className="p-3.5 rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Flame size={14} className="text-amber-400" />
                Noise Gate (Supressor de Ruído)
              </span>
              <span className="text-xs font-mono text-amber-400">
                {settings?.gateThreshold ?? -45} dB
              </span>
            </div>
            <input
              type="range"
              min={-80}
              max={-20}
              value={settings?.gateThreshold ?? -45}
              onChange={(e) => tone3000?.setGateThreshold(Number(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Corta ruídos e chiados de captadores quando você não está tocando.
            </p>
          </div>

          {/* Studio Room Reverb */}
          <div className="p-3.5 rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Volume2 size={14} className="text-indigo-400" />
                Ambiência de Estúdio (Reverb)
              </span>
              <span className="text-xs font-mono text-indigo-400">
                {Math.round((settings?.reverbMix ?? 0.15) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={settings?.reverbMix ?? 0.15}
              onChange={(e) => tone3000?.setReverbMix(Number(e.target.value))}
              className="w-full accent-indigo-400 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Simula a acústica natural de uma sala de estúdio profissional.
            </p>
          </div>
        </div>

        {/* Live Output VU Meter & Actions */}
        <div className="mt-5 pt-4 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
              <span>Nível de Saída do Amplificador (VU Meter)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round(outputLevel * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                style={{ width: `${Math.min(100, outputLevel * 160)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition cursor-pointer"
            >
              Aplicar & Tocar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
