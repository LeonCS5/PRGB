import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { ArrowRight, ChevronDown, RefreshCw, Volume2 } from 'lucide-react';
import { useAudioSession } from '../context/AudioSessionContext';
import {
  ENGINE_BUFFER_SIZES,
  INPUT_GAIN_MAX_DB,
  INPUT_GAIN_MIN_DB,
  LATENCY_SAMPLES_MAX,
  LATENCY_SAMPLES_STEP,
  audioDeviceName,
  diagnoseSignal,
  formatAudioFormat,
  groupAudioDevices,
  parseDeviceLabel,
  peakToDb,
  type AudioDeviceOption,
  type AudioFormat,
  type SignalStage
} from '../services/audioDevices';
import { askBrowserForOutput, canAskBrowserForOutput, canChooseAudioOutput } from '../services/audioOutput';
import { SoundFX } from '../services/synthAudio';

export interface AudioRoutePanelProps {
  currentDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
}

const STAGE_TEXT: Record<SignalStage, { title: string; help: string; tone: string }> = {
  off: { title: 'Áudio desligado', help: 'Conecte o áudio para o PRGB ouvir a guitarra.', tone: 'text-ink-300' },
  suspended: { title: 'O navegador pausou o áudio', help: 'Reative o áudio para voltar a ouvir a guitarra.', tone: 'text-near' },
  'monitor-off': { title: 'O som da guitarra está desligado', help: 'Ligue “Ouvir som da guitarra” neste painel.', tone: 'text-near' },
  checking: { title: 'Testando a saída', help: 'Rajadas bem fracas conferem se o som volta para a entrada. Leva alguns segundos.', tone: 'text-ink-300' },
  'monitor-closed': { title: 'Som fechado para evitar microfonia', help: 'A saída escolhida devolve o som para a entrada. Escolha outra saída na lista.', tone: 'text-miss' },
  'no-signal': { title: 'Nenhum sinal da guitarra', help: 'Toque uma corda. Se o nível não subir, confira o cabo, o volume da guitarra, o botão de ganho da interface e se a entrada certa está marcada.', tone: 'text-near' },
  gate: { title: 'O noise gate está cortando o som', help: 'O sinal chega, mas fica abaixo do gate. Aumente o ganho de entrada ou baixe o gate.', tone: 'text-near' },
  playing: { title: 'O som está saindo', help: 'Se não estiver ouvindo, marque outra saída na lista, confira o volume do Windows e feche os programas que usam ASIO.', tone: 'text-hit' }
};

const HOLD_MS = 1500; // long enough to read, and to last between two notes

interface SignalView {
  stage: SignalStage;
  inputPeak: number;
  outputPeak: number;
  gateOpen: boolean;
}

const formatDb = (peak: number): string => (peak > 0 ? `${Math.round(peakToDb(peak))} dB` : '--');
const formatMs = (ms: number): string => `${ms.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ms`;

const useSignalView = (): SignalView => {
  const { audioEngine } = useAudioSession();
  const [view, setView] = useState<SignalView>({ stage: 'off', inputPeak: 0, outputPeak: 0, gateOpen: false });

  useEffect(() => {
    let frame = 0;
    let shown = '';
    let nextUpdate = 0;
    let inputRms = 0;
    let inputPeak = 0;
    let outputPeak = 0;
    let gateOpenAt = -Infinity;
    let heldAt = -Infinity;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - heldAt > HOLD_MS) {
        inputRms = 0;
        inputPeak = 0;
        outputPeak = 0;
        heldAt = now;
      }
      const reading = audioEngine.getSignalReading();
      const level = audioEngine.getInputLevel();
      inputRms = Math.max(inputRms, reading.inputRms);
      inputPeak = Math.max(inputPeak, level.peak);
      outputPeak = Math.max(outputPeak, audioEngine.getOutputLevel());
      if (reading.gateOpen && reading.inputRms > 0) gateOpenAt = now;
      if (now < nextUpdate) return;
      nextUpdate = now + 120;
      const gateOpen = now - gateOpenAt < HOLD_MS;
      const stage = diagnoseSignal({ ...reading, inputRms, gateOpen });
      const key = `${stage}|${formatDb(inputPeak)}|${formatDb(outputPeak)}|${gateOpen}`;
      if (key !== shown) {
        shown = key;
        setView({ stage, inputPeak, outputPeak, gateOpen });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioEngine]);

  return view;
};

