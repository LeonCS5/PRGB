import React from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { isLoadFailure, resetFailedLazyLoads } from './lazyLoad';

/** What the player sees when a screen crashes: a way out, instead of a blank page. */
export const CrashScreen: React.FC = () => (
  <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-950 px-6 text-center text-ink-100">
    <BrandMark size={32} />
    <TriangleAlert size={36} aria-hidden="true" className="text-amp-300" />
    <div role="alert" className="max-w-md">
      <h1 className="font-display text-xl font-bold">Algo deu errado por aqui</h1>
      <p className="mt-2 text-sm leading-6 text-ink-300">
        O PRGB encontrou um erro e precisou parar esta tela. Seus recordes ficam guardados neste navegador. Recarregue a página para voltar a tocar.
      </p>
    </div>
    <button type="button" onClick={() => window.location.reload()}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-amp-400 px-5 text-sm font-bold text-ink-950 transition hover:bg-amp-300 focus-visible:outline-2 focus-visible:outline-signal-400">
      <RotateCcw size={16} aria-hidden="true" />
      Recarregar
    </button>
  </main>
);

interface ErrorBoundaryState {
  hasError: boolean;
}

// A class on purpose: React only catches render errors in class components (there is no hook for it)
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Nothing leaves the browser: the console is the only record, as the policy says
    console.error('Erro de tela no PRGB.', error, info.componentStack);
  }

  render(): React.ReactNode {
    return this.state.hasError ? <CrashScreen /> : this.props.children;
  }
}

interface LazyErrorBoundaryProps extends React.PropsWithChildren {
  overlay?: boolean;
  onClose?: () => void;
}

interface LazyErrorBoundaryState {
  error: unknown;
}

/** What the player sees when a part of the app could not be downloaded (a new version replaced the files, or the network dropped). */
export const LoadFailureNotice: React.FC<{ overlay: boolean; onRetry: () => void; onClose?: () => void }> = ({ overlay, onRetry, onClose }) => {
  const box = (
    <div role="alert" className="max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-5 text-left text-ink-100 shadow-panel">
      <h2 className="font-display text-lg font-bold">Não deu para carregar esta parte</h2>
      <p className="mt-2 text-sm leading-6 text-ink-300">
        Confira a conexão e tente de novo. Se o PRGB acabou de ser atualizado, recarregar a página resolve.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-amp-400 px-4 text-sm font-bold text-ink-950 transition hover:bg-amp-300 focus-visible:outline-2 focus-visible:outline-signal-400">
          <RotateCcw size={16} aria-hidden="true" /> Tentar de novo
        </button>
        {onClose && (
          <button type="button" onClick={onClose}
            className="min-h-11 cursor-pointer rounded-xl border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-800">Fechar</button>
        )}
      </div>
    </div>
  );
  return overlay ? <div className="fixed inset-0 z-[90] grid place-items-center bg-ink-950/60 p-5">{box}</div> : <div className="grid place-items-center p-5">{box}</div>;
};

// Around one lazy screen: a failed download offers to try again instead of taking the whole app down. Any other error
// goes up to the app-wide boundary, as before.
export class LazyErrorBoundary extends React.Component<LazyErrorBoundaryProps, LazyErrorBoundaryState> {
  state: LazyErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): LazyErrorBoundaryState {
    return { error };
  }

  retry = (): void => {
    resetFailedLazyLoads();
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (!isLoadFailure(error)) throw error;
    return <LoadFailureNotice overlay={this.props.overlay ?? false} onRetry={this.retry} onClose={this.props.onClose} />;
  }
}
