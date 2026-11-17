import type { AppearanceRoot } from './apply';

// In-memory Storage and a fake <html>, so the tests run in Node
export const memoryStorage = (initial: Record<string, string> = {}): Storage & { dump(): Record<string, string> } => {
  const items = new Map(Object.entries(initial));
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); },
    setItem: (key, value) => { items.set(key, String(value)); },
    dump: () => Object.fromEntries(items)
  };
};

export interface FakeRoot extends AppearanceRoot {
  attributes: Map<string, string>;
  variables: Map<string, string>;
}

export const fakeRoot = (): FakeRoot => {
  const attributes = new Map<string, string>();
  const variables = new Map<string, string>();
  return {
    attributes,
    variables,
    setAttribute: (name, value) => { attributes.set(name, value); },
    removeAttribute: (name) => { attributes.delete(name); },
    style: {
      setProperty: (name, value) => { variables.set(name, value); },
      removeProperty: (name) => { const old = variables.get(name) ?? ''; variables.delete(name); return old; }
    }
  };
};
