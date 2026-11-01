// Neural amp models (.nam) and cabinet impulse responses from the player's own files. Both are read in the
// browser and never leave it, and no model ships with the app. The engine stays out of the bundle and out of
// the network until someone loads a model.

import type { NamModelInfo } from '../vendor/nam-engine/index.js';

export const NEURAL_FILE_MAX_BYTES = 50 * 1024 * 1024;
const TARGET_LOUDNESS_DB = -18; // the level models are normalized to, so changing model doesn't change the volume

export type NeuralFileError = 'too_big' | 'not_a_model' | 'not_audio';

export class NeuralFileRefused extends Error {
  readonly code: NeuralFileError;

  constructor(code: NeuralFileError, options?: ErrorOptions) {
    super(code, options);
    this.name = 'NeuralFileRefused';
    this.code = code;
  }
}

/** Refuses what can't be a model before it reaches the audio thread. */
export const checkModelText = (text: string): void => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new NeuralFileRefused('not_a_model', { cause: error });
  }
  const isModel = typeof parsed === 'object' && parsed !== null && 'architecture' in parsed;
  if (!isModel) throw new NeuralFileRefused('not_a_model');
};

export const checkFileSize = (bytes: number): void => {
  if (bytes > NEURAL_FILE_MAX_BYTES) throw new NeuralFileRefused('too_big');
};

export const modelGainDb = (info: Pick<NamModelInfo, 'hasLoudness' | 'loudness'>): number =>
  info.hasLoudness ? TARGET_LOUDNESS_DB - info.loudness : 0;

/** A model trained at another rate plays at the wrong pitch and tone. -1 means the file doesn't say. */
export const modelRateMatches = (info: Pick<NamModelInfo, 'expectedSampleRate'>, sampleRate: number): boolean =>
  info.expectedSampleRate <= 0 || info.expectedSampleRate === sampleRate;
