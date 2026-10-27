import React, { useEffect, useRef, useState, useCallback, useEffectEvent, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Search,
  Trophy,
  Flame,
  Clock,
  Zap
} from 'lucide-react';
import type { NormalizedSongTab, NoteEvent } from '../services/songsterrApi';
import { useAudioSession, useLatestPitch } from '../context/AudioSessionContext';
import { SoundFX } from '../services/synthAudio';
import {
  Tone3000AmpEngine,
  AMP_PRESETS,
  type Tone3000Settings
} from '../services/tone3000Amp';

interface YousicianGameProps {
  tab: NormalizedSongTab;
  onOpenSearch: () => void;
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

// Yousician standard string colors (String 1 to 6)
const STRING_COLORS: Record<number, string> = {
  1: '#ec4899', // Pink / High E
  2: '#3b82f6', // Blue / B
  3: '#06b6d4', // Cyan / G
  4: '#10b981', // Green / D
  5: '#f59e0b', // Yellow / A
  6: '#ef4444' // Red / Low E
};

export const YousicianGame: React.FC<YousicianGameProps> = ({
  tab,
  onOpenSearch,
  onOpenAudioSettings,
  tone3000,
  onOpenTone3000Rack
}) => {
  const { getLatestPitch } = useAudioSession();
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
  const lastMetronomeBeatRef = useRef<number>(-1);
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
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, width, height);

      const hitLineX = 140; // Yousician hit target X
      const stringCount = tab.stringCount || 6;
      const topMargin = 70;
      const bottomMargin = 70;
      const availableHeight = height - topMargin - bottomMargin;
      const stringSpacing = availableHeight / (stringCount - 1);

      // 1. Draw horizontal string rails
      for (let s = 1; s <= stringCount; s++) {
        const y = topMargin + (s - 1) * stringSpacing;
        const color = STRING_COLORS[s] || '#64748b';

        // String line glow & rail
        ctx.beginPath();
        ctx.strokeStyle = '#1e293b';
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
        ctx.fillText(`Corda ${s}`, 18, y);
      }

