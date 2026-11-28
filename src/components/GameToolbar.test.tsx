import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SPEED_OPTIONS } from '../context/sessionSettings';
import { ToolButton, ToolGroup } from './GameToolbar';
import { shortcutFor, stepOption, type ShortcutEvent } from './gameToolbarKit';

const press = (key: string, target: ShortcutEvent['target'] = { tagName: 'BODY' }, extra: Partial<ShortcutEvent> = {}): ShortcutEvent =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, target, ...extra });

describe('game shortcuts', () => {
  it('maps the keys of the toolbar', () => {
    expect(shortcutFor(press(' '))).toBe('play');
    expect(shortcutFor(press('m'))).toBe('metronome');
    expect(shortcutFor(press('M'))).toBe('metronome');
    expect(shortcutFor(press('n'))).toBe('notes');
    expect(shortcutFor(press('a'))).toBe('appearance');
    expect(shortcutFor(press('ArrowUp'))).toBe('speed-up');
    expect(shortcutFor(press('ArrowDown'))).toBe('speed-down');
    expect(shortcutFor(press('x'))).toBeNull();
  });

  it('stays out of the way of typing, pickers and the slider', () => {
    for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
      expect(shortcutFor(press('m', { tagName }))).toBeNull();
      expect(shortcutFor(press('ArrowUp', { tagName }))).toBeNull();
    }
    expect(shortcutFor(press('m', { tagName: 'DIV', isContentEditable: true }))).toBeNull();
  });

  it('leaves a modal or panel its own keys', () => {
    expect(shortcutFor(press('m', { tagName: 'DIALOG', closest: (selector) => (selector === 'dialog' ? {} : null) }))).toBeNull();
    expect(shortcutFor(press(' ', { tagName: 'BUTTON', closest: () => ({}) }))).toBeNull();
  });

  it('does not press a focused button twice with Space', () => {
    expect(shortcutFor(press(' ', { tagName: 'BUTTON', closest: () => null }))).toBeNull();
    expect(shortcutFor(press('m', { tagName: 'BUTTON', closest: () => null }))).toBe('metronome');
  });

  it('ignores browser shortcuts and held keys', () => {
    expect(shortcutFor(press('a', undefined, { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press('a', undefined, { metaKey: true }))).toBeNull();
    expect(shortcutFor(press('a', undefined, { altKey: true }))).toBeNull();
    expect(shortcutFor(press('m', undefined, { repeat: true }))).toBeNull();
  });
});

describe('stepOption', () => {
  it('moves one speed at a time and stops at the ends', () => {
    expect(stepOption(SPEED_OPTIONS, 1, 1)).toBe(1.1);
    expect(stepOption(SPEED_OPTIONS, 1, -1)).toBe(0.9);
    expect(stepOption(SPEED_OPTIONS, SPEED_OPTIONS[0], -1)).toBe(SPEED_OPTIONS[0]);
    expect(stepOption(SPEED_OPTIONS, SPEED_OPTIONS[SPEED_OPTIONS.length - 1], 1)).toBe(SPEED_OPTIONS[SPEED_OPTIONS.length - 1]);
    expect(stepOption(SPEED_OPTIONS, 3.3, 1)).toBe(3.3); // a value that is not an option stays
  });
});

describe('ToolButton', () => {
  const noop = () => {};
  it('shows an off switch as not pressed, with the state written out for the phone sheet', () => {
    const html = renderToStaticMarkup(<ToolButton label="Metrônomo" icon={<i />} pressed={false} shortcut="metronome" onClick={noop} />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-keyshortcuts="M"');
    expect(html).toContain('title="Metrônomo (M)"');
    expect(html).toContain('Desligado');
  });

  it('marks an on switch and keeps a plain action out of the switch role', () => {
    const on = renderToStaticMarkup(<ToolButton label="Metrônomo" icon={<i />} pressed onClick={noop} />);
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('Ligado');
    expect(on).toContain('border-amp-400!');
    const plain = renderToStaticMarkup(<ToolButton label="Áudio" icon={<i />} onClick={noop} />);
    expect(plain).not.toContain('aria-pressed');
    expect(plain).not.toContain('Ligado');
  });

  it('keeps the name when the label is hidden to save room', () => {
    const html = renderToStaticMarkup(<ToolButton label="Aparência" icon={<i />} hideLabelBelow="sm" onClick={noop} />);
    expect(html).toContain('aria-label="Aparência"');
    expect(html).toContain('max-sm:sr-only');
  });

  it('writes Space as the word, in the accessible shortcut', () => {
    expect(renderToStaticMarkup(<ToolButton label="Tocar" icon={<i />} shortcut="play" onClick={noop} />)).toContain('aria-keyshortcuts="Space"');
  });
});

describe('ToolGroup', () => {
  it('is a named group, with a title for the phone sheet', () => {
    const html = renderToStaticMarkup(<ToolGroup label="Prática"><b /></ToolGroup>);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Prática"');
    expect(html).toContain('>Prática<');
  });
});
