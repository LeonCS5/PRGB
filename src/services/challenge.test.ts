import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_PARAM,
  buildChallengeUrl,
  challengeShareText,
  decodeChallenge,
  encodeChallenge,
  readChallengeFromSearch,
  type Challenge
} from './challenge';

const challenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  v: 1,
  songId: 123,
  partId: 2,
  title: 'Ação e Reação 🎸',
  artist: 'Björk',
  trackName: 'Guitarra — solo',
  score: 123456,
  accuracy: 92,
  nickname: 'João',
  ...overrides
});

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Builds a code from raw bytes, to feed the decoder data that encodeChallenge never produces
const codeForBytes = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const codeFor = (json: string): string => codeForBytes(new TextEncoder().encode(json));

const tuple = (overrides: Record<number, unknown> = {}): unknown[] => {
  const values: unknown[] = [1, 123, 2, 'Título', 'Artista', 'Faixa', 1000, 50, 'Leo'];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
};

describe('encodeChallenge and decodeChallenge', () => {
  it('round-trips accents and emoji in a URL-safe code', () => {
    const code = encodeChallenge(challenge());
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeChallenge(code)).toEqual(challenge());
  });

  it('round-trips the offline demo and a challenge without nickname', () => {
    const demo = challenge({ songId: -1, partId: 0, nickname: null, score: 0, accuracy: 100, trackName: '' });
    expect(decodeChallenge(encodeChallenge(demo))).toEqual(demo);
    expect(decodeChallenge(encodeChallenge(challenge({ score: 10_000_000, accuracy: 0 }))))
      .toEqual(challenge({ score: 10_000_000, accuracy: 0 }));
  });

  it('encodes the documented compact tuple', () => {
    const expected = codeFor(JSON.stringify([1, 123, 2, 'Ação e Reação 🎸', 'Björk', 'Guitarra — solo', 123456, 92, 'João']));
    expect(encodeChallenge(challenge())).toBe(expected);
  });

  it('cleans what it can when encoding: unsafe characters, long text, invalid nickname', () => {
    const decoded = decodeChallenge(encodeChallenge(challenge({
      title: 'x'.repeat(200),
      artist: 'AC\u0000DC‮',
      nickname: 'Puta'
    })));
    expect(decoded?.title).toBe('x'.repeat(120));
    expect(decoded?.artist).toBe('ACDC');
    expect(decoded?.nickname).toBeNull();
    expect(decodeChallenge(encodeChallenge(challenge({ nickname: '  João   Silva ' })))?.nickname).toBe('João Silva');
  });

  it('keeps worst-case multi-byte challenges under the link limit', () => {
    const emoji = '🎸'.repeat(120);
    const huge = challenge({
      songId: Number.MAX_SAFE_INTEGER, title: emoji, artist: emoji, trackName: emoji, nickname: '𝐀'.repeat(20)
    });
    const code = encodeChallenge(huge);
    expect(code.length).toBeLessThanOrEqual(2000);
    const decoded = decodeChallenge(code);
    expect(decoded).toMatchObject({ songId: Number.MAX_SAFE_INTEGER, score: 123456, nickname: '𝐀'.repeat(20) });
    // Shortened to fit, never emptied
    const titleLength = Array.from(decoded?.title ?? '').length;
    expect(titleLength).toBeGreaterThan(0);
    expect(titleLength).toBeLessThan(120);
    expect(emoji.startsWith(decoded?.title ?? 'x')).toBe(true);
  });

  it('throws RangeError for numbers outside the rules', () => {
    const invalid: Partial<Challenge>[] = [
      { score: -1 }, { score: 10_000_001 }, { score: 1.5 }, { accuracy: 101 }, { accuracy: 92.5 },
      { songId: 0 }, { songId: -2 }, { partId: -1 }, { partId: Number.NaN }
    ];
    for (const overrides of invalid) {
      expect(() => encodeChallenge(challenge(overrides)), JSON.stringify(overrides)).toThrow(RangeError);
    }
  });
});

