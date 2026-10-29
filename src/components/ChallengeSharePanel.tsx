import React, { useId, useState } from 'react';
import { ArrowLeft, Copy, Share2 } from 'lucide-react';
import { buildChallengeUrl, challengeShareText, type Challenge } from '../services/challenge';
import { NICKNAME_ERROR_MESSAGES, validateNickname } from '../services/nickname';
import { readPreferences, savePreferences } from '../context/preferences';

export interface ChallengeSharePanelProps {
  challenge: Omit<Challenge, 'nickname'>;
  isReply: boolean;
  onBack: () => void;
}

export const ChallengeSharePanel: React.FC<ChallengeSharePanelProps> = ({ challenge, isReply, onBack }) => {
  const inputId = useId();
  const [nickname, setNickname] = useState(() => readPreferences().nickname ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const validation = nickname.trim() ? validateNickname(nickname) : null;
  const nicknameError = validation && !validation.ok ? NICKNAME_ERROR_MESSAGES[validation.error] : null;
  const canShare = typeof navigator.share === 'function';

  const prepareLink = (): { url: string; text: string } | null => {
    setStatus('');
    setError(null);
    if (nicknameError) return null;
    const checkedNickname = validation?.ok ? validation.value : null;
    const full: Challenge = { ...challenge, nickname: checkedNickname };
    let url: string;
    try {
      url = buildChallengeUrl(window.location.origin + '/', full);
    } catch {
      // encodeChallenge throws RangeError when the run data breaks the link rules
      setError('Não foi possível criar o link deste desafio.');
      return null;
    }
    savePreferences({ nickname: checkedNickname });
    return { url, text: challengeShareText(full, url) };
  };

  const handleShare = async () => {
    const link = prepareLink();
    if (!link) return;
    try {
      await navigator.share({ title: 'Desafio PRGB', text: link.text });
      setStatus('Desafio compartilhado');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Não foi possível compartilhar. Use “Copiar link”.');
    }
  };

  const handleCopy = async () => {
    const link = prepareLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setManualUrl(null);
      setStatus('Link copiado');
    } catch {
      setManualUrl(link.url);
      setError('Não foi possível copiar automaticamente. Copie o link abaixo.');
    }
  };

  const buttonClass = 'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="text-left">
      <button type="button" onClick={onBack} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-ink-300 hover:text-ink-100">
        <ArrowLeft size={14} aria-hidden="true" /> Voltar ao resultado
      </button>
      <h3 className="mt-2 font-display text-xl font-bold">{isReply ? 'Responder ao desafio' : 'Desafiar um amigo'}</h3>
      <p className="mt-1 text-xs leading-5 text-ink-300">
        O link leva a música, seus {challenge.score.toLocaleString('pt-BR')} pontos, sua precisão ({challenge.accuracy}%) e, se você quiser, seu apelido. Quem abrir o link verá essas informações.
      </p>

      <label htmlFor={inputId} className="mt-5 block text-sm font-semibold text-ink-200">Seu apelido <span className="font-normal text-ink-300">(opcional)</span></label>
      <input id={inputId} type="text" value={nickname} maxLength={40} autoComplete="nickname"
        onChange={(event) => setNickname(event.target.value)}
        aria-invalid={nicknameError ? true : undefined} aria-describedby={`${inputId}-help`}
        className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm text-ink-100 placeholder-ink-400 focus:border-amp-500 focus:outline-none focus:ring-1 focus:ring-amp-500"
        placeholder="Ex.: Riffeiro_92" />
      <p id={`${inputId}-help`} className={'mt-1.5 text-xs ' + (nicknameError ? 'text-miss' : 'text-ink-300')}>
        {nicknameError ?? 'Fica salvo só neste navegador. Não use seu nome completo.'}
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {canShare && (
          <button type="button" onClick={() => void handleShare()} disabled={Boolean(nicknameError)} className={buttonClass + ' bg-amp-400 text-ink-950 hover:bg-amp-300'}>
            <Share2 size={16} aria-hidden="true" /> Compartilhar
          </button>
        )}
        <button type="button" onClick={() => void handleCopy()} disabled={Boolean(nicknameError)}
          className={buttonClass + (canShare ? ' border border-ink-600 text-ink-100 hover:border-ink-400' : ' bg-amp-400 text-ink-950 hover:bg-amp-300')}>
          <Copy size={16} aria-hidden="true" /> Copiar link
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-sm font-semibold text-hit">{status}</p>
      {error && <p role="alert" className="text-center text-xs text-miss">{error}</p>}
      {manualUrl && (
        <input type="text" readOnly value={manualUrl} aria-label="Link do desafio" onFocus={(event) => event.currentTarget.select()}
          className="mt-2 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs text-ink-200" />
      )}
    </div>
  );
};
