// Nickname rules. The nickname is the only personal data PRGB keeps (LGPD: data minimization).
// The ranking database replicates these rules in SQL, so they stay simple and are exported as data.

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

// Letters of any script (accents included), digits, "_", "-", "." and single spaces between words.
// Leading, trailing and double spaces fail, so only normalized nicknames match.
export const NICKNAME_PATTERN = /^[\p{L}0-9_.-]+(?: [\p{L}0-9_.-]+)*$/u;

// Terms up to this many letters only match whole words ("cunt" must not block "Scunthorpe");
// longer terms also match inside words ("caralh" blocks "caralhada").
export const BLOCKED_TERM_WHOLE_WORD_MAX = 5;

// Stored already folded (see foldForModeration): no accents and no repeated letters, so
// "moderação" is "moderacao", "staff" is "staf" and "faggot" is "fagot". Some are stems ("estupr").
// Left out on purpose because they are everyday words, names or band names: porra (folds like
// "Porã"), pica (Pica-Pau), pinto, pau, rola, macaco, corno, dick, cock, pussy, ass (folds to "as").
export const BLOCKED_TERMS: readonly string[] = Object.freeze([
  // Pretending to be the PRGB team
  'admin', 'administrador', 'administrator', 'moderador', 'moderator', 'moderacao', 'suporte', 'staf', 'prgb',
  'prgboficial',
  // Profanity and sexual terms (pt-BR)
  'cu', 'cuzao', 'puta', 'putaria', 'foda', 'fodase', 'merda', 'bosta', 'caralh', 'buceta', 'boceta', 'xoxota', 'xereca',
  'piroca', 'punhet', 'boquete', 'vadia', 'vagabunda', 'prostitut', 'arombad', 'fdp', 'pqp', 'vsf', 'vtnc',
  // Profanity and sexual terms (English)
  'fuck', 'fucker', 'fucking', 'shit', 'bulshit', 'cunt', 'slut', 'twat', 'whore', 'bitch', 'ashole', 'dickhead',
  'anal', 'porn', 'porno', 'dildo',
  // Homophobic and transphobic slurs
  'viado', 'bicha', 'boiola', 'baitola', 'traveco', 'fag', 'fagot',
  // Racist slurs and hate
  'niger', 'niga', 'chink', 'spic', 'nazi', 'nazista', 'hitler',
  // Ableist slurs
  'retardad', 'retarded', 'mongoloide',
  // Sexual violence
  'estupr', 'pedofil'
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

/**
 * Fold text for moderation. The database replicates these steps:
 * 1. NFKD, lowercase and remove combining marks (drops accents; styled letters such as "𝐚" or "ａ" become "a")
 * 2. leetspeak: 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s
 * 3. every run of non-letters becomes one space, the word separator
 * 4. consecutive one-letter words are joined ("p.u.t.a" → "puta")
 * 5. repeated letters collapse ("fuuuck" → "fuck")
 */
export function foldForModeration(text: string): string {
  const pieces = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
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
  const padded = ` ${folded} `;
  return BLOCKED_TERMS.some((term) => term.length <= BLOCKED_TERM_WHOLE_WORD_MAX
    ? padded.includes(` ${term} `)
    : folded.includes(term));
};

/**
 * Checked twice: with digits read as leetspeak ("4dm1n") and with digits removed, because a
 * trailing number would otherwise glue a letter to a short term ("Admin1" folds to "admini").
 */
export function containsBlockedTerm(text: string): boolean {
  return hasBlockedTerm(foldForModeration(text)) || hasBlockedTerm(foldForModeration(text.replace(/[0-9]/g, '')));
}

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; error: NicknameError } {
  const value = normalizeNickname(raw);
  // Code points, like char_length() in the database ("𝐀" is one letter but two UTF-16 units)
  const length = Array.from(value).length;
  if (length < NICKNAME_MIN) return { ok: false, error: 'short' };
  if (length > NICKNAME_MAX) return { ok: false, error: 'long' };
  if (!NICKNAME_PATTERN.test(value)) return { ok: false, error: 'chars' };
  if (containsBlockedTerm(value)) return { ok: false, error: 'offensive' };
  return { ok: true, value };
}
