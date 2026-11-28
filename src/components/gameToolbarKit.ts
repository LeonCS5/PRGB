export const toolClass = 'flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400 disabled:cursor-not-allowed disabled:opacity-50';

// Keys that work while playing. Only when nothing that types or picks has the focus, and never with a modifier
export type GameShortcut = 'play' | 'metronome' | 'notes' | 'appearance' | 'speed-up' | 'speed-down';

export const SHORTCUT_KEYS: Readonly<Record<GameShortcut, string>> = {
  play: 'Espaço',
  metronome: 'M',
  notes: 'N',
  appearance: 'A',
  'speed-up': '↑',
  'speed-down': '↓'
};

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat?: boolean;
  target: EventTarget | { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
}

interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

export const shortcutFor = (event: ShortcutEvent): GameShortcut | null => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null;
  const target = event.target as ElementLike | null; // a keydown's target is an element; the test passes plain objects
  const tag = target?.tagName?.toUpperCase();
  if (tag && TYPING_TAGS.has(tag)) return null;
  if (target?.isContentEditable) return null;
  if (target?.closest?.('dialog')) return null; // a panel or modal has the focus: its keys are its own
  switch (event.key) {
    // A button or link already acts on Space itself: leaving it alone avoids pressing it twice
    case ' ': return tag === 'BUTTON' || tag === 'A' ? null : 'play';
    case 'm': case 'M': return 'metronome';
    case 'n': case 'N': return 'notes';
    case 'a': case 'A': return 'appearance';
    case 'ArrowUp': return 'speed-up';
    case 'ArrowDown': return 'speed-down';
    default: return null;
  }
};

// Next value in a list (the speeds), or the same one at the ends
export const stepOption = (options: readonly number[], current: number, direction: 1 | -1): number => {
  const index = options.indexOf(current);
  if (index < 0) return current;
  return options[Math.min(options.length - 1, Math.max(0, index + direction))];
};