      // 2. Draw Yousician Playhead / Target Hit Zone Bar
      const grad = ctx.createLinearGradient(hitLineX - 4, 0, hitLineX + 4, 0);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.9)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(hitLineX - 8, topMargin - 20, 16, availableHeight + 40);

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.moveTo(hitLineX, topMargin - 20);
      ctx.lineTo(hitLineX, topMargin + availableHeight + 20);
      ctx.stroke();

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
  }, [tab.stringCount]);

  const particlePath = useMemo(() => {
    const path = new Path2D();
    path.arc(0, 0, 1, 0, Math.PI * 2);
    return path;
  }, []);

  const noteGraphics = useMemo(() => {
    const paths = new Map<number, Path2D>();
    return tab.notes.map((note) => {
      const technique = `${note.bendSemitones ? '↑' : ''}${note.harmonic ? 'H' : ''}${note.tapping ? 'T' : ''}`;
      const width = Math.max(technique ? 72 : 48, note.durationMs * 0.45 * speed * 0.7);
      let path = paths.get(width);
      if (!path) {
        path = new Path2D();
        path.roundRect(-24, -16, width, 32, 16);
        paths.set(width, path);
      }
      return {
        note,
        path,
        fret: note.dead ? 'x' : note.ghost ? `(${note.fret})` : `${note.fret}`,
        subtitle: note.dead ? '' : technique || note.noteName,
        bendTarget: note.midiNote + Math.round(note.bendSemitones ?? 0)
      };
    });
  }, [tab.notes, speed]);

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
            color: '#10b981',
            alpha: 1,
            size: 3 + Math.random() * 4
          });
        }

        floatingTextsRef.current.push({
          id: `float-${Math.random()}`,
          text: `PERFECT! ${note.noteName}`,
          color: '#34d399',
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
            color: '#06b6d4',
            alpha: 1,
            size: 2.5 + Math.random() * 3
          });
        }

        floatingTextsRef.current.push({
          id: `float-${Math.random()}`,
          text: 'GOOD',
          color: '#38bdf8',
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
          text: 'MISS',
          color: '#ef4444',
          x: hitX + 15,
          y: yPos - 10,
          alpha: 0.9,
          scale: 0.9
        });
      }
    },
    [combo]
  );

  // Metronome audio pulse
  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) return;
    const msPerBeat = (60000 / tab.initialBpm);
    const currentBeat = Math.floor(currentTimeMs / msPerBeat);
    if (currentBeat !== lastMetronomeBeatRef.current) {
      lastMetronomeBeatRef.current = currentBeat;
      SoundFX.playClick(currentBeat % 4 === 0);
    }
  }, [isPlaying, metronomeEnabled, currentTimeMs, tab.initialBpm]);

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
    const topMargin = 70;
    const stringSpacing = (height - 140) / ((tab.stringCount || 6) - 1);
    const pixelsPerMs = 0.45 * speed;

    // 3. Process & Draw Notes
    const HIT_WINDOW_MS = 130; // Tolerance window for playing guitar note

    for (const { note, path, fret, subtitle, bendTarget } of noteGraphics) {
      const timeDiff = note.timeMs - currentTimeMs;
      const noteX = hitLineX + timeDiff * pixelsPerMs;

      // Note Y position based on its string
      const noteY = topMargin + (note.string - 1) * stringSpacing;
      const stringColor = STRING_COLORS[note.string] || '#3b82f6';

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
      ctx.save();
      ctx.translate(noteX, noteY);
      if (note.grace) ctx.scale(0.75, 0.75);

      // Shadow / Glow
      if (state === 'perfect') {
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 18;
      } else if (state === 'good') {
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
      } else if (state === 'miss') {
        ctx.globalAlpha = 0.35;
      } else if (state === 'skipped' || note.ghost) {
        ctx.globalAlpha = 0.55;
      }

      // Note background fill
      if (state === 'perfect') {
        ctx.fillStyle = '#10b981';
      } else if (state === 'good') {
        ctx.fillStyle = '#06b6d4';
      } else if (state === 'miss') {
        ctx.fillStyle = '#64748b';
      } else {
        ctx.fillStyle = stringColor;
      }
      ctx.fill(path);

      // Note border
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = state === 'perfect' ? '#a7f3d0' : '#ffffff';
      ctx.stroke(path);

      // Draw Fret Number inside the note block
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fret, -4, 0);

      // Note name subtitle (e.g. A2, D3)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(subtitle, 14, 0);

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

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-white select-none overflow-hidden">
      {/* Top Header / Scoreboard HUD */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-6 backdrop-blur">
        {/* Song Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-rose-300 border border-slate-700 transition cursor-pointer"
          >
            <Search size={14} />
            Mudar Música
          </button>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {tab.title}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {tab.trackName}
              </span>
            </div>
            <div className="text-xs text-slate-400">{tab.artist}</div>
          </div>
        </div>

        {/* Live Tuner Widget (Listening to Realtek / Audio Interface) */}
        <LiveTuner />

        {/* Yousician HUD (Score, Combo, Accuracy, Max Combo) */}
        <div className="flex items-center gap-6">
          {/* Combo Multiplier */}
          <div className="flex items-center gap-1.5">
            <Flame
              size={20}
              className={combo >= 5 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}
            />
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Combo (Max {maxCombo})</div>
              <div className="text-sm font-black text-amber-300 font-mono">
                {combo} <span className="text-xs text-amber-500">({comboMultiplier}x)</span>
              </div>
            </div>
          </div>

          {/* Accuracy */}
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Precisão</div>
            <div className="text-sm font-black text-emerald-400 font-mono">{accuracy}%</div>
          </div>

          {/* Total Score */}
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-3.5 py-1 border border-amber-500/30 shadow-sm">
            <Trophy size={18} className="text-amber-400" />
            <div className="font-mono text-lg font-black text-white">{score}</div>
          </div>
        </div>
      </header>

      {/* Main Yousician Rails Canvas */}
      <main ref={canvasContainerRef} className="relative flex-1 w-full min-h-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </main>

      {/* Bottom Playback & Audio Controls Dock */}
      <footer className="h-20 border-t border-slate-800/80 bg-slate-900/95 px-6 flex items-center justify-between backdrop-blur">
        {/* Play / Pause / Restart */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 text-white transition active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>

          <button
            onClick={() => {
              setCurrentTimeMs(0);
              noteStatesRef.current.clear();
              synthPlayedNotesRef.current.clear();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            title="Reiniciar música"
          >
            <RotateCcw size={18} />
          </button>

          {/* Progress Timeline Slider */}
          <div className="flex items-center gap-2 ml-2">
            <span className="font-mono text-xs text-slate-400">{formatTime(currentTimeMs)}</span>
            <input
              type="range"
              min={0}
              max={tab.totalDurationMs}
              value={currentTimeMs}
              onChange={(e) => {
                const target = Number(e.target.value);
                setCurrentTimeMs(target);
                // Clear state for future notes
                for (const [id] of noteStatesRef.current) {
                  const n = tab.notes.find((x) => x.id === id);
                  if (n && n.timeMs > target) {
                    noteStatesRef.current.delete(id);
                    synthPlayedNotesRef.current.delete(id);
                  }
                }
              }}
              className="w-48 sm:w-64 accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-xs text-slate-500">{formatTime(tab.totalDurationMs)}</span>
          </div>
        </div>

        {/* Practice Tools (Speed, Metronome, Backing Synth, Audio Settings) */}
        <div className="flex items-center gap-3">
          {/* Practice Speed */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1">
            <Gauge size={14} className="text-slate-400 ml-1.5" />
            {[0.5, 0.75, 1.0].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-lg px-2 py-1 text-xs font-bold transition cursor-pointer ${
                  speed === s ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Metronome */}
          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              metronomeEnabled
                ? 'border-amber-500 bg-amber-950/60 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Clock size={15} />
            Metrônomo
          </button>

          {/* Backing Synth Audio */}
          <button
            onClick={() => setSynthAudioEnabled(!synthAudioEnabled)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              synthAudioEnabled
                ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {synthAudioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            Áudio da Tab
          </button>

          {/* Audio Interface Settings Modal */}
          <button
            onClick={onOpenAudioSettings}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition shadow-sm cursor-pointer"
          >
            <Sliders size={15} className="text-cyan-400" />
            Interface
          </button>

          {/* TONE3000 Live Guitar Monitor & Amp Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenTone3000Rack}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                toneSettings?.isMonitoringEnabled
                  ? 'border-emerald-500/80 bg-emerald-950/60 text-emerald-300 shadow-sm shadow-emerald-500/20'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Abrir Rack TONE3000 (Amplificador & Efeitos)"
            >
              <Zap
                size={14}
                className={
                  toneSettings?.isMonitoringEnabled
                    ? 'text-emerald-400 fill-emerald-400'
                    : 'text-slate-400'
                }
              />
              <span>
                {toneSettings
                  ? AMP_PRESETS[toneSettings.preset]?.badge || 'TONE3000'
                  : 'TONE3000'}
              </span>
            </button>

            <button
              onClick={() => {
                if (tone3000 && toneSettings) {
                  tone3000.setMonitoringEnabled(!toneSettings.isMonitoringEnabled);
                }
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                toneSettings?.isMonitoringEnabled
                  ? 'border-emerald-500/60 bg-emerald-900/40 text-emerald-300'
                  : 'border-rose-900 bg-rose-950/40 text-rose-400'
              }`}
              title={
                toneSettings?.isMonitoringEnabled
                  ? 'Mutar Som da Guitarra'
                  : 'Ouvir Som da Guitarra'
              }
            >
              {toneSettings?.isMonitoringEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const LiveTuner: React.FC = () => {
  const latestPitch = useLatestPitch();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-1.5 shadow-inner">
      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
        Escuta:
      </div>
      <div className="flex items-baseline gap-1.5 font-mono">
        <span className="text-base font-black text-cyan-400">
          {latestPitch ? latestPitch.noteName : '--'}
        </span>
        <span className="text-xs text-slate-500">
          {latestPitch ? `${latestPitch.frequency} Hz` : 'Silêncio'}
        </span>
      </div>
      {latestPitch && (
        <div
          className={`h-2.5 w-2.5 rounded-full animate-pulse ${
            Math.abs(latestPitch.cents) <= 6 ? 'bg-emerald-400 shadow-emerald-500/50 shadow-md' : 'bg-cyan-400'
          }`}
        />
      )}
    </div>
  );
};
