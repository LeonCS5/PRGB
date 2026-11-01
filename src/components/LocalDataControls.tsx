import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';
import { CONSENT_COPY } from '../content/legal';
import { buildLocalDataExport, clearLocalData, LOCAL_DATA_FILE_NAME, markLocalDataCleared } from '../context/localData';
import { useRanking } from '../context/ranking';

const buttonClass = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition';

// plain: nothing but local data to erase. account: this browser holds the ranking session, the player decides
// what happens to it. deleteAccount: confirming the deletion of the account and of everything local.
type EraseStep = 'plain' | 'account' | 'deleteAccount';

export const LocalDataControls: React.FC = () => {
  const { isConfigured, api, deleteAccount } = useRanking();
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [eraseStep, setEraseStep] = useState<EraseStep | null>(null);
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

  const startErasing = () => {
    setStatus('');
    setEraseStep(isConfigured && api.hasStoredSession() ? 'account' : 'plain');
  };

  return (
    <div>
      <p className="max-w-3xl text-xs leading-6 text-ink-300">{CONSENT_COPY.localDataDescription}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleDownload} className={buttonClass + ' border-ink-600 text-ink-100 hover:border-ink-400'}>
          <Download size={16} aria-hidden="true" /> Baixar meus dados locais
        </button>
        {!eraseStep && (
          <button type="button" onClick={startErasing} className={buttonClass + ' border-miss/40 text-miss hover:border-miss'}>
            <Trash2 size={16} aria-hidden="true" /> {CONSENT_COPY.clearLocalLabel}
          </button>
        )}
      </div>
      {eraseStep === 'plain' && (
        <div role="group" aria-label="Confirmar exclusão dos dados locais" className="mt-4 rounded-xl border border-miss/40 bg-miss/5 p-4">
          <p className="text-sm text-ink-100">Apagar recordes, histórico, preferências e apelido guardados neste navegador? Não dá para desfazer.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={handleClear} className={buttonClass + ' border-miss bg-miss text-ink-950 hover:bg-miss/90'}>Apagar</button>
            <button type="button" autoFocus onClick={() => setEraseStep(null)} className={buttonClass + ' border-ink-600 text-ink-100 hover:border-ink-400'}>Cancelar</button>
          </div>
        </div>
      )}
      {eraseStep === 'account' && (
        <div role="group" aria-label="Você tem uma conta do ranking neste navegador" className="mt-4 rounded-xl border border-near/40 bg-near/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink-100"><AlertTriangle size={18} className="shrink-0 text-near" aria-hidden="true" /> Você tem uma conta do ranking neste navegador</p>
          <p className="mt-2 text-sm leading-6 text-ink-100">O único acesso a ela é uma chave guardada aqui. Se essa chave for apagada, como ao limpar os dados do site, você perde o acesso à conta e não temos como devolvê-lo.</p>
          <p className="mt-2 text-sm leading-6 text-ink-200">Se não pretende usar mais o ranking, exclua a conta antes. “Apagar só os dados locais” mantém a chave: sua conta continua funcionando neste navegador.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => setEraseStep('deleteAccount')} className={buttonClass + ' border-miss bg-miss text-ink-950 hover:bg-miss/90'}>Excluir a conta e apagar tudo</button>
            <button type="button" onClick={handleClear} className={buttonClass + ' border-miss/40 text-miss hover:border-miss'}>Apagar só os dados locais (mantém a conta)</button>
            <button type="button" autoFocus onClick={() => setEraseStep(null)} className={buttonClass + ' border-ink-600 text-ink-100 hover:border-ink-400'}>Cancelar</button>
          </div>
        </div>
      )}
      {eraseStep === 'deleteAccount' && (
        <div className="mt-4">
          <DeleteAccountConfirm
            description="Apaga na hora sua conta do ranking e tudo o que está ligado a ela (apelido, pontuações e registros das partidas) e, em seguida, os dados guardados neste navegador. Não dá para desfazer nem recuperar."
            onCancel={() => setEraseStep('account')}
            onConfirm={async () => {
              await deleteAccount();
              handleClear();
            }} />
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold text-hit">{status}</p>
      <a ref={downloadRef} download={LOCAL_DATA_FILE_NAME} className="hidden" aria-hidden="true" tabIndex={-1} />
    </div>
  );
};
