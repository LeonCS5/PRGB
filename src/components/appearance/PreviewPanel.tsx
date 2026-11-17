import React from 'react';
import { Check, X } from 'lucide-react';
import type { AppearanceSettings, GameplayAppearance } from '../../appearance/types';
import type { GamePalette } from '../practiceLanes';
import { GameplayPreviewCanvas } from './GameplayPreviewCanvas';
import { UI_OPTIONS } from './options';

const COLOR_CHIPS: readonly { label: string; className: string }[] = [
  { label: 'Fundo', className: 'bg-ink-950' },
  { label: 'Painel', className: 'bg-ink-900' },
  { label: 'Elevado', className: 'bg-ink-700' },
  { label: 'Principal', className: 'bg-amp-400' },
  { label: 'Destaque', className: 'bg-signal-400' },
  { label: 'Texto', className: 'bg-ink-100' }
];

export const PreviewCanvasCard: React.FC<{ appearance: GameplayAppearance; palette: GamePalette; className?: string }> = ({ appearance, palette, className = 'h-40' }) => (
  <GameplayPreviewCanvas appearance={appearance} palette={palette} className={className} />
);

// Real components with the real tokens: the attributes on <html> already restyle them, so this shows what the app will look like
export const PreviewSamples: React.FC<{ settings: AppearanceSettings }> = ({ settings }) => {
  const uiLabel = UI_OPTIONS.find((option) => option.value === settings.uiStyle)?.label ?? '';
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-300">Cores do tema</p>
        <ul className="grid grid-cols-6 gap-1.5">
          {COLOR_CHIPS.map((chip) => (
            <li key={chip.label} className="min-w-0 text-center">
              <span aria-hidden="true" className={`block h-7 rounded-md border border-ink-500 ${chip.className}`} />
              <span className="mt-1 block truncate text-[10px] text-ink-300">{chip.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4 shadow-panel">
        <p className="font-display text-base font-bold text-ink-100">Cartão de exemplo</p>
        <p className="mt-1 text-sm text-ink-300">Estilo {uiLabel}: bordas, cantos e letra do site.</p>
        <p className="mt-3 text-xs font-semibold text-ink-200">Campo de texto</p>
        <input type="text" readOnly value="Exemplo" tabIndex={-1} aria-label="Campo de texto de exemplo"
          className="mt-1 min-h-11 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 text-sm text-ink-100" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" tabIndex={-1} className="min-h-11 rounded-xl bg-amp-400 px-4 text-sm font-bold text-ink-950 shadow-glow-amp">Primário</button>
          <button type="button" tabIndex={-1} className="min-h-11 rounded-xl border border-ink-600 bg-ink-900 px-4 text-sm font-semibold text-ink-100">Secundário</button>
          <span className="rounded-full border border-signal-500/40 bg-signal-500/10 px-3 py-1 font-mono text-xs text-signal-300">124 bpm</span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <p className="flex items-center gap-2 rounded-xl border border-hit/40 bg-hit/10 px-3 py-2 text-sm font-semibold text-ink-100"><Check size={16} className="shrink-0 text-hit" aria-hidden="true" />Perfeito!</p>
        <p className="flex items-center gap-2 rounded-xl border border-miss/40 bg-miss/10 px-3 py-2 text-sm font-semibold text-ink-100"><X size={16} className="shrink-0 text-miss" aria-hidden="true" />Errou</p>
      </div>
    </div>
  );
};
