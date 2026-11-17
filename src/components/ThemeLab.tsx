import React, { useId, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useThemeId } from '../context/useTheme';
import { ORIGINAL_PREVIEW, ORIGINAL_THEME_ID, THEMES, setTheme, type ThemeColors } from '../services/themes';

// TEMPORARY: floating picker to compare identities in the real app (see services/themes.ts to remove it)
const swatches = (colors: ThemeColors): string[] =>
  [colors.background, colors.surfaceElevated, colors.primary, colors.secondary, colors.text];

export const ThemeLab: React.FC = () => {
  const [open, setOpen] = useState(false);
  const activeId = useThemeId();
  const panelId = useId();

  return (
    <div className="fixed right-3 bottom-20 z-[60] flex flex-col items-end gap-2 lg:bottom-3">
      {open && (
        <div id={panelId} role="group" aria-label="Temas de cores" className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-panel">
          <ul className="flex flex-col gap-1.5">
            {THEMES.map((theme) => {
              const active = theme.id === activeId;
              return (
                <li key={theme.id}>
                  <button type="button" aria-pressed={active} onClick={() => setTheme(theme.id)}
                    className={'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left ' + (active ? 'border-amp-400 bg-ink-800' : 'border-ink-700 bg-ink-850 hover:bg-ink-800')}>
                    <span className="flex shrink-0" aria-hidden="true">
                      {swatches(theme.colors ?? ORIGINAL_PREVIEW).map((color, index) => (
                        <span key={index} style={{ backgroundColor: color }} className="-ml-1 h-5 w-5 rounded-full border border-ink-600 first:ml-0" />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink-100">{theme.name}</span>
                    {active && <><Check size={16} className="shrink-0 text-amp-400" aria-hidden="true" /><span className="sr-only">tema ativo</span></>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setTheme(ORIGINAL_THEME_ID)} disabled={activeId === ORIGINAL_THEME_ID}
            className="mt-2 min-h-11 w-full cursor-pointer rounded-lg border border-ink-600 px-3 text-sm font-semibold text-ink-200 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50">
            Restaurar o tema original
          </button>
        </div>
      )}
      <button type="button" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink-600 bg-ink-900/90 px-4 text-sm font-semibold text-ink-200 hover:bg-ink-800">
        <Palette size={16} aria-hidden="true" /> Temas
      </button>
    </div>
  );
};
