import React from 'react';
import { LayoutGrid, Music, Play, PlugZap, Sliders, Trophy, type LucideIcon } from 'lucide-react';

export interface SiteNavProps {
  isAudioRunning: boolean;
  onPlay: () => void;
  onSearch: () => void;
  onAudio: () => void;
  onRanking: (() => void) | null; // null when the ranking is not configured
}

interface NavItem {
  label: string;
  ariaLabel?: string;
  icon: LucideIcon;
  onSelect?: () => void; // without it, the item is a link to the game modes on the landing
}

const navItems = ({ onPlay, onSearch, onRanking }: SiteNavProps): NavItem[] => [
  { label: 'Tocar', icon: Play, onSelect: onPlay },
  { label: 'Músicas', icon: Music, onSelect: onSearch },
  { label: 'Modos', icon: LayoutGrid },
  ...(onRanking ? [{ label: 'Ranking', icon: Trophy, onSelect: onRanking }] : [])
];

const NavEntry: React.FC<{ item: NavItem; iconSize: number; className: string }> = ({ item, iconSize, className }) => {
  const { label, ariaLabel, icon: Icon, onSelect } = item;
  const content = <><Icon size={iconSize} className="shrink-0" aria-hidden="true" />{label}</>;
  return onSelect
    ? <button type="button" aria-label={ariaLabel} onClick={onSelect} className={className}>{content}</button>
    : <a href="#modos" className={className}>{content}</a>;
};

export const HeaderNav: React.FC<SiteNavProps> = (props) => (
  <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
    {navItems(props).map((item) => (
      <NavEntry key={item.label} item={item} iconSize={16}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-200 transition hover:bg-ink-800 hover:text-amp-300" />
    ))}
  </nav>
);

// Stands for the audio item on wide screens: it shows the state and opens the panel that fixes it
export const AudioChip: React.FC<Pick<SiteNavProps, 'isAudioRunning' | 'onAudio'>> = ({ isAudioRunning, onAudio }) => (
  <button type="button" onClick={onAudio}
    className={`hidden min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition hover:bg-ink-800 lg:flex ${isAudioRunning ? 'border-ink-700 text-ink-200' : 'border-amp-500/50 text-amp-300'}`}>
    <span aria-hidden="true" className={`size-2 rounded-full ${isAudioRunning ? 'bg-hit' : 'bg-amp-400'}`} />
    {isAudioRunning ? 'Áudio conectado' : 'Conectar áudio'}
  </button>
);

export const TabBar: React.FC<SiteNavProps> = (props) => {
  const items = navItems(props);
  const audio: NavItem = props.isAudioRunning
    ? { label: 'Áudio', ariaLabel: 'Áudio conectado', icon: Sliders, onSelect: props.onAudio }
    : { label: 'Conectar', ariaLabel: 'Conectar áudio', icon: PlugZap, onSelect: props.onAudio };
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {[...items.slice(0, 3), audio, ...items.slice(3)].map((item) => (
        <NavEntry key={item.label} item={item} iconSize={20}
          className="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-200 transition hover:text-amp-300" />
      ))}
    </nav>
  );
};
