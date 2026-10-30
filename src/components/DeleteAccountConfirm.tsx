import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { checkboxInput, dangerButton, secondaryButton } from './rankingStyles';
import { CONSENT_COPY } from '../content/legal';
import { getRankingErrorMessage } from '../context/uiErrors';

export interface DeleteAccountConfirmProps {
  description: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const DeleteAccountConfirm: React.FC<DeleteAccountConfirmProps> = ({ description, onConfirm, onCancel }) => {
  const [isSure, setIsSure] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getRankingErrorMessage(err));
      setIsDeleting(false);
    }
  };

  return (
    <div role="group" aria-label={`Confirmar: ${CONSENT_COPY.deleteTitle}`} className="rounded-xl border border-miss/40 bg-miss/5 p-4 text-left">
      <p className="text-sm leading-6 text-ink-100">{description}</p>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-ink-100">
        <input type="checkbox" checked={isSure} disabled={isDeleting} onChange={(event) => setIsSure(event.target.checked)} className={checkboxInput} />
        <span>Entendo que a exclusão é definitiva.</span>
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-miss">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => void handleDelete()} disabled={!isSure || isDeleting} aria-busy={isDeleting} className={dangerButton}>
          {isDeleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {CONSENT_COPY.deleteConfirmLabel}
        </button>
        <button type="button" autoFocus onClick={onCancel} disabled={isDeleting} className={secondaryButton}>Cancelar</button>
      </div>
    </div>
  );
};
