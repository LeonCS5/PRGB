import React from 'react';
import { SHORTCUT_KEYS, toolClass, type GameShortcut } from './gameToolbarKit';

export interface ToolGroupProps {
  label: string;
  children: React.ReactNode;
}

// On a wide screen a group is a row of buttons with a thin divider; in the phone's "Mais" sheet it is a titled block
export const ToolGroup: React.FC<ToolGroupProps> = ({ label, children }) => (
  <div role="group" aria-label={label} className="contents sm:flex sm:items-center sm:gap-2 sm:border-l sm:border-ink-700 sm:pl-2">
    <span aria-hidden="true" className="col-span-full pt-2 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 sm:hidden">{label}</span>
    {children}
  </div>
);

export interface ToolButtonProps {
  label: string; // the accessible name; also the visible text unless `compactLabel` hides it
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean; // a switch: shows on/off
  shortcut?: GameShortcut;
  tone?: 'amp' | 'signal';
  hideLabelBelow?: 'sm' | '2xl'; // icon-only on a phone ('sm') or from a tablet up to a laptop ('2xl'); the label stays in the accessible name
  disabled?: boolean;
  title?: string;
  className?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ label, icon, onClick, pressed, shortcut, tone = 'amp', hideLabelBelow, disabled, title, className = '' }) => {
  const key = shortcut ? SHORTCUT_KEYS[shortcut] : undefined;
  const isSwitch = pressed !== undefined;
  const on = tone === 'amp' ? 'border-amp-400! bg-amp-500/10 text-amp-300!' : 'border-signal-500! bg-signal-500/10 text-signal-300!';
  const labelClass = hideLabelBelow === 'sm' ? 'max-sm:sr-only' : hideLabelBelow === '2xl' ? 'sm:max-2xl:sr-only' : '';
  return (
    <button type="button" aria-label={label} aria-pressed={isSwitch ? pressed : undefined} aria-keyshortcuts={key === 'Espaço' ? 'Space' : key}
      title={title ?? (key ? `${label} (${key})` : label)} disabled={disabled} onClick={onClick}
      className={`${toolClass} ${isSwitch && pressed ? on : ''} ${className}`}>
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className={labelClass}>{label}</span>
      {isSwitch && <span aria-hidden="true" className={`ml-auto text-[0.625rem] font-bold uppercase tracking-wider sm:hidden ${pressed ? '' : 'text-ink-400'}`}>{pressed ? 'Ligado' : 'Desligado'}</span>}
      {isSwitch && <span aria-hidden="true" className={`hidden size-2 shrink-0 rounded-full sm:block ${pressed ? (tone === 'amp' ? 'bg-amp-400' : 'bg-signal-400') : 'bg-ink-600'}`} />}
      {key && <kbd aria-hidden="true" className="hidden rounded border border-ink-600 px-1 font-mono text-[0.625rem] font-semibold text-ink-300 2xl:inline">{key}</kbd>}
    </button>
  );
};
