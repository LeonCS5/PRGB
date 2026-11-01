import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useAudioSession } from '../context/AudioSessionContext';
import { inputLevelState, looksLikeInstrumentInput, peakToDb, type InputLevelState } from '../services/audioDevices';

const LEVEL_LABELS: Record<InputLevelState, string> = {
  silent: 'Sem sinal',
  low: 'Baixo',
  good: 'Bom',
  hot: 'Alto',
  clipping: 'Saturando',
};

const LEVEL_COLORS: Record<InputLevelState, { text: string; bar: string }> = {
  silent: { text: 'text-ink-300', bar: 'bg-ink-500' },
  low: { text: 'text-near', bar: 'bg-near' },
  good: { text: 'text-hit', bar: 'bg-hit' },
  hot: { text: 'text-near', bar: 'bg-near' },
  clipping: { text: 'text-miss', bar: 'bg-miss' },
};

const METER_FLOOR_DB = -60;
const PEAK_HOLD_MS = 400; // a pick lasts less than the eye needs to read it

// Follows the signal itself, not the detected note: an input with no note in it is what needs diagnosing
export const InputLevelMeter: React.FC = () => {
  const { audioEngine, isAudioRunning } = useAudioSession();
  const [heldPeak, setHeldPeak] = useState(0);

  useEffect(() => {
    if (!isAudioRunning) return;
    let frame = 0;
    let held = 0;
    let heldUntil = 0;
    let shownDb: number | null = null;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const { peak } = audioEngine.getInputLevel();
      if (peak >= held || now >= heldUntil) {
        held = peak;
        heldUntil = now + PEAK_HOLD_MS;
      }
      const db = Math.round(peakToDb(held));
      if (db !== shownDb) {
        shownDb = db;
        setHeldPeak(held);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioEngine, isAudioRunning]);

  const peak = isAudioRunning ? heldPeak : 0;
  const db = peakToDb(peak);
  const state = inputLevelState(peak);
  const fill = Math.max(0, Math.min(100, ((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100));

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
        <div className={'h-full rounded-full ' + LEVEL_COLORS[state].bar} style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-1 flex items-center justify-between gap-1 whitespace-nowrap font-mono text-[10px] font-bold sm:text-xs">
        <span className={LEVEL_COLORS[state].text}>{isAudioRunning ? LEVEL_LABELS[state] : 'Desligado'}</span>
        <span className="text-ink-300">{Number.isFinite(db) && peak > 0 ? `${Math.round(db)} dB` : '--'}</span>
      </p>
    </div>
  );
};

export const AudioRouteNotice: React.FC = () => {
  const { activeInput, routeAlert } = useAudioSession();
  const message = routeAlert?.kind === 'moved'
    ? `A interface estava devolvendo o som para a entrada e isso virava microfonia. A saída mudou para ${routeAlert.outputName}.`
    : routeAlert?.kind === 'muted'
      ? 'Microfonia: o som da saída está voltando para a entrada, então o monitor foi silenciado. Escolha outra saída em Áudio.'
      : activeInput && !looksLikeInstrumentInput(activeInput.label)
        ? 'O PRGB está ouvindo o microfone do computador, não a guitarra. Escolha a sua interface em Áudio.'
        : null;
  if (!message) return null;
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl border border-near/40 bg-near/10 px-3 py-2 text-xs leading-5 text-near">
      <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
};