const inputFormat = (device: AudioDeviceOption): AudioFormat => {
  const info = device as AudioDeviceOption & { getCapabilities?: () => MediaTrackCapabilities };
  const capabilities = info.getCapabilities?.();
  return { channels: capabilities?.channelCount?.max, sampleRate: capabilities?.sampleRate?.max, bits: capabilities?.sampleSize?.max };
};

interface DeviceRowProps {
  group: 'input' | 'output';
  label: string;
  format: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const DeviceRow: React.FC<DeviceRowProps> = ({ group, label, format, checked, disabled, onSelect }) => (
  <label className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1 text-sm transition ${disabled ? 'cursor-not-allowed text-ink-400' : 'cursor-pointer hover:bg-ink-800'} ${checked ? 'bg-signal-500/10 text-ink-100' : 'text-ink-200'}`}>
    <input type="radio" name={`prgb-audio-${group}`} checked={checked} disabled={disabled} onChange={onSelect} className="size-4 shrink-0 accent-signal-400" />
    <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-300">{group === 'input' ? 'Entrada' : 'Saída'}</span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {format && <span className="shrink-0 font-mono text-[11px] text-ink-300">{format}</span>}
  </label>
);

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  readout: string;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, readout, onChange }) => (
  <label className="block text-xs text-ink-200">
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="font-mono text-ink-100">{readout}</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} aria-valuetext={readout}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-1 h-1.5 w-full cursor-pointer rounded-lg bg-ink-800 accent-amp-400" />
  </label>
);

const Stage: React.FC<{ label: string; value: string; active: boolean }> = ({ label, value, active }) => (
  <div className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 ${active ? 'border-hit/50 bg-hit/5' : 'border-ink-700 bg-ink-950'}`}>
    <p className="text-[10px] tracking-wider text-ink-300">{label}</p>
    <p className="truncate font-mono text-xs font-bold text-ink-100">{value}</p>
  </div>
);

// First thing in the panel: it answers "why can't I hear it" and points at the control that fixes it
const SignalPath: React.FC = () => {
  const { audioEngine, outputName } = useAudioSession();
  const signal = useSignalView();
  const stageText = STAGE_TEXT[signal.stage];

  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900 p-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-300">Caminho do som</p>
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1">
        <Stage label="GUITARRA" value={formatDb(signal.inputPeak)} active={signal.inputPeak > 0.002} />
        <ArrowRight size={14} className="hidden shrink-0 text-ink-400 sm:block" aria-hidden="true" />
        <Stage label="GATE" value={signal.gateOpen ? 'Aberto' : 'Fechado'} active={signal.gateOpen} />
        <ArrowRight size={14} className="hidden shrink-0 text-ink-400 sm:block" aria-hidden="true" />
        <Stage label="AMP" value={formatDb(signal.outputPeak)} active={signal.outputPeak > 0.01} />
        <ArrowRight size={14} className="hidden shrink-0 text-ink-400 sm:block" aria-hidden="true" />
        <Stage label="SAÍDA" value={outputName ? parseDeviceLabel(outputName).endpoint : 'Padrão do sistema'} active={signal.stage === 'playing'} />
      </div>
      <div aria-live="polite">
        <p className={`mt-2 text-sm font-semibold ${stageText.tone}`}>{stageText.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-300">{stageText.help}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => SoundFX.playPerfectHit()}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">
          <Volume2 size={14} aria-hidden="true" /> Testar saída
        </button>
        {signal.stage === 'suspended' && (
          <button type="button" onClick={() => void audioEngine.resumeContext()}
            className="min-h-10 cursor-pointer rounded-xl bg-amp-500 px-3 text-xs font-bold text-ink-950 hover:bg-amp-400">Reativar áudio</button>
        )}
      </div>
    </div>
  );
};

