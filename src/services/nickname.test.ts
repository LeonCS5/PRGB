import { describe, expect, it } from 'vitest';
import {
  BLOCKED_TERMS,
  BLOCKED_TERM_WHOLE_WORD_MAX,
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
  it('accepts letters of any script, digits, "_", "-", "." and single spaces', () => {
    for (const nickname of ['Leo', 'João Silva', 'ana_b.r-1', 'Zoë', 'Søren', 'Łukasz', '日本語']) {
      expect(NICKNAME_PATTERN.test(nickname)).toBe(true);
    }
  });

  it('rejects symbols, emoji, invisible characters and unnormalized spaces', () => {
    for (const nickname of ['Leo!', 'a@b', 'Leo🎸', 'Le​o', 'a  b', ' ab', 'ab ', 'a\tb', '']) {
      expect(NICKNAME_PATTERN.test(nickname)).toBe(false);
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
    // "𝐀" is one letter stored as two UTF-16 units: the limit counts letters, like char_length() in SQL
    expect(validateNickname('𝐀'.repeat(20)).ok).toBe(true);
    expect(validateNickname('𝐀'.repeat(21))).toEqual({ ok: false, error: 'long' });
  });

  it('rejects characters outside the pattern', () => {
    for (const nickname of ['Leo!', 'Leo🎸', 'Le​o', 'a<b>c']) {
      expect(validateNickname(nickname)).toEqual({ ok: false, error: 'chars' });
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

  // False positives avoided, and how
  it('matches short terms only as whole words (Scunthorpe problem)', () => {
    expect(BLOCKED_TERM_WHOLE_WORD_MAX).toBe(5);
    for (const text of [
      'Scunthorpe', // cunt
      'Analice', 'Ana L', 'Canal', 'Analógico', // anal
      'Computador', 'Deputado', 'Disputa', 'Reputação', // puta
      'Curitiba', 'Escudo', // cu
      'Nazareth', // nazi
      'Spice Girls', // spic
      'Shiitake' // shit ("shiitake" folds to "shitake")
    ]) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
  });

  it('keeps 5-letter terms whole-word too, because they hide in common words', () => {
    for (const text of [
      'Fagote', // fagot (the bassoon, in a music app)
      'Bichano', // bicha
      'Desviado', // viado
      'Badminton', // admin
      'Nigéria', // niger
      'Bostaph' // bosta
    ]) {
      expect(containsBlockedTerm(text), text).toBe(false);
    }
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

  it('accepts the cost of whole-word matching: short terms glued to another word pass', () => {
    expect(containsBlockedTerm('FuckYou')).toBe(false);
    expect(containsBlockedTerm('Fuck You')).toBe(true);
  });
});

describe('BLOCKED_TERMS', () => {
  it('holds folded, lowercase ASCII terms without duplicates', () => {
    expect(new Set(BLOCKED_TERMS).size).toBe(BLOCKED_TERMS.length);
    for (const term of BLOCKED_TERMS) {
      expect(term).toMatch(/^[a-z]+$/);
      expect(foldForModeration(term), term).toBe(term);
    }
  });

  it('blocks every term on its own', () => {
    for (const term of BLOCKED_TERMS) expect(containsBlockedTerm(term), term).toBe(true);
  });

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(BLOCKED_TERMS)).toBe(true);
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
