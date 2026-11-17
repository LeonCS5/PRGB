import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_EFFECTS, DEFAULT_STRINGS } from '../appearance/defaults';
import { getPreset } from '../appearance/presets';
import { THEMES } from '../appearance/themes';
import type { AppearanceSettings } from '../appearance/types';
import { AppearanceScreen } from './AppearanceScreen';
import {
  AccessibilitySection, BackgroundSection, EffectsSection, InterfaceSection, NotesSection, ThemesSection
} from './appearance/sections';
import { PreviewSamples } from './appearance/PreviewPanel';
import { CATEGORIES } from './appearance/options';
import * as preview from './gameplayPreview';
import { ORIGINAL_PALETTE } from './testCanvas';

// The palette reads CSS variables from the document, which the Node test environment does not have
vi.mock('../appearance/useGamePalette', () => ({ useGamePalette: () => ORIGINAL_PALETTE }));

const noop = () => {};
const base = (overrides: Partial<AppearanceSettings> = {}): AppearanceSettings => ({ ...DEFAULT_APPEARANCE, ...overrides });

describe('AppearanceScreen', () => {
  it('names the screen, lists the six categories and marks the open one', () => {
    const html = renderToStaticMarkup(createElement(AppearanceScreen, { onExit: noop }));
    expect(html).toContain('>Aparência</h1>');
    for (const category of CATEGORIES) expect(html).toContain(category.label);
    expect(CATEGORIES).toHaveLength(6);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true".*?<\/svg>Temas/);
    expect(html).toContain('Voltar ao início');
    expect(html).toContain('Pré-visualização');
    expect(html).toContain('aria-label="Categorias de aparência"');
  });

  it('draws nothing during the render', () => {
    const draw = vi.spyOn(preview, 'drawGameplayPreview');
    renderToStaticMarkup(createElement(AppearanceScreen, { onExit: noop }));
    expect(draw).not.toHaveBeenCalled();
    draw.mockRestore();
  });
});

describe('ThemesSection', () => {
  const render = (settings: AppearanceSettings, customized: boolean) =>
    renderToStaticMarkup(createElement(ThemesSection, { settings, onChange: noop, customized, onPreset: noop, onReset: noop }));

  it('lists the six presets and marks only the active one with text', () => {
    const html = render(getPreset('midnight-arcade'), false);
    for (const theme of THEMES) expect(html).toContain(theme.name);
    expect(THEMES).toHaveLength(6);
    expect(html.match(/>ativo</g)).toHaveLength(1);
    expect(html.match(/<input[^>]*checked/g)).toHaveLength(1);
    expect(html).toContain('Tema Midnight Arcade sem alterações');
    expect(html).not.toContain('Personalizado');
  });

  it('says it is customized, and from which preset', () => {
    const html = render({ ...getPreset('refined'), noteStyle: 'neon' }, true);
    expect(html).toContain('Personalizado');
    expect(html).toContain('a partir de PRGB Refined');
    expect(html).toContain('ativo, personalizado');
  });

  it('offers a restore button and says where the choices are saved', () => {
    const html = render(DEFAULT_APPEARANCE, false);
    expect(html).toContain('Restaurar padrões');
    expect(html).toContain('só neste navegador');
  });
});

describe('option sections', () => {
  it('Interface: three styles and three fonts, with the active one marked', () => {
    const html = renderToStaticMarkup(createElement(InterfaceSection, { settings: base({ uiStyle: 'sharp', font: 'technical' }), onChange: noop }));
    for (const label of ['Soft', 'Sharp', 'Arcade', 'Modern', 'Technical', 'Expressive']) expect(html).toContain(label);
    expect(html.match(/<legend/g)).toHaveLength(2);
    expect(html.match(/>ativo</g)).toHaveLength(2);
    expect(html).toContain('Estilo dos componentes');
    expect(html).toContain('Tipografia');
  });

  it('Notes: styles, schemes with their colors, ranges with a visible value', () => {
    const settings = base({ noteStyle: 'neon', strings: { ...DEFAULT_STRINGS, scheme: 'vibrant', glow: 35 } });
    const html = renderToStaticMarkup(createElement(NotesSection, { settings, onChange: noop, originalStrings: ORIGINAL_PALETTE.strings }));
    for (const label of ['Classic', 'Arcade', 'Minimal', 'Neon', 'Digital', 'Original', 'Vibrant', 'Pastel', 'Sólida', 'Segmentada', 'Fina', 'Grossa']) expect(html).toContain(label);
    expect(html).toContain('#ff3d9a');
    expect(html).toContain('#c49bff');
    expect(html).toContain('>35%</output>');
    expect(html).toContain('Brilho das cordas');
    expect(html.match(/type="range"/g)).toHaveLength(3);
  });

  it('Effects: five switches with a line each, and the reduced motion notice only when it applies', () => {
    const on = base({ effects: { ...DEFAULT_EFFECTS, hitPulse: true } });
    const html = renderToStaticMarkup(createElement(EffectsSection, { settings: on, onChange: noop, effectsPaused: false }));
    for (const label of ['Hit Pulse', 'Perfect Spark', 'Combo Glow', 'Note Trail', 'Reactive Background', 'Sutil', 'Forte']) expect(html).toContain(label);
    expect(html.match(/role="switch"/g)).toHaveLength(5);
    expect(html.match(/<input[^>]*role="switch"[^>]*checked/g)).toHaveLength(1);
    expect(html).not.toContain('movimento reduzido');
    const paused = renderToStaticMarkup(createElement(EffectsSection, { settings: on, onChange: noop, effectsPaused: true }));
    expect(paused).toContain('Efeitos desligados por preferência de movimento reduzido');
  });

  it('Background: four styles with a thumbnail each', () => {
    const html = renderToStaticMarkup(createElement(BackgroundSection, { settings: base({ background: 'grid' }), onChange: noop }));
    for (const label of ['Solid', 'Gradient', 'Grid', 'Ambient']) expect(html).toContain(label);
    expect(html.match(/h-14 rounded-lg/g)).toHaveLength(4);
    expect(html.match(/>ativo</g)).toHaveLength(1);
  });

  it('Accessibility: the master switch, the system preference and the contrast note', () => {
    const html = renderToStaticMarkup(createElement(AccessibilitySection, { settings: base({ reduceEffects: true }), onChange: noop, systemReducesMotion: false }));
    expect(html).toContain('Desativar todos os efeitos decorativos');
    expect(html).toMatch(/<input[^>]*role="switch"[^>]*checked/);
    expect(html).toContain('preferência de movimento reduzido do sistema');
    expect(html).toContain('contraste');
  });
});

describe('PreviewSamples', () => {
  it('shows success and error with text, the theme colors and the component style', () => {
    const html = renderToStaticMarkup(createElement(PreviewSamples, { settings: base({ uiStyle: 'arcade' }) }));
    expect(html).toContain('Perfeito!');
    expect(html).toContain('Errou');
    expect(html).toContain('Primário');
    expect(html).toContain('Secundário');
    expect(html).toContain('Cores do tema');
    expect(html).toContain('Estilo Arcade');
  });
});
