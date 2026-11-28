import React, { useEffect, useId, useState } from 'react';
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
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-700">
        <div className={'h-full rounded-full ' + LEVEL_COLORS[state].bar} style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-1 flex items-center justify-between gap-1 whitespace-nowrap font-mono text-[0.625rem] font-bold sm:text-xs">
        <span className={LEVEL_COLORS[state].text}>{isAudioRunning ? LEVEL_LABELS[state] : 'Desligado'}</span>
        <span className="text-ink-300">{Number.isFinite(db) && peak > 0 ? `${Math.round(db)} dB` : '--'}</span>
      </p>
    </div>
  );
};

// The warning about the audio route, or null when the route is fine
const useRouteMessage = (): string | null => {
  const { activeInput, routeAlert } = useAudioSession();
  return routeAlert?.kind === 'moved'
    ? `A interface devolve o som para a própria entrada, o que vira microfonia. A saída mudou para ${routeAlert.outputName}. Se quiser outra, troque em Áudio.`
    : routeAlert?.kind === 'unavailable'
      ? 'Não foi possível usar essa saída. O som ficou fechado: escolha outra saída em Áudio.'
    : routeAlert?.kind === 'muted'
      ? 'Microfonia: o som da saída está voltando para a entrada, então o monitor foi silenciado. Escolha outra saída em Áudio.'
      : activeInput && !looksLikeInstrumentInput(activeInput.label)
        ? 'O PRGB está ouvindo o microfone do computador, não a guitarra. Escolha a sua interface em Áudio.'
        : null;
};

export const AudioRouteNotice: React.FC = () => {
  const message = useRouteMessage();
  if (!message) return null;
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl border border-near/40 bg-near/10 px-3 py-2 text-xs leading-5 text-near">
      <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
};

/**
 * The same warning for the game: a small button in the header that opens the message over the score strip, so it takes no
 * room from the lane (the lane keeps its size when the warning comes or goes) and never covers a note. A screen reader
 * hears the message at once, whether the button is open or not.
 */
export const AudioRouteBadge: React.FC = () => {
  const message = useRouteMessage();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!message) return null;
  return (
    <div className="relative shrink-0">
      <span role="status" className="sr-only">{message}</span>
      <button type="button" aria-expanded={open} aria-controls={panelId} aria-label="Aviso de áudio" title="Aviso de áudio" onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-near/40 bg-near/10 text-near transition hover:bg-near/20">
        <TriangleAlert size={18} aria-hidden="true" />
      </button>
      {open && (
        <p id={panelId} className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,85vw)] rounded-xl border border-near/40 bg-ink-900 px-3 py-2 text-xs leading-5 text-near shadow-panel">
          {message}
        </p>
      )}
    </div>
  );
};
