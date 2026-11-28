import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Eye } from 'lucide-react';
import { applyPreset, isPresetCustomized, resetAppearance, setAppearance, useAppearance, useGameplayAppearance } from '../appearance/useAppearance';
import { useGamePalette } from '../appearance/useGamePalette';
import { GuideSection } from './appearance/GuideSection';
import { PreviewCanvasCard, PreviewSamples } from './appearance/PreviewPanel';
import { CATEGORIES, type CategoryId } from './appearance/options';
import {
  AccessibilitySection, BackgroundSection, EffectsSection, InterfaceSection, NotesSection, ThemesSection
} from './appearance/sections';
import { useReducedMotion } from './appearance/useReducedMotion';

export interface AppearanceScreenProps {
  onExit: () => void;
  titleId?: string; // lets a dialog around the screen (the game's) name itself by the heading
  exitLabel?: string; // the game opens this screen over itself: "Voltar à música" instead of "Voltar ao início"
}

export const AppearanceScreen: React.FC<AppearanceScreenProps> = ({ onExit, exitLabel = 'Voltar ao início', titleId }) => {
  const settings = useAppearance();
  const gameplay = useGameplayAppearance();
  const palette = useGamePalette();
  const systemReducesMotion = useReducedMotion();
  const [category, setCategory] = useState<CategoryId>('temas');
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const customized = isPresetCustomized(settings);
  const effectsPaused = settings.reduceEffects || systemReducesMotion;
  const section = { settings, onChange: setAppearance };

  return (
    <main className="relative h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-8 lg:px-12">
        <button type="button" onClick={onExit} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-ink-200 hover:bg-ink-800">
          <ArrowLeft size={18} aria-hidden="true" /> {exitLabel}
        </button>
        <h1 id={titleId} ref={heading} tabIndex={-1} className="mt-4 font-display text-3xl font-bold">Aparência</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">Escolha como o PRGB parece. As mudanças valem na hora e ficam salvas neste navegador.</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)_21rem] lg:items-start xl:grid-cols-[14rem_minmax(0,1fr)_24rem]">
          <nav aria-label="Categorias de aparência" className="min-w-0 lg:sticky lg:top-4">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {CATEGORIES.map(({ id, label, icon: Icon }) => {
                const current = id === category;
                return (
                  <li key={id} className="shrink-0">
                    <button type="button" aria-current={current ? 'true' : undefined} onClick={() => setCategory(id)}
                      className={`flex min-h-11 w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition ${current ? 'border-amp-400 bg-amp-500/10 text-amp-300' : 'border-ink-700 bg-ink-900 text-ink-200 hover:border-ink-400 hover:text-ink-100'}`}>
                      <Icon size={16} className="shrink-0" aria-hidden="true" />{label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 max-lg:contents lg:sticky lg:top-4 lg:order-3 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
            <aside aria-label="Pré-visualização" className="sticky top-0 z-10 -mx-4 border-b border-ink-700 bg-ink-950/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:rounded-2xl lg:border lg:bg-ink-900 lg:p-4 lg:backdrop-blur-none">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink-100"><Eye size={16} className="text-signal-400" aria-hidden="true" />Pré-visualização</h2>
                <button type="button" aria-expanded={isPreviewOpen} aria-controls="appearance-preview" onClick={() => setIsPreviewOpen((open) => !open)}
                  className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-200 hover:bg-ink-800 lg:hidden">
                  {isPreviewOpen ? 'Recolher' : 'Mostrar'}<ChevronDown size={14} className={isPreviewOpen ? 'rotate-180' : ''} aria-hidden="true" />
                </button>
              </div>
              <div id="appearance-preview" className={`${isPreviewOpen ? '' : 'hidden lg:block'}`}>
                <PreviewCanvasCard appearance={gameplay} palette={palette} className="mt-2 h-28 lg:h-44" />
                <div className="mt-4 hidden lg:block"><PreviewSamples settings={settings} /></div>
              </div>
            </aside>
            <details open className="rounded-2xl border border-ink-700 bg-ink-900 p-4 lg:hidden">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-ink-100">Componentes de exemplo</summary>
              <div className="mt-2"><PreviewSamples settings={settings} /></div>
            </details>
          </div>

          <section aria-labelledby={`appearance-title-${category}`} className="min-w-0 lg:order-2">
            {category === 'temas' && <ThemesSection {...section} customized={customized} onPreset={applyPreset} onReset={resetAppearance} />}
            {category === 'interface' && <InterfaceSection {...section} />}
            {category === 'notas' && <NotesSection {...section} originalStrings={palette.strings} />}
            {category === 'sombra' && <GuideSection {...section} />}
            {category === 'efeitos' && <EffectsSection {...section} effectsPaused={effectsPaused} />}
            {category === 'fundo' && <BackgroundSection {...section} />}
            {category === 'acessibilidade' && <AccessibilitySection {...section} systemReducesMotion={systemReducesMotion} />}
          </section>
        </div>
      </div>
    </main>
  );
};
