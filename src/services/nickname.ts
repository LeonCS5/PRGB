// Nickname rules. The nickname is the only personal data PRGB keeps (LGPD: data minimization).
// The ranking database replicates these rules in SQL, so they stay simple and are exported as data.

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

// A–Z, a–z, Latin-1 and Latin Extended-A letters (U+00C0–U+017F except × and ÷), ASCII digits, "_", "-",
// "." and single spaces between words. Everything else is left out on purpose: Cyrillic and Greek letters
// pass for Latin ones ("РRGВ"), Hangul fillers print as blanks, and Latin Extended-B and beyond hold
// look-alikes that no normalization undoes ("ƒuck", clicks "ǃ"). The few look-alikes left in range are
// mapped by MODERATION_CONFUSABLES. Leading, trailing and double spaces fail, so only normalized
// nicknames match.
export const NICKNAME_PATTERN =
  /^[A-Za-z0-9_.\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F-]+(?: [A-Za-z0-9_.\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F-]+)*$/u;

// Letters in the allowed range that NFKD leaves alone but read as other letters ("Admın", "Pørno").
// Applied to lowercase text with the accents already removed.
export const MODERATION_CONFUSABLES: Readonly<Record<string, string>> = Object.freeze({
  'ı': 'i', 'ĸ': 'k', 'ł': 'l', 'ħ': 'h', 'ŧ': 't', 'đ': 'd', 'ð': 'd', 'ŋ': 'n',
  'œ': 'oe', 'æ': 'ae', 'ø': 'o', 'þ': 'th', 'ß': 'ss'
});

const CONFUSABLE = new RegExp(`[${Object.keys(MODERATION_CONFUSABLES).join('')}]`, 'g');

export interface BlockedTerm {
  readonly term: string;
  // 'word': only a whole word ("cunt" must not block "Scunthorpe");
  // 'part': also inside a word ("caralh" blocks "caralhada", "fuck" blocks "FuckYou")
  readonly mode: 'word' | 'part';
}

const word = (...terms: string[]): BlockedTerm[] => terms.map((term) => Object.freeze({ term, mode: 'word' as const }));
const part = (...terms: string[]): BlockedTerm[] => terms.map((term) => Object.freeze({ term, mode: 'part' as const }));

// Stored already folded (see foldForModeration): no accents and no repeated letters, so
// "moderação" is "moderacao", "staff" is "staf" and "faggot" is "fagot". Some are stems ("estupr").
// Left out on purpose because they are everyday words, names or band names: porra (folds like
// "Porã"), pica (Pica-Pau), pinto, pau, rola, macaco, corno, dick, cock, pussy, ass (folds to "as",
// a Portuguese word).
export const BLOCKED_TERMS: readonly BlockedTerm[] = Object.freeze([
  // Pretending to be the PRGB team
  ...part('admin', 'moderador', 'moderator', 'moderacao', 'suporte', 'prgb'),
  ...word('staf'), // "Gustaf"
  // Profanity and sexual terms (pt-BR)
  ...part('puta', 'putinh', 'cuzao', 'cuzinh', 'foda', 'merd', 'bosta', 'caralh', 'bucet', 'bocet', 'xoxota',
    'xereca', 'piroca', 'punhet', 'boquete', 'vagabunda', 'prostitut', 'arombad'),
  ...word('cu', 'vadia', 'fdp', 'pqp', 'vsf', 'vtnc'), // "Curitiba", "vadiar"
  // Profanity and sexual terms (English)
  ...part('fuck', 'shit', 'bitch', 'whore', 'ashole', 'dickhead', 'porn', 'dildo'),
  ...word('cunt', 'slut', 'twat', 'anal'), // "Scunthorpe", "Analice", "Canal"
  // Homophobic and transphobic slurs
  ...part('viadinh', 'viadao', 'boiola', 'baitola', 'traveco'),
  ...word('viado', 'bicha', 'fag', 'fagot'), // "Desviado", "Bichano", "Fagundes", "Fagote"
  // Racist slurs and hate
  ...part('nazi', 'hitler'),
  ...word('niger', 'niga', 'chink', 'spic'), // "Nigéria", "Spice Girls"
  // Ableist slurs
  ...part('retardad', 'retarded', 'mongoloide'),
  // Sexual violence
  ...part('estupr', 'pedofil')
]);

