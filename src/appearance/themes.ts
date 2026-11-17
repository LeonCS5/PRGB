// A theme is 9 base colors. They are written as CSS variables on <html> (CSSOM, allowed by the CSP), overriding the
// existing ink-* / amp-* / signal-* tokens, so every component follows without edits. "Original" writes nothing:
// the --color-* defaults in index.css are that theme.
// Gameplay colors (six strings, players, hit/near/miss, note violet, the canvas position/hit line) have their own
// tokens that no theme touches: only the surfaces around them change.
import type { ThemeId } from './types';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  primary: string;
  secondary: string;
  text: string;
  textMuted: string;
  success: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  // null = the current identity, untouched
  colors: ThemeColors | null;
}

export const ORIGINAL_THEME_ID: ThemeId = 'original';

// The Original swatches only feed the preview; they are the real current tokens (index.css)
export const ORIGINAL_PREVIEW: ThemeColors = {
  background: '#07070b', surface: '#0d0e15', surfaceElevated: '#181a26', border: '#242738',
  primary: '#ff9a4d', secondary: '#34e3ff', text: '#eceef5', textMuted: '#8389a3', success: '#3ee08f'
};

export const THEMES: readonly ThemeDefinition[] = [
  { id: ORIGINAL_THEME_ID, name: 'PRGB Original', description: 'As cores atuais, sem nenhuma mudança.', colors: null },
  {
    id: 'refined', name: 'PRGB Refined', description: 'A identidade atual, mais refinada e confortável.',
    colors: { background: '#090A0F', surface: '#12141C', surfaceElevated: '#1B1E29', border: '#282D3C', primary: '#FF984B', secondary: '#75E5F4', text: '#F3F4F8', textMuted: '#9DA7BA', success: '#39DCA1' }
  },
  {
    id: 'midnight-arcade', name: 'Midnight Arcade', description: 'Jogo de ritmo moderno, fundos azulados.',
    colors: { background: '#0B0C18', surface: '#17192A', surfaceElevated: '#20243A', border: '#30344E', primary: '#FF865E', secondary: '#65DFFC', text: '#F6F5FF', textMuted: '#A3A7C6', success: '#34E5A0' }
  },
  {
    id: 'graphite-studio', name: 'Graphite Studio', description: 'Sóbrio, de software de produção musical.',
    colors: { background: '#111214', surface: '#1C1E22', surfaceElevated: '#272A30', border: '#363A40', primary: '#F2A45C', secondary: '#79C9CE', text: '#F5F5F4', textMuted: '#A8ADB4', success: '#65C98C' }
  },
  {
    id: 'analog-soul', name: 'Analog Soul', description: 'Amplificadores clássicos e estúdio tradicional.',
    colors: { background: '#191714', surface: '#29251F', surfaceElevated: '#373128', border: '#504537', primary: '#D6A65C', secondary: '#A6B8A0', text: '#F2E8D8', textMuted: '#B4A695', success: '#88B987' }
  },
  {
    id: 'electric-neon', name: 'Electric Neon', description: 'Detalhes intensos de jogo rítmico.',
    colors: { background: '#080B12', surface: '#121827', surfaceElevated: '#1C2638', border: '#2D3B50', primary: '#B7F34B', secondary: '#4DE1FF', text: '#F0F7FF', textMuted: '#91A4B8', success: '#38E8A0' }
  }
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: string): boolean => HEX.test(value);

const parse = (hex: string): [number, number, number] =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];

const toHex = (rgb: number[]): string =>
  '#' + rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('');

// Linear mix in sRGB: t = 0 gives a, t = 1 gives b
export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
};

const luminance = (hex: string): number => {
  const [r, g, b] = parse(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// WCAG contrast ratio
export const contrastRatio = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const WHITE = '#ffffff';
const BLACK = '#000000';

// Every CSS variable a theme sets: the existing scales (so components follow) plus the new semantic names
export const deriveTokens = (colors: ThemeColors): Record<string, string> => {
  const { background, surface, surfaceElevated, border, primary, secondary, text, textMuted, success } = colors;
  return {
    '--color-ink-950': background,
    '--color-ink-900': surface,
    '--color-ink-850': mix(surface, surfaceElevated, 0.5),
    '--color-ink-800': surfaceElevated,
    '--color-ink-700': border,
    '--color-ink-600': mix(border, textMuted, 0.3),
    '--color-ink-500': mix(border, textMuted, 0.6),
    '--color-ink-400': textMuted,
    '--color-ink-300': mix(textMuted, text, 0.45),
    '--color-ink-200': mix(textMuted, text, 0.8),
    '--color-ink-100': text,
    '--color-amp-200': mix(primary, WHITE, 0.6),
    '--color-amp-300': mix(primary, WHITE, 0.28),
    '--color-amp-400': primary,
    '--color-amp-500': mix(primary, BLACK, 0.12),
    '--color-amp-600': mix(primary, BLACK, 0.26),
    '--color-amp-700': mix(primary, BLACK, 0.45),
    '--color-signal-300': mix(secondary, WHITE, 0.4),
    '--color-signal-400': secondary,
    '--color-signal-500': mix(secondary, BLACK, 0.15),
    '--color-signal-600': mix(secondary, BLACK, 0.35),
    '--color-success': success,
    '--color-logo-1': mix(primary, WHITE, 0.2),
    '--color-logo-2': mix(primary, BLACK, 0.12),
    '--color-logo-3': mix(primary, BLACK, 0.4)
  };
};

// Every variable name any theme may write, so applying a theme can clear what the previous one left
export const THEME_TOKEN_NAMES: readonly string[] = Object.keys(deriveTokens(THEMES[1].colors!));

export const findTheme = (id: string | null): ThemeDefinition =>
  THEMES.find((theme) => theme.id === id) ?? THEMES[0];

// The pairs that must stay readable in every theme; the test fails if a palette breaks one
export const READABILITY_CHECKS = (colors: ThemeColors) => [
  { name: 'texto no fundo', ratio: contrastRatio(colors.text, colors.background), min: 7 },
  { name: 'texto no cartão', ratio: contrastRatio(colors.text, colors.surface), min: 7 },
  { name: 'texto discreto no fundo', ratio: contrastRatio(colors.textMuted, colors.background), min: 4.5 },
  { name: 'texto discreto no cartão', ratio: contrastRatio(colors.textMuted, colors.surfaceElevated), min: 4.5 },
  { name: 'rótulo sobre a cor principal', ratio: contrastRatio(colors.background, colors.primary), min: 4.5 },
  { name: 'cor principal no fundo', ratio: contrastRatio(colors.primary, colors.background), min: 4.5 },
  { name: 'cor secundária no fundo', ratio: contrastRatio(colors.secondary, colors.background), min: 4.5 },
  { name: 'sucesso no fundo', ratio: contrastRatio(colors.success, colors.background), min: 4.5 }
];
