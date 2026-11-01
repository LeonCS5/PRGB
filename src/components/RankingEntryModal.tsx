import React, { useId, useState } from 'react';
import { Loader2, ShieldCheck, Trophy, X } from 'lucide-react';
import { ModalFrame } from './ModalFrame';
import { checkboxInput, checkboxRow, closeButton, primaryButton, secondaryButton, textInput } from './rankingStyles';
import { CONSENT_COPY, LEGAL_VERSION } from '../content/legal';
import { splitLegalLabel } from '../context/legalRoute';
import { useRanking, type RankingEntryMode } from '../context/ranking';
import { getRankingErrorMessage } from '../context/uiErrors';
import { toRankingError } from '../services/backend/rankingApi';
import { NICKNAME_ERROR_MESSAGES, validateNickname } from '../services/nickname';

const TITLE_ID = 'ranking-entry-title';

export interface RankingEntryModalProps {
  mode: RankingEntryMode;
}

export const RankingEntryModal: React.FC<RankingEntryModalProps> = ({ mode }) => {
  const { api, finishEntry } = useRanking();
  const inputId = useId();
  const isCreating = mode === 'create';
  const [nickname, setNickname] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkedNickname = validateNickname(nickname);
  const nicknameError = isCreating && nickname.trim() && !checkedNickname.ok ? NICKNAME_ERROR_MESSAGES[checkedNickname.error] : null;
  const canSend = isAdult && hasConsented && (!isCreating || checkedNickname.ok);

  // Stays open while a request runs, so an account is never created behind a closed window
  const cancel = () => {
    if (!isSending) finishEntry(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend || isSending) return;
    const acceptance = { ageConfirmed: isAdult, consent: hasConsented, consentVersion: LEGAL_VERSION };
    setIsSending(true);
    setError(null);
    try {
      if (!isCreating) {
        finishEntry(await api.reacceptTerms(acceptance));
        return;
      }
      if (!checkedNickname.ok) return;
      // Only here, after the choices above: the account is the start of data processing (LGPD)
      await api.ensureAnonymousSession();
      finishEntry(await api.createProfile({ ...acceptance, nickname: checkedNickname.value }));
    } catch (err) {
      const existing = toRankingError(err).code === 'profile_exists' ? await api.getMyProfile().catch(() => null) : null;
      if (existing) {
        finishEntry(existing);
        return;
      }
      setError(getRankingErrorMessage(err));
      setIsSending(false);
    }
  };

  return (
    <ModalFrame titleId={TITLE_ID} onClose={cancel} className="max-w-xl overflow-y-auto">
      <button type="button" onClick={cancel} disabled={isSending} aria-label="Fechar" className={closeButton}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300">
        {isCreating ? <Trophy size={22} aria-hidden="true" /> : <ShieldCheck size={22} aria-hidden="true" />}
      </div>
      <h2 id={TITLE_ID} className="pr-10 font-display text-2xl font-bold">{isCreating ? 'Entrar no ranking' : 'Atualizamos a Política de Privacidade'}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-300">
        {isCreating
          ? 'O ranking é opcional e só para maiores de 18 anos. Sem ele, você continua tocando normalmente, sem conta.'
          : 'Aceite a nova versão para continuar no ranking.'}
      </p>

      <ul className="mt-4 list-disc space-y-2 rounded-xl border border-ink-700 bg-ink-950 py-3 pl-8 pr-4 text-xs leading-5 text-ink-200 marker:text-amp-400">
        {CONSENT_COPY.rankingSummary.map((item) => <li key={item}>{item}</li>)}
      </ul>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3">
        {isCreating && (
          <div>
            <label htmlFor={inputId} className="block text-sm font-semibold text-ink-200">Seu apelido no ranking</label>
            <input id={inputId} type="text" value={nickname} maxLength={40} autoComplete="off" spellCheck={false} placeholder="Ex.: Riffeiro_92"
              onChange={(event) => setNickname(event.target.value)}
              aria-invalid={nicknameError ? true : undefined} aria-describedby={`${inputId}-help`}
              className={textInput + ' mt-2'} />
            {nicknameError && <p role="alert" className="mt-1.5 text-xs text-miss">{nicknameError}</p>}
            <p id={`${inputId}-help`} className="mt-1.5 text-xs leading-5 text-ink-300">{CONSENT_COPY.nicknameHelp}</p>
          </div>
        )}

        <label className={checkboxRow}>
          <input type="checkbox" checked={isAdult} onChange={(event) => setIsAdult(event.target.checked)} className={checkboxInput} />
          <span>{CONSENT_COPY.ageLabel}</span>
        </label>
        <label className={checkboxRow}>
          <input type="checkbox" checked={hasConsented} onChange={(event) => setHasConsented(event.target.checked)} className={checkboxInput} />
          <span>
            {splitLegalLabel(CONSENT_COPY.rankingLabel).map(({ text, href }) => href
              // A new tab keeps what was typed here and the song in the game
              ? <a key={text} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-signal-300 underline underline-offset-2 hover:text-signal-200">{text}</a>
              : text)}
          </span>
        </label>

        {!isCreating && (
          <p className="text-xs leading-5 text-ink-300">Sem aceitar, você continua tocando normalmente, só fora do ranking. Você ainda pode baixar seus dados ou excluir a conta em “Minha conta do ranking”.</p>
        )}
        {error && <p role="alert" className="rounded-xl border border-miss/40 bg-miss/5 p-3 text-sm text-ink-100">{error}</p>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={cancel} disabled={isSending} className={secondaryButton}>Agora não</button>
          <button type="submit" disabled={!canSend || isSending} aria-busy={isSending} className={primaryButton}>
            {isSending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isCreating ? 'Entrar no ranking' : 'Aceitar e continuar'}
          </button>
        </div>
        {!canSend && <p className="text-right text-xs text-ink-300">Para continuar, {isCreating ? 'escolha um apelido válido e ' : ''}marque as duas caixas.</p>}
      </form>
    </ModalFrame>
  );
};
