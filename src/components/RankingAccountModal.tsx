import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Download, Loader2, Pencil, Trash2, UserRound, X } from 'lucide-react';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';
import { ModalFrame } from './ModalFrame';
import { closeButton, primaryButton, secondaryButton, textInput } from './rankingStyles';
import { CONSENT_COPY, LEGAL_VERSION } from '../content/legal';
import { useRanking } from '../context/ranking';
import { getRankingErrorMessage } from '../context/uiErrors';
import { NICKNAME_ERROR_MESSAGES, validateNickname } from '../services/nickname';

const TITLE_ID = 'ranking-account-title';
const EXPORT_FILE_NAME = 'prgb-dados-ranking.json';

const NicknameForm: React.FC<{ current: string; onDone: (message: string | null) => void }> = ({ current, onDone }) => {
  const { api, saveProfile } = useRanking();
  const inputId = useId();
  const [nickname, setNickname] = useState(current);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = validateNickname(nickname);
  const invalid = nickname.trim() && !checked.ok ? NICKNAME_ERROR_MESSAGES[checked.error] : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checked.ok || isSaving) return;
    if (checked.value === current) {
      onDone(null);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      saveProfile(await api.updateNickname(checked.value));
      onDone('Apelido atualizado.');
    } catch (err) {
      setError(getRankingErrorMessage(err));
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-3">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink-200">Novo apelido</label>
      <input id={inputId} type="text" value={nickname} maxLength={40} autoFocus autoComplete="off" spellCheck={false}
        onChange={(event) => setNickname(event.target.value)}
        aria-invalid={invalid ? true : undefined} aria-describedby={`${inputId}-help`} className={textInput + ' mt-2'} />
      {(invalid ?? error) && <p role="alert" className="mt-1.5 text-xs text-miss">{invalid ?? error}</p>}
      <p id={`${inputId}-help`} className="mt-1.5 text-xs leading-5 text-ink-300">{CONSENT_COPY.nicknameHelp}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="submit" disabled={!checked.ok || isSaving} aria-busy={isSaving} className={primaryButton}>
          {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Salvar apelido
        </button>
        <button type="button" onClick={() => onDone(null)} disabled={isSaving} className={secondaryButton}>Cancelar</button>
      </div>
    </form>
  );
};

