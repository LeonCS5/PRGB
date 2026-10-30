import React, { useEffect, useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { CONSENT_COPY } from '../content/legal';
import { buildLocalDataExport, clearLocalData, LOCAL_DATA_FILE_NAME, markLocalDataCleared } from '../context/localData';

const buttonClass = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition';

export const LocalDataControls: React.FC = () => {
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
  }, []);

  const handleDownload = () => {
    const link = downloadRef.current;
    if (!link) return;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = URL.createObjectURL(new Blob([buildLocalDataExport()], { type: 'application/json' }));
    link.href = fileUrlRef.current;
    link.click();
    setStatus('Arquivo com seus dados locais baixado.');
  };

  const handleClear = () => {
    clearLocalData();
    markLocalDataCleared();
    // The open page still holds the old preferences in memory and would save them again: start fresh
    window.location.reload();
  };

  return (
    <div>
      <p className="max-w-3xl text-xs leading-6 text-ink-300">{CONSENT_COPY.localDataDescription}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleDownload} className={buttonClass + ' border-ink-600 text-ink-100 hover:border-ink-400'}>
          <Download size={16} aria-hidden="true" /> Baixar meus dados locais
        </button>
        {!isConfirming && (
          <button type="button" onClick={() => { setStatus(''); setIsConfirming(true); }} className={buttonClass + ' border-miss/40 text-miss hover:border-miss'}>
            <Trash2 size={16} aria-hidden="true" /> {CONSENT_COPY.clearLocalLabel}
          </button>
        )}
      </div>
      {isConfirming && (
        <div role="group" aria-label="Confirmar exclusão dos dados locais" className="mt-4 rounded-xl border border-miss/40 bg-miss/5 p-4">
          <p className="text-sm text-ink-100">Apagar recordes, histórico, preferências e apelido guardados neste navegador? Não dá para desfazer.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={handleClear} className={buttonClass + ' border-miss bg-miss text-ink-950 hover:bg-miss/90'}>Apagar</button>
            <button type="button" autoFocus onClick={() => setIsConfirming(false)} className={buttonClass + ' border-ink-600 text-ink-100 hover:border-ink-400'}>Cancelar</button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold text-hit">{status}</p>
      <a ref={downloadRef} download={LOCAL_DATA_FILE_NAME} className="hidden" aria-hidden="true" tabIndex={-1} />
    </div>
  );
};
