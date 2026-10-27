import React, { useEffect, useRef } from 'react';

export interface ModalFrameProps {
  titleId: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

export const ModalFrame: React.FC<ModalFrameProps> = ({ titleId, onClose, className = '', children }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    dialog?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] rounded-2xl border border-ink-700 bg-ink-900 p-5 text-ink-100 shadow-panel focus:outline-none! backdrop:bg-ink-950/85 backdrop:backdrop-blur-md sm:p-6 ${className}`}>
      {children}
    </dialog>
  );
};
