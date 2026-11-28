import React, { useId } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { GUIDE_PRESETS, getGuidePreset, matchGuidePreset, type GuidePresetId } from '../appearance/guidePresets';
import { THEMES } from '../appearance/themes';
import { applyPreset, isPresetCustomized, setAppearance, useAppearance } from '../appearance/useAppearance';
import type { ThemeId } from '../appearance/types';
import { ZOOM_AUTO, ZOOM_OPTIONS } from '../context/sessionSettings';
import { OptionGroup, SwitchField } from './appearance/controls';
import { EFFECT_ITEMS, GUIDE_STYLE_OPTIONS, INTENSITY_OPTIONS, NOTE_OPTIONS, NOTE_SIZE_OPTIONS, SCHEME_OPTIONS } from './appearance/options';
import { formatScale } from './gameScaleKit';
import { formatZoomLabel } from './noteSpacing';
import { ModalFrame } from './ModalFrame';
import { RESUME_SECONDS } from './resumeCountdown';

export interface QuickAppearancePanelProps {
  onClose: () => void;
  onOpenAll: () => void;
  zoom: number;
  autoZoom?: number; // what Auto measured for this song
  onZoomChange: (value: number) => void;
  paused: boolean; // the game stopped when the panel opened (not in a duo online, where the song never waits)
}

// Compact versions of the choices: the cards of the full screen without their long hints
const compact = <T extends string | number>(options: readonly { value: T; label: string; hint: string }[]) => options.map((option) => ({ ...option, hint: '' }));
const NOTE_COMPACT = compact(NOTE_OPTIONS);
const NOTE_SIZE_COMPACT = compact(NOTE_SIZE_OPTIONS);
const SCHEME_COMPACT = compact(SCHEME_OPTIONS);
const GUIDE_STYLE_COMPACT = compact(GUIDE_STYLE_OPTIONS);

const selectClass = 'mt-1 min-h-11 w-full cursor-pointer rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400';

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="space-y-3 border-t border-ink-700 pt-4 first:border-t-0 first:pt-0">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h3>
    {children}
  </section>
);