describe('decodeChallenge strictness', () => {
  it('accepts hand-built tuples in the same format', () => {
    expect(decodeChallenge(codeFor(JSON.stringify(tuple())))).toEqual({
      v: 1, songId: 123, partId: 2, title: 'Título', artist: 'Artista', trackName: 'Faixa', score: 1000, accuracy: 50, nickname: 'Leo'
    });
  });

  it('rejects empty, oversized or non-base64url codes', () => {
    const valid = encodeChallenge(challenge());
    for (const code of ['', 'A'.repeat(2001), `${valid}=`, `${valid}==`, valid.replace(/^./, '+'), `/${valid}`, `${valid} `, 'é']) {
      expect(decodeChallenge(code), code.slice(0, 20)).toBeNull();
    }
    // Valid content, but a code longer than 2000 characters is refused before decoding
    const giant = codeFor(JSON.stringify(tuple({
      1: Number.MAX_SAFE_INTEGER, 3: '🎸'.repeat(120), 4: '🎸'.repeat(120), 5: '🎸'.repeat(120), 8: '𝐀'.repeat(20)
    })));
    expect(giant.length).toBeGreaterThan(2000);
    expect(decodeChallenge(giant)).toBeNull();
  });

  it('rejects truncated codes', () => {
    const code = encodeChallenge(challenge());
    for (let cut = 1; cut <= 8; cut++) expect(decodeChallenge(code.slice(0, -cut)), String(cut)).toBeNull();
  });

  it('never throws or returns invalid data for tampered codes', () => {
    const code = encodeChallenge(challenge());
    let rejected = 0;
    for (let index = 0; index < code.length; index++) {
      for (const char of 'Az0-_') {
        if (code[index] === char) continue;
        const result = decodeChallenge(code.slice(0, index) + char + code.slice(index + 1));
        if (result === null) rejected++;
        // Anything accepted must be a fully valid challenge: re-encoding gives it back unchanged
        else expect(decodeChallenge(encodeChallenge(result))).toEqual(result);
      }
    }
    expect(rejected).toBeGreaterThan(0);
  });

  it('rejects non-canonical encodings: stray bits, BOM, whitespace, escapes, number formats', () => {
    // 1 leftover byte: the last character carries 2 data bits and 4 bits that must be zero
    let title = 'T';
    while (new TextEncoder().encode(JSON.stringify(tuple({ 3: title }))).length % 3 !== 1) title += 'x';
    const canonical = codeFor(JSON.stringify(tuple({ 3: title })));
    expect(decodeChallenge(canonical)).not.toBeNull();
    const lastIndex = BASE64URL_ALPHABET.indexOf(canonical.slice(-1));
    expect(lastIndex % 16).toBe(0);
    const strayBits = canonical.slice(0, -1) + BASE64URL_ALPHABET[lastIndex + 1];
    expect(decodeChallenge(strayBits)).toBeNull();

    const json = JSON.stringify(tuple());
    expect(decodeChallenge(codeFor(`﻿${json}`))).toBeNull();
    expect(decodeChallenge(codeFor(JSON.stringify(tuple(), null, 1)))).toBeNull();
    expect(decodeChallenge(codeFor(json.replace('Título', 'T\\u00edtulo')))).toBeNull();
    expect(decodeChallenge(codeFor(json.replace(',1000,', ',1e3,')))).toBeNull();
    expect(decodeChallenge(codeFor(json.replace(',2,', ',-0,')))).toBeNull();
  });

  it('rejects invalid UTF-8 and non-JSON content', () => {
    expect(decodeChallenge(codeForBytes(new Uint8Array([0x5b, 0xff, 0x5d])))).toBeNull();
    expect(decodeChallenge(codeFor('not json'))).toBeNull();
  });

  it('rejects JSON with the wrong shape or types', () => {
    const wrong: unknown[] = [
      { v: 1, songId: 123 },
      tuple().slice(0, 8),
      [...tuple(), 'extra'],
      tuple({ 0: 2 }), tuple({ 0: '1' }),
      tuple({ 1: '123' }), tuple({ 1: 0 }), tuple({ 1: -2 }), tuple({ 1: 1.5 }),
      tuple({ 2: -1 }), tuple({ 2: '0' }),
      tuple({ 3: 5 }), tuple({ 3: null }), tuple({ 4: [] }), tuple({ 5: {} }),
      tuple({ 6: -1 }), tuple({ 6: 10_000_001 }), tuple({ 6: 1.5 }), tuple({ 6: '100' }),
      tuple({ 7: 101 }), tuple({ 7: -1 }), tuple({ 7: 92.5 }),
      tuple({ 8: 42 }), tuple({ 8: true }), tuple({ 8: {} })
    ];
    for (const data of wrong) expect(decodeChallenge(codeFor(JSON.stringify(data))), JSON.stringify(data)).toBeNull();
  });

  it('rejects long text, control characters, bidi overrides and lone surrogates', () => {
    for (const text of ['x'.repeat(121), 'a\u0007b', 'a\nb', 'a‮b', 'a⁦b', '\ud800']) {
      expect(decodeChallenge(codeFor(JSON.stringify(tuple({ 3: text })))), JSON.stringify(text)).toBeNull();
    }
    expect(decodeChallenge(codeFor(JSON.stringify(tuple({ 3: '🎸'.repeat(120) }))))?.title).toBe('🎸'.repeat(120));
  });

  it('drops an offensive or invalid nickname but keeps the challenge', () => {
    for (const nickname of ['Puta', 'Admin1', 'ab', 'Leo!', 'x'.repeat(21)]) {
      const decoded = decodeChallenge(codeFor(JSON.stringify(tuple({ 8: nickname }))));
      expect(decoded, nickname).not.toBeNull();
      expect(decoded?.nickname, nickname).toBeNull();
    }
    expect(decodeChallenge(codeFor(JSON.stringify(tuple({ 8: ' João ' }))))?.nickname).toBe('João');
    expect(decodeChallenge(codeFor(JSON.stringify(tuple({ 8: null }))))?.nickname).toBeNull();
  });
});

