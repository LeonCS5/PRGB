import { describe, expect, it } from 'vitest';
import {
  BLOCKED_TERMS,
  MODERATION_ALLOWLIST,
  NICKNAME_ERROR_MESSAGES,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  containsBlockedTerm,
  foldForModeration,
  normalizeNickname,
  validateNickname,
  type NicknameError
} from './nickname';

describe('normalizeNickname', () => {
  it('composes accents (NFC), trims and collapses inner whitespace', () => {
    expect(normalizeNickname('João')).toBe('João');
    expect(normalizeNickname('João')).toHaveLength(4);
    expect(normalizeNickname('  João \t  Silva\n')).toBe('João Silva');
  });
});

describe('NICKNAME_PATTERN', () => {
  it('accepts Latin letters with accents, digits, "_", "-", "." and single spaces', () => {
    for (const nickname of ['Leo', 'João Silva', 'ana_b.r-1', 'Zoë', 'Søren', 'Łukasz', 'Straße', 'Ｌｅｏ']) {
      expect(NICKNAME_PATTERN.test(nickname), nickname).toBe(true);
    }
  });

  it('rejects symbols, emoji, invisible characters and unnormalized spaces', () => {
    for (const nickname of ['Leo!', 'a@b', 'Leo🎸', 'Le\u200Bo', 'a  b', ' ab', 'ab ', 'a\tb', '']) {
      expect(NICKNAME_PATTERN.test(nickname), nickname).toBe(false);
    }
  });

  it('rejects other scripts, so look-alike letters and blank letters cannot pass', () => {
    for (const nickname of [
      '\u0420RG\u0412', '\u0430dmin', // Cyrillic \u0420, \u0412 and \u0430
      'Ad\u03BCin', // Greek \u03BC
      '日本語', '𝐀𝐝𝐦𝐢𝐧', // other scripts; styled math letters are not Latin
      '\u3164\u3164\u3164', '\uFFA0\uFFA0\uFFA0', '\u115F\u115F\u115F', 'a\u1160b' // Hangul fillers print as blanks
    ]) {
      expect(NICKNAME_PATTERN.test(nickname), nickname).toBe(false);
    }
  });

  it('carries no global state, so it is safe to reuse', () => {
    expect(NICKNAME_PATTERN.flags).toBe('u');
  });
});

describe('validateNickname', () => {
  it('returns the normalized nickname when it is valid', () => {
    expect(validateNickname('  João   Silva ')).toEqual({ ok: true, value: 'João Silva' });
    expect(validateNickname('João')).toEqual({ ok: true, value: 'João' });
  });

  it('enforces the length limits, counted in code points', () => {
    expect(NICKNAME_MIN).toBe(3);
    expect(NICKNAME_MAX).toBe(20);
    expect(validateNickname('ab')).toEqual({ ok: false, error: 'short' });
    expect(validateNickname('   ')).toEqual({ ok: false, error: 'short' });
    expect(validateNickname('abc').ok).toBe(true);
    expect(validateNickname('a'.repeat(20)).ok).toBe(true);
    expect(validateNickname('a'.repeat(21))).toEqual({ ok: false, error: 'long' });
    // "𝼀" (U+1DF00) is one Latin letter stored as two UTF-16 units: the limit counts letters, like char_length() in SQL
    expect(validateNickname('\u{1DF00}'.repeat(20)).ok).toBe(true);
    expect(validateNickname('\u{1DF00}'.repeat(21))).toEqual({ ok: false, error: 'long' });
  });

  it('rejects characters outside the pattern', () => {
    for (const nickname of ['Leo!', 'Leo🎸', 'Le\u200Bo', 'a<b>c', '\u0420RG\u0412', '\u0430dmin', '\u3164\u3164\u3164',
      '\uFFA0\uFFA0\uFFA0', '\u115F\u115F\u115F', '\u1160\u1160\u1160']) {
      expect(validateNickname(nickname), nickname).toEqual({ ok: false, error: 'chars' });
    }
  });

  it('checks length before characters', () => {
    expect(validateNickname('a!')).toEqual({ ok: false, error: 'short' });
    expect(validateNickname('!'.repeat(21))).toEqual({ ok: false, error: 'long' });
  });

  it('rejects offensive nicknames and team impersonation', () => {
    for (const nickname of ['Puta', 'Admin1', 'PRGB Oficial', 'Moderador', 'Suporte']) {
      expect(validateNickname(nickname)).toEqual({ ok: false, error: 'offensive' });
    }
  });

  it('rejects the nicknames found in review', () => {
    for (const nickname of ['FuckYou', 'FilhoDaPuta', 'VaiTomarNoCu', 'PutaMerda', 'ShitHead', 'Putinha', 'Bucetinha',
      'Viadinho', 'Merdinha', 'Cuzinho', 'Nazismo', 'Pornstar', 'AdminPRGB', 'PRGBAdmin', 'OficialPRGB', 'PRGBteam']) {
      expect(validateNickname(nickname), nickname).toEqual({ ok: false, error: 'offensive' });
    }
  });

  it('accepts names and words that hold a blocked term', () => {
    for (const nickname of ['Cássio', 'Assis', 'Scunthorpe', 'Analice', 'Ana L', 'Computador', 'Deputado', 'Disputa',
      'Reputação', 'Enviado', 'Analista', 'Fagundes', 'Fagote', 'Bichano', 'Desviado', 'Badminton', 'Nigéria', 'Bostaph',
      'Shiitake', 'Nazareth', 'Spice Girls', 'Ponta Porã', 'Pica-Pau', 'Kkkkk', 'Joao 1990', 'Guitar 5150']) {
      expect(validateNickname(nickname), nickname).toEqual({ ok: true, value: nickname });
    }
  });
});

