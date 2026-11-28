import React from 'react';
import { Check } from 'lucide-react';
import type { Option } from './options';

const ring = 'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-400';

export interface OptionGroupProps<T extends string | number> {
  legend: string;
  name: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // Extra content inside each option card (a sample of the option)
  sample?: (option: Option<T>) => React.ReactNode;
  columns?: string;
}

export const OptionGroup = <T extends string | number>({ legend, name, options, value, onChange, sample, columns = 'grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]' }: OptionGroupProps<T>): React.ReactElement => (
  <fieldset className="min-w-0">
    <legend className="mb-2 text-sm font-semibold text-ink-100">{legend}</legend>
    <div className={`grid gap-2 ${columns}`}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label key={String(option.value)} className="relative block min-w-0 cursor-pointer">
            <input type="radio" name={name} value={String(option.value)} checked={checked} onChange={() => onChange(option.value)} className="peer sr-only" />
            <span className={`flex h-full min-h-11 flex-col gap-1.5 rounded-xl border p-3 transition ${checked ? 'border-amp-400 bg-amp-500/10' : 'border-ink-600 bg-ink-900 hover:border-ink-400'} ${ring}`}>
              <span className="flex flex-wrap items-center justify-between gap-x-2 text-sm font-semibold text-ink-100">
                {option.label}
                {checked && <span className="flex items-center gap-1 text-xs font-semibold text-amp-300"><Check size={14} aria-hidden="true" />ativo</span>}
              </span>
              {sample?.(option)}
              {option.hint && <span className="text-xs leading-5 text-ink-300">{option.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
}

export const RangeField: React.FC<RangeFieldProps> = ({ id, label, value, min, max, step = 5, unit = '%', hint, onChange }) => (
  <div className="min-w-0">
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-ink-100">{label}</label>
      <output htmlFor={id} className="font-mono text-sm text-amp-300">{value}{unit}</output>
    </div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))}
      className="mt-1 block h-11 w-full cursor-pointer accent-amp-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400" />
    {hint && <p className="text-xs leading-5 text-ink-300">{hint}</p>}
  </div>
);

export interface SwitchFieldProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const SwitchField: React.FC<SwitchFieldProps> = ({ id, label, hint, checked, onChange }) => (
  <label htmlFor={id} className="relative flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3">
    <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
    <span aria-hidden="true" className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-400 ${checked ? 'border-amp-400 bg-amp-500/30' : 'border-ink-500 bg-ink-800'}`}>
      <span className={`size-4.5 rounded-full transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5 bg-amp-300' : 'translate-x-0 bg-ink-300'}`} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-100">{label}<span className="text-xs font-semibold text-ink-300">{checked ? 'Ligado' : 'Desligado'}</span></span>
      <span className="block text-xs leading-5 text-ink-300">{hint}</span>
    </span>
  </label>
);
