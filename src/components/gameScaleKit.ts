// What the scale cards and the quick panel write for a speed or a spacing: plain text, no component (so the card file
// exports only components and React's fast refresh keeps working).
export const formatScale = (value: number): string => value.toLocaleString('pt-BR') + '×';
