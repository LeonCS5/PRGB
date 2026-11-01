// Problem reports: one RPC under the public key, so reporting takes no account and no consent. What is stored
// is the category, the screen and the text, nothing that ties them to a person.

import { getSupabaseClient } from './supabaseClient';

export const FEEDBACK_CATEGORIES = [
  { id: 'audio', label: 'Áudio ou guitarra' },
  { id: 'notas', label: 'Detecção de notas' },
  { id: 'musica', label: 'Música ou tablatura' },
  { id: 'ranking', label: 'Ranking ou sala online' },
  { id: 'sugestao', label: 'Sugestão' },
  { id: 'outro', label: 'Outro assunto' }
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['id'];
export type FeedbackScreen = 'inicio' | 'play_free' | 'jogo' | 'sala';
export type FeedbackResult = 'sent' | 'rate_limited' | 'failed';

export interface FeedbackReport {
  category: FeedbackCategory;
  screen: FeedbackScreen;
  message: string;
}

export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 1000;

export const isFeedbackSendable = (message: string): boolean => {
  const { length } = message.trim();
  return length >= FEEDBACK_MIN_LENGTH && length <= FEEDBACK_MAX_LENGTH;
};

export async function submitFeedback({ category, screen, message }: FeedbackReport): Promise<FeedbackResult> {
  try {
    const client = await getSupabaseClient();
    if (!client) return 'failed';
    const { error } = await client.rpc('submit_feedback', {
      p_category: category,
      p_screen: screen,
      p_message: message.trim()
    });
    if (!error) return 'sent';
    return error.message === 'rate_limited' ? 'rate_limited' : 'failed';
  } catch {
    return 'failed';
  }
}