describe('foldForModeration', () => {
  it('lowercases and removes accents', () => {
    expect(foldForModeration('ÁÉÍÓÚ Çãõ')).toBe('aeiou cao');
    expect(foldForModeration('İstanbul')).toBe('istanbul');
  });

  it('reads leetspeak', () => {
    expect(foldForModeration('@dm1n$')).toBe('admins');
    expect(foldForModeration('P0RR4 M3RD4')).toBe('pora merda');
    expect(foldForModeration('5h17')).toBe('shit');
  });

  it('turns styled and full-width letters into plain ones', () => {
    expect(foldForModeration('𝐟𝐮𝐜𝐤')).toBe('fuck');
    expect(foldForModeration('ｆｕｃｋ')).toBe('fuck');
  });

  it('keeps one space between words and drops other non-letters', () => {
    expect(foldForModeration('Joao_da-Silva.2')).toBe('joao da silva');
    expect(foldForModeration('Ana L')).toBe('ana l');
  });

  it('joins spelled-out letters and collapses repeated letters', () => {
    expect(foldForModeration('f.u.c.k')).toBe('fuck');
    expect(foldForModeration('A B C Banda')).toBe('abc banda');
    expect(foldForModeration('FUUUUCK')).toBe('fuck');
    expect(foldForModeration('Cássio')).toBe('casio');
    expect(foldForModeration('kkkkk')).toBe('k');
    expect(foldForModeration('')).toBe('');
  });

  it('splits camelCase into words first, but keeps digits glued to letters', () => {
    expect(foldForModeration('FilhoDaPuta')).toBe('filho da puta');
    expect(foldForModeration('VaiTomarNoCu')).toBe('vai tomar no cu');
    expect(foldForModeration('OficialPRGB')).toBe('oficial prgb');
    expect(foldForModeration('ÉdsonÁvila')).toBe('edson avila');
    expect(foldForModeration('PRGBteam')).toBe('prgbteam'); // uppercase then lowercase is not a split
    expect(foldForModeration('4dm1n')).toBe('admin');
    // A stray capital splits a word: containsBlockedTerm also folds the lowercased text
    expect(foldForModeration('PuTa')).toBe('pu ta');
    expect(foldForModeration('puta')).toBe('puta');
  });
});