export const RankingAccountModal: React.FC = () => {
  const { api, profile, loadProfile, openEntry, closeAccount, deleteAccount } = useRanking();
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedAttempt, setLoadedAttempt] = useState(-1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [wasDeleted, setWasDeleted] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const found = await loadProfile();
        if (cancelled) return;
        if (found) {
          setLoadError(null);
          setLoadedAttempt(attempt);
        } else {
          // The session had no profile (sign-up abandoned) or its account is gone
          closeAccount();
          openEntry('create');
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(getRankingErrorMessage(err));
        setLoadedAttempt(attempt);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [attempt, loadProfile, closeAccount, openEntry]);

  useEffect(() => () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setStatus('');
    setError(null);
    try {
      const data = await api.exportMyData();
      const link = downloadRef.current;
      if (!link) return;
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.href = fileUrlRef.current;
      link.click();
      setStatus('Arquivo com seus dados do ranking baixado.');
    } catch (err) {
      setError(getRankingErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = !wasDeleted && loadedAttempt !== attempt;

  return (
    <ModalFrame titleId={TITLE_ID} onClose={closeAccount} className="max-w-xl overflow-y-auto">
      <button type="button" onClick={closeAccount} aria-label="Fechar" className={closeButton}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300">
        <UserRound size={22} aria-hidden="true" />
      </div>
      <h2 id={TITLE_ID} className="pr-10 font-display text-2xl font-bold">Minha conta do ranking</h2>

      {wasDeleted ? (
        <div role="status" className="mt-4">
          <p className="flex items-center gap-2 text-sm text-ink-100"><Check size={18} className="shrink-0 text-hit" aria-hidden="true" /> Sua conta do ranking foi excluída.</p>
          <p className="mt-2 text-xs leading-5 text-ink-300">Você continua tocando normalmente, sem conta. Os dados guardados neste navegador continuam aqui.</p>
          <button type="button" autoFocus onClick={closeAccount} className={primaryButton + ' mt-5 w-full'}>Fechar</button>
        </div>
      ) : isLoading ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando sua conta…</p>
      ) : loadError ? (
        <div className="mt-4">
          <p role="alert" className="rounded-xl border border-miss/40 bg-miss/5 p-3 text-sm text-ink-100">{loadError}</p>
          <button type="button" onClick={() => setAttempt(attempt + 1)} className={secondaryButton + ' mt-3'}>Tentar novamente</button>
        </div>
      ) : profile && (
        <div className="mt-4 space-y-5">
          {profile.consentVersion !== LEGAL_VERSION && (
            <section aria-label="Novo aceite" className="rounded-xl border border-near/40 bg-near/5 p-4">
              <p className="text-sm leading-6 text-ink-100">Atualizamos a Política de Privacidade. Aceite a nova versão para continuar no ranking.</p>
              <button type="button" onClick={() => openEntry('reaccept')} className={primaryButton + ' mt-3'}>Revisar e aceitar</button>
            </section>
          )}

          <section aria-labelledby="ranking-nickname-title" className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <p id="ranking-nickname-title" className="text-xs text-ink-300">Seu apelido público</p>
            {isEditing
              ? <NicknameForm current={profile.nickname} onDone={(message) => { setIsEditing(false); setStatus(message ?? ''); }} />
              : (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-display text-xl font-bold text-ink-100">{profile.nickname}</p>
                  <button type="button" onClick={() => { setStatus(''); setIsEditing(true); }} className={secondaryButton}>
                    <Pencil size={15} aria-hidden="true" /> Trocar apelido
                  </button>
                </div>
              )}
          </section>

          <section aria-labelledby="ranking-export-title">
            <h3 id="ranking-export-title" className="font-display text-base font-bold">{CONSENT_COPY.exportLabel}</h3>
            <p className="mt-1 text-xs leading-5 text-ink-300">{CONSENT_COPY.exportDescription}</p>
            <button type="button" onClick={() => void handleExport()} disabled={isExporting} aria-busy={isExporting} className={secondaryButton + ' mt-3'}>
              {isExporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} {CONSENT_COPY.exportLabel}
            </button>
          </section>

          <section aria-labelledby="ranking-delete-title" className="border-t border-ink-700 pt-5">
            <h3 id="ranking-delete-title" className="font-display text-base font-bold">{CONSENT_COPY.deleteTitle}</h3>
            {isDeleting ? (
              <div className="mt-3">
                <DeleteAccountConfirm description={CONSENT_COPY.deleteDescription} onCancel={() => setIsDeleting(false)}
                  onConfirm={async () => {
                    await deleteAccount();
                    setError(null);
                    setWasDeleted(true);
                  }} />
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs leading-5 text-ink-300">{CONSENT_COPY.deleteDescription}</p>
                <button type="button" onClick={() => { setStatus(''); setIsDeleting(true); }} className={secondaryButton + ' mt-3 border-miss/40 text-miss hover:border-miss'}>
                  <Trash2 size={16} aria-hidden="true" /> {CONSENT_COPY.deleteTitle}
                </button>
              </>
            )}
          </section>

          {error && <p role="alert" className="rounded-xl border border-miss/40 bg-miss/5 p-3 text-sm text-ink-100">{error}</p>}
          <p role="status" aria-live="polite" className="min-h-5 text-xs font-semibold text-hit">{status}</p>
          <a ref={downloadRef} download={EXPORT_FILE_NAME} className="hidden" aria-hidden="true" tabIndex={-1} />
        </div>
      )}
    </ModalFrame>
  );
};
