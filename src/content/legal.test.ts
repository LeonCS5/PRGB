import { describe, expect, it } from 'vitest';
import {
  CONSENT_COPY, LEGAL_CONTACT, LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE, formatLegalDate, type LegalDocument
} from './legal';

const DOCUMENTS: LegalDocument[] = [PRIVACY_POLICY, TERMS_OF_USE];

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(collectStrings);
  return [];
};

const ALL_TEXT = collectStrings([LEGAL_CONTACT, PRIVACY_POLICY, TERMS_OF_USE, CONSENT_COPY]);

const sectionText = (document: LegalDocument, id: string): string => {
  const section = document.sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Missing section "${id}" in ${document.id}`);
  return [section.title, ...section.paragraphs, ...(section.items ?? [])].join('\n');
};

describe('legal documents', () => {
  it('carry the current version and a well-formed structure', () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_POLICY).toMatchObject({ id: 'privacidade', title: 'Política de Privacidade' });
    expect(TERMS_OF_USE).toMatchObject({ id: 'termos', title: 'Termos de Uso' });
    for (const document of DOCUMENTS) {
      expect(document.updatedAt).toBe(LEGAL_VERSION);
      expect(document.summary.length).toBeGreaterThanOrEqual(3);
      for (const section of document.sections) {
        expect(section.paragraphs.length, section.id).toBeGreaterThan(0);
        if (section.items) expect(section.items.length, section.id).toBeGreaterThan(0);
      }
    }
  });

  it('use unique kebab-case section ids, so both documents can share one page', () => {
    const ids = DOCUMENTS.flatMap((document) => document.sections.map((section) => section.id));
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('have no empty or badly spaced text', () => {
    for (const text of ALL_TEXT) {
      expect(text.trim(), JSON.stringify(text)).not.toBe('');
      expect(text, JSON.stringify(text)).toBe(text.trim());
      expect(text, JSON.stringify(text)).not.toMatch(/\s{2}/);
    }
  });

  it('cover every topic the LGPD requires in the privacy policy', () => {
    expect(PRIVACY_POLICY.sections.map((section) => section.id)).toEqual(expect.arrayContaining([
      'dados-coletados', 'finalidades', 'bases-legais', 'compartilhamento', 'transferencia-internacional',
      'retencao', 'direitos', 'seguranca', 'menores-de-idade', 'alteracoes', 'contato'
    ]));
  });

  // Facts shared with the backend (retention job, providers, legal bases): if one changes, review these texts.
  it('state the retention periods, providers and legal bases the app really uses', () => {
    const retention = sectionText(PRIVACY_POLICY, 'retencao');
    for (const period of ['12 meses', '8 semanas', '7 dias']) expect(retention).toContain(period);
    const sharing = sectionText(PRIVACY_POLICY, 'compartilhamento');
    for (const party of ['Vercel', 'Supabase', 'Songsterr']) expect(sharing).toContain(party);
    expect(sectionText(PRIVACY_POLICY, 'transferencia-internacional')).toContain('Estados Unidos');
    const legalBases = sectionText(PRIVACY_POLICY, 'bases-legais');
    expect(legalBases).toContain('art. 7º, I)');
    expect(legalBases).toContain('art. 7º, IX)');
  });

  it('name the controller and the channel for data subjects and the ANPD', () => {
    expect(LEGAL_CONTACT.controller.trim()).not.toBe('');
    expect(LEGAL_CONTACT.email).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/);
    for (const id of ['quem-somos', 'contato']) {
      expect(sectionText(PRIVACY_POLICY, id)).toContain(LEGAL_CONTACT.controller);
      expect(sectionText(PRIVACY_POLICY, id)).toContain(LEGAL_CONTACT.email);
    }
    const contact = sectionText(PRIVACY_POLICY, 'contato');
    expect(contact).toContain('encarregado');
    expect(contact).toContain('ANPD');
    expect(sectionText(TERMS_OF_USE, 'fale-conosco')).toContain(LEGAL_CONTACT.email);
  });

  it('leave no bracketed placeholder behind', () => {
    for (const text of ALL_TEXT) {
      expect(text).not.toContain('[NOME DO CONTROLADOR]');
      expect(text).not.toContain('[E-MAIL DE CONTATO]');
      expect(text, text).not.toMatch(/\[[^\]]*\]/);
    }
  });

  it('only quote section titles, button labels or nickname examples', () => {
    const allowed = new Set([
      ...DOCUMENTS.flatMap((document) => document.sections.map((section) => section.title)),
      CONSENT_COPY.exportLabel, CONSENT_COPY.deleteTitle, CONSENT_COPY.clearLocalLabel,
      'admin', 'moderador', 'suporte'
    ]);
    for (const text of ALL_TEXT) {
      expect(text.split('“').length, text).toBe(text.split('”').length);
      for (const [, quote] of text.matchAll(/“([^”]+)”/g)) expect(allowed.has(quote), quote).toBe(true);
    }
  });

  it('point to the buttons by the labels the UI shows', () => {
    const rights = sectionText(PRIVACY_POLICY, 'direitos');
    expect(rights).toContain(`“${CONSENT_COPY.exportLabel}”`);
    expect(rights).toContain(`“${CONSENT_COPY.deleteTitle}”`);
    expect(sectionText(PRIVACY_POLICY, 'dados-no-navegador')).toContain(`“${CONSENT_COPY.clearLocalLabel}”`);
  });
});

describe('CONSENT_COPY', () => {
  it('asks for the age with the exact wording', () => {
    expect(CONSENT_COPY.ageLabel).toBe('Confirmo que tenho 18 anos ou mais.');
  });

  it('names each document exactly once in the consent labels, so the UI can link them', () => {
    for (const label of [CONSENT_COPY.rankingLabel, CONSENT_COPY.onlineLabel]) {
      expect(label.split(PRIVACY_POLICY.title)).toHaveLength(2);
      expect(label.split(TERMS_OF_USE.title)).toHaveLength(2);
    }
  });

  it('summarizes the ranking in 3 to 5 bullets, with retention and how to delete', () => {
    const { rankingSummary } = CONSENT_COPY;
    expect(rankingSummary.length).toBeGreaterThanOrEqual(3);
    expect(rankingSummary.length).toBeLessThanOrEqual(5);
    expect(rankingSummary.join('\n')).toContain('12 meses');
    expect(rankingSummary.join('\n')).toContain('excluir a conta');
    expect(CONSENT_COPY.onlineSummary.join('\n')).toContain('não são gravados');
  });
});

describe('text encoding', () => {
  it('has no replacement characters, mojibake or "?" glued to a letter', () => {
    for (const text of ALL_TEXT) {
      expect(text, text).not.toMatch(/�/);
      expect(text, text).not.toMatch(/\?\p{L}/u);
      expect(text, text).not.toMatch(/Ã[\u0080-¿]|â€/);
    }
  });
});

describe('formatLegalDate', () => {
  it('formats the ISO date in pt-BR without shifting the day', () => {
    expect(formatLegalDate('2026-10-28')).toBe('28 de outubro de 2026');
    expect(formatLegalDate('2026-01-01')).toBe('1 de janeiro de 2026');
  });
});
