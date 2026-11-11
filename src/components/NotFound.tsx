import React from 'react';
import { BrandMark } from './BrandMark';

export const NotFound: React.FC = () => (
  <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-950 px-6 py-8 text-center text-ink-100">
    <title>Página não encontrada · PRGB</title>
    <BrandMark size={32} />
    <div className="max-w-md">
      <h1 className="font-display text-xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-sm leading-6 text-ink-300">Este endereço não existe no PRGB.</p>
    </div>
    <a href="/" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-amp-400 px-5 text-sm font-bold text-ink-950 transition hover:bg-amp-300 focus-visible:outline-2 focus-visible:outline-signal-400">
      Voltar ao início
    </a>
  </main>
);
