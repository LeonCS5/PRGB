import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_MAX_LENGTH, isFeedbackSendable, submitFeedback, type FeedbackReport } from './feedbackApi';
import { getSupabaseClient } from './supabaseClient';

vi.mock('./supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

const report: FeedbackReport = { category: 'audio', screen: 'play_free', message: '  O som some depois de um minuto.\n' };

const clientAnswering = (answer: unknown) => {
  const rpc = vi.fn().mockResolvedValue(answer);
  vi.mocked(getSupabaseClient).mockResolvedValue({ rpc } as unknown as SupabaseClient);
  return rpc;
};

beforeEach(() => {
  vi.mocked(getSupabaseClient).mockReset();
});

describe('submitFeedback', () => {
  it('sends the trimmed report and nothing else', async () => {
    const rpc = clientAnswering({ error: null });
    await expect(submitFeedback(report)).resolves.toBe('sent');
    expect(rpc).toHaveBeenCalledWith('submit_feedback', {
      p_category: 'audio',
      p_screen: 'play_free',
      p_message: 'O som some depois de um minuto.'
    });
  });

  it('tells the hourly limit apart', async () => {
    clientAnswering({ error: { message: 'rate_limited' } });
    await expect(submitFeedback(report)).resolves.toBe('rate_limited');
  });

  it.each([
    ['a refusal from the server', () => clientAnswering({ error: { message: 'invalid_input' } })],
    ['no backend configured', () => vi.mocked(getSupabaseClient).mockResolvedValue(null)],
    ['the client failing to load offline', () => vi.mocked(getSupabaseClient).mockRejectedValue(new TypeError('Failed to fetch'))],
    ['the request failing', () => {
      vi.mocked(getSupabaseClient).mockResolvedValue({ rpc: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) } as unknown as SupabaseClient);
    }]
  ])('reports a failure on %s', async (_label, arrange) => {
    arrange();
    await expect(submitFeedback(report)).resolves.toBe('failed');
  });
});

describe('isFeedbackSendable', () => {
  it('measures the text without its margins, as the server does', () => {
    expect(isFeedbackSendable('   curto    ')).toBe(false);
    expect(isFeedbackSendable('dez letras')).toBe(true);
  });

  it('stops at the longest text the server takes', () => {
    expect(isFeedbackSendable('x'.repeat(FEEDBACK_MAX_LENGTH))).toBe(true);
    expect(isFeedbackSendable('x'.repeat(FEEDBACK_MAX_LENGTH + 1))).toBe(false);
  });
});
