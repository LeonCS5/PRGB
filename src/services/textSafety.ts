// Filters for free text that a peer controls and that the UI later shows (room messages).
// Same rules the challenge links use: no control/bidi/invisible characters, no links or domains, no blocked terms.
import { containsBlockedTerm } from './nickname';

// Control characters, lone surrogates, bidi marks, overrides and isolates (they garble the text around
// them) and invisible characters: zero-width ones, word joiner to invisible plus, BOM and Hangul fillers
export const UNSAFE_CHAR =
  /[\p{Cc}\p{Cs}؜ᅟᅠ​-‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ]/u;

const LINK = /https?:|www\.|@|\b[a-z0-9-]+\.(?:com|net|org|br|io|app|xyz|me|link|gg|info|biz|site|online|shop|store)\b/i;

// NFKC first, so full-width letters and look-alike dots read as a plain domain
export const hasLink = (text: string): boolean => LINK.test(text.normalize('NFKC'));

/** True when the text has no unsafe characters, no link or domain and no blocked term. */
export const isSafePeerText = (text: string): boolean =>
  !UNSAFE_CHAR.test(text) && !hasLink(text) && !containsBlockedTerm(text);
