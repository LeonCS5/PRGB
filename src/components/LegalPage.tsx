import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { LocalDataControls } from './LocalDataControls';
import { formatLegalDate, LEGAL_CONTACT, PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from '../content/legal';

export interface LegalPageProps {
  document: LegalDocument;
  sectionId: string | null;
}

export const LegalPage: React.FC<LegalPageProps> = ({ document, sectionId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const otherDocument = document.id === PRIVACY_POLICY.id ? TERMS_OF_USE : PRIVACY_POLICY;

  // The page renders after the hash changed, so the browser's own anchor jump may have found nothing yet
  useEffect(() => {
    const section = sectionId ? sectionRefs.current.get(sectionId) : undefined;
    if (section) {
      section.scrollIntoView({ block: 'start' });
    } else {
      scrollRef.current?.scrollTo({ top: 0 });
      headingRef.current?.focus();
    }
  }, [document, sectionId]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-5 sm:px-8">
          <a href="#" aria-label="PRGB: voltar ao início" className="rounded-lg"><BrandMark size={28} /></a>
          <a href="#" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-200 hover:text-amp-300">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao início
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-mono text-xs tracking-widest text-amp-300">PRGB · DOCUMENTO LEGAL</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-4xl font-bold tracking-tight focus:outline-none! sm:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm text-ink-300">Última atualização: <time dateTime={document.updatedAt}>{formatLegalDate(document.updatedAt)}</time></p>

        <section aria-labelledby="legal-summary" className="mt-8 rounded-2xl border border-amp-500/25 bg-amp-500/5 p-5 sm:p-6">
          <h2 id="legal-summary" className="font-display text-lg font-bold">Resumo</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-200 marker:text-amp-400">
            {document.summary.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <nav aria-labelledby="legal-contents" className="mt-8">
          <h2 id="legal-contents" className="font-mono text-xs tracking-widest text-ink-300">NESTA PÁGINA</h2>
          <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {document.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`} className="inline-block py-1 text-signal-300 underline-offset-4 hover:underline">{section.title}</a></li>
            ))}
          </ol>
        </nav>

        {document.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mt-10 scroll-mt-24 border-t border-ink-700 pt-8"
            ref={(element) => {
              if (element) sectionRefs.current.set(section.id, element);
              else sectionRefs.current.delete(section.id);
            }}>
            <h2 id={`${section.id}-title`} className="font-display text-2xl font-bold tracking-tight">{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-ink-200">{paragraph}</p>)}
            {section.items && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-200 marker:text-ink-400">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {document.id === PRIVACY_POLICY.id && section.id === 'dados-no-navegador' && (
              <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <LocalDataControls />
              </div>
            )}
          </section>
        ))}

        <footer className="mt-12 border-t border-ink-700 pt-6 text-sm text-ink-300">
          <p>Dúvidas: <a href={`mailto:${LEGAL_CONTACT.email}`} className="text-signal-300 underline-offset-4 hover:underline">{LEGAL_CONTACT.email}</a></p>
          <p className="mt-2">Veja também: <a href={`#${otherDocument.id}`} className="text-signal-300 underline-offset-4 hover:underline">{otherDocument.title}</a></p>
        </footer>
      </main>
    </div>
  );
};
