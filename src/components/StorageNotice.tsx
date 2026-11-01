import React, { useState } from 'react';

const STORAGE_KEY = 'prgb:storage-notice:v1';

const wasSeen = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'seen';
  } catch {
    return false;
  }
};

// Informs and asks for nothing: the site has no cookies and what it keeps is what the player chose. A choice
// here would suggest there was something to refuse. It stays in the page flow so it never covers a control.
export const StorageNotice: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => !wasSeen());
  if (!isVisible) return null;

  const dismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'seen');
    } catch {
      // Blocked storage only means the notice comes back on the next visit
    }
  };

  return (
    <aside aria-label="Aviso sobre dados no navegador" className="mx-auto max-w-7xl px-5 pt-4 sm:px-8 lg:px-12">
      <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-xs leading-5 text-ink-200">
        <p className="min-w-0 flex-1">
          Sem cookies, publicidade ou rastreadores. Suas preferências e recordes ficam só neste navegador.{' '}
          <a href="#privacidade" className="text-signal-300 underline underline-offset-2 hover:text-signal-200">Política de Privacidade</a>
        </p>
        <button type="button" onClick={dismiss} className="min-h-10 shrink-0 cursor-pointer rounded-lg bg-amp-500 px-4 text-sm font-bold text-ink-950 hover:bg-amp-400">Entendi</button>
      </div>
    </aside>
  );
};
