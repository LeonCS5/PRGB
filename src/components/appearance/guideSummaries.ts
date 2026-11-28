// The one-line summaries of the shadow groups (what each collapsed group shows). Plain functions, apart from the
// component file so that it exports only components.
import type { GuideColor, GuideSettings } from '../../appearance/types';
import { GUIDE_COLOR_OPTIONS, GUIDE_EASING_OPTIONS, GUIDE_SHAPE_OPTIONS } from './options';

export const colorName = (value: GuideColor): string => GUIDE_COLOR_OPTIONS.find((option) => option.value === value)?.label.toLowerCase() ?? value;

export const guideSummaries = (guide: GuideSettings) => {
  const s = guide.shadow;
  const onOff = (value: boolean) => (value ? 'ligado' : 'desligado');
  return {
    body: `${s.shape === 'note' ? 'formato da nota' : GUIDE_SHAPE_OPTIONS.find((o) => o.value === s.shape)?.label.toLowerCase()} · ${colorName(s.color)} · ${s.opacity}% · ${s.width}×${s.height}%`,
    outline: s.outline ? `${s.outlineWidth} px · ${colorName(s.outlineColor)}` : 'desligado',
    trail: s.trail ? `${s.trailLength}% de comprimento · ${s.trailOpacity}% de opacidade` : 'desligado',
    motion: `salto ${s.hopMs} ms · ${GUIDE_EASING_OPTIONS.find((o) => o.value === s.easing)?.label.toLowerCase()} · pulso ${onOff(s.pulse)}`,
    chords: `${s.chordCover === 'between' ? 'cobre tudo' : 'só as tocadas'} · próxima nota ${onOff(s.showNext)}`,
    glow: `${s.glow}%`
  };
};
