// Score challenge shared by link ("fiz X pontos, me supera"), with no server involved.
// The link is forgeable by design: anyone can write any score into it. That is fine for a challenge
// between friends; only the online ranking needs scores checked by the server.

import { containsBlockedTerm, validateNickname } from './nickname';

export interface Challenge {
  v: 1;
  songId: number; // -1 = offline demo
  partId: number;
  title: string;
  artist: string;
  trackName: string;
  score: number;
  accuracy: number; // integer 0-100
  nickname: string | null; // optional; dropped when it fails validateNickname
}

export const CHALLENGE_PARAM = 'desafio';

// The code is base64url of a compact JSON tuple, to keep links short:
// [1, songId, partId, title, artist, trackName, score, accuracy, nickname]
type ChallengeTuple = [1, number, number, string, string, string, number, number, string | null];

const MAX_CODE_LENGTH = 2000;
const MAX_SCORE = 10_000_000;
const TEXT_MAX = 120;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Control characters, lone surrogates, bidi marks, overrides and isolates (they garble the text around
// them) and invisible characters: zero-width ones, word joiner to invisible plus, BOM and Hangul fillers
const UNSAFE_CHAR =
  /[\p{Cc}\p{Cs}؜ᅟᅠ​-‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ]/u;
const UNSAFE_CHARS = new RegExp(UNSAFE_CHAR.source, 'gu');
// The link opens under our domain, so its text must not carry a link that passes a scam off as PRGB's
const LINK = /https?:|www\.|@|\b[a-z0-9-]+\.(?:com|net|org|br|io|app|xyz|me|link|gg|info|biz|site|online|shop|store)\b/i;

const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isSongId = (value: unknown): value is number => value === -1 || isInteger(value, 1, Number.MAX_SAFE_INTEGER);

const isPartId = (value: unknown): value is number => isInteger(value, 0, Number.MAX_SAFE_INTEGER);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && Array.from(value).length <= TEXT_MAX && !UNSAFE_CHAR.test(value);

// NFKC first, so full-width letters and look-alike dots ("ｇｏｌｐｅ．ｃｏｍ") read as a plain domain
const hasLink = (text: string): boolean => LINK.test(text.normalize('NFKC'));

const isAllowedText = (text: string): boolean => !hasLink(text) && !containsBlockedTerm(text);

const checkNickname = (nickname: string): string | null => {
  const result = validateNickname(nickname);
  // The nickname rules allow "." and letters, so a domain ("golpe.com") gets past them
  return result.ok && !hasLink(result.value) ? result.value : null;
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (code: string): Uint8Array => {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const parseTuple = (data: unknown): Challenge | null => {
  if (!Array.isArray(data) || data.length !== 9) return null;
  const [v, songId, partId, title, artist, trackName, score, accuracy, nickname]: unknown[] = data;
  if (v !== 1 || !isSongId(songId) || !isPartId(partId) || !isText(title) || !isText(artist) || !isText(trackName)
    || !isInteger(score, 0, MAX_SCORE) || !isInteger(accuracy, 0, 100)) {
    return null;
  }
  // A link or an offensive term in the song text costs the whole challenge: its text is shown as it is
  if (![title, artist, trackName].every(isAllowedText)) return null;
  if (nickname !== null && typeof nickname !== 'string') return null;
  // An offensive or malformed nickname costs only the nickname, not the challenge
  const checkedNickname = nickname === null ? null : checkNickname(nickname);
  return { v: 1, songId, partId, title, artist, trackName, score, accuracy, nickname: checkedNickname };
};

/**
 * Encode a challenge for a link. Text is cleaned (unsafe characters removed, at most 120 characters,
 * shortened further if multi-byte text would overflow the link limit) and an invalid nickname becomes
 * null, so the result always decodes. Throws RangeError if songId, partId, score or accuracy break the
 * rules, or if the song text (as it goes into the link) holds a link, a domain or a blocked term.
 */
export function encodeChallenge(challenge: Challenge): string {
  const { songId, partId, score, accuracy } = challenge;
  if (!isSongId(songId) || !isPartId(partId) || !isInteger(score, 0, MAX_SCORE) || !isInteger(accuracy, 0, 100)) {
    throw new RangeError('Invalid challenge: songId, partId, score or accuracy out of range');
  }
  const nickname = typeof challenge.nickname === 'string' ? checkNickname(challenge.nickname) : null;
  const texts = [challenge.title, challenge.artist, challenge.trackName]
    .map((text) => Array.from(text.replace(UNSAFE_CHARS, '')));
  const shorten = (limit: number): string[] => texts.map((chars) => chars.slice(0, limit).join(''));
  const build = ([title, artist, trackName]: string[]): string => {
    const tuple: ChallengeTuple = [1, songId, partId, title, artist, trackName, score, accuracy, nickname];
    return toBase64Url(new TextEncoder().encode(JSON.stringify(tuple)));
  };
  let limit = TEXT_MAX;
  let fields = shorten(limit);
  let code = build(fields);
  while (code.length > MAX_CODE_LENGTH && limit > 0) {
    limit = Math.max(0, limit - 10);
    fields = shorten(limit);
    code = build(fields);
  }
  // Checked on the text that goes into the link, which is what the decoder checks
  if (!fields.every(isAllowedText)) {
    throw new RangeError('Invalid challenge: song text with a link or a blocked term');
  }
  return code;
}

/** Strict: anything that encodeChallenge would not produce for a valid challenge gives null. */
export function decodeChallenge(code: string): Challenge | null {
  if (code.length === 0 || code.length > MAX_CODE_LENGTH || !BASE64URL.test(code)) return null;
  try {
    const bytes = fromBase64Url(code);
    // atob ignores stray bits, so several codes could decode to the same bytes: only the canonical one passes
    if (toBase64Url(bytes) !== code) return null;
    const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const data: unknown = JSON.parse(json);
    if (JSON.stringify(data) !== json) return null;
    return parseTuple(data);
  } catch {
    return null;
  }
}

/** Clean link on purpose: the query string and hash of baseUrl are dropped. */
export function buildChallengeUrl(baseUrl: string, challenge: Challenge): string {
  const base = baseUrl.split(/[?#]/, 1)[0];
  return `${base}?${CHALLENGE_PARAM}=${encodeChallenge(challenge)}`;
}

export function readChallengeFromSearch(search: string): Challenge | null {
  const codes = new URLSearchParams(search).getAll(CHALLENGE_PARAM);
  return codes.length === 1 ? decodeChallenge(codes[0]) : null;
}

const scoreFormat = new Intl.NumberFormat('pt-BR');

export function challengeShareText(challenge: Challenge, url: string): string {
  const song = challenge.artist ? `“${challenge.title}” (${challenge.artist})` : `“${challenge.title}”`;
  return `🎸 Desafio PRGB: fiz ${scoreFormat.format(challenge.score)} pontos em ${song}, `
    + `com ${challenge.accuracy}% de precisão. Consegue me superar? ${url}`;
}
