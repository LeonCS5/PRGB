// Play Free: no song and no score. The app only listens to the guitar and shows what it hears, which also
// makes this the quickest way to check an audio setup.

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Sliders, Trash2, Zap } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ErrorNotice } from './ErrorNotice';
import {
  drawLaneBackground,
  layoutLanes,
  noteHeightFor,
  PIXELS_PER_MS,
  readPalette,
  stringY,
  type LaneLayout,
} from './practiceLanes';
import { useAudioSession, useLatestPitch } from '../context/AudioSessionContext';
import { STANDARD_TUNING } from '../services/audioEngine';
import { updateTrail, type PlayedNote } from '../services/noteTrail';

export interface FreePlayProps {
  onExit: () => void;
  onOpenAudioSettings: () => void;
  onOpenTone3000Rack?: () => void;
}

const NOW_LINE_MARGIN = 120; // room right of the line, so a note still ringing stays in view
const RECENT_NOTES = 12;
const TOOL_CLASS = 'flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500';

interface Scene {
  width: number;
  height: number;
  dpr: number;
  background: OffscreenCanvas;
  layout: LaneLayout;
  noteHeight: number;
}

const Reading: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2">
    <p className="text-[10px] tracking-wider text-ink-300">{label}</p>
    {/* Room for two lines on a phone: a header that changes height with each note would resize the canvas */}
    <div className="mt-0.5 min-h-10 break-words font-mono text-sm font-bold text-ink-100 sm:min-h-0">{children}</div>
  </div>
);