// "Aparência rápida": the choices people change most, over the game, which stays visible beside it. Everything applies
// at once on the canvas; the full screen (with every option) opens from the last button without leaving the game
export const QuickAppearancePanel: React.FC<QuickAppearancePanelProps> = ({ onClose, onOpenAll, zoom, autoZoom = 1, onZoomChange, paused }) => {
  const settings = useAppearance();
  const titleId = useId();
  const themeId = useId();
  const presetId = useId();
  const zoomId = useId();
  const { guide } = settings;
  const activePreset = matchGuidePreset(guide);
  const customized = isPresetCustomized(settings);

  return (
    <ModalFrame titleId={titleId} onClose={onClose}
      className="m-0! max-sm:inset-x-0! max-sm:top-auto! max-sm:bottom-0! max-sm:max-h-[58dvh]! max-sm:w-full! max-sm:rounded-b-none! sm:inset-y-0! sm:right-0! sm:left-auto! sm:h-dvh sm:max-h-none! sm:w-96! sm:rounded-r-none! overflow-y-auto backdrop:bg-transparent! backdrop:backdrop-blur-none!">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-xl font-bold">Aparência rápida</h2>
          <p role="status" className="mt-1 text-xs leading-5 text-ink-300">
            {paused ? `A música está pausada. Ao fechar, volta em ${RESUME_SECONDS} s.` : 'Na dupla online a música não para: ajuste com calma.'} As mudanças aparecem na pista na hora.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar e continuar tocando" className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-ink-700 text-ink-200 transition hover:border-ink-500">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Block title="Tema">
          <div>
            <label htmlFor={themeId} className="text-sm font-semibold text-ink-100">Tema {customized && <span className="font-normal text-near">(personalizado)</span>}</label>
            <select id={themeId} value={settings.presetId ?? ''} onChange={(event) => { if (event.target.value) applyPreset(event.target.value as ThemeId); }} className={selectClass}>
              {!settings.presetId && <option value="">Personalizado</option>}
              {THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </div>
        </Block>

        <Block title="Sombra-guia">
          <SwitchField id="quick-guide" label="Sombra-guia" hint="Mostra na linha de acerto qual nota tocar agora."
            checked={guide.enabled} onChange={(enabled) => setAppearance({ guide: { enabled } })} />
          {guide.enabled && (
            <>
              <div>
                <label htmlFor={presetId} className="text-sm font-semibold text-ink-100">Predefinição</label>
                <select id={presetId} value={activePreset ?? ''} className={selectClass}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const preset = getGuidePreset(event.target.value as GuidePresetId);
                    setAppearance({ guide: { style: preset.style, shadow: { ...preset.shadow } } });
                  }}>
                  {!activePreset && <option value="">Personalizada</option>}
                  {GUIDE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
              </div>
              <OptionGroup legend="Estilo" name="quick-guide-style" options={GUIDE_STYLE_COMPACT} value={guide.style}
                onChange={(style) => setAppearance({ guide: { style } })} columns="grid-cols-2" />
              <OptionGroup legend="Intensidade" name="quick-guide-intensity" options={INTENSITY_OPTIONS} value={guide.intensity}
                onChange={(intensity) => setAppearance({ guide: { intensity } })} columns="grid-cols-3" />
            </>
          )}
        </Block>

        <Block title="Notas e cordas">
          <OptionGroup legend="Estilo da nota" name="quick-note" options={NOTE_COMPACT} value={settings.noteStyle}
            onChange={(noteStyle) => setAppearance({ noteStyle })} columns="grid-cols-2" />
          <OptionGroup legend="Tamanho das notas" name="quick-note-size" options={NOTE_SIZE_COMPACT} value={settings.noteSize}
            onChange={(noteSize) => setAppearance({ noteSize })} columns="grid-cols-2" />
          <SwitchField id="quick-techniques" label="Mostrar as técnicas" hint="Ligados (H e P), slides, vibrato, palm mute e bend. Desligado, só os números."
            checked={settings.techniques.show} onChange={(show) => setAppearance({ techniques: { show } })} />
          <OptionGroup legend="Cores das cordas" name="quick-scheme" options={SCHEME_COMPACT} value={settings.strings.scheme}
            onChange={(scheme) => setAppearance({ strings: { scheme } })} columns="grid-cols-2" />
          <div>
            <label htmlFor={zoomId} className="text-sm font-semibold text-ink-100">Espaçamento das notas</label>
            <select id={zoomId} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} className={selectClass + ' font-mono'}>
              {ZOOM_OPTIONS.map((value) => <option key={value} value={value}>{value === ZOOM_AUTO ? formatZoomLabel(ZOOM_AUTO, autoZoom) : formatScale(value)}</option>)}
            </select>
          </div>
        </Block>

        <Block title="Sons e efeitos">
          <SwitchField id="quick-hit-sounds" label="Sons de acerto e erro" hint="Os sons curtos de Perfeito, Bom e Errou."
            checked={settings.hitSounds} onChange={(hitSounds) => setAppearance({ hitSounds })} />
          <details className="group rounded-xl border border-ink-700 bg-ink-900">
            <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-semibold text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400">Efeitos visuais</summary>
            <div className="space-y-2 border-t border-ink-700 p-2">
              {EFFECT_ITEMS.map((item) => (
                <SwitchField key={item.key} id={`quick-effect-${item.key}`} label={item.label} hint={item.hint}
                  checked={settings.effects[item.key]} onChange={(checked) => setAppearance({ effects: { [item.key]: checked } })} />
              ))}
              <SwitchField id="quick-reduce-effects" label="Desativar todos os efeitos" hint="Deixa o jogo mais quieto."
                checked={settings.reduceEffects} onChange={(reduceEffects) => setAppearance({ reduceEffects })} />
            </div>
          </details>
        </Block>
      </div>

      <div className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex flex-col gap-2 border-t border-ink-700 bg-ink-900 px-5 pb-5 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:flex-row-reverse sm:px-6 sm:pb-6">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 cursor-pointer rounded-xl bg-amp-400 px-4 text-sm font-bold text-ink-950 transition hover:bg-amp-300">Continuar tocando</button>
        <button type="button" onClick={onOpenAll} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 px-4 text-sm font-semibold text-ink-200 transition hover:border-ink-500">
          Todas as opções<ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </ModalFrame>
  );
};
