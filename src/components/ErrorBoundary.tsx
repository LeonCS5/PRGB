import React from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { BrandMark } from './BrandMark';

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
