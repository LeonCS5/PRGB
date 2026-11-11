import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_CONTACT } from '../content/legal';
import { RankingError } from '../services/backend/rankingApi';
import { NICKNAME_ERROR_MESSAGES } from '../services/nickname';
import { RoomError } from '../services/backend/roomChannel';
import { TabsApi } from '../services/tabsApi';
import { getRoomErrorMessage, getSearchErrorMessage, getSongMetadata } from './uiErrors';
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
  afterEach(() => vi.unstubAllGlobals());

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
