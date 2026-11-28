import { DEFAULT_GUIDE_SHADOW } from './defaults';
import type { GuideSettings, GuideShadowSettings, GuideStyle } from './types';

// One-click looks of the guide. Choosing one fills the style and every detailed option (not the on/off switch nor the
// intensity); touching any option afterwards matches none of them, which the screen shows as "Personalizada".
export const GUIDE_PRESET_IDS = ['discreet', 'highlight', 'cinema', 'outline', 'neon'] as const;
export type GuidePresetId = (typeof GUIDE_PRESET_IDS)[number];

export interface GuidePreset {
  id: GuidePresetId;
  name: string;
  description: string;
  style: GuideStyle;
  shadow: GuideShadowSettings;
}

const shadow = (overrides: Partial<GuideShadowSettings>): GuideShadowSettings => ({ ...DEFAULT_GUIDE_SHADOW, ...overrides });

export const GUIDE_PRESETS: readonly GuidePreset[] = [
  {
    id: 'discreet', name: 'Discreta', description: 'Uma sombra leve, só para apontar a nota.', style: 'shadow',
    shadow: shadow({ opacity: 45, width: 120, height: 120, blur: 40, outline: false, trail: false, pulse: false })
  },
  { id: 'highlight', name: 'Destaque', description: 'Corpo escuro atrás da nota, com borda visível. O padrão.', style: 'shadow', shadow: shadow({}) },
  {
    id: 'cinema', name: 'Cinema', description: 'Grande e macia, com rastro longo e a próxima nota em prévia.', style: 'shadow',
    shadow: shadow({
      opacity: 90, width: 170, height: 160, blur: 70, offsetY: 10, outline: false, trailLength: 100, trailOpacity: 40,
      pulseStrength: 70, hopMs: 400, showNext: true
    })
  },
  {
    id: 'outline', name: 'Contorno', description: 'Quase só uma moldura em volta da nota.', style: 'shadow',
    shadow: shadow({
      opacity: 20, width: 130, height: 130, blur: 0, offsetY: 0, shape: 'rounded', outlineWidth: 4, outlineColor: 'white', trail: false
    })
  },
  {
    id: 'neon', name: 'Neon', description: 'O holograma luminoso, na cor da corda.', style: 'hologram',
    shadow: shadow({ opacity: 70, color: 'string', blur: 80, outlineColor: 'string', pulseStrength: 80, glow: 100 })
  }
];

export const getGuidePreset = (id: GuidePresetId): GuidePreset => GUIDE_PRESETS.find((preset) => preset.id === id) ?? GUIDE_PRESETS[1];

export const sameGuideShadow = (a: GuideShadowSettings, b: GuideShadowSettings): boolean =>
  (Object.keys(a) as (keyof GuideShadowSettings)[]).every((key) => a[key] === b[key]);

/** The preset the guide is exactly at, or null when it was customized. */
export const matchGuidePreset = (guide: GuideSettings): GuidePresetId | null =>
  GUIDE_PRESETS.find((preset) => preset.style === guide.style && sameGuideShadow(preset.shadow, guide.shadow))?.id ?? null;
