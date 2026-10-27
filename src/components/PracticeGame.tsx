import React, { useEffect, useRef, useState, useCallback, useEffectEvent, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Search,
  Clock,
  Zap
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ModalFrame } from './ModalFrame';
import type { NormalizedSongTab, NoteEvent } from '../services/songsterrApi';
import { useAudioSession, useLatestPitch } from '../context/AudioSessionContext';
import { MetronomeScheduler, SoundFX } from '../services/synthAudio';
import {
  Tone3000AmpEngine,
  AMP_PRESETS,
  type Tone3000Settings
} from '../services/tone3000Amp';

interface PracticeGameProps {
  tab: NormalizedSongTab;
  onOpenSearch: () => void;
  onExit: () => void;
  onOpenAudioSettings: () => void;
  tone3000?: Tone3000AmpEngine | null;
  onOpenTone3000Rack?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface FloatingText {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

// Resolve CSS tokens once, outside the animation loop.
const readPalette = () => {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => styles.getPropertyValue('--color-' + name).trim();
  return { background: color('ink-900'), rail: color('ink-800'), ink: color('ink-950'), muted: color('ink-400'), signal: color('signal-400'), hit: color('hit'), near: color('near'), miss: color('miss'), strings: [color('note-violet'), color('signal-300'), color('signal-600'), color('hit'), color('near'), color('amp-400')] };
};

export const PracticeGame: React.FC<PracticeGameProps> = ({
  tab,
  onOpenSearch,
  onExit,
  onOpenAudioSettings,
  tone3000,
  onOpenTone3000Rack
}) => {
  const { getLatestPitch, isAudioRunning, startAudio } = useAudioSession();
  const [palette] = useState(readPalette);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLElement | null>(null);

  // TONE3000 Amp State
  const [toneSettings, setToneSettings] = useState<Tone3000Settings | null>(
    () => tone3000 ? tone3000.getSettings() : null
  );

  const [settingsAmp, setSettingsAmp] = useState(tone3000);
  if (settingsAmp !== tone3000) {
    setSettingsAmp(tone3000);
    setToneSettings(tone3000 ? tone3000.getSettings() : null);
  }

  useEffect(() => {
    if (!tone3000) return;
    return tone3000.subscribe((s) => setToneSettings(s));
  }, [tone3000]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [synthAudioEnabled, setSynthAudioEnabled] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  // Scoring & Gamification state
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);

  // Note hit tracking
  const noteStatesRef = useRef<Map<string, 'pending' | 'perfect' | 'good' | 'miss' | 'skipped'>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const [metronome] = useState(() => new MetronomeScheduler());
  const synthPlayedNotesRef = useRef<Set<string>>(new Set());

  const [previousTab, setPreviousTab] = useState(tab);
  if (previousTab !== tab) {
    setPreviousTab(tab);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setCurrentTimeMs(0);
    setIsPlaying(false);
  }

  useEffect(() => {
    noteStatesRef.current.clear();
    particlesRef.current = [];
    floatingTextsRef.current = [];
    synthPlayedNotesRef.current.clear();
  }, [tab]);

  const sceneRef = useRef<{
    width: number;
    height: number;
    dpr: number;
    background: OffscreenCanvas;
  } | null>(null);

  const syncCanvasSizeRef = useRef<(() => void) | null>(null);
  const [noteHeight, setNoteHeight] = useState(46);

  // Rebuild static rails/playhead only when geometry or pixel density changes.
  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let resolutionQuery: MediaQueryList;
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
      // Clear background
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);

      const hitLineX = 140; // Practice hit target X
      const stringCount = tab.stringCount || 6;
      const topMargin = Math.min(70, height * 0.16);
      const bottomMargin = Math.min(70, height * 0.16);
      const availableHeight = height - topMargin - bottomMargin;
      const stringSpacing = availableHeight / (stringCount - 1);
      setNoteHeight(Math.min(46, Math.max(0, stringSpacing * 0.7)));

      // 1. Draw horizontal string rails
      for (let s = 1; s <= stringCount; s++) {
        const y = topMargin + (s - 1) * stringSpacing;
        const color = palette.strings[(s) - 1] || palette.muted;

        // String line glow & rail
        ctx.beginPath();
        ctx.strokeStyle = palette.rail;
        ctx.lineWidth = 14;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Colored string center line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // String label on the left (e.g. 1 / E, 6 / E)
        ctx.fillStyle = color;
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.background;
        const labelHeight = Math.min(26, stringSpacing * 0.9);
        ctx.fillRect(10, y - labelHeight / 2, 62, labelHeight);
        ctx.fillStyle = color;
        ctx.fillText(`${s} / ${['e', 'B', 'G', 'D', 'A', 'E'][s - 1] || s}`, 18, y);
      }

      // 2. Draw Practice Playhead / Target Hit Zone Bar
      const grad = ctx.createLinearGradient(hitLineX - 4, 0, hitLineX + 4, 0);
      grad.addColorStop(0, palette.signal + '1a');
      grad.addColorStop(0.5, palette.signal);
      grad.addColorStop(1, palette.signal + '1a');
      ctx.fillStyle = grad;
      ctx.fillRect(hitLineX - 8, topMargin - 20, 16, availableHeight + 40);

      ctx.beginPath();
      ctx.strokeStyle = palette.signal;
      ctx.lineWidth = 3;
      ctx.shadowColor = palette.signal;
      ctx.shadowBlur = 16;
      ctx.moveTo(hitLineX, topMargin - 20);
      ctx.lineTo(hitLineX, topMargin + availableHeight + 20);
      ctx.stroke();
      ctx.shadowBlur = 0;

      sceneRef.current = { width, height, dpr, background };
    };
    const watchResolution = () => {
      resolutionQuery?.removeEventListener('change', watchResolution);
      syncSize();
      resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener('change', watchResolution);
    };
    syncCanvasSizeRef.current = syncSize;
    sceneRef.current = null;
    watchResolution();
    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    window.addEventListener('resize', syncSize);
    return () => {
      observer.disconnect();
      resolutionQuery.removeEventListener('change', watchResolution);
      window.removeEventListener('resize', syncSize);
      syncCanvasSizeRef.current = null;
      sceneRef.current = null;
    };
  }, [tab.stringCount, palette]);

  const particlePath = useMemo(() => {
    const path = new Path2D();
    path.arc(0, 0, 1, 0, Math.PI * 2);
    return path;
  }, []);

  const noteGraphics = useMemo(() => {
    const paths = new Map<string, Path2D>();
    const scale = noteHeight / 46;
    const fretFontSize = 23 * scale;
    const subtitleFontSize = 13 * scale;
    return tab.notes.map((note) => {
      const technique = `${note.bendSemitones ? '↑' : ''}${note.harmonic ? 'H' : ''}${note.tapping ? 'T' : ''}`;
      const fret = note.dead ? 'x' : note.ghost ? `(${note.fret})` : `${note.fret}`;
      const subtitle = note.dead ? '' : technique || note.noteName;
      const fretWidth = fret.length * fretFontSize * 0.75;
      const left = -(10 * scale + fretWidth / 2);
      const fretX = 0;
      const subtitleX = fretWidth / 2 + 8 * scale;
      const labelWidth = 20 * scale + fretWidth + (subtitle ? 8 * scale + subtitle.length * subtitleFontSize * 0.65 : 0);
      const width = Math.max((technique ? 104 : 70) * scale, labelWidth, note.durationMs * 0.45 * speed * 0.7);
      const key = `${width}:${noteHeight}`;
      let path = paths.get(key);
      if (!path) {
        path = new Path2D();
        path.roundRect(left, -noteHeight / 2, width, noteHeight, noteHeight / 2);
        paths.set(key, path);
      }
      return {
        note,
        path,
        fret,
        subtitle,
        fretX,
        subtitleX,
        fretFont: `900 ${fretFontSize}px Inter, sans-serif`,
        subtitleFont: `bold ${subtitleFontSize}px monospace`,
        bendTarget: note.midiNote + Math.round(note.bendSemitones ?? 0)
      };
    });
  }, [tab.notes, speed, noteHeight]);

  // Hit calculation & Feedback
  const triggerHitFeedback = useCallback(
    (type: 'perfect' | 'good' | 'miss', note: NoteEvent, yPos: number) => {
      const hitX = 140;

      if (type === 'perfect') {
        SoundFX.playPerfectHit();
        setScore((prev) => prev + 150 * Math.min(4, Math.floor(combo / 5) + 1));
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
        setPerfectCount((p) => p + 1);

        // Spawn bright green explosion particles
        for (let i = 0; i < 24; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 2 + Math.random() * 5;
          particlesRef.current.push({
            x: hitX,
            y: yPos,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color: palette.hit,
            alpha: 1,
            size: 3 + Math.random() * 4
          });
        }

        floatingTextsRef.current.push({
          id: `float-${Math.random()}`,
          text: `Perfeito! ${note.noteName}`,
          color: palette.hit,
          x: hitX + 15,
          y: yPos - 10,
          alpha: 1,
          scale: 1.4
        });
      } else if (type === 'good') {
        SoundFX.playPerfectHit();
        setScore((prev) => prev + 100 * Math.min(4, Math.floor(combo / 5) + 1));
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
        setGoodCount((g) => g + 1);

        for (let i = 0; i < 14; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 3.5;
          particlesRef.current.push({
            x: hitX,
            y: yPos,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color: palette.near,
            alpha: 1,
            size: 2.5 + Math.random() * 3
          });
        }

        floatingTextsRef.current.push({
          id: `float-${Math.random()}`,
          text: 'Bom',
          color: palette.near,
          x: hitX + 15,
          y: yPos - 10,
          alpha: 1,
          scale: 1.1
        });
      } else {
        // Miss
        SoundFX.playMissSound();
        setCombo(0);
        setMissCount((m) => m + 1);

        floatingTextsRef.current.push({
          id: `float-${Math.random()}`,
          text: 'Errou',
          color: palette.miss,
          x: hitX + 15,
          y: yPos - 10,
          alpha: 0.9,
          scale: 0.9
        });
      }
    },
    [combo, palette]
  );

  // Metronome: clicks are scheduled on the audio clock; the render loop only reports the song position
  const startMetronome = useEffectEvent(() => {
    metronome.start(tab.beatGrid, currentTimeMs, speed);
  });

  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) return;
    startMetronome();
    return () => metronome.stop();
  }, [isPlaying, metronomeEnabled, speed, tab.beatGrid, metronome]);

  // Synth preview of song notes
  useEffect(() => {
    if (!isPlaying || !synthAudioEnabled) return;
    for (const note of tab.notes) {
      if (note.dead) continue;
      if (
        note.timeMs >= currentTimeMs - 40 &&
        note.timeMs <= currentTimeMs + 40 &&
        !synthPlayedNotesRef.current.has(note.id)
      ) {
        synthPlayedNotesRef.current.add(note.id);
        SoundFX.playGuitarNote(note.freqHz, note.durationMs, 0.25);
      }
    }
  }, [isPlaying, synthAudioEnabled, currentTimeMs, tab.notes]);

  // Render Canvas Scene
  const drawGame = useEffectEvent((ctx: CanvasRenderingContext2D) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { width, height, dpr, background } = scene;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(background, 0, 0, background.width / dpr, background.height / dpr);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px Inter, sans-serif';
    const latestPitch = getLatestPitch();
    const hitLineX = 140;
    const topMargin = Math.min(70, height * 0.16);
    const stringSpacing = (height - topMargin * 2) / ((tab.stringCount || 6) - 1);
    const pixelsPerMs = 0.45 * speed;

    // 3. Process & Draw Notes
    const HIT_WINDOW_MS = 130; // Tolerance window for playing guitar note

    for (const { note, path, fret, subtitle, fretX, subtitleX, fretFont, subtitleFont, bendTarget } of noteGraphics) {
      const timeDiff = note.timeMs - currentTimeMs;
      const noteX = hitLineX + timeDiff * pixelsPerMs;

      // Note Y position based on its string
      const noteY = topMargin + (note.string - 1) * stringSpacing;
      const stringColor = palette.strings[(note.string) - 1] || palette.muted;

      // Only draw if within screen view
      if (noteX < -100 || noteX > width + 100) continue;

      let state = noteStatesRef.current.get(note.id) || 'pending';

      // Check if note is inside the active hit window and matches audio engine pitch
      if (state === 'pending' && isPlaying) {
        if (note.dead || note.grace) {
          if (timeDiff < -HIT_WINDOW_MS) {
            noteStatesRef.current.set(note.id, 'skipped');
            state = 'skipped';
          }
        } else if (Math.abs(timeDiff) <= HIT_WINDOW_MS) {
          if (latestPitch && latestPitch.volume > 0.02) {
            // Bends accept either the written pitch or the bend target.
            const midiDiff = Math.min(
              Math.abs(latestPitch.midiNote - note.midiNote),
              Math.abs(latestPitch.midiNote - bendTarget)
            );
            if (midiDiff <= 1) {
              const absDiff = Math.abs(timeDiff);
              if (absDiff <= 55) {
                noteStatesRef.current.set(note.id, 'perfect');
                triggerHitFeedback('perfect', note, noteY);
              } else {
                noteStatesRef.current.set(note.id, 'good');
                triggerHitFeedback('good', note, noteY);
              }
              state = noteStatesRef.current.get(note.id)!;
            }
          }
        } else if (timeDiff < -HIT_WINDOW_MS) {
          state = note.ghost ? 'skipped' : 'miss';
          noteStatesRef.current.set(note.id, state);
          if (state === 'miss') triggerHitFeedback('miss', note, noteY);
        }
      }

      // Draw Note Pill
      if (!noteHeight) continue;
      ctx.save();
      ctx.translate(noteX, noteY);
      if (note.grace) ctx.scale(0.75, 0.75);

      // Shadow / Glow
      if (state === 'perfect') {
        ctx.shadowColor = palette.hit;
        ctx.shadowBlur = 18;
      } else if (state === 'good') {
        ctx.shadowColor = palette.near;
        ctx.shadowBlur = 12;
      } else if (state === 'miss') {
        ctx.globalAlpha = 0.35;
      } else if (state === 'skipped' || note.ghost) {
        ctx.globalAlpha = 0.55;
      }

      // Note background fill
      if (state === 'perfect') {
        ctx.fillStyle = palette.hit;
      } else if (state === 'good') {
        ctx.fillStyle = palette.near;
      } else if (state === 'miss') {
        ctx.fillStyle = palette.muted;
      } else {
        ctx.fillStyle = stringColor;
      }
      ctx.fill(path);

      // Note border
      ctx.lineWidth = 2.5 * noteHeight / 46;
      ctx.strokeStyle = state === 'perfect' ? palette.hit : palette.ink;
      ctx.stroke(path);

      // Draw Fret Number inside the note block
      ctx.fillStyle = palette.ink;
      ctx.font = fretFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fret, fretX, 0);

      // Note name subtitle (e.g. A2, D3)
      ctx.fillStyle = palette.ink;
      ctx.font = subtitleFont;
      ctx.textAlign = 'left';
      ctx.fillText(subtitle, subtitleX, 0);

      ctx.restore();
    }

    // 4. Draw & Update Sparks / Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.035;

      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.scale(p.size, p.size);
      ctx.fill(particlePath);
      ctx.restore();
    }

    // 5. Draw & Update Floating Hit Text
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const ft = floatingTextsRef.current[i];
      ft.y -= 1.2;
      ft.alpha -= 0.025;

      if (ft.alpha <= 0) {
        floatingTextsRef.current.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `black 20px Inter, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  });

  const renderFrame = useEffectEvent((now: number) => {
    const delta = (now - lastFrameTimeRef.current) * speed;
    lastFrameTimeRef.current = now;
    if (isPlaying) {
      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= tab.totalDurationMs) {
          setIsPlaying(false);
          return tab.totalDurationMs;
        }
        return next;
      });
      if (metronomeEnabled) metronome.update(currentTimeMs + delta);
    }
    // Some DPR changes do not dispatch resize or media-query events.
    if (sceneRef.current && sceneRef.current.dpr !== (window.devicePixelRatio || 1)) {
      syncCanvasSizeRef.current?.();
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGame(ctx);
  });

  useEffect(() => {
    let animId: number;
    const render = (now: number) => {
      renderFrame(now);
      animId = requestAnimationFrame(render);
    };
    lastFrameTimeRef.current = performance.now();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const totalPlayed = perfectCount + goodCount + missCount;
  const accuracy = totalPlayed > 0 ? Math.round(((perfectCount + goodCount) / totalPlayed) * 100) : 100;
  const comboMultiplier = Math.min(4, Math.floor(combo / 5) + 1);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const restart = () => {
    setCurrentTimeMs(0);
    setScore(0); setCombo(0); setMaxCombo(0);
    setPerfectCount(0); setGoodCount(0); setMissCount(0);
    noteStatesRef.current.clear(); synthPlayedNotesRef.current.clear();
    particlesRef.current = []; floatingTextsRef.current = [];
    setIsPlaying(true);
  };
  const finished = currentTimeMs >= tab.totalDurationMs;
  const toolClass = 'flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-ink-950 text-ink-100 select-none">
      <header className="shrink-0 border-b border-ink-700 bg-ink-900 px-4 py-3 sm:px-6 [@media(max-height:500px)]:py-1">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onExit} aria-label="Voltar ao início" className="flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg"><BrandMark size={26} className="[&>span]:text-lg" /></button>
          <div className="min-w-0 flex-1 font-display">
            <h1 className="truncate text-base font-bold sm:text-xl">{tab.title}</h1>
            <p className="truncate text-xs text-ink-300">{tab.artist} · {tab.trackName}</p>
          </div>
          <LiveTuner />
          <button onClick={onOpenSearch} aria-label="Escolher outra música" className={toolClass}><Search size={17} /><span className="hidden lg:inline">Mudar música</span></button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-ink-700 pt-3 font-mono [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:pt-1">
          {[
            { label: 'PONTUAÇÃO', value: score.toLocaleString('pt-BR'), color: 'text-amp-300' },
            { label: 'COMBO', value: combo + ' ×' + comboMultiplier, color: 'text-near' },
            { label: 'PRECISÃO', value: accuracy + '%', color: 'text-hit' },
            { label: 'MAX COMBO', value: maxCombo, color: 'text-signal-300' }
          ].map(item => <div key={item.label}><p className="text-[9px] tracking-wider text-ink-300 sm:text-[10px]">{item.label}</p><p className={'mt-0.5 text-xl font-bold sm:text-2xl ' + item.color}>{item.value}</p></div>)}
        </div>
      </header>
      <main ref={canvasContainerRef} aria-label="Pista de prática de guitarra" className="relative min-h-0 w-full flex-1 overflow-hidden">
        <canvas ref={canvasRef} aria-label="Notas da tablatura nas seis cordas" className="absolute inset-0 block size-full" />
        {!isAudioRunning && <button onClick={() => void startAudio()} className="absolute right-3 top-2 min-h-10 cursor-pointer rounded-xl border border-signal-500/30 bg-ink-900/90 px-3 text-xs font-semibold text-signal-300">Conectar guitarra</button>}
      </main>
      <footer className="shrink-0 border-t border-ink-700 bg-ink-900 px-3 py-3 sm:px-6 [@media(max-height:500px)]:py-1">
        <div className="flex items-center gap-3">
          <button onClick={() => finished ? restart() : setIsPlaying(!isPlaying)} aria-label={isPlaying ? 'Pausar' : 'Tocar'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-amp-400 text-ink-950 transition hover:bg-amp-300">{isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
          <button onClick={restart} aria-label="Reiniciar música" className={toolClass}><RotateCcw size={18} /></button>
          <span className="font-mono text-xs text-ink-300">{formatTime(currentTimeMs)}</span>
          <input aria-label="Posição da música" type="range" min={0} max={tab.totalDurationMs} value={currentTimeMs}
            onChange={(event) => {
              const target = Number(event.target.value);
              setCurrentTimeMs(target);
              for (const [id] of noteStatesRef.current) {
                const note = tab.notes.find(item => item.id === id);
                if (note && note.timeMs > target) { noteStatesRef.current.delete(id); synthPlayedNotesRef.current.delete(id); }
              }
            }} className="h-10 min-w-0 flex-1 cursor-pointer accent-amp-400" />
          <span className="font-mono text-xs text-ink-300">{formatTime(tab.totalDurationMs)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          <label className={toolClass}><span className="sr-only">Velocidade</span><select aria-label="Velocidade" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="min-h-10 cursor-pointer bg-ink-800 font-mono outline-none">{[0.5, 0.75, 1].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          <button aria-label="Metrônomo" aria-pressed={metronomeEnabled} onClick={() => setMetronomeEnabled(!metronomeEnabled)} className={toolClass + (metronomeEnabled ? ' border-amp-400 text-amp-300' : '')}><Clock size={16} /><span className="hidden sm:inline">Metrônomo</span></button>
          <button aria-label="Sintetizador da tablatura" aria-pressed={synthAudioEnabled} onClick={() => setSynthAudioEnabled(!synthAudioEnabled)} className={toolClass + (synthAudioEnabled ? ' border-signal-500 text-signal-300' : '')}>{synthAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span className="hidden sm:inline">Sintetizador</span></button>
          <button aria-label="Configurações de áudio" onClick={onOpenAudioSettings} className={toolClass}><Sliders size={16} /><span className="hidden sm:inline">Áudio</span></button>
          <button aria-label="Abrir amplificador TONE3000" onClick={onOpenTone3000Rack} className={toolClass + ' text-amp-300'}><Zap size={16} /><span>{toneSettings ? AMP_PRESETS[toneSettings.preset]?.badge : 'Amp'}</span></button>
          <button aria-label={toneSettings?.isMonitoringEnabled ? 'Silenciar guitarra' : 'Ouvir guitarra'} aria-pressed={toneSettings?.isMonitoringEnabled ?? false} onClick={() => { if (tone3000 && toneSettings) tone3000.setMonitoringEnabled(!toneSettings.isMonitoringEnabled); }} className={toolClass}>{toneSettings?.isMonitoringEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        </div>
      </footer>
      {finished && <ModalFrame titleId="practice-result" onClose={() => setCurrentTimeMs(0)} className="max-w-md text-center">
        <p className="font-mono text-xs tracking-widest text-amp-300">MAIS UM RIFF NO CAMINHO</p>
        <h2 id="practice-result" className="mt-3 font-display text-3xl font-bold">Prática concluída</h2>
        <p className="mt-2 text-sm text-ink-300">{tab.title}</p>
        <p className="mt-7 font-mono text-5xl font-bold text-amp-300">{score.toLocaleString('pt-BR')}</p><p className="mt-2 text-xs text-ink-300">PONTOS</p>
        <div className="my-7 grid grid-cols-2 gap-3 font-mono"><div><p className="text-2xl text-hit">{accuracy}%</p><p className="text-xs text-ink-300">Precisão</p></div><div><p className="text-2xl text-signal-300">{maxCombo}</p><p className="text-xs text-ink-300">Max combo</p></div></div>
        <button onClick={restart} className="min-h-11 w-full cursor-pointer rounded-xl bg-amp-400 px-4 font-bold text-ink-950">Tocar de novo</button>
        <button onClick={() => { setCurrentTimeMs(0); onOpenSearch(); }} className="mt-3 min-h-11 w-full cursor-pointer rounded-xl border border-ink-700 px-4 text-sm text-ink-200">Escolher outra música</button>
      </ModalFrame>}
    </div>
  );
};

const LiveTuner: React.FC = () => {
  const latestPitch = useLatestPitch();
  return <div aria-label="Afinador" className="flex shrink-0 items-center gap-2 rounded-xl border border-signal-500/20 bg-signal-500/5 px-2 py-2 font-mono sm:px-4">
    <span className="text-lg font-bold text-signal-300">{latestPitch ? latestPitch.noteName : '--'}</span>
    <span className="hidden text-xs text-ink-300 sm:inline">{latestPitch ? latestPitch.frequency + ' Hz' : 'Toque uma corda'}</span>
    {latestPitch && <span className={'size-2 rounded-full ' + (Math.abs(latestPitch.cents) <= 6 ? 'bg-hit' : 'bg-signal-400')} />}
  </div>;
};
