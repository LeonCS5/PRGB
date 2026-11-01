import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';

export interface GameMoreSheetProps {
  children: (close: () => void) => React.ReactNode;
}

const DESKTOP_QUERY = '(min-width: 40rem)';

export const GameMoreSheet: React.FC<GameMoreSheetProps> = ({ children }) => {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    // Restore focus after the dialog leaves the DOM, before another modal opens.
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [isOpen]);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      setIsDesktop(query.matches);
      if (query.matches) setIsOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  if (isDesktop) return <>{children(close)}</>;

  return (
    <>
      <button ref={triggerRef} type="button" aria-label="Mais opções" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(true)}
        className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">
        <MoreHorizontal size={16} aria-hidden="true" /> Mais
      </button>
      {isOpen && (
        <ModalFrame titleId={titleId} onClose={close}
          className="top-auto! bottom-0! mb-0! max-h-[85dvh] w-full! max-w-md overflow-y-auto rounded-b-none">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-bold">Mais opções</h2>
            <button type="button" onClick={close}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 px-3 text-sm text-ink-200 transition hover:border-ink-500">
              <X size={18} aria-hidden="true" /> Fechar
            </button>
          </div>
          <div className="grid gap-2 [&>button]:w-full [&>button]:justify-start">{children(close)}</div>
        </ModalFrame>
      )}
    </>
  );
};
