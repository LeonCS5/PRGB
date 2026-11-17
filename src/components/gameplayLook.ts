// What the canvas draws with, resolved from the base palette (the theme) and the gameplay appearance.
// Built once per change of settings, never per frame.

import type { GameplayAppearance, NoteStyle, StringSettings } from '../appearance/types';
import { resolveGameplayPalette, sameStringLook } from './gameplayPalette';
import { buildNoteKit, type NoteKit } from './noteStyles';
import type { GamePalette } from './practiceLanes';

export interface GameplayLook {
  base: GamePalette;
  noteStyle: NoteStyle;
  strings: StringSettings;
  palette: GamePalette;
  kit: NoteKit;
}

export const buildGameplayLook = (base: GamePalette, appearance: Pick<GameplayAppearance, 'noteStyle' | 'strings'>): GameplayLook => {
  const strings = { ...appearance.strings };
  const palette = resolveGameplayPalette(base, strings);
  return { base, noteStyle: appearance.noteStyle, strings, palette, kit: buildNoteKit(palette, appearance.noteStyle, strings.glow) };
};

export const isCurrentLook = (look: GameplayLook, base: GamePalette, appearance: Pick<GameplayAppearance, 'noteStyle' | 'strings'>): boolean =>
  look.base === base && look.noteStyle === appearance.noteStyle && sameStringLook(look.strings, appearance.strings);
