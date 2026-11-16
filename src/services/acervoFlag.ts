export const isAcervoEnabled = (): boolean => import.meta.env.VITE_ACERVO_ENABLED?.trim() !== 'false';
