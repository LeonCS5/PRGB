import React from 'react';
import { COMPACT_KEY_SYMBOLS, TECHNIQUE_KEY } from './techniqueKey';

const Chip: React.FC<{ symbol: string }> = ({ symbol }) => (
  <span aria-hidden="true" className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-ink-500 bg-ink-800 px-1.5 font-mono text-xs font-bold text-ink-100">{symbol}</span>
);

/** The key to the symbols: a list with the meaning of each (Aparência) or one line of chips (the first game). */
export const TechniqueLegend: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-300">
        {TECHNIQUE_KEY.filter((item) => COMPACT_KEY_SYMBOLS.includes(item.symbol)).map((item) => (
          <span key={item.symbol} className="inline-flex items-center gap-1.5"><Chip symbol={item.symbol} />{item.short}</span>
        ))}
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Símbolos das técnicas">
      {TECHNIQUE_KEY.map((item) => (
        <li key={item.symbol + item.short} className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/60 p-3 text-xs leading-5 text-ink-200">
          <Chip symbol={item.symbol} />
          <span><strong className="font-semibold text-ink-100">{item.short[0].toUpperCase() + item.short.slice(1)}:</strong> {item.description}</span>
        </li>
      ))}
    </ul>
  );
};