describe('links', () => {
  it('builds a clean link that reads back to the same challenge', () => {
    const url = buildChallengeUrl('https://prgb.vercel.app/jogar?musica=1&x=2#topo', challenge());
    expect(url).toBe(`https://prgb.vercel.app/jogar?${CHALLENGE_PARAM}=${encodeChallenge(challenge())}`);
    expect(readChallengeFromSearch(new URL(url).search)).toEqual(challenge());
    expect(buildChallengeUrl('/', challenge())).toMatch(/^\/\?desafio=[A-Za-z0-9_-]+$/);
  });

  it('reads the challenge with or without "?" and next to other params', () => {
    const code = encodeChallenge(challenge());
    expect(readChallengeFromSearch(`desafio=${code}`)).toEqual(challenge());
    expect(readChallengeFromSearch(`?utm=zap&desafio=${code}&x=1`)).toEqual(challenge());
  });

  it('ignores missing, empty, repeated or broken params', () => {
    const code = encodeChallenge(challenge());
    for (const search of ['', '?', '?outro=1', '?desafio=', `?desafio=${code}&desafio=${code}`, '?desafio=%%%',
      `?desafio=${'A'.repeat(5000)}`]) {
      expect(readChallengeFromSearch(search), search.slice(0, 30)).toBeNull();
    }
  });
});

describe('challengeShareText', () => {
  it('writes a pt-BR invitation with score, song, accuracy and link', () => {
    const url = 'https://prgb.vercel.app/?desafio=abc';
    expect(challengeShareText(challenge(), url)).toBe(
      '🎸 Desafio PRGB: fiz 123.456 pontos em “Ação e Reação 🎸” (Björk), com 92% de precisão. '
      + `Consegue me superar? ${url}`
    );
    expect(challengeShareText(challenge({ artist: '' }), url)).toContain('em “Ação e Reação 🎸”, com');
  });
});
