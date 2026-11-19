import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_CONTACT } from '../content/legal';
import { RankingError } from '../services/backend/rankingApi';
import { NICKNAME_ERROR_MESSAGES } from '../services/nickname';
import { RoomError } from '../services/backend/roomChannel';
import { TabsApi, TabsBlockedError } from '../services/tabsApi';
import { getAudioErrorMessage, getRoomErrorMessage, getSearchErrorMessage, getSongMetadata } from './uiErrors';
import { getRankingErrorMessage } from './uiErrors';

describe('getRankingErrorMessage', () => {
  it('maps the codes to pt-BR messages', () => {
    expect(getRankingErrorMessage(new RankingError('nickname_taken'))).toBe('Esse apelido já está em uso.');
    expect(getRankingErrorMessage(new RankingError('nickname_blocked'))).toBe(NICKNAME_ERROR_MESSAGES.offensive);
  });

  it('reads the code of an error that has not been mapped yet', () => {
    expect(getRankingErrorMessage({ message: 'rate_limited', code: 'P0001' })).toBe('Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.');
  });

  it('never shows the text of an unexpected error', () => {
    expect(getRankingErrorMessage(new Error('duplicate key value violates unique constraint')))
      .toBe('Não foi possível falar com o ranking agora. Tente novamente em instantes.');
  });

  it('says how to ask for a review of a refused score (LGPD art. 20)', () => {
    expect(getRankingErrorMessage(new RankingError('score_implausible'))).toContain(LEGAL_CONTACT.email);
  });
});

describe('tab provider and room messages', () => {
  afterEach(() => {
    TabsApi.reset();
    vi.unstubAllGlobals();
  });

  it('says the external catalog refused, without promising a retry or naming the provider', async () => {
    const blocked = new TabsBlockedError(403);
    expect(getSearchErrorMessage(blocked)).toBe(
      'O acervo externo recusou o acesso agora. Os exercícios e músicas do PRGB continuam disponíveis.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 429 })));
    await expect(getSongMetadata(7)).rejects.toThrow('acervo externo recusou');
  });

  it('explains that a catalog song cannot be ranked', () => {
    expect(getRankingErrorMessage(new RankingError('songsterr_unavailable')))
      .toBe('Esta música não pode valer para o ranking agora. O ranking vale para os exercícios e músicas do PRGB.');
  });

  it('says the format was unexpected, not that the connection failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"oops":true}')));
    await expect(getSongMetadata(7)).rejects.toThrow('formato inesperado');
    await expect(TabsApi.searchSongs('x').catch(getSearchErrorMessage)).resolves.toContain('formato inesperado');
  });

  it('keeps the connection message for network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(getSongMetadata(7)).rejects.toThrow('Verifique sua conexão');
  });

  it('explains a full Realtime service', () => {
    expect(getRoomErrorMessage(new RoomError('realtime_busy'))).toContain('lotadas');
  });
});

describe('messages that say what to do', () => {
  it('tells a part outside the ranking that retrying will not help', () => {
    for (const code of ['part_unregistered', 'tab_invalid'] as const) {
      const text = getRankingErrorMessage(new RankingError(code));
      expect(text).toContain('não vale para o ranking');
      expect(text).not.toContain('Tente novamente');
    }
  });

  it('says where to click to allow the microphone, and what ASIO is', () => {
    const denied = new Error('x');
    denied.name = 'NotAllowedError';
    expect(getAudioErrorMessage(denied)).toContain('cadeado');
    const busy = new Error('x');
    busy.name = 'NotReadableError';
    expect(getAudioErrorMessage(busy)).toContain('ASIO (o modo de áudio dedicado');
  });
});
