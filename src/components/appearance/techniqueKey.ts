// The symbols of the techniques on the track, in the same letters as a tab: what the game draws for each one.
// `short` is the label (a chip in the first game, the bold word in the list) and `description` what to do, kept apart so
// nothing has to split a sentence to get at either.
export interface TechniqueKeyItem {
  symbol: string;
  short: string;
  description: string;
}

export const TECHNIQUE_KEY: ReadonlyArray<TechniqueKeyItem> = [
  { symbol: 'H', short: 'hammer-on', description: 'palhete só a primeira nota, a seguinte é feita só com o dedo (a casa sobe).' },
  { symbol: 'P', short: 'pull-off', description: 'puxe a corda ao tirar o dedo, sem palhetar (a casa desce).' },
  { symbol: '/', short: 'slide para cima', description: 'deslize o dedo pela corda até a casa seguinte.' },
  { symbol: '\\', short: 'slide para baixo', description: 'deslize o dedo pela corda de volta.' },
  { symbol: '~', short: 'vibrato', description: 'balance a nota, em uma onda sob ela.' },
  { symbol: 'PM', short: 'palm mute', description: 'apoie a palma da mão na corda para abafar, no contorno tracejado.' },
  { symbol: '↑½', short: 'bend', description: 'empurre a corda; o número é o tamanho em tons (¼, ½, 1, 1½).' },
  { symbol: 'x', short: 'nota morta', description: 'abafe e bata a corda, sem altura definida.' },
  { symbol: '(5)', short: 'nota fantasma', description: 'tocada bem de leve, geralmente não precisa soar.' }
];

// The one-line key of the first game shows these (one chip for the slide, not one for each direction)
export const COMPACT_KEY_SYMBOLS: ReadonlyArray<string> = ['H', 'P', '/', '~', 'PM', '↑½', 'x'];