export const FreePlay: React.FC<FreePlayProps> = ({ onExit, onOpenAudioSettings, onOpenTone3000Rack }) => {
  const { audioEngine, isAudioRunning, startAudio, audioError, dismissAudioError, getLatestPitch } = useAudioSession();
  const pitch = useLatestPitch();
  const [palette] = useState(readPalette);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const trailRef = useRef<PlayedNote[]>([]);
  const totalRef = useRef(0);
  const [total, setTotal] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  // The last game may have left another tuning, and the string and fret shown here depend on it
  useEffect(() => {
    audioEngine.setTuning(STANDARD_TUNING);
  }, [audioEngine]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const syncSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const previous = sceneRef.current;
      if (previous?.width === width && previous.height === height && previous.dpr === dpr) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (!width || !height) {
        sceneRef.current = null;
        return;
      }
      const background = new OffscreenCanvas(canvas.width, canvas.height);
      const ctx = background.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);
      const [layout] = layoutLanes(height, [6]);
      drawLaneBackground(ctx, layout, width, palette, null, width - NOW_LINE_MARGIN);
      sceneRef.current = { width, height, dpr, background, layout, noteHeight: noteHeightFor(layout) };
      // A resize wipes the canvas after this frame's drawing, so without this it would paint blank once
      canvas.getContext('2d')?.drawImage(background, 0, 0);
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      sceneRef.current = null;
    };
  }, [palette]);

  useEffect(() => {
    const drawNote = (ctx: CanvasRenderingContext2D, scene: Scene, note: PlayedNote, nowMs: number) => {
      if (note.string === null) return;
      const { layout, noteHeight, width } = scene;
      const x = width - NOW_LINE_MARGIN - (nowMs - note.startMs) * PIXELS_PER_MS;
      // Wide enough for the fret and the note name, even on a quick pluck
      const noteWidth = Math.max(noteHeight * 1.5, (note.endMs - note.startMs) * PIXELS_PER_MS);
      if (x + noteWidth < 0) return;
      const y = stringY(layout, note.string);
      const scale = noteHeight / 46;
      const textX = x + noteHeight * 0.3;
      ctx.fillStyle = palette.strings[note.string - 1];
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight / 2, noteWidth, noteHeight, noteHeight / 2);
      ctx.fill();
      ctx.fillStyle = palette.ink;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `900 ${Math.round(18 * scale)}px Inter, sans-serif`;
      const fret = String(note.fret ?? '');
      ctx.fillText(fret, textX, y);
      const fretWidth = ctx.measureText(fret).width;
      ctx.font = `700 ${Math.max(10, Math.round(11 * scale))}px Inter, sans-serif`;
      ctx.fillText(note.noteName, textX + fretWidth + 4 * scale, y);
    };

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      const scene = sceneRef.current;
      const ctx = canvasRef.current?.getContext('2d');
      if (!scene || !ctx) return;
      const nowMs = performance.now();
      const previous = trailRef.current;
      const trail = updateTrail(previous, getLatestPitch(), nowMs);
      trailRef.current = trail;
      // The list changes every frame while a note rings: only a new note may cause a render
      const last = trail.at(-1);
      const before = previous.at(-1);
      const isNewNote = last !== undefined && last.attackId !== before?.attackId;
      if (isNewNote) {
        totalRef.current += 1;
        setTotal(totalRef.current);
      }
      if (isNewNote || (last && last.noteName !== before?.noteName)) {
        setRecent(trail.slice(-RECENT_NOTES).map((note) => note.noteName));
      }
      ctx.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
      ctx.drawImage(scene.background, 0, 0, scene.width, scene.height);
      for (const note of trail) drawNote(ctx, scene, note, nowMs);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [getLatestPitch, palette]);

  const clear = () => {
    trailRef.current = [];
    totalRef.current = 0;
    setTotal(0);
    setRecent([]);
  };

  const inputLevel = pitch ? Math.round(Math.min(100, pitch.volume * 250)) : 0;
  const position = pitch?.stringEstimate != null && pitch.fretEstimate != null
    ? `Corda ${pitch.stringEstimate} · casa ${pitch.fretEstimate}`
    : 'Fora do braço';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-ink-950 text-ink-100">
      <header className="shrink-0 border-b border-ink-700 bg-ink-900 px-3 py-3 sm:px-6 [@media(max-height:500px)]:py-1">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onExit} aria-label="Voltar ao início" className="flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg">
            <BrandMark size={26} className="[&>span]:text-lg" />
          </button>
          <div className="min-w-0 font-display">
            <h1 className="truncate text-base font-bold sm:text-xl">Play Free</h1>
            <p className="truncate text-xs text-ink-300">Toque à vontade: o PRGB só escuta e mostra as notas.</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2 [@media(max-height:500px)]:mt-1">
          <div className="flex w-28 shrink-0 flex-col items-center justify-center rounded-xl border border-signal-500/30 bg-signal-500/5 sm:w-32">
            <p className="text-[10px] tracking-wider text-ink-300">NOTA</p>
            <p className="font-display text-4xl font-bold text-signal-300 sm:text-6xl [@media(max-height:500px)]:text-2xl">{pitch ? pitch.noteName : '--'}</p>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Reading label="FREQUÊNCIA">{pitch ? `${pitch.frequency.toFixed(1)} Hz` : '--'}</Reading>
            <Reading label="AFINAÇÃO">
              {pitch
                ? <span className={Math.abs(pitch.cents) <= 6 ? 'text-hit' : 'text-near'}>{pitch.cents > 0 ? '+' : ''}{pitch.cents} cents</span>
                : '--'}
            </Reading>
            <Reading label="POSIÇÃO"><span className="text-xs sm:whitespace-nowrap sm:text-[11px]">{pitch ? position : '--'}</span></Reading>
            <Reading label="ENTRADA">
              <div className="flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full bg-signal-400" style={{ width: `${inputLevel}%` }} />
                </div>
                <span className="text-xs">{inputLevel}%</span>
              </div>
            </Reading>
            <Reading label="CLAREZA">{pitch ? `${Math.round(pitch.clarity * 100)}%` : '--'}</Reading>
            <Reading label="NOTAS"><span className="text-amp-300">{total}</span></Reading>
          </div>
        </div>
        {audioError && <div className="mt-2"><ErrorNotice message={audioError} onDismiss={dismissAudioError} /></div>}
      </header>

      <main ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} role="img" aria-label="Notas tocadas nas seis cordas" className="absolute inset-0 h-full w-full" />
      </main>

      <footer className="shrink-0 border-t border-ink-700 bg-ink-900 px-3 py-2 sm:px-6">
        <div className="flex min-h-7 items-center gap-2">
          <span className="shrink-0 text-[10px] tracking-widest text-ink-300">ÚLTIMAS</span>
          {recent.length === 0 && <span className="truncate text-xs text-ink-300">As notas que você tocar aparecem aqui.</span>}
          {/* Aligned right so that the newest note stays in view when they don't all fit */}
          <div className="flex min-w-0 flex-1 justify-end gap-1.5 overflow-hidden">
            {recent.map((name, index) => (
              <span key={index} className="shrink-0 rounded-md border border-signal-500/20 bg-signal-500/10 px-2 py-0.5 font-mono text-xs text-signal-300">{name}</span>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {isAudioRunning ? (
            <span className="flex shrink-0 items-center gap-1.5 px-1 font-mono text-xs text-hit"><Mic size={14} aria-hidden="true" /> Ao vivo</span>
          ) : (
            <button type="button" onClick={() => void startAudio()} className={TOOL_CLASS}><Mic size={16} aria-hidden="true" /> Conectar guitarra</button>
          )}
          <button type="button" onClick={clear} className={TOOL_CLASS}><Trash2 size={16} aria-hidden="true" /> Limpar</button>
          <button type="button" onClick={onOpenAudioSettings} className={TOOL_CLASS}><Sliders size={16} aria-hidden="true" /> Áudio</button>
          {onOpenTone3000Rack && (
            <button type="button" onClick={onOpenTone3000Rack} className={TOOL_CLASS + ' text-amp-300!'}><Zap size={16} aria-hidden="true" /> Amp</button>
          )}
        </div>
      </footer>
    </div>
  );
};