describe('containsBlockedTerm', () => {
  it('sees through case, accents, leetspeak, separators, repeats and styled letters', () => {
    for (const text of ['Puta', 'PuTa', 'Pút4', 'p.u.t.a', 'Filho da Puta', 'FUUUCK', 'C4r4lh0', 'Caralhada',
      'b.u.c.e.t.a', 'ｐｕｔａ', 'Foda-se', 'Fodase', 'Motherfucker', 'Pornô']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('catches short terms followed or broken up by digits', () => {
    for (const text of ['Admin1', 'Admin123', 'admin_01', 'Merda123', 'Nazi88', 'fu2ck']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('blocks nicknames that pretend to be the PRGB team', () => {
    for (const text of ['Admin', 'Administrador', 'Moderadora', 'PRGB Oficial', 'PRGBOficial', 'Equipe PRGB', '𝐏𝐑𝐆𝐁',
      'Suporte Técnico', 'Staff']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('blocks racist, homophobic, transphobic and ableist slurs, including folded spellings', () => {
    for (const text of ['Faggot', 'N1gg3r', 'Nigga', 'Viado', 'v14d0', 'Boiola', 'Traveco', 'Retardada', 'Mongoloide']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('catches terms glued to other words, split by camelCase or not', () => {
    for (const text of ['FuckYou', 'fuckyou', 'FilhoDaPuta', 'filhodaputa', 'VaiTomarNoCu', 'PutaMerda', 'putamerda',
      'ShitHead', 'AdminPRGB', 'PRGBAdmin', 'OficialPRGB', 'PRGBteam', 'Pornstar', 'Nazismo']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('is not fooled by alternating case, which camelCase would split apart', () => {
    for (const text of ['PuTa', 'CaRaLhO', 'mErDa', 'FuCk', 'aDmIn', 'Pu7A', 'cArAlH0']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('catches diminutives and stems that do not hold the base word', () => {
    // "putinha" does not hold "puta": the stem "putinh" is listed on its own
    for (const text of ['Putinha', 'Bucetinha', 'Viadinho', 'Merdinha', 'Cuzinho']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  // False positives avoided, and how
  it('matches short and ambiguous terms only as whole words (Scunthorpe problem)', () => {
    for (const text of [
      'Scunthorpe', // cunt
      'Analice', 'Ana L', 'Canal', 'Analógico', 'Analista', // anal
      'Curitiba', 'Escudo', // cu
      'Spice Girls', // spic
      'Fagote', 'Fagundes', // fagot (the bassoon, in a music app), fag
      'Bichano', // bicha
      'Desviado', 'Enviado', // viado
      'Nigéria', // niger
      'Gustaf' // staf
    ]) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
  });

  it('erases allowlisted words before matching terms inside words', () => {
    for (const text of [
      'Computador', 'Deputado', 'Disputa', 'Reputação', 'Amputado', 'Imputável', 'Diputado', // puta
      'Badminton', // admin
      'Bostaph', // bosta
      'Shiitake', // shit ("shiitake" folds to "shitake")
      'Nazir', 'Nazim' // nazi
    ]) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
    // The allowlist only erases its own fragment
    for (const text of ['Disputa Puta', 'BadmintonAdmin', 'Nazareth Nazi', 'badmintonadmin']) {
      expect(containsBlockedTerm(text), text).toBe(true);
    }
  });

  it('does not match "nazi" inside "Nazareth"', () => {
    expect(containsBlockedTerm('Nazareth')).toBe(false);
  });

  it('leaves out words that are everyday words, names or band names', () => {
    for (const text of [
      'Cássio', 'Assis', // "ass" is not listed: repeated letters fold it into "as", a Portuguese word
      'Ponta Porã', // "porra" is not listed: it folds into "pora", like Porã
      'Pica-Pau', 'Pinto', 'Macaco', 'Capricorno', 'Dick Dale', 'Pussy Riot', 'Hancock', 'Cocktail',
      'Therapist', // no "rapist" substring
      'Moderado', // only "moderador" is blocked
      'Kkkkkk' // laughter
    ]) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
  });

  it('does not turn innocent numbers into words', () => {
    for (const text of ['Cássio 10', 'Joao 1990', 'Guitar 5150']) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
  });

  it('accepts the cost of whole-word matching: whole-word terms glued to another word pass', () => {
    expect(containsBlockedTerm('vaitomarnocu')).toBe(false);
    expect(containsBlockedTerm('VaiTomarNoCu')).toBe(true);
  });
});

describe('BLOCKED_TERMS', () => {
  it("holds folded, lowercase ASCII terms without duplicates, each 'word' or 'part'", () => {
    const terms = BLOCKED_TERMS.map(({ term }) => term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const { term, mode } of BLOCKED_TERMS) {
      expect(term).toMatch(/^[a-z]+$/);
      expect(foldForModeration(term), term).toBe(term);
      expect(['word', 'part']).toContain(mode);
    }
  });

  it("matches 'word' terms as whole words and 'part' terms inside words", () => {
    const mode = (term: string) => BLOCKED_TERMS.find((entry) => entry.term === term)?.mode;
    expect(mode('cu')).toBe('word');
    expect(mode('cunt')).toBe('word');
    expect(mode('fuck')).toBe('part');
    expect(mode('puta')).toBe('part');
    expect(mode('putinh')).toBe('part');
    expect(mode('prgb')).toBe('part');
    expect(containsBlockedTerm('xcux')).toBe(false);
    expect(containsBlockedTerm('x cu x')).toBe(true);
    expect(containsBlockedTerm('xfuckx')).toBe(true);
  });

  it('blocks every term on its own', () => {
    for (const { term } of BLOCKED_TERMS) expect(containsBlockedTerm(term), term).toBe(true);
  });

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(BLOCKED_TERMS)).toBe(true);
    for (const entry of BLOCKED_TERMS) expect(Object.isFrozen(entry), entry.term).toBe(true);
  });
});

describe('MODERATION_ALLOWLIST', () => {
  it('holds folded, lowercase ASCII fragments without duplicates', () => {
    expect(new Set(MODERATION_ALLOWLIST).size).toBe(MODERATION_ALLOWLIST.length);
    for (const fragment of MODERATION_ALLOWLIST) {
      expect(fragment).toMatch(/^[a-z]+$/);
      expect(foldForModeration(fragment), fragment).toBe(fragment);
    }
  });

  it('never erases a blocked term itself', () => {
    for (const { term } of BLOCKED_TERMS) {
      for (const fragment of MODERATION_ALLOWLIST) expect(term.includes(fragment), `${term}/${fragment}`).toBe(false);
    }
  });

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(MODERATION_ALLOWLIST)).toBe(true);
  });
});

describe('NICKNAME_ERROR_MESSAGES', () => {
  it('has a short pt-BR message for every error', () => {
    const errors: NicknameError[] = ['short', 'long', 'chars', 'offensive'];
    for (const error of errors) {
      expect(NICKNAME_ERROR_MESSAGES[error].length).toBeGreaterThan(0);
      expect(NICKNAME_ERROR_MESSAGES[error].length).toBeLessThanOrEqual(60);
    }
    expect(NICKNAME_ERROR_MESSAGES.short).toContain('3');
    expect(NICKNAME_ERROR_MESSAGES.long).toContain('20');
    expect(NICKNAME_ERROR_MESSAGES.long).toContain('máximo');
  });
});
