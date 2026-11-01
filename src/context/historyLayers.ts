// The browser's back button closes what the player sees, one layer at a time, instead of leaving the site.
// Each open layer (the screen above the landing, then each modal over it) owns one history entry, created
// when it opens. An entry needs a user gesture: when a page adds one without it, Chromium's back button skips
// every entry of that page, and gestures from before a back press stop counting. So nothing here adds an
// entry in reaction to going back, and modals that open by themselves stay out (selfOpened in ModalFrame).

type Close = () => void;

let screen: Close | null = null;
let modals: Close[] = [];
let isListening = false;
let isSyncQueued = false;
let isTraversing = false;

const openLayers = (): Close[] => (screen ? [screen, ...modals] : modals);

const entryDepth = (): number => (window.history.state as { prgbLayers?: number } | null)?.prgbLayers ?? 0;

const sync = () => {
  if (isTraversing) return; // it ends in onPopState, which syncs again
  const wanted = openLayers().length;
  const depth = entryDepth();
  if (wanted < depth) {
    isTraversing = true;
    window.history.go(wanted - depth);
    return;
  }
  for (let next = depth + 1; next <= wanted; next += 1) {
    const address = window.location.href;
    // Whatever the address carried (?demo) belongs to the screen, so the landing's own entry drops it
    if (next === 1 && screen) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
    window.history.pushState({ prgbLayers: next }, '', address);
  }
};

// In a microtask: a commit that closes one layer and opens another nets out and keeps the entry
const queueSync = () => {
  if (isSyncQueued) return;
  isSyncQueued = true;
  queueMicrotask(() => {
    isSyncQueued = false;
    sync();
  });
};

const onPopState = () => {
  if (isTraversing) {
    isTraversing = false;
    sync();
    return;
  }
  openLayers().slice(entryDepth()).reverse().forEach((close) => close());
};

const listen = () => {
  if (isListening) return;
  isListening = true;
  window.addEventListener('popstate', onPopState);
};

/** Registers the screen above the landing. Returns what to call when it closes by any other way. */
export const openScreenLayer = (close: Close): Close => {
  listen();
  screen = close;
  queueSync();
  return () => {
    screen = null;
    queueSync();
  };
};

/** Registers a modal over whatever is open. Returns what to call when it closes by any other way. */
export const openModalLayer = (close: Close): Close => {
  listen();
  modals = [...modals, close];
  queueSync();
  return () => {
    modals = modals.filter((item) => item !== close);
    queueSync();
  };
};