// Folded fragments erased before matching, one at a time in this order (like nested replace() calls
// in SQL): everyday words and names that hold a 'part' term.
export const MODERATION_ALLOWLIST: readonly string[] = Object.freeze([
  'computa', 'deputa', 'diputa', 'disputa', 'reputa', 'imputa', 'amputa', // puta
  'badminton', // admin
  'bostaph', // bosta (Paul Bostaph, Slayer's drummer)
  'shitake', // shit ("shiitake" folds to "shitake")
  'nazir', 'nazim' // nazi (Arabic and Turkish names)
]);

export type NicknameError = 'short' | 'long' | 'chars' | 'offensive';

export const NICKNAME_ERROR_MESSAGES: Record<NicknameError, string> = {
  short: `Use pelo menos ${NICKNAME_MIN} caracteres.`,
  long: `Use no máximo ${NICKNAME_MAX} caracteres.`,
  chars: 'Use só letras, números, espaço, ponto, hífen ou _.',
  offensive: 'Esse apelido não é permitido. Escolha outro.'
};

const LEETSPEAK: Readonly<Record<string, string>> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's'
};

export function normalizeNickname(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// NFKD, lowercase, combining marks removed and confusables mapped: "Ølsen" → "olsen"
const baseLetters = (text: string): string =>
  text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(CONFUSABLE, (char) => MODERATION_CONFUSABLES[char]);

/**
 * Form used to tell nicknames apart: two nicknames with the same key are the same nickname ("João" and
 * "Joao", "LEO" and "leo"). Normalized, lowercase, without accents, confusables mapped, single spaces.
 */
export function nicknameKey(raw: string): string {
  return baseLetters(normalizeNickname(raw)).trim().replace(/\s+/g, ' ');
}

/**
 * Fold text for moderation. The database replicates these steps:
 * 1. camelCase splits into words: a lowercase letter followed by an uppercase one gets a space
 *    between them ("FilhoDaPuta" → "Filho Da Puta"). Digits stay glued to letters: they may be leetspeak.
 * 2. NFKD, lowercase and remove combining marks (drops accents; styled letters such as "𝐚" or "ａ" become "a")
 * 3. MODERATION_CONFUSABLES: ı→i ĸ→k ł→l ħ→h ŧ→t đ→d ð→d ŋ→n œ→oe æ→ae ø→o þ→th ß→ss
 * 4. leetspeak: 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s
 * 5. every run of non-letters becomes one space, the word separator
 * 6. consecutive one-letter words are joined ("p.u.t.a" → "puta")
 * 7. repeated letters collapse ("fuuuck" → "fuck")
 */
export function foldForModeration(text: string): string {
  const pieces = baseLetters(text.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2'))
    .replace(/[013457@$]/g, (char) => LEETSPEAK[char])
    .split(/\P{L}+/u)
    .filter(Boolean);
  const words: string[] = [];
  let spelled = '';
  for (const piece of pieces) {
    if (Array.from(piece).length === 1) {
      spelled += piece;
      continue;
    }
    if (spelled) words.push(spelled);
    spelled = '';
    words.push(piece);
  }
  if (spelled) words.push(spelled);
  return words.join(' ').replace(/(\p{L})\1+/gu, '$1');
}

const hasBlockedTerm = (folded: string): boolean => {
  let text = folded;
  for (const fragment of MODERATION_ALLOWLIST) text = text.replaceAll(fragment, '');
  const padded = ` ${text} `;
  return BLOCKED_TERMS.some(({ term, mode }) => mode === 'word' ? padded.includes(` ${term} `) : text.includes(term));
};

/**
 * Checked four times: with digits read as leetspeak ("4dm1n") and with digits removed, because a
 * trailing number would otherwise glue a letter to a short term ("Admin1" folds to "admini"); and each
 * of those lowercased first too, which skips the camelCase split so a stray capital can't break a
 * term apart ("FuCk" would fold to "fu ck").
 */
export function containsBlockedTerm(text: string): boolean {
  const withoutDigits = text.replace(/[0-9]/g, '');
  return [text, withoutDigits, text.toLowerCase(), withoutDigits.toLowerCase()]
    .some((variant) => hasBlockedTerm(foldForModeration(variant)));
}

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; error: NicknameError } {
  const value = normalizeNickname(raw);
  // Code points, like char_length() in the database ("𝐀" is one character but two UTF-16 units)
  const length = Array.from(value).length;
  if (length < NICKNAME_MIN) return { ok: false, error: 'short' };
  if (length > NICKNAME_MAX) return { ok: false, error: 'long' };
  if (!NICKNAME_PATTERN.test(value)) return { ok: false, error: 'chars' };
  if (containsBlockedTerm(value)) return { ok: false, error: 'offensive' };
  return { ok: true, value };
}
