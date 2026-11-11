import React, { useId, useState } from 'react';
import { Cpu, X } from 'lucide-react';
import { ErrorNotice } from './ErrorNotice';
import { useAudioSession } from '../context/AudioSessionContext';
import { NeuralFileRefused, modelRateMatches, type NeuralFileError } from '../services/neuralAmp';

const FILE_ERRORS: Record<NeuralFileError, string> = {
  too_big: 'Este arquivo é grande demais. O limite é de 50 MB.',
  not_a_model: 'Este arquivo não é um modelo .nam válido.',
  not_audio: 'Não foi possível ler este arquivo de áudio. Use um .wav com a resposta ao impulso.'
};

const errorMessage = (error: unknown): string =>
  error instanceof NeuralFileRefused
    ? FILE_ERRORS[error.code]
    : 'O motor neural não conseguiu abrir este arquivo. Ele pode ser de um formato que o navegador ainda não suporta.';

interface FileRowProps {
  label: string;
  accept: string;
  loaded: string | null;
  disabled: boolean;
  onLoad: (file: File) => void;
  onClear: () => void;
}

const FileRow: React.FC<FileRowProps> = ({ label, accept, loaded, disabled, onLoad, onClear }) => {
  const inputId = useId();
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-1.5">
      <label htmlFor={inputId} className="min-w-0 flex-1 text-xs text-ink-200">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate font-mono text-[11px] text-ink-300">{loaded ?? 'Nenhum arquivo'}</span>
      </label>
      <input id={inputId} type="file" accept={accept} disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onLoad(file);
        }}
        className="min-h-11 w-40 min-w-11 cursor-pointer text-[11px] text-ink-300 file:mr-2 file:min-h-11 file:min-w-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink-700 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-ink-100 disabled:cursor-not-allowed disabled:opacity-50" />
      {loaded && (
        <button type="button" onClick={onClear} disabled={disabled} aria-label={`Remover ${label}`}
          className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-50">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export const NeuralAmpSection: React.FC = () => {
  const { audioEngine, ampEngine } = useAudioSession();
  const [names, setNames] = useState(() => audioEngine.getNeuralFiles());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setNames(audioEngine.getNeuralFiles());
      setIsBusy(false);
    }
  };

  const loadModel = (file: File) => run(async () => {
    const info = await audioEngine.loadNeuralModel(file);
    const sampleRate = audioEngine.getEngineInfo()?.sampleRate ?? 48000;
    setWarning(modelRateMatches(info, sampleRate) ? null : `Este modelo foi feito para ${info.expectedSampleRate} Hz, e o motor está em ${sampleRate} Hz. O timbre pode mudar.`);
  });

  return (
    <section aria-labelledby="neural-amp-title" className="mt-4 rounded-2xl border border-signal-500/25 bg-signal-500/5 p-4">
      <h3 id="neural-amp-title" className="flex items-center gap-2 text-sm font-bold text-ink-100">
        <Cpu size={16} className="text-signal-300" aria-hidden="true" /> Modelo neural de amplificador
      </h3>
      <p className="mt-1 text-xs leading-5 text-ink-300">
        Carregue um modelo .nam e, se quiser, um gabinete em .wav. Os arquivos ficam só neste navegador e somem ao fechar a página. Com um modelo carregado, o ganho vem dele: tom, reverb e volume continuam valendo. Modelos grandes podem pesar no computador.
      </p>
      <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-signal-300">
        {isBusy ? 'Carregando o modelo…' : ''}
      </p>
      <div aria-busy={isBusy} className="mt-3 space-y-2">
        <FileRow label="Modelo .nam" accept=".nam" loaded={names.model} disabled={isBusy || !ampEngine}
          onLoad={(file) => void loadModel(file)}
          onClear={() => void run(async () => { await audioEngine.clearNeuralModel(); setWarning(null); })} />
        <FileRow label="Gabinete (IR .wav)" accept=".wav,audio/wav" loaded={names.impulse} disabled={isBusy || !ampEngine}
          onLoad={(file) => void run(() => audioEngine.loadImpulseResponse(file))}
          onClear={() => void run(() => audioEngine.clearImpulseResponse())} />
      </div>
      {warning && <p className="mt-2 text-xs leading-5 text-near">{warning}</p>}
      {error && <div className="mt-2"><ErrorNotice message={error} onDismiss={() => setError(null)} /></div>}
    </section>
  );
};
