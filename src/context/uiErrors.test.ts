import { describe, expect, it } from 'vitest';
import { LEGAL_CONTACT } from '../content/legal';
import { RankingError } from '../services/backend/rankingApi';
import { NICKNAME_ERROR_MESSAGES } from '../services/nickname';
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
