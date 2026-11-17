import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { ORIGINAL_PREVIEW, THEMES } from '../../appearance/themes';
import type { AppearanceSettings, StringScheme, ThemeId } from '../../appearance/types';
import type { AppearancePatch } from '../../appearance/useAppearance';
import { STRING_SCHEME_COLORS } from '../gameplayPalette';
import { OptionGroup, RangeField, SwitchField } from './controls';
import {
  BACKGROUND_OPTIONS, CONTRAST_OPTIONS, EFFECT_ITEMS, FONT_OPTIONS, INTENSITY_OPTIONS, LINE_OPTIONS, NOTE_OPTIONS,
  SCHEME_OPTIONS, THICKNESS_OPTIONS, UI_OPTIONS
} from './options';

export interface SectionProps {
  settings: AppearanceSettings;
  onChange: (patch: AppearancePatch) => void;
}

const Heading: React.FC<{ id: string; title: string; children?: React.ReactNode }> = ({ id, title, children }) => (
  <header className="mb-4">
    <h2 id={id} className="font-display text-xl font-bold text-ink-100">{title}</h2>
    {children && <p className="mt-1 text-sm leading-6 text-ink-300">{children}</p>}
  </header>
);

export interface ThemesSectionProps extends SectionProps {
  customized: boolean;
  onPreset: (id: ThemeId) => void;
  onReset: () => void;
}

