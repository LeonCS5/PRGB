import React, { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { DEFAULT_GUIDE } from '../../appearance/defaults';
import { GUIDE_PRESETS, getGuidePreset, matchGuidePreset, type GuidePresetId } from '../../appearance/guidePresets';
import type { GuideColor, GuideShadowSettings } from '../../appearance/types';
import { OptionGroup, RangeField, SwitchField } from './controls';
import {
  GUIDE_COLOR_OPTIONS, GUIDE_COVER_OPTIONS, GUIDE_EASING_OPTIONS, GUIDE_SHAPE_OPTIONS, GUIDE_STYLE_OPTIONS, INTENSITY_OPTIONS, type Option
} from './options';
import type { SectionProps } from './sections';
import { guideSummaries } from './guideSummaries';


// A swatch of colours as radios: 'automática' and 'cor da corda' have no fixed colour, so they show a text chip
const ColorField: React.FC<{ legend: string; name: string; value: GuideColor; onChange: (value: GuideColor) => void }> = ({ legend, name, value, onChange }) => (
  <fieldset className="min-w-0">
    <legend className="mb-2 text-sm font-semibold text-ink-100">{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {GUIDE_COLOR_OPTIONS.map((option) => {
        const checked = option.value === value;
        return (
          <label key={option.value} className="relative block cursor-pointer">
            <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)} className="peer sr-only" />
            <span className={`flex min-h-11 min-w-11 items-center gap-2 rounded-xl border px-2.5 text-xs font-semibold text-ink-100 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-400 ${checked ? 'border-amp-400 bg-amp-500/10' : 'border-ink-600 bg-ink-900 hover:border-ink-400'}`}>
              <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-ink-400"
                style={{ background: option.swatch ?? 'conic-gradient(#c49bff, #34e3ff, #3ee08f, #ffc94d, #ff9a4d, #c49bff)' }} />
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

// A recolhível group of options. Its summary shows the values at a glance, so the screen stays short
const Group: React.FC<{ title: string; summary: string; children: React.ReactNode }> = ({ title, summary, children }) => (
  <details className="group rounded-2xl border border-ink-700 bg-ink-900">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink-100">{title}</span>
        <span className="block truncate text-xs text-ink-300">{summary}</span>
      </span>
      <ChevronDown size={16} className="shrink-0 text-ink-300 transition group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="space-y-5 border-t border-ink-700 p-4">{children}</div>
  </details>
);


type ShadowPatch = Partial<GuideShadowSettings>;

export const GuideSection: React.FC<SectionProps> = ({ settings, onChange }) => {
  const { guide } = settings;
  const [confirming, setConfirming] = useState(false);
  const setShadow = (shadow: ShadowPatch) => onChange({ guide: { shadow } });
  const active = matchGuidePreset(guide);
  const summaries = guideSummaries(guide);
  const hologram = guide.style === 'hologram';
  const presetOptions: readonly Option<string>[] = GUIDE_PRESETS.map((preset) => ({ value: preset.id, label: preset.name, hint: preset.description }));
  const applyPreset = (id: GuidePresetId) => {
    const preset = getGuidePreset(id);
    onChange({ guide: { style: preset.style, shadow: { ...preset.shadow } } });
  };
  const shadow = guide.shadow;

  return (
    <div className="space-y-5">
      <header>
        <h2 id="appearance-title-sombra" className="font-display text-xl font-bold text-ink-100">Sombra-guia</h2>
        <p className="mt-1 text-sm leading-6 text-ink-300">
          Uma sombra na linha de acerto mostra qual é a próxima nota e salta até ela na hora de tocar. Deixe do seu jeito: nada aqui muda a pontuação.
        </p>
      </header>
      <SwitchField id="appearance-guide" label="Sombra-guia" hint="Desligada, nenhuma sombra aparece no jogo."
        checked={guide.enabled} onChange={(enabled) => onChange({ guide: { enabled } })} />
      {guide.enabled && (
        <>
          <div className="space-y-2">
            <OptionGroup legend="Predefinições" name="appearance-guide-preset" options={presetOptions} value={active ?? ''}
              onChange={(id) => applyPreset(id as GuidePresetId)} />
            <p role="status" className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200">
              {active
                ? <>Predefinição <strong className="font-semibold text-ink-100">{getGuidePreset(active).name}</strong> sem alterações.</>
                : <><strong className="font-semibold text-near">Personalizada</strong>: você mudou alguma opção. Escolha uma predefinição para recomeçar dela.</>}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <OptionGroup legend="Estilo da sombra-guia" name="appearance-guide-style" options={GUIDE_STYLE_OPTIONS} value={guide.style}
              onChange={(style) => onChange({ guide: { style } })} columns="grid-cols-1" />
            <OptionGroup legend="Intensidade da sombra-guia" name="appearance-guide-intensity" options={INTENSITY_OPTIONS} value={guide.intensity}
              onChange={(intensity) => onChange({ guide: { intensity } })} columns="grid-cols-3" />
          </div>

          <SwitchField id="appearance-guide-preserve" label="Preservar a nota (recomendado)"
            hint="A sombra nunca esconde a nota: o holograma vira um anel e a nota mantém o tamanho e a nitidez."
            checked={shadow.preserveNote} onChange={(preserveNote) => setShadow({ preserveNote })} />

          <div className="space-y-3">
            <Group title="Corpo" summary={summaries.body}>
              {!hologram && (
                <OptionGroup legend="Forma" name="appearance-guide-shape" options={GUIDE_SHAPE_OPTIONS} value={shadow.shape}
                  onChange={(shape) => setShadow({ shape })} />
              )}
              <ColorField legend="Cor" name="appearance-guide-color" value={shadow.color} onChange={(color) => setShadow({ color })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <RangeField id="appearance-guide-opacity" label="Opacidade" value={shadow.opacity} min={20} max={100} step={5}
                  hint="Quanto mais alta, mais escura e presente." onChange={(opacity) => setShadow({ opacity })} />
                {!hologram && (
                  <RangeField id="appearance-guide-blur" label="Suavidade das bordas" value={shadow.blur} min={0} max={100} step={5}
                    hint="Zero é borda seca." onChange={(blur) => setShadow({ blur })} />
                )}
                <RangeField id="appearance-guide-width" label="Largura" value={shadow.width} min={80} max={180} step={5}
                  hint="100% é do tamanho da nota." onChange={(width) => setShadow({ width })} />
                <RangeField id="appearance-guide-height" label="Altura" value={shadow.height} min={80} max={180} step={5}
                  onChange={(height) => setShadow({ height })} />
                <RangeField id="appearance-guide-offset-x" label="Deslocamento horizontal" value={shadow.offsetX} min={-50} max={50} step={5}
                  hint="Positivo empurra para a direita." onChange={(offsetX) => setShadow({ offsetX })} />
                <RangeField id="appearance-guide-offset-y" label="Deslocamento vertical" value={shadow.offsetY} min={-50} max={50} step={5}
                  hint="Positivo empurra para baixo." onChange={(offsetY) => setShadow({ offsetY })} />
              </div>
            </Group>

            {!hologram && (
              <Group title="Contorno" summary={summaries.outline}>
                <SwitchField id="appearance-guide-outline" label="Contorno" hint="Uma borda em volta do corpo, para ele aparecer sobre o fundo escuro."
                  checked={shadow.outline} onChange={(outline) => setShadow({ outline })} />
                {shadow.outline && (
                  <>
                    <RangeField id="appearance-guide-outline-width" label="Espessura" value={shadow.outlineWidth} min={1} max={6} step={1} unit=" px"
                      onChange={(outlineWidth) => setShadow({ outlineWidth })} />
                    <ColorField legend="Cor do contorno" name="appearance-guide-outline-color" value={shadow.outlineColor} onChange={(outlineColor) => setShadow({ outlineColor })} />
                  </>
                )}
              </Group>
            )}

            <Group title="Rastro" summary={summaries.trail}>
              <SwitchField id="appearance-guide-trail" label="Rastro" hint="Um traço fraco liga a linha de acerto à nota que vem, atrás dela."
                checked={shadow.trail} onChange={(trail) => setShadow({ trail })} />
              {shadow.trail && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <RangeField id="appearance-guide-trail-length" label="Comprimento" value={shadow.trailLength} min={20} max={100} step={10}
                    onChange={(trailLength) => setShadow({ trailLength })} />
                  <RangeField id="appearance-guide-trail-opacity" label="Opacidade do rastro" value={shadow.trailOpacity} min={10} max={100} step={10}
                    onChange={(trailOpacity) => setShadow({ trailOpacity })} />
                </div>
              )}
            </Group>

            <Group title="Movimento" summary={summaries.motion}>
              <RangeField id="appearance-guide-hop" label="Antecedência do salto" value={shadow.hopMs} min={100} max={600} step={50} unit=" ms"
                hint="Quanto tempo antes da nota a sombra começa a saltar. Com movimento reduzido ela só troca de lugar."
                onChange={(hopMs) => setShadow({ hopMs })} />
              <OptionGroup legend="Jeito do salto" name="appearance-guide-easing" options={GUIDE_EASING_OPTIONS} value={shadow.easing}
                onChange={(easing) => setShadow({ easing })} columns="grid-cols-1 sm:grid-cols-3" />
              <SwitchField id="appearance-guide-pulse" label="Pulso ao tocar" hint="A sombra incha por um instante quando chega a hora da nota."
                checked={shadow.pulse} onChange={(pulse) => setShadow({ pulse })} />
              {shadow.pulse && (
                <RangeField id="appearance-guide-pulse-strength" label="Força do pulso" value={shadow.pulseStrength} min={10} max={100} step={10}
                  onChange={(pulseStrength) => setShadow({ pulseStrength })} />
              )}
            </Group>

            <Group title="Acordes e próxima nota" summary={summaries.chords}>
              <OptionGroup legend="Acordes" name="appearance-guide-cover" options={GUIDE_COVER_OPTIONS} value={shadow.chordCover}
                onChange={(chordCover) => setShadow({ chordCover })} columns="grid-cols-1 sm:grid-cols-2" />
              <SwitchField id="appearance-guide-next" label="Prévia da próxima nota" hint="Uma sombra bem fraca, um pouco à frente, já mostra onde vem a nota seguinte."
                checked={shadow.showNext} onChange={(showNext) => setShadow({ showNext })} />
            </Group>

            {hologram && (
              <Group title="Holograma" summary={`brilho ${summaries.glow}`}>
                <RangeField id="appearance-guide-glow" label="Brilho" value={shadow.glow} min={0} max={100} step={10}
                  hint="O quanto o halo se espalha. Só vale para o estilo Holograma." onChange={(glow) => setShadow({ glow })} />
              </Group>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {confirming ? (
              <>
                <span className="text-sm text-ink-200">Voltar a sombra ao padrão?</span>
                <button type="button" onClick={() => { onChange({ guide: { style: DEFAULT_GUIDE.style, intensity: DEFAULT_GUIDE.intensity, shadow: { ...DEFAULT_GUIDE.shadow } } }); setConfirming(false); }}
                  className="min-h-11 cursor-pointer rounded-xl bg-amp-400 px-4 text-sm font-bold text-ink-950 hover:bg-amp-300">Sim, restaurar</button>
                <button type="button" onClick={() => setConfirming(false)}
                  className="min-h-11 cursor-pointer rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">Cancelar</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">
                <RotateCcw size={16} aria-hidden="true" />Restaurar sombra
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
