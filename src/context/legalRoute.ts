// Hash routes of the legal pages, with no router library: #privacidade and #termos open a document,
// and a section id (unique across both documents) opens its document scrolled to that section.
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from '../content/legal';

export interface LegalRoute {
  document: LegalDocument;
  sectionId: string | null;
}

const DOCUMENTS: readonly LegalDocument[] = [PRIVACY_POLICY, TERMS_OF_USE];

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
