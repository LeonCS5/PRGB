import { describe, expect, it } from 'vitest';
import { CONSENT_COPY, PRIVACY_POLICY, TERMS_OF_USE } from '../content/legal';
import { splitLegalLabel } from './legalRoute';

describe('splitLegalLabel', () => {
  it.each([
    ['rankingLabel', CONSENT_COPY.rankingLabel],
    ['onlineLabel', CONSENT_COPY.onlineLabel]
  ])('links both documents in %s without changing its text', (_name, label) => {
    const parts = splitLegalLabel(label);
    expect(parts.map((part) => part.text).join('')).toBe(label);
    expect(parts.filter((part) => part.href)).toEqual([
      { text: PRIVACY_POLICY.title, href: '/#privacidade' },
      { text: TERMS_OF_USE.title, href: '/#termos' }
    ]);
  });

  it('keeps text without a document as it is', () => {
    expect(splitLegalLabel(CONSENT_COPY.ageLabel)).toEqual([{ text: CONSENT_COPY.ageLabel, href: null }]);
  });
});
