import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { LEGAL_CONTACT } from '../content/legal';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  isFeedbackSendable,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackResult,
  type FeedbackScreen
} from '../services/backend/feedbackApi';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  screen: FeedbackScreen;
}

const fieldClass = 'w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-400 focus:border-amp-400 focus:outline-none';

const FeedbackForm: React.FC<Omit<FeedbackModalProps, 'isOpen'>> = ({ onClose, screen }) => {
  const [category, setCategory] = useState<FeedbackCategory>('audio');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending || !isFeedbackSendable(message)) return;
    setIsSending(true);
    setResult(await submitFeedback({ category, screen, message }));
    setIsSending(false);
  };

  return (
    <ModalFrame titleId="FeedbackModal-title" onClose={onClose} className="max-w-lg overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <h2 id="FeedbackModal-title" className="font-display text-xl font-bold">Reportar problema</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg text-ink-300 hover:text-ink-100"><X size={20} /></button>
      </div>

      {result === 'sent' ? (
        <div role="status" className="mt-4">
          <p className="flex items-center gap-2 font-semibold text-hit"><CheckCircle2 size={18} /> Recebemos seu relato. Obrigado!</p>
          <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full cursor-pointer rounded-xl bg-amp-500 px-4 text-sm font-bold text-ink-950 hover:bg-amp-400">Fechar</button>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Sobre o quê?
            <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)} className={fieldClass}>
              {FEEDBACK_CATEGORIES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            O que aconteceu?
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} required maxLength={FEEDBACK_MAX_LENGTH}
              placeholder="Conte o que você fez e o que esperava ver. Se for de áudio, diga qual interface e navegador usa."
              className={`${fieldClass} resize-y font-normal`} />
            <span className="self-end font-mono text-[11px] font-normal text-ink-300">{message.length}/{FEEDBACK_MAX_LENGTH}</span>
          </label>

          <p className="text-xs leading-5 text-ink-300">
            O relato não leva seu nome nem sua conta e fica guardado por 180 dias. Não escreva nome, e-mail ou outros dados pessoais. Como não sabemos quem enviou, não temos como responder: para receber resposta, escreva para{' '}
            <a href={`mailto:${LEGAL_CONTACT.email}`} className="text-signal-300 underline underline-offset-2">{LEGAL_CONTACT.email}</a>.
          </p>

          {(result === 'failed' || result === 'rate_limited') && (
            <p role="alert" className="text-sm text-miss">
              {result === 'failed' ? 'Não foi possível enviar agora.' : 'Recebemos muitos relatos nesta hora.'} Tente de novo mais tarde ou escreva para{' '}
              <a href={`mailto:${LEGAL_CONTACT.email}`} className="underline underline-offset-2">{LEGAL_CONTACT.email}</a>.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-11 cursor-pointer rounded-xl border border-ink-700 px-4 text-sm font-semibold text-ink-200 hover:border-ink-500">Cancelar</button>
            <button type="submit" disabled={isSending || !isFeedbackSendable(message)} aria-busy={isSending}
              className="min-h-11 cursor-pointer rounded-xl bg-amp-500 px-4 text-sm font-bold text-ink-950 hover:bg-amp-400 disabled:cursor-not-allowed disabled:opacity-50">
              {isSending ? 'Enviando...' : 'Enviar relato'}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
};

// The form only exists while open, so every report starts from a blank one
export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, ...form }) =>
  isOpen ? <FeedbackForm {...form} /> : null;
