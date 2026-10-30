// Hash routes of the legal pages, with no router library: #privacidade and #termos open a document,
// and a section id (unique across both documents) opens its document scrolled to that section.
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from '../content/legal';

export interface LegalRoute {
  document: LegalDocument;
  sectionId: string | null;
}

export interface LegalLabelPart {
  text: string;
  href: string | null; // the document quoted by this part of the label; null for plain text
}

const DOCUMENTS: readonly LegalDocument[] = [PRIVACY_POLICY, TERMS_OF_USE];

/**
 * Splits a consent label around the document titles it quotes, so they can be rendered as links. The links
 * point at the app's root: the current address may carry ?demo, which would open the game there instead.
 */
export const splitLegalLabel = (label: string): LegalLabelPart[] =>
  label.split(new RegExp(`(${DOCUMENTS.map((document) => document.title).join('|')})`)).filter(Boolean).map((text) => {
    const document = DOCUMENTS.find((item) => item.title === text);
    return { text, href: document ? `${import.meta.env.BASE_URL}#${document.id}` : null };
  });

export const resolveLegalRoute = (hash: string): LegalRoute | null => {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  if (!id) return null;
  for (const document of DOCUMENTS) {
    if (document.id === id) return { document, sectionId: null };
    if (document.sections.some((section) => section.id === id)) return { document, sectionId: id };
  }
  return null;
};

export const subscribeToHash = (listener: () => void): (() => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};

export const readHash = (): string => window.location.hash;
