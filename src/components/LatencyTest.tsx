import React, { useEffect, useRef, useState } from 'react';
import { Check, Timer, X } from 'lucide-react';
import { InputLevelMeter } from './AudioRouting';
import { ModalFrame } from './ModalFrame';
import { HIT_LINE_X, PIXELS_PER_MS, readPalette } from './practiceLanes';
import { useAudioSession } from '../context/AudioSessionContext';
import {
  HIGH_LATENCY_MS,
  TEST_END_MS,
  TEST_NOTE_COUNT,
  WARM_UP_NOTES,
  createAttackTracker,
  emptyOffsets,
  latencySettings,
  noteForHit,
  readAttack,
  summarizeTest,
  testNoteTime,
  type LatencyResult
} from '../services/latencyTest';

const TITLE_ID = 'latency-test-title';
const LANE_HEIGHT = 150;
// The note of the game: same speed, same shape, and the fret number is what reaches the line. Anything else would
// train a different habit, and the number measured here would not be the one that applies in the game.
const NOTE_WIDTH = 70;
const NOTE_HEIGHT = 46;
const NOTE_LEFT = -19; // from the fret number
const NARROWEST_LINE_SHARE = 0.2; // keeps the line in view on a phone
// The line sits at 30% of the strip: 150 of these 500 ms come before it
const STRIP_MIN_MS = -150;
const STRIP_MAX_MS = 350;

const primaryButton = 'min-h-11 cursor-pointer rounded-xl bg-amp-400 px-5 text-sm font-bold text-ink-950 transition hover:bg-amp-300 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'min-h-11 cursor-pointer rounded-xl border border-ink-600 bg-ink-850 px-5 text-sm font-semibold text-ink-100 transition hover:border-ink-400';

const formatOffset = (ms: number) => `${ms > 0 ? '+' : ''}${ms} ms`;
const stripShare = (ms: number) => (Math.min(STRIP_MAX_MS, Math.max(STRIP_MIN_MS, ms)) - STRIP_MIN_MS) / (STRIP_MAX_MS - STRIP_MIN_MS) * 100;

