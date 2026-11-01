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
// here would suggest there was something to refuse.
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
    <aside aria-label="Aviso sobre dados no navegador" className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 text-xs leading-5 text-ink-200 shadow-panel sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1">
        O PRGB não usa cookies, publicidade nem rastreadores. Suas preferências e recordes ficam só neste navegador.{' '}
        <a href="#privacidade" className="text-signal-300 underline underline-offset-2 hover:text-signal-200">Política de Privacidade</a>
      </p>
      <button type="button" onClick={dismiss} className="min-h-10 shrink-0 cursor-pointer rounded-xl bg-amp-500 px-4 text-sm font-bold text-ink-950 hover:bg-amp-400">Entendi</button>
    </aside>
  );
};