export const AudioRoutePanel: React.FC<AudioRoutePanelProps> = ({ currentDeviceId, onDeviceChange }) => {
  const { activeInput, audioEngine, changeOutputDevice, isAudioRunning, outputDeviceId, outputName } = useAudioSession();
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const info = isAudioRunning ? audioEngine.getEngineInfo() : null;
  const canChooseOutput = canChooseAudioOutput();

  const refreshDevices = useCallback(async () => {
    const [nextInputs, nextOutputs] = await Promise.all([audioEngine.getAudioInputDevices(), audioEngine.getAudioOutputDevices()]);
    setInputs(nextInputs);
    setOutputs(nextOutputs);
  }, [audioEngine]);

  useEffect(() => {
    void refreshDevices();
    const devices = navigator.mediaDevices;
    devices?.addEventListener?.('devicechange', refreshDevices);
    return () => devices?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices, isAudioRunning, activeInput]);

  const activeInputName = activeInput ? audioDeviceName(activeInput.label) : '';
  const isInputActive = (device: AudioDeviceOption) =>
    activeInputName ? audioDeviceName(device.label) === activeInputName : device.deviceId === currentDeviceId;
  const isOutputActive = (device: AudioDeviceOption) =>
    outputDeviceId ? device.deviceId === outputDeviceId : outputName !== '' && audioDeviceName(device.label) === outputName;

  const groups = groupAudioDevices(inputs, outputs);
  const hasNames = inputs.some((device) => device.label);

  return (
    <section aria-labelledby="audio-route-title" className="rounded-2xl border border-ink-700 bg-ink-950 p-4">
      <h3 id="audio-route-title" className="font-display text-base font-bold">Rota de áudio</h3>
      <p className="mt-0.5 text-xs leading-5 text-ink-300">Escolha uma entrada e uma saída. O navegador usa os drivers do sistema, não ASIO.</p>
      <p className="mt-1 text-xs leading-5 text-near">Use tomadas aterradas. Se sentir choque ao tocar nas cordas, pare, desconecte tudo e chame um eletricista.</p>

      <SignalPath />

      <div className="mt-4">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-300">Dispositivos</p>
        {!hasNames && <p className="mb-2 text-xs leading-5 text-ink-300">Conecte o áudio para o navegador mostrar os nomes dos dispositivos.</p>}
        <div className="space-y-2">
          {groups.map((group) => (
            <fieldset key={group.name} className="rounded-xl border border-ink-700 bg-ink-900 p-1.5">
              <legend className="px-1.5 text-xs font-bold text-ink-100">{group.name}</legend>
              {group.outputs.map((device) => (
                <DeviceRow key={device.deviceId} group="output" label={parseDeviceLabel(device.label).endpoint || 'Saída de áudio'}
                  format={isOutputActive(device) && info ? formatAudioFormat({ channels: info.outputChannels, sampleRate: info.sampleRate }) : ''}
                  checked={isOutputActive(device)} disabled={!canChooseOutput} onSelect={() => void changeOutputDevice(device.deviceId)} />
              ))}
              {group.inputs.map((device) => (
                <DeviceRow key={device.deviceId} group="input" label={parseDeviceLabel(device.label).endpoint || 'Entrada de áudio'}
                  format={formatAudioFormat(isInputActive(device) && activeInput
                    ? { channels: activeInput.channelCount, sampleRate: activeInput.sampleRate, bits: activeInput.sampleSize ?? undefined }
                    : inputFormat(device))}
                  checked={isInputActive(device)} onSelect={() => onDeviceChange(device.deviceId)} />
              ))}
            </fieldset>
          ))}
        </div>
        {!canChooseOutput && (
          <p className="mt-2 text-xs leading-5 text-near">Este navegador não deixa o site escolher a saída: o som vai para a saída padrão do sistema. Use Chrome, Edge ou Firefox, ou troque a saída padrão no Windows.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {canAskBrowserForOutput() && (
            <button type="button" onClick={() => void askBrowserForOutput().then((deviceId) => changeOutputDevice(deviceId)).then(refreshDevices).catch(() => undefined)}
              className="min-h-10 cursor-pointer rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">
              Escolher saída pelo navegador
            </button>
          )}
          <button type="button" onClick={() => void refreshDevices()}
            className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-200 transition hover:bg-ink-800">
            <RefreshCw size={13} aria-hidden="true" /> Atualizar lista
          </button>
        </div>
      </div>
    </section>
  );
};

export const SignalControls: React.FC = () => {
  const { ampEngine, audioOptions, changeAudioOptions } = useAudioSession();
  const [gateDb, setGateDb] = useState(ampEngine?.getSettings().gateThreshold ?? -45);

  useEffect(() => {
    if (!ampEngine) return;
    setGateDb(ampEngine.getSettings().gateThreshold);
    return ampEngine.subscribe((settings) => setGateDb(settings.gateThreshold));
  }, [ampEngine]);

  return (
    <section aria-labelledby="audio-signal-title" className="space-y-2 rounded-2xl border border-ink-700 bg-ink-950 p-4">
      <h3 id="audio-signal-title" className="font-display text-base font-bold">Sinal</h3>
      <SliderRow label="Ganho de entrada" value={audioOptions.inputGainDb} min={INPUT_GAIN_MIN_DB} max={INPUT_GAIN_MAX_DB} step={1}
        readout={`${audioOptions.inputGainDb > 0 ? '+' : ''}${audioOptions.inputGainDb} dB`}
        onChange={(inputGainDb) => void changeAudioOptions({ inputGainDb })} />
      <SliderRow label="Noise gate" value={gateDb} min={-80} max={-20} step={1} readout={`${gateDb} dB`}
        onChange={(value) => ampEngine?.setGateThreshold(value)} />
    </section>
  );
};

// Closed by default: buffer, latency and sample rate matter only once the sound already works
export const AdvancedAudioOptions: React.FC = () => {
  const { audioEngine, audioOptions, changeAudioOptions, isAudioRunning } = useAudioSession();
  const [isApplying, setIsApplying] = useState(false);
  const [, readLatencyAgain] = useReducer((reads: number) => reads + 1, 0); // the numbers below are read on render
  const info = isAudioRunning ? audioEngine.getEngineInfo() : null;
  const sampleRate = info?.sampleRate ?? 48000;

  const applyEngineOption = async (changes: Parameters<typeof changeAudioOptions>[0]) => {
    setIsApplying(true);
    try {
      await changeAudioOptions(changes);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <details onToggle={readLatencyAgain} className="group rounded-2xl border border-ink-700 bg-ink-950">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 text-sm font-bold text-ink-100">
        Ajustes avançados: latência e buffer
        <ChevronDown size={16} className="shrink-0 text-ink-300 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-300">Compensação de latência</p>
          <SliderRow label="Entrada" value={audioOptions.inputLatencySamples} min={0} max={LATENCY_SAMPLES_MAX} step={LATENCY_SAMPLES_STEP}
            readout={`${audioOptions.inputLatencySamples} amostras`}
            onChange={(inputLatencySamples) => void changeAudioOptions({ inputLatencySamples })} />
          <SliderRow label="Saída" value={audioOptions.outputLatencySamples} min={0} max={LATENCY_SAMPLES_MAX} step={LATENCY_SAMPLES_STEP}
            readout={`${audioOptions.outputLatencySamples} amostras`}
            onChange={(outputLatencySamples) => void changeAudioOptions({ outputLatencySamples })} />
          <p className="text-[11px] leading-4 text-ink-300">Só muda a pontuação: {formatMs(((audioOptions.inputLatencySamples + audioOptions.outputLatencySamples) / sampleRate) * 1000)} a mais para as notas contarem.</p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-300">Motor de áudio</p>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-ink-200">
            <input type="checkbox" checked={audioOptions.resampleTo48k} disabled={isApplying}
              onChange={(event) => void applyEngineOption({ resampleTo48k: event.target.checked })} className="size-4 accent-amp-400" />
            Reamostrar sempre para 48 kHz
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-ink-200">
            <input type="checkbox" checked={audioOptions.lowPower} disabled={isApplying}
              onChange={(event) => void applyEngineOption({ lowPower: event.target.checked })} className="size-4 accent-amp-400" />
            Modo de baixo consumo
          </label>
          <label className="block text-xs text-ink-200">
            Tamanho do buffer
            <select value={audioOptions.bufferSamples} disabled={isApplying}
              onChange={(event) => void applyEngineOption({ bufferSamples: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-2 text-xs text-ink-100">
              {ENGINE_BUFFER_SIZES.map((size) => (
                <option key={size} value={size}>{size ? `${size} amostras (${formatMs((size / 48000) * 1000)})` : 'Menor possível'}</option>
              ))}
            </select>
          </label>
          {info && (
            <p className="font-mono text-[11px] leading-4 text-ink-300">
              Medido agora: {formatMs(info.engineLatencyMs)} no motor + {formatMs(info.outputLatencyMs)} na saída, a {formatAudioFormat({ sampleRate: info.sampleRate })}
            </p>
          )}
        </div>
      </div>
    </details>
  );
};
