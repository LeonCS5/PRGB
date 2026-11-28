import React, { useEffect, useId } from 'react';
import { Gauge, MoveHorizontal } from 'lucide-react';
import { SPEED_OPTIONS, ZOOM_AUTO, ZOOM_OPTIONS } from '../context/sessionSettings';
import { formatZoomLabel } from './noteSpacing';
import { formatScale } from './gameScaleKit';

export interface ScaleToastData {
  id: number;
  text: string;
}

// Where the value sits among the options, as filled segments: a glance tells "slow/fast" and "close/far"
const LevelBar: React.FC<{ options: readonly number[]; value: number }> = ({ options, value }) => {
  const current = Math.max(0, options.indexOf(value));
  return (
    <span aria-hidden="true" className="flex items-center gap-0.5">
      {options.map((option, index) => (
        <span key={option} className={'h-1 w-2.5 rounded-full transition-colors ' + (index <= current ? 'bg-amp-400' : 'bg-ink-600')} />
      ))}
    </span>
  );
};

interface ScaleControlProps {
  label: string;
  hint: string;
  icon: React.ReactNode;
  options: readonly number[];
  value: number;
  disabled?: boolean;
  describedBy?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

const ScaleControl: React.FC<ScaleControlProps> = ({ label, hint, icon, options, value, disabled = false, describedBy, format = formatScale, onChange }) => {
  const id = useId();
  return (
    <div title={hint} className={'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-2.5 text-ink-200 transition focus-within:border-amp-400 hover:border-ink-500' + (disabled ? ' cursor-not-allowed opacity-60' : '')}>
      <span aria-hidden="true" className="text-ink-400">{icon}</span>
      <div className="flex flex-col justify-center gap-0.5">
        <label htmlFor={id} className="text-[0.625rem] font-semibold uppercase leading-none tracking-wider text-ink-400">{label}</label>
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(Number(event.target.value))}
          className="-ml-1 cursor-pointer bg-ink-800 font-mono text-sm font-bold leading-none text-ink-100 focus:outline-none disabled:cursor-not-allowed"
        >
          {options.map((option) => <option key={option} value={option}>{format(option)}</option>)}
        </select>
        <LevelBar options={options} value={value} />
      </div>
    </div>
  );
};

export interface GameScaleControlsProps {
  speed: number;
  zoom: number;
  autoZoom?: number; // what Auto measured for this song, shown on its option
  speedLocked: boolean;
  lockedHint?: string;
  lockedHelpId?: string;
  onSpeedChange: (value: number) => void;
  onZoomChange: (value: number) => void;
}

export const GameScaleControls: React.FC<GameScaleControlsProps> = ({ speed, zoom, autoZoom = 1, speedLocked, lockedHint, lockedHelpId, onSpeedChange, onZoomChange }) => (
  <>
    <ScaleControl label="Velocidade" hint={lockedHint ?? 'Velocidade da música'} icon={<Gauge size={16} />} options={SPEED_OPTIONS} value={speed}
      disabled={speedLocked} describedBy={lockedHelpId} onChange={onSpeedChange} />
    <ScaleControl label="Espaçamento" hint="Espaçamento entre as notas na pista (o tamanho das notas fica na Aparência). Auto espaça cada música para as notas não se sobreporem." icon={<MoveHorizontal size={16} />} options={ZOOM_OPTIONS} value={zoom}
      format={(option) => (option === ZOOM_AUTO ? formatZoomLabel(ZOOM_AUTO, autoZoom) : formatScale(option))} onChange={onZoomChange} />
  </>
);

const TOAST_MS = 1400;

// Brief confirmation over the track after a change; a polite live region so a screen reader hears it too
export const ScaleToast: React.FC<{ toast: ScaleToastData | null; onDone: () => void }> = ({ toast, onDone }) => {
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      {toast && (
        <span key={toast.id} className="rounded-full border border-amp-400/60 bg-ink-900/90 px-4 py-1.5 font-mono text-sm font-bold text-amp-300 shadow-panel">
          {toast.text}
        </span>
      )}
    </div>
  );
};
