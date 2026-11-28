import { Accessibility, Image as ImageIcon, LayoutPanelTop, Music2, Palette, Sparkles, SunDim, type LucideIcon } from 'lucide-react';
import type {
  BackgroundStyle, EffectIntensity, FontPack, GameplayContrast, GuideChordCover, GuideColor, GuideEasing, GuideShape, GuideStyle, LineStyle, NoteSize, NoteStyle,
  StringScheme, StringThickness, UiStyle
} from '../../appearance/types';

export type CategoryId = 'temas' | 'interface' | 'notas' | 'sombra' | 'efeitos' | 'fundo' | 'acessibilidade';

export interface Category { id: CategoryId; label: string; icon: LucideIcon }

export const CATEGORIES: readonly Category[] = [
  { id: 'temas', label: 'Temas', icon: Palette },
  { id: 'interface', label: 'Interface', icon: LayoutPanelTop },
  { id: 'notas', label: 'Notas e cordas', icon: Music2 },
  { id: 'sombra', label: 'Sombra-guia', icon: SunDim },
  { id: 'efeitos', label: 'Efeitos visuais', icon: Sparkles },
  { id: 'fundo', label: 'Fundo', icon: ImageIcon },
  { id: 'acessibilidade', label: 'Acessibilidade', icon: Accessibility }
];

export interface Option<T extends string | number> { value: T; label: string; hint: string }

export const UI_OPTIONS: readonly Option<UiStyle>[] = [
  { value: 'soft', label: 'Suave', hint: 'Cantos arredondados, o visual de sempre.' },
  { value: 'sharp', label: 'Reto', hint: 'Cantos retos e bordas bem definidas.' },
  { value: 'arcade', label: 'Arcade', hint: 'Cantos médios, contorno duplo e botões que afundam.' }
];

export const FONT_OPTIONS: readonly Option<FontPack>[] = [
  { value: 'modern', label: 'Moderna', hint: 'Inter, limpa e neutra.' },
  { value: 'technical', label: 'Técnica', hint: 'IBM Plex, precisa como um painel.' },
  { value: 'expressive', label: 'Expressiva', hint: 'Space Grotesk, a letra do PRGB.' }
];

export const NOTE_OPTIONS: readonly Option<NoteStyle>[] = [
  { value: 'classic', label: 'Clássica', hint: 'Cápsula cheia, o visual original.' },
  { value: 'arcade', label: 'Arcade', hint: 'Bloco com borda marcada.' },
  { value: 'minimal', label: 'Mínima', hint: 'Só o contorno, discreta.' },
  { value: 'neon', label: 'Neon', hint: 'Contorno luminoso.' },
  { value: 'digital', label: 'Digital', hint: 'Forma angular, de painel.' }
];

export const NOTE_SIZE_OPTIONS: readonly Option<NoteSize>[] = [
  { value: 80, label: 'Pequeno', hint: '80%: mais ar entre as notas.' },
  { value: 100, label: 'Normal', hint: 'O tamanho que a pista sugere.' },
  { value: 125, label: 'Grande', hint: '125%: números maiores.' },
  { value: 150, label: 'Enorme', hint: '150%: o maior que cabe entre as cordas.' }
];

export const SCHEME_OPTIONS: readonly Option<StringScheme>[] = [
  { value: 'original', label: 'Original', hint: 'As cores de sempre.' },
  { value: 'vibrant', label: 'Vibrante', hint: 'Cores fortes e bem separadas.' },
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

export const GUIDE_STYLE_OPTIONS: readonly Option<GuideStyle>[] = [
  { value: 'shadow', label: 'Sombra', hint: 'Uma sombra escura e suave atrás da nota a tocar.' },
  { value: 'hologram', label: 'Holograma', hint: 'Um halo luminoso com núcleo brilhante.' }
];

export const BACKGROUND_OPTIONS: readonly Option<BackgroundStyle>[] = [
  { value: 'solid', label: 'Lisa', hint: 'Cor lisa, o visual de sempre.' },
  { value: 'gradient', label: 'Degradê', hint: 'Degradê suave de cima para baixo.' },
  { value: 'grid', label: 'Grade', hint: 'Grade fina, como papel milimetrado.' },
  { value: 'ambient', label: 'Ambiente', hint: 'Duas luzes difusas nos cantos.' }
];

export type EffectKey = 'hitPulse' | 'perfectSpark' | 'comboGlow' | 'noteTrail' | 'reactiveBackground';

export const EFFECT_ITEMS: readonly { key: EffectKey; label: string; hint: string }[] = [
  { key: 'hitPulse', label: 'Pulso de acerto', hint: 'Um anel se abre na linha de acerto a cada nota acertada.' },
  { key: 'perfectSpark', label: 'Faíscas do Perfeito', hint: 'Faíscas curtas saem da nota quando o acerto é Perfeito.' },
  { key: 'comboGlow', label: 'Brilho do combo', hint: 'A linha de acerto brilha mais conforme o combo cresce.' },
  { key: 'noteTrail', label: 'Rastro das notas', hint: 'As notas deixam um rastro suave enquanto andam.' },
  { key: 'reactiveBackground', label: 'Fundo reativo', hint: 'O fundo da pista reage de leve ao som que você toca.' }
];

export const GUIDE_SHAPE_OPTIONS: readonly Option<GuideShape>[] = [
  { value: 'capsule', label: 'Cápsula', hint: 'Extremidades totalmente arredondadas.' },
  { value: 'ellipse', label: 'Elipse', hint: 'Oval, como um halo.' },
  { value: 'rounded', label: 'Retângulo', hint: 'Cantos arredondados, mais quadrada.' },
  { value: 'note', label: 'Formato da nota', hint: 'Segue os cantos do estilo de nota escolhido.' }
];

export const GUIDE_COLOR_OPTIONS: readonly (Option<GuideColor> & { swatch: string | null })[] = [
  { value: 'auto', label: 'Automática', hint: '', swatch: null },
  { value: 'black', label: 'Preto', hint: '', swatch: '#000000' },
  { value: 'string', label: 'Cor da corda', hint: '', swatch: null },
  { value: 'white', label: 'Branco', hint: '', swatch: '#ffffff' },
  { value: 'amber', label: 'Laranja', hint: '', swatch: '#ff9a4d' },
  { value: 'cyan', label: 'Ciano', hint: '', swatch: '#34e3ff' },
  { value: 'violet', label: 'Violeta', hint: '', swatch: '#c49bff' },
  { value: 'green', label: 'Verde', hint: '', swatch: '#3ee08f' },
  { value: 'red', label: 'Vermelho', hint: '', swatch: '#ff4d6d' }
];

export const GUIDE_EASING_OPTIONS: readonly Option<GuideEasing>[] = [
  { value: 'smooth', label: 'Suave', hint: 'Sai devagar, acelera e chega macio.' },
  { value: 'snap', label: 'Seca', hint: 'Espera e pula de uma vez, perto da nota.' },
  { value: 'elastic', label: 'Elástica', hint: 'Passa um pouco do ponto e volta.' }
];

export const GUIDE_COVER_OPTIONS: readonly Option<GuideChordCover>[] = [
  { value: 'between', label: 'Cobrir tudo', hint: 'Uma forma só, da corda mais aguda à mais grave do acorde.' },
  { value: 'played', label: 'Só as tocadas', hint: 'Uma sombra em cada corda que soa, sem cobrir as do meio.' }
];
