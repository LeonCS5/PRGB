import { Accessibility, Image as ImageIcon, LayoutPanelTop, Music2, Palette, Sparkles, type LucideIcon } from 'lucide-react';
import type { BackgroundStyle, EffectIntensity, FontPack, GameplayContrast, LineStyle, NoteStyle, StringScheme, StringThickness, UiStyle } from '../../appearance/types';

export type CategoryId = 'temas' | 'interface' | 'notas' | 'efeitos' | 'fundo' | 'acessibilidade';

export interface Category { id: CategoryId; label: string; icon: LucideIcon }

export const CATEGORIES: readonly Category[] = [
  { id: 'temas', label: 'Temas', icon: Palette },
  { id: 'interface', label: 'Interface', icon: LayoutPanelTop },
  { id: 'notas', label: 'Notas e cordas', icon: Music2 },
  { id: 'efeitos', label: 'Efeitos visuais', icon: Sparkles },
  { id: 'fundo', label: 'Fundo', icon: ImageIcon },
  { id: 'acessibilidade', label: 'Acessibilidade', icon: Accessibility }
];

export interface Option<T extends string | number> { value: T; label: string; hint: string }

export const UI_OPTIONS: readonly Option<UiStyle>[] = [
  { value: 'soft', label: 'Soft', hint: 'Cantos arredondados, o visual de sempre.' },
  { value: 'sharp', label: 'Sharp', hint: 'Cantos retos e bordas bem definidas.' },
  { value: 'arcade', label: 'Arcade', hint: 'Cantos médios, contorno duplo e botões que afundam.' }
];

export const FONT_OPTIONS: readonly Option<FontPack>[] = [
  { value: 'modern', label: 'Modern', hint: 'Inter, limpa e neutra.' },
  { value: 'technical', label: 'Technical', hint: 'IBM Plex, precisa como um painel.' },
  { value: 'expressive', label: 'Expressive', hint: 'Space Grotesk, a letra do PRGB.' }
];

export const NOTE_OPTIONS: readonly Option<NoteStyle>[] = [
  { value: 'classic', label: 'Classic', hint: 'Cápsula cheia, o visual original.' },
  { value: 'arcade', label: 'Arcade', hint: 'Bloco com borda marcada.' },
  { value: 'minimal', label: 'Minimal', hint: 'Só o contorno, discreta.' },
  { value: 'neon', label: 'Neon', hint: 'Contorno luminoso.' },
  { value: 'digital', label: 'Digital', hint: 'Forma angular, de painel.' }
];

export const SCHEME_OPTIONS: readonly Option<StringScheme>[] = [
  { value: 'original', label: 'Original', hint: 'As cores de sempre.' },
  { value: 'vibrant', label: 'Vibrant', hint: 'Cores fortes e bem separadas.' },
  { value: 'pastel', label: 'Pastel', hint: 'Cores suaves.' }
];

export const THICKNESS_OPTIONS: readonly Option<StringThickness>[] = [
  { value: 'thin', label: 'Fina', hint: '' },
  { value: 'normal', label: 'Normal', hint: '' },
  { value: 'thick', label: 'Grossa', hint: '' }
];

export const LINE_OPTIONS: readonly Option<LineStyle>[] = [
  { value: 'solid', label: 'Sólida', hint: '' },
  { value: 'dashed', label: 'Segmentada', hint: '' }
];

export const CONTRAST_OPTIONS: readonly Option<GameplayContrast>[] = [
  { value: 'low', label: 'Baixo', hint: '' },
  { value: 'normal', label: 'Normal', hint: '' },
  { value: 'high', label: 'Alto', hint: '' }
];

export const INTENSITY_OPTIONS: readonly Option<EffectIntensity>[] = [
  { value: 1, label: 'Sutil', hint: '' },
  { value: 2, label: 'Normal', hint: '' },
  { value: 3, label: 'Forte', hint: '' }
];

export const BACKGROUND_OPTIONS: readonly Option<BackgroundStyle>[] = [
  { value: 'solid', label: 'Solid', hint: 'Cor lisa, o visual de sempre.' },
  { value: 'gradient', label: 'Gradient', hint: 'Degradê suave de cima para baixo.' },
  { value: 'grid', label: 'Grid', hint: 'Grade fina, como papel milimetrado.' },
  { value: 'ambient', label: 'Ambient', hint: 'Duas luzes difusas nos cantos.' }
];

export type EffectKey = 'hitPulse' | 'perfectSpark' | 'comboGlow' | 'noteTrail' | 'reactiveBackground';

export const EFFECT_ITEMS: readonly { key: EffectKey; label: string; hint: string }[] = [
  { key: 'hitPulse', label: 'Hit Pulse', hint: 'Um anel se abre na linha de acerto a cada nota acertada.' },
  { key: 'perfectSpark', label: 'Perfect Spark', hint: 'Faíscas curtas saem da nota quando o acerto é Perfeito.' },
  { key: 'comboGlow', label: 'Combo Glow', hint: 'A linha de acerto brilha mais conforme o combo cresce.' },
  { key: 'noteTrail', label: 'Note Trail', hint: 'As notas deixam um rastro suave enquanto andam.' },
  { key: 'reactiveBackground', label: 'Reactive Background', hint: 'O fundo da pista reage de leve ao som que você toca.' }
];
