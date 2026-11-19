import { beforeEach, describe, expect, it, vi } from 'vitest';

// No DOM in these tests: useState is replaced by one cell, which is enough to follow what OnDemand decides
// between renders (a real remount would lose the cell).
let cell: { value: unknown } | null = null;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useState = (initial: unknown) => {
    cell ??= { value: initial };
    const current = cell;
    return [current.value, (next: unknown) => { current.value = next; }];
  };
  return { ...actual, default: { ...actual, useState }, useState };
});

const { OnDemand } = await import('./OnDemand');
const { LazyScreen } = await import('./OnDemand');

const child = 'lazy-child';
// OnDemand returns either null or one LazyScreen element (loading message and retry) wrapping the children
const render = (open: boolean) => OnDemand({ open, label: 'o painel', children: child }) as { type: unknown; props: { children: unknown; label: string; overlay: boolean } } | null;

describe('OnDemand', () => {
  beforeEach(() => { cell = null; });

  it('mounts nothing while it was never opened', () => {
    expect(render(false)).toBeNull();
    expect(render(false)).toBeNull();
  });

  it('mounts the children inside a LazyScreen overlay as soon as it opens', () => {
    const element = render(true);
    expect(element?.type).toBe(LazyScreen);
    expect(element?.props.overlay).toBe(true);
    expect(element?.props.label).toBe('o painel');
    expect(element?.props.children).toBe(child);
  });

  it('keeps the children mounted after closing, so they keep their own state', () => {
    render(true);
    const closed = render(false);
    expect(closed?.type).toBe(LazyScreen);
    expect(closed?.props.children).toBe(child);
  });

  it('starts mounted when it already begins open', () => {
    expect(render(true)).not.toBeNull();
  });
});
