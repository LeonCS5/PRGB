import React, { Suspense, useState } from 'react';
import { LazyErrorBoundary } from './ErrorBoundary';

interface LazyScreenProps {
  label: string; // what is loading, in the loading message ("o jogo")
  onClose?: () => void; // lets a modal that failed to load be closed
  overlay?: boolean; // loading and failing happen over the screen (modals) instead of in place of it
  children: React.ReactNode;
}

const LoadingMessage: React.FC<{ label: string; overlay: boolean }> = ({ label, overlay }) => (
  overlay
    ? (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-ink-950/60 p-5">
        <p role="status" className="rounded-xl border border-ink-700 bg-ink-900 px-5 py-3 text-sm text-ink-100 shadow-panel">Carregando {label}…</p>
      </div>
    )
    : <p role="status" className="p-5 text-sm text-ink-300">Carregando {label}…</p>
);

// One place for lazy screens: a loading message while the chunk comes, and a way to try again when it does not
export const LazyScreen: React.FC<LazyScreenProps> = ({ label, onClose, overlay = false, children }) => (
  <LazyErrorBoundary overlay={overlay} onClose={onClose}>
    <Suspense fallback={<LoadingMessage label={label} overlay={overlay} />}>{children}</Suspense>
  </LazyErrorBoundary>
);

interface OnDemandProps {
  open: boolean;
  label: string;
  onClose?: () => void;
  children: React.ReactNode;
}

// Mounts lazy children only once they were asked for, then keeps them mounted (so they keep their own state)
export const OnDemand: React.FC<OnDemandProps> = ({ open, label, onClose, children }) => {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return seen ? <LazyScreen overlay label={label} onClose={onClose}>{children}</LazyScreen> : null;
};
