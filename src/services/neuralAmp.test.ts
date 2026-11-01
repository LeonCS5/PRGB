import { describe, expect, it } from 'vitest';
import { NEURAL_FILE_MAX_BYTES, NeuralFileRefused, checkFileSize, checkModelText, modelGainDb, modelRateMatches } from './neuralAmp';

const refusal = (run: () => void): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof NeuralFileRefused ? error.code : 'other';
  }
};

describe('checkModelText', () => {
  it('takes a model', () => {
    expect(refusal(() => checkModelText('{"architecture":"WaveNet","weights":[]}'))).toBeNull();
  });

  it.each([
    ['text that is not JSON', 'não é um modelo'],
    ['JSON without an architecture', '{"name":"preset"}'],
    ['a JSON list', '[1, 2]'],
    ['nothing', 'null'],
  ])('refuses %s', (_name, text) => {
    expect(refusal(() => checkModelText(text))).toBe('not_a_model');
  });
});

describe('checkFileSize', () => {
  it('takes a file up to the limit and refuses one over it', () => {
    expect(refusal(() => checkFileSize(NEURAL_FILE_MAX_BYTES))).toBeNull();
    expect(refusal(() => checkFileSize(NEURAL_FILE_MAX_BYTES + 1))).toBe('too_big');
  });
});

describe('modelGainDb', () => {
  it('brings a loud model and a quiet one to the same level', () => {
    expect(modelGainDb({ hasLoudness: true, loudness: -10 })).toBe(-8);
    expect(modelGainDb({ hasLoudness: true, loudness: -24 })).toBe(6);
  });

  it('leaves alone a model that reports no loudness', () => {
    expect(modelGainDb({ hasLoudness: false, loudness: 0 })).toBe(0);
  });
});

describe('modelRateMatches', () => {
  it('compares the model with the engine', () => {
    expect(modelRateMatches({ expectedSampleRate: 48000 }, 48000)).toBe(true);
    expect(modelRateMatches({ expectedSampleRate: 44100 }, 48000)).toBe(false);
  });

  it('gives the benefit of the doubt to a file that does not say', () => {
    expect(modelRateMatches({ expectedSampleRate: -1 }, 48000)).toBe(true);
  });
});