// Each hit as a mark against the line: a good run is a tight group, and anyone can see that without reading a number
const HitStrip: React.FC<{ offsets: (number | null)[]; resultMs?: number }> = ({ offsets, resultMs }) => (
  <div aria-hidden="true" className="mt-3">
    <div className="relative h-8 rounded-lg border border-ink-700 bg-ink-950">
      <span className="absolute inset-y-0 left-[30%] w-0.5 bg-signal-400" />
      {resultMs !== undefined && <span className="absolute inset-y-0 w-1 rounded bg-amp-400" style={{ left: `${stripShare(resultMs)}%` }} />}
      {offsets.map((offset, index) => (offset === null ? null : (
        <span key={index} className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${index < WARM_UP_NOTES ? 'bg-ink-400' : 'bg-hit'}`} style={{ left: `${stripShare(offset)}%` }} />
      )))}
    </div>
    <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-300">
      <span>antes da linha</span><span>depois da linha</span>
    </div>
  </div>
);

interface LatencyRunProps {
  startedAt: number;
  onDone: (offsets: (number | null)[]) => void;
  onAbort: () => void;
}

const LatencyRun: React.FC<LatencyRunProps> = ({ startedAt, onDone, onAbort }) => {
  const { getLatestPitch } = useAudioSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offsets, setOffsets] = useState(emptyOffsets);
  const [passed, setPassed] = useState(0);
  const callbacks = useRef({ onDone, onAbort });

  useEffect(() => {
    callbacks.current = { onDone, onAbort };
  }, [onDone, onAbort]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const palette = readPalette();
    const noteColor = palette.strings[5];
    let frame = 0;
    let tracker = createAttackTracker(getLatestPitch());
    let shown = emptyOffsets();
    let shownPassed = 0;

    const draw = (clock: number) => {
      const width = canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(LANE_HEIGHT * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(LANE_HEIGHT * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, LANE_HEIGHT);
      const middle = LANE_HEIGHT / 2;
      const lineX = Math.min(HIT_LINE_X, width * NARROWEST_LINE_SHARE);
      ctx.fillStyle = palette.rail;
      ctx.fillRect(0, middle - 2, width, 4);
      ctx.fillStyle = palette.signal;
      ctx.fillRect(lineX - 2, 8, 4, LANE_HEIGHT - 16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 23px Inter, sans-serif';
      for (let index = 0; index < TEST_NOTE_COUNT; index += 1) {
        const x = lineX + (testNoteTime(index) - clock) * PIXELS_PER_MS;
        if (x < -NOTE_WIDTH || x > width + NOTE_WIDTH) continue;
        const wasPlayed = shown[index] !== null;
        ctx.globalAlpha = !wasPlayed && x < lineX - NOTE_WIDTH ? 0.35 : 1;
        ctx.fillStyle = wasPlayed ? palette.hit : noteColor;
        ctx.beginPath();
        ctx.roundRect(x + NOTE_LEFT, middle - NOTE_HEIGHT / 2, NOTE_WIDTH, NOTE_HEIGHT, NOTE_HEIGHT / 2);
        ctx.fill();
        ctx.fillStyle = palette.ink;
        ctx.fillText('0', x, middle);
        ctx.globalAlpha = 1;
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const clock = now - startedAt;
      // Read and drawn in the same frame, like the game judges a note: this is the delay the game itself sees
      const reading = readAttack(tracker, getLatestPitch(), clock);
      tracker = reading.tracker;
      if (reading.hitMs !== null) {
        const index = noteForHit(shown, reading.hitMs);
        if (index !== null) {
          shown = shown.map((offset, position) => (position === index ? Math.round((reading.hitMs ?? 0) - testNoteTime(index)) : offset));
          setOffsets(shown);
        }
      }
      draw(clock);
      const nextPassed = Array.from({ length: TEST_NOTE_COUNT }, (_, index) => index).filter((index) => clock >= testNoteTime(index)).length;
      if (nextPassed !== shownPassed) {
        shownPassed = nextPassed;
        setPassed(nextPassed);
      }
      if (clock >= TEST_END_MS) {
        cancelAnimationFrame(frame);
        callbacks.current.onDone(shown);
      }
    };
    frame = requestAnimationFrame(tick);

    // A hidden tab gets no frames, so the clock would jump over the notes
    const abortWhenHidden = () => {
      if (document.hidden) callbacks.current.onAbort();
    };
    document.addEventListener('visibilitychange', abortWhenHidden);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', abortWhenHidden);
    };
  }, [getLatestPitch, startedAt]);

  const lastHit = offsets.findLast((offset) => offset !== null);

  return (
    <div>
      <p className="text-center font-display text-lg font-bold">Toque quando o 0 chegar na linha</p>
      <canvas ref={canvasRef} aria-label="Pista do teste: as notas andam até a linha, sempre no mesmo ritmo" height={LANE_HEIGHT} className="mt-3 block h-[150px] w-full rounded-xl" />
      <div className="mt-3 flex items-center justify-between font-mono text-sm">
        <span role="status" className="text-ink-300">Nota {Math.min(passed + 1, TEST_NOTE_COUNT)} de {TEST_NOTE_COUNT}</span>
        <span className="text-hit">{lastHit !== undefined && lastHit !== null ? formatOffset(lastHit) : ''}</span>
      </div>
      <HitStrip offsets={offsets} />
    </div>
  );
};

interface ResultViewProps {
  offsets: (number | null)[];
  result: LatencyResult;
  isSaved: boolean;
  onSave: () => void;
  onRepeat: () => void;
  onClose: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ offsets, result, isSaved, onSave, onRepeat, onClose }) => {
  const { verdict, latencyMs, spreadMs, heard, expected } = result;
  if (isSaved) {
    return (
      <div className="py-4 text-center">
        <Check size={32} className="mx-auto text-hit" aria-hidden="true" />
        <p role="status" className="mt-2 font-display text-xl font-bold">Ajuste de {latencyMs} ms salvo</p>
        <p className="mt-1 text-sm text-ink-300">A pontuação agora desconta esse atraso. Refaça o teste se trocar de interface ou de navegador.</p>
        <button type="button" onClick={onClose} className={primaryButton + ' mt-5'}>Pronto</button>
      </div>
    );
  }
  if (verdict === 'few') {
    return (
      <div className="py-2 text-center">
        <p className="font-display text-xl font-bold">O PRGB ouviu só {heard} de {expected} notas</p>
        <p className="mt-1 text-sm text-ink-300">Confira se o medidor de entrada sobe quando você toca e repita o teste.</p>
        <HitStrip offsets={offsets} />
        <button type="button" onClick={onRepeat} className={primaryButton + ' mt-5'}>Repetir</button>
      </div>
    );
  }
  const isUnsteady = verdict === 'unsteady';
  return (
    <div className="text-center">
      <p className="font-mono text-xs tracking-widest text-ink-300">SEU ATRASO</p>
      <p className="mt-1 font-display text-5xl font-bold text-amp-300">{latencyMs} ms</p>
      <p className="mt-2 text-sm text-ink-300">{heard} de {expected} notas ouvidas · variação de ±{spreadMs} ms</p>
      {isUnsteady && <p role="alert" className="mt-2 text-sm text-near">As notas variaram demais para confiar nesse número. Tente tocar sempre no mesmo momento.</p>}
      {latencyMs > HIGH_LATENCY_MS && <p className="mt-2 text-sm text-near">Atraso alto: feche outros programas de áudio e confira o buffer nos ajustes avançados.</p>}
      <HitStrip offsets={offsets} resultMs={latencyMs} />
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={isUnsteady ? onRepeat : onSave} className={primaryButton}>{isUnsteady ? 'Repetir' : 'Salvar ajuste'}</button>
        <button type="button" onClick={isUnsteady ? onSave : onRepeat} className={secondaryButton}>{isUnsteady ? 'Salvar mesmo assim' : 'Repetir'}</button>
      </div>
    </div>
  );
};

type Phase = { name: 'intro' } | { name: 'running'; startedAt: number } | { name: 'result'; offsets: (number | null)[]; saved: boolean };

export interface LatencyTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LatencyTest: React.FC<LatencyTestProps> = ({ isOpen, onClose }) => {
  const { audioEngine, changeAudioOptions, isAudioRunning, startAudio } = useAudioSession();
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setPhase({ name: 'intro' });
    onClose();
  };

  const connect = async () => {
    setIsConnecting(true);
    try {
      await startAudio();
    } finally {
      setIsConnecting(false);
    }
  };

  const save = async (offsets: (number | null)[]) => {
    const { latencyMs } = summarizeTest(offsets);
    await changeAudioOptions(latencySettings(latencyMs, audioEngine.getEngineInfo()?.sampleRate ?? 48000));
    setPhase({ name: 'result', offsets, saved: true });
  };

  const currentMs = audioEngine.getLatencyCompensationMs();

  return (
    <ModalFrame titleId={TITLE_ID} onClose={close} className="max-w-2xl overflow-y-auto">
      <button type="button" onClick={close} aria-label="Fechar" className="absolute right-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100">
        <X size={20} aria-hidden="true" />
      </button>
      <div className="mb-5 flex items-center gap-3 pr-10">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amp-500/30 bg-amp-500/10 text-amp-300"><Timer size={22} aria-hidden="true" /></span>
        <div>
          <h2 id={TITLE_ID} className="font-display text-xl font-bold">Teste de latência</h2>
          <p className="text-xs text-ink-300">Mede quanto o PRGB demora para ouvir a sua nota</p>
        </div>
      </div>

      {phase.name === 'intro' && (
        <div>
          <ol className="space-y-2 text-sm leading-6 text-ink-200">
            <li><span className="mr-2 font-mono font-bold text-amp-300">1</span>Doze notas vão até a linha, sempre no mesmo ritmo.</li>
            <li><span className="mr-2 font-mono font-bold text-amp-300">2</span>Toque uma corda solta, qualquer uma, quando o 0 de cada nota chegar na linha.</li>
            <li><span className="mr-2 font-mono font-bold text-amp-300">3</span>Olhe a nota chegando e toque junto com ela, sem esperar para reagir.</li>
          </ol>
          <div className="mt-4 rounded-xl border border-ink-700 bg-ink-950 p-3">
            <p className="mb-2 text-xs text-ink-300">Nível de entrada: toque uma corda para conferir</p>
            <InputLevelMeter />
          </div>
          <p className="mt-3 text-xs text-ink-300">{currentMs > 0 ? `Ajuste atual: ${Math.round(currentMs)} ms.` : 'Sem ajuste salvo.'} O teste muda só a pontuação, não o som.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {isAudioRunning
              ? <button type="button" onClick={() => setPhase({ name: 'running', startedAt: performance.now() })} className={primaryButton}>Começar</button>
              : <button type="button" disabled={isConnecting} onClick={() => void connect()} className={primaryButton}>{isConnecting ? 'Conectando...' : 'Conectar guitarra'}</button>}
          </div>
        </div>
      )}

      {phase.name === 'running' && (
        <LatencyRun key={phase.startedAt} startedAt={phase.startedAt}
          onDone={(offsets) => setPhase({ name: 'result', offsets, saved: false })}
          onAbort={() => setPhase({ name: 'intro' })} />
      )}

      {phase.name === 'result' && (
        <ResultView offsets={phase.offsets} result={summarizeTest(phase.offsets)} isSaved={phase.saved} onClose={close}
          onSave={() => void save(phase.offsets)}
          onRepeat={() => setPhase({ name: 'running', startedAt: performance.now() })} />
      )}
    </ModalFrame>
  );
};
