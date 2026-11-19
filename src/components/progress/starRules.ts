import { MIN_STAR_NOTES, STAR_ACCURACY, THREE_STAR_MAX_MISSES } from '../../services/progress';

// The fixed wording of how stars, accuracy and picks work, read from the same thresholds the game uses
export const STARS_RULE_TEXT = `Estrelas: 1 com ${STAR_ACCURACY.one}% de precisão, 2 com ${STAR_ACCURACY.two}%, 3 com ${STAR_ACCURACY.three}% e no máximo ${THREE_STAR_MAX_MISSES} nota errada. Contam exercícios com ${MIN_STAR_NOTES} notas ou mais.`;
export const ACCURACY_TEXT = 'Precisão é a porcentagem das notas acertadas (Perfeito ou Bom).';
export const PICKS_TEXT = 'Palhetas são conquistas que você ganha tocando.';