export const ThemesSection: React.FC<ThemesSectionProps> = ({ settings, customized, onPreset, onReset }) => {
  const [confirming, setConfirming] = useState(false);
  const activeName = THEMES.find((theme) => theme.id === settings.presetId)?.name;
  return (
    <div className="space-y-5">
      <Heading id="appearance-title-temas" title="Temas">Cada tema é um visual completo: cores, estilo, letras, notas e fundo. Depois você pode ajustar o que quiser.</Heading>
      <fieldset className="min-w-0">
        <legend className="sr-only">Tema</legend>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]">
          {THEMES.map((theme) => {
            const active = settings.presetId === theme.id;
            const colors = theme.colors ?? ORIGINAL_PREVIEW;
            const swatches = [colors.background, colors.surface, colors.surfaceElevated, colors.primary, colors.secondary, colors.text];
            return (
              <label key={theme.id} className="relative block min-w-0 cursor-pointer">
                <input type="radio" name="appearance-theme" value={theme.id} checked={active} onChange={() => onPreset(theme.id)} className="peer sr-only" />
                <span className={`flex h-full flex-col gap-2 rounded-2xl border p-3 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-400 ${active ? 'border-amp-400 bg-amp-500/10' : 'border-ink-600 bg-ink-900 hover:border-ink-400'}`}>
                  <span aria-hidden="true" className="flex h-9 overflow-hidden rounded-lg border border-ink-600">
                    {swatches.map((color, index) => <span key={index} className="flex-1" style={{ backgroundColor: color }} />)}
                  </span>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-100">
                    {theme.name}
                    {active && <span className="flex items-center gap-1 text-xs font-semibold text-amp-300"><Check size={14} aria-hidden="true" />{customized ? 'ativo, personalizado' : 'ativo'}</span>}
                  </span>
                  <span className="text-xs leading-5 text-ink-300">{theme.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p role="status" className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200">
        {customized
          ? <><strong className="font-semibold text-near">Personalizado</strong>{activeName ? ` a partir de ${activeName}` : ''}: você mudou algo do tema escolhido.</>
          : <>Tema {activeName} sem alterações.</>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-sm text-ink-200">Voltar tudo ao PRGB Original?</span>
            <button type="button" onClick={() => { onReset(); setConfirming(false); }}
              className="min-h-11 cursor-pointer rounded-xl bg-amp-400 px-4 text-sm font-bold text-ink-950 hover:bg-amp-300">Sim, restaurar</button>
            <button type="button" onClick={() => setConfirming(false)}
              className="min-h-11 cursor-pointer rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">Cancelar</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">
            <RotateCcw size={16} aria-hidden="true" />Restaurar padrões
          </button>
        )}
      </div>
      <p className="text-xs leading-5 text-ink-300">Suas escolhas ficam salvas só neste navegador. Nada é enviado a lugar nenhum.</p>
    </div>
  );
};

// Fixed per option (not the current setting), so each card shows what it would look like
const radiusClass = { soft: 'rounded-[12px]', sharp: 'rounded-[2px]', arcade: 'rounded-[8px]' } as const;
const fontClass = {
  modern: "font-['Inter',ui-sans-serif,system-ui,sans-serif]",
  technical: "font-['IBM_Plex_Sans',ui-sans-serif,system-ui,sans-serif]",
  expressive: "font-['Space_Grotesk','Inter',ui-sans-serif,system-ui,sans-serif]"
} as const;

export const InterfaceSection: React.FC<SectionProps> = ({ settings, onChange }) => (
  <div className="space-y-6">
    <Heading id="appearance-title-interface" title="Interface">Formato dos botões e painéis, e a letra do site.</Heading>
    <OptionGroup legend="Estilo dos componentes" name="appearance-ui" options={UI_OPTIONS} value={settings.uiStyle}
      onChange={(uiStyle) => onChange({ uiStyle })}
      sample={(option) => (
        <span aria-hidden="true" className="flex gap-1.5">
          <span className={`flex h-8 items-center border border-amp-400 bg-amp-400 px-3 text-xs font-bold text-ink-950 ${radiusClass[option.value]}`}>Tocar</span>
          <span className={`flex h-8 items-center border border-ink-500 px-3 text-xs font-semibold text-ink-200 ${radiusClass[option.value]}`}>Voltar</span>
        </span>
      )} />
    <OptionGroup legend="Tipografia" name="appearance-font" options={FONT_OPTIONS} value={settings.font}
      onChange={(font) => onChange({ font })}
      sample={(option) => (
        <span aria-hidden="true" className={`block leading-6 text-ink-100 ${fontClass[option.value]}`}>
          <span className="block text-lg font-bold">Toque no tempo</span>
          <span className="block text-sm">Perfeito 98% · 124 bpm</span>
        </span>
      )} />
  </div>
);

const SchemeSwatch: React.FC<{ colors: readonly string[] }> = ({ colors }) => (
  <span aria-hidden="true" className="flex h-5 overflow-hidden rounded-md border border-ink-600">
    {colors.map((color, index) => <span key={index} className="flex-1" style={{ backgroundColor: color }} />)}
  </span>
);

export const NotesSection: React.FC<SectionProps & { originalStrings: readonly string[] }> = ({ settings, onChange, originalStrings }) => {
  const { strings } = settings;
  const colorsOf = (scheme: StringScheme): readonly string[] => scheme === 'original' ? originalStrings : STRING_SCHEME_COLORS[scheme];
  return (
    <div className="space-y-6">
      <Heading id="appearance-title-notas" title="Notas e cordas">Como as notas e as seis cordas aparecem na pista. Só o desenho muda, nunca a pontuação.</Heading>
      <OptionGroup legend="Estilo da nota" name="appearance-note" options={NOTE_OPTIONS} value={settings.noteStyle}
        onChange={(noteStyle) => onChange({ noteStyle })} />
      <div>
        <OptionGroup legend="Esquema de cores das cordas" name="appearance-scheme" options={SCHEME_OPTIONS} value={strings.scheme}
          onChange={(scheme) => onChange({ strings: { scheme } })}
          sample={(option) => <SchemeSwatch colors={colorsOf(option.value)} />} />
        <p className="mt-2 text-xs leading-5 text-ink-300">As cores seguem a ordem das cordas: da 1 (mais aguda) à 6 (mais grave).</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <OptionGroup legend="Espessura das cordas" name="appearance-thickness" options={THICKNESS_OPTIONS} value={strings.thickness}
          onChange={(thickness) => onChange({ strings: { thickness } })} columns="grid-cols-3" />
        <OptionGroup legend="Linha das cordas" name="appearance-line" options={LINE_OPTIONS} value={strings.lineStyle}
          onChange={(lineStyle) => onChange({ strings: { lineStyle } })} columns="grid-cols-2" />
      </div>
      <OptionGroup legend="Contraste do fundo da pista" name="appearance-contrast" options={CONTRAST_OPTIONS} value={strings.contrast}
        onChange={(contrast) => onChange({ strings: { contrast } })} columns="grid-cols-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <RangeField id="appearance-intensity" label="Intensidade das cores" value={strings.intensity} min={40} max={100}
          onChange={(intensity) => onChange({ strings: { intensity } })} />
        <RangeField id="appearance-lane-opacity" label="Opacidade das pistas" value={strings.laneOpacity} min={30} max={100}
          onChange={(laneOpacity) => onChange({ strings: { laneOpacity } })} />
        <RangeField id="appearance-glow" label="Brilho das cordas" value={strings.glow} min={0} max={100}
          hint="Zero é o visual original, sem brilho." onChange={(glow) => onChange({ strings: { glow } })} />
      </div>
    </div>
  );
};

export const EffectsSection: React.FC<SectionProps & { effectsPaused: boolean }> = ({ settings, onChange, effectsPaused }) => (
  <div className="space-y-5">
    <Heading id="appearance-title-efeitos" title="Efeitos visuais">Enfeites opcionais durante o jogo. Todos começam desligados e nenhum muda a pontuação.</Heading>
    {effectsPaused && (
      <p role="status" className="rounded-xl border border-near/40 bg-near/10 p-3 text-sm text-ink-100">
        Efeitos desligados por preferência de movimento reduzido. Suas escolhas abaixo ficam guardadas e voltam a valer quando a preferência mudar.
      </p>
    )}
    <div className="grid gap-2 sm:grid-cols-2">
      {EFFECT_ITEMS.map((item) => (
        <SwitchField key={item.key} id={`appearance-effect-${item.key}`} label={item.label} hint={item.hint}
          checked={settings.effects[item.key]} onChange={(checked) => onChange({ effects: { [item.key]: checked } })} />
      ))}
    </div>
    <OptionGroup legend="Intensidade dos efeitos" name="appearance-effect-intensity" options={INTENSITY_OPTIONS} value={settings.effects.intensity}
      onChange={(intensity) => onChange({ effects: { intensity } })} columns="grid-cols-3" />
  </div>
);

// Static strings so Tailwind sees every class; the gradients mirror the data-bg rules of index.css at thumbnail scale
const backgroundThumb = {
  solid: 'bg-ink-950',
  gradient: 'bg-ink-950 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-amp-500)_18%,transparent)_0%,transparent_60%),linear-gradient(0deg,color-mix(in_srgb,var(--color-ink-600)_70%,transparent)_0%,transparent_50%)]',
  grid: 'bg-ink-950 bg-[linear-gradient(color-mix(in_srgb,var(--color-ink-100)_14%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--color-ink-100)_14%,transparent)_1px,transparent_1px)] bg-[length:12px_12px]',
  ambient: 'bg-ink-950 bg-[radial-gradient(ellipse_60%_55%_at_12%_0%,color-mix(in_srgb,var(--color-amp-500)_38%,transparent),transparent_70%),radial-gradient(ellipse_55%_55%_at_92%_100%,color-mix(in_srgb,var(--color-signal-500)_30%,transparent),transparent_70%)]'
} as const;

export const BackgroundSection: React.FC<SectionProps> = ({ settings, onChange }) => (
  <div className="space-y-5">
    <Heading id="appearance-title-fundo" title="Fundo">O pano de fundo do site. É estático, sem animação, e fica mais discreto durante o jogo.</Heading>
    <OptionGroup legend="Estilo do fundo" name="appearance-background" options={BACKGROUND_OPTIONS} value={settings.background}
      onChange={(background) => onChange({ background })}
      sample={(option) => <span aria-hidden="true" className={`block h-14 rounded-lg border border-ink-600 ${backgroundThumb[option.value]}`} />} />
  </div>
);

export const AccessibilitySection: React.FC<SectionProps & { systemReducesMotion: boolean }> = ({ settings, onChange, systemReducesMotion }) => (
  <div className="space-y-5">
    <Heading id="appearance-title-acessibilidade" title="Acessibilidade" />
    <SwitchField id="appearance-reduce-effects" label="Desativar todos os efeitos decorativos"
      hint="Desliga brilhos, rastros, faíscas e sombras de enfeite. O jogo continua igual, só mais quieto."
      checked={settings.reduceEffects} onChange={(reduceEffects) => onChange({ reduceEffects })} />
    <p className="text-sm leading-6 text-ink-200">
      O PRGB já respeita a preferência de movimento reduzido do sistema{systemReducesMotion ? ': ela está ligada neste aparelho, então os efeitos já estão desligados' : ''}.
    </p>
    <p className="text-sm leading-6 text-ink-200">
      Os temas são testados para leitura: o texto mantém contraste suficiente com o fundo. Acerto e erro nunca dependem só da cor, o jogo sempre mostra também o texto.
    </p>
  </div>
);
