import React, { useEffect, useId, useRef, useState, useEffectEvent, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Search,
  Clock,
  Zap,
  Loader2,
  Trophy,
  UserRound
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ModalFrame } from './ModalFrame';
import { DuoHud, LiveTuner, SoloHud } from './GameHud';
import { ResultPanel } from './ResultPanel';
import type { GameDevPreset } from './devScenes';
import {
  buildNoteGraphics,
  drawLaneBackground,
  layoutLanes,
  noteHeightFor,
  playHitFeedback,
  readPalette,
  stringY,
  HIT_LINE_X,
  PIXELS_PER_MS,
  type HitEffects,
  type LaneLayout
} from './practiceLanes';
import type { NoteEvent } from '../services/songsterrApi';
import type { DetectedPitch, PlayerSlot } from '../services/audioEngine';
import type { Challenge } from '../services/challenge';
import { useAudioSession } from '../context/AudioSessionContext';
import { DEFAULT_PLAYER_NAMES, type GamePart, type PersonalBestOutcome, type RankedStart, type RunSummary } from '../context/gameSession';
import { useRanking } from '../context/ranking';
import type { RankedPhase } from '../context/rankedRun';
import { useRankedRun } from '../context/useRankedRun';
import { MetronomeScheduler, SoundFX } from '../services/synthAudio';
import {
  accuracyPercent,
  applyJudgement,
  consumeAttack,
  createAttackLedger,
  createScoreState,
  judgeNote,
  HIT_WINDOW_MS,
  type AttackLedger,
  type ScoreState
} from '../services/scoring';
import { getPersonalBest, recordRun } from '../services/records';
import {
  Tone3000AmpEngine,
  AMP_PRESETS,
  type Tone3000Settings
} from '../services/tone3000Amp';

export interface OnlineProgress {
  score: number;
  combo: number;
  accuracy: number;
  positionMs: number;
  finished: boolean;
}

// An online duo run starts by itself and can't be paused or moved: both players stay on the same clock
export interface OnlineRun {
  startAtMs: number; // Date.now() time
  hud: React.ReactNode;
  onProgress: (progress: OnlineProgress) => void;
  onFinished: (summary: RunSummary) => void;
}

interface PracticeGameProps {
  parts: GamePart[]; // one part (solo) or two (duo: player 1 first)
  playerNames?: [string, string] | null;
  challenge?: Challenge | null;
  onOpenSearch: () => void;
  onExit: () => void;
  onOpenAudioSettings: () => void;
  tone3000?: Tone3000AmpEngine | null;
  onOpenTone3000Rack?: () => void;
  rankedStart?: RankedStart | null;
  onRankedTabOutdated?: () => Promise<string | null>;
  devPreset?: GameDevPreset | null;
  online?: OnlineRun | null;
}

type NoteState = 'pending' | 'perfect' | 'good' | 'miss' | 'skipped';

interface Lane {
  part: GamePart;
  player: PlayerSlot;
}

// Judging state of one player during a run (scoring rules that need memory per player live here)
interface PlayerRun {
  score: ScoreState;
  attacks: AttackLedger; // the guitar attack last spent on a hit
}

const freshPlayers = (): PlayerRun[] => [
  { score: createScoreState(), attacks: createAttackLedger() },
  { score: createScoreState(), attacks: createAttackLedger() }
];

const synthKey = (laneIndex: number, noteId: string) => `${laneIndex}:${noteId}`;

// A longer gap between frames (a stall, a slow device) only moves the song this far, so it never jumps
// past notes nobody could play; a hidden tab pauses instead (visibilitychange)
const MAX_FRAME_GAP_MS = 100;

const isSamePart = (a: GamePart, b: GamePart) => a.tab.songId === b.tab.songId && a.partId === b.partId;

const RANKED_STATUS: Record<Exclude<RankedPhase, 'off'>, string> = {
  preparing: 'Conferindo sua conta e a faixa no ranking…',
  ready: 'Valendo para o ranking: toque a música inteira em 1×, sem saltos. Você pode pausar.',
  starting: 'Abrindo a partida no ranking…',
  running: 'Valendo para o ranking: velocidade travada em 1× e posição da música bloqueada.'
};

export const PracticeGame: React.FC<PracticeGameProps> = ({
  parts,
  playerNames = null,
  challenge = null,
  onOpenSearch,
  onExit,
  onOpenAudioSettings,
  tone3000,
  onOpenTone3000Rack,
  rankedStart = null,
  onRankedTabOutdated,
  devPreset = null,
  online = null,
}) => {
  const isOnline = online != null;
  const { getLatestPitch, isAudioRunning, startAudio, channelMode } = useAudioSession();
  const { isConfigured: isRankingOn, openAccount } = useRanking();
  const [palette] = useState(readPalette);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLElement | null>(null);

  // The caller remounts the game for each session (keyed), so the parts are fixed for its lifetime
  const [lanes] = useState<Lane[]>(() => parts.map((part, index) => ({ part, player: index === 0 ? 0 : 1 })));
  const [names] = useState<[string, string]>(() => playerNames ?? DEFAULT_PLAYER_NAMES);
  const isDuo = lanes.length > 1;
  const durationMs = useMemo(() => Math.max(...lanes.map((lane) => lane.part.tab.totalDurationMs)), [lanes]);
  // Parts of one song share the beat grid; the longest one covers the whole song
  const clockTab = useMemo(() => lanes.reduce((longest, lane) =>
    lane.part.tab.totalDurationMs > longest.part.tab.totalDurationMs ? lane : longest).part.tab, [lanes]);
  const mainTab = lanes[0].part.tab;
  const ranked = useRankedRun({
    part: isDuo ? null : lanes[0].part,
    start: rankedStart,
    reloadTab: onRankedTabOutdated,
    devSessionId: devPreset?.rankedSessionId
  });
  const rankedHelpId = useId();

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

  // Playback state. positionRef is the song clock; currentTimeMs mirrors it for the slider and the synth
  const [isPlaying, setIsPlaying] = useState(() => devPreset?.playing ?? false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => devPreset?.positionMs ?? 0);
  const positionRef = useRef(currentTimeMs);
  const [speed, setSpeed] = useState(1.0);
  const [synthAudioEnabled, setSynthAudioEnabled] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  // Scoring: playersRef is read and written by the canvas loop, `scores` mirrors it for the HUD
  const [initialPlayers] = useState<PlayerRun[]>(() => devPreset ? devPreset.scores.map((score) => ({ score, attacks: createAttackLedger() })) : freshPlayers());
  const playersRef = useRef(initialPlayers);
  const [scores, setScores] = useState<ScoreState[]>(() => initialPlayers.map((run) => run.score));

  // Run integrity: a run counts for records and challenges only if it was played from start to end
  // at one speed. Seeking (either way) or changing speed after the run started marks it.
  const runStartedRef = useRef(devPreset !== null);
  const integrityRef = useRef({ jumped: false, speedChanged: false });
  const runFinishedRef = useRef(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  // Note hit tracking, one map per lane
  const noteStatesRef = useRef<Map<string, NoteState>[]>([new Map(), new Map()]);
  const effectsRef = useRef<HitEffects>({ particles: [], texts: [] });
  const lastFrameTimeRef = useRef<number>(0);
  const [metronome] = useState(() => new MetronomeScheduler());
  const synthPlayedNotesRef = useRef<Set<string>>(new Set());

  const sceneRef = useRef<{
    width: number;
    height: number;
    dpr: number;
    background: OffscreenCanvas;
    layouts: LaneLayout[];
  } | null>(null);

  const syncCanvasSizeRef = useRef<(() => void) | null>(null);
  const [noteHeights, setNoteHeights] = useState<number[]>(() => lanes.map(() => 46));

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

      const layouts = layoutLanes(height, lanes.map((lane) => lane.part.tab.stringCount));
      const heights = layouts.map(noteHeightFor);
      setNoteHeights((current) => current.every((value, index) => value === heights[index]) ? current : heights);
      layouts.forEach((layout, index) => {
        const label = isDuo
          ? {
            text: `${names[index] === DEFAULT_PLAYER_NAMES[index] ? names[index].toUpperCase() : names[index]} · CANAL ${index + 1}`,
            color: palette.players[index]
          }
          : null;
        drawLaneBackground(ctx, layout, width, palette, label);
      });
      if (isDuo) {
        ctx.fillStyle = palette.divider;
        ctx.fillRect(0, layouts[1].top - 1, width, 2);
      }

      sceneRef.current = { width, height, dpr, background, layouts };
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
  }, [lanes, names, isDuo, palette]);

  const particlePath = useMemo(() => {
    const path = new Path2D();
    path.arc(0, 0, 1, 0, Math.PI * 2);
    return path;
  }, []);

  const laneGraphics = useMemo(
    () => lanes.map((lane, index) => buildNoteGraphics(lane.part.tab.notes, speed, noteHeights[index])),
    [lanes, speed, noteHeights]
  );

  // Every judgement of a pending note goes through here, with the full pitch of the note's player
  const judgePendingNote = (player: PlayerSlot, note: NoteEvent, timeDiffMs: number, pitch: DetectedPitch | null, y: number): NoteState => {
    const run = playersRef.current[player];
    const outcome = judgeNote(note, timeDiffMs, pitch, run.attacks);
    if (outcome === null) return 'pending';
    if (outcome === 'skip') return 'skipped';
    const players = playersRef.current.slice();
    players[player] = {
      score: applyJudgement(run.score, outcome),
      // A hit spends the attack, so a held note can't also hit the repeated notes after it
      attacks: outcome !== 'miss' && pitch ? consumeAttack(run.attacks, pitch.attackId, note.timeMs) : run.attacks
    };
    playersRef.current = players;
    setScores(players.map((run) => run.score));
    playHitFeedback(outcome, note, y, palette, effectsRef.current);
    return outcome;
  };

  const forEachNote = (visit: (note: NoteEvent, noteStates: Map<string, NoteState>, laneIndex: number) => void) => {
    lanes.forEach((lane, laneIndex) => {
      const noteStates = noteStatesRef.current[laneIndex];
      for (const note of lane.part.tab.notes) visit(note, noteStates, laneIndex);
    });
  };

  // Notes jumped over are skipped rather than missed
  const skipNotesBefore = (position: number) => forEachNote((note, noteStates) => {
    if (note.timeMs - position < -HIT_WINDOW_MS && (noteStates.get(note.id) ?? 'pending') === 'pending') {
      noteStates.set(note.id, 'skipped');
    }
  });

  // At the end every note still pending is past its window for good: the same rule as a note that
  // scrolled by unplayed (miss, or skip for dead/grace/ghost), so the HUD and the result agree
  const expirePendingNotes = () => {
    let players = playersRef.current;
    lanes.forEach((lane, laneIndex) => {
      const noteStates = noteStatesRef.current[laneIndex];
      for (const note of lane.part.tab.notes) {
        if ((noteStates.get(note.id) ?? 'pending') !== 'pending') continue;
        const outcome = judgeNote(note, -Infinity, null);
        noteStates.set(note.id, outcome === 'miss' ? 'miss' : 'skipped');
        if (outcome !== 'miss') continue;
        players = players.slice();
        players[lane.player] = { ...players[lane.player], score: applyJudgement(players[lane.player].score, 'miss') };
      }
    });
    if (players === playersRef.current) return;
    playersRef.current = players;
    setScores(players.map((run) => run.score));
  };

  const finishRun = () => {
    if (runFinishedRef.current) return;
    runFinishedRef.current = true;
    // DEV scenes start at the end with made-up scores: their notes were never played
    if (!devPreset) expirePendingNotes();
    const { jumped, speedChanged } = integrityRef.current;
    const finalScores = playersRef.current.slice(0, lanes.length).map((run) => run.score);
    const summary: RunSummary = { scores: finalScores, speed, jumped, speedChanged, personalBest: null };

    // Online runs never touch the personal records or the ranking
    if (online) {
      online.onFinished(summary);
      return;
    }

    let personalBest: PersonalBestOutcome | null = null;
    // Duo runs are two people in one browser: they never touch the personal records
    if (!isDuo) {
      const { tab, partId } = lanes[0].part;
      const score = finalScores[0];
      if (devPreset) {
        // Preview what recordRun would say, without saving a made-up run
        const previous = getPersonalBest(tab.songId, partId, speed);
        personalBest = { isNew: !jumped && !speedChanged && score.score > (previous?.score ?? 0), previous };
      } else if (jumped || speedChanged) {
        personalBest = { isNew: false, previous: getPersonalBest(tab.songId, partId, speed) };
      } else {
        const outcome = recordRun({
          songId: tab.songId,
          partId,
          title: tab.title,
          artist: tab.artist,
          trackName: tab.trackName,
          score: score.score,
          accuracy: accuracyPercent(score),
          maxCombo: score.maxCombo,
          perfect: score.perfect,
          good: score.good,
          miss: score.miss,
          speed,
          mode: 'solo',
          playedAt: new Date().toISOString()
        });
        personalBest = { isNew: outcome.isPersonalBest, previous: outcome.previousBest };
      }
    }
    setRunSummary({ ...summary, personalBest });
    // The server can only see a run that was too fast, so a slower one must never be sent
    if (!isDuo) ranked.controller.submitRun(finalScores[0], { jumped, speedChanged: speedChanged || speed !== 1 });
  };

  // Metronome: clicks are scheduled on the audio clock; the render loop only reports the song position
  const startMetronome = useEffectEvent(() => {
    metronome.start(clockTab.beatGrid, positionRef.current, speed);
  });

  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) return;
    startMetronome();
    return () => metronome.stop();
  }, [isPlaying, metronomeEnabled, speed, clockTab, metronome]);

  // Synth preview of song notes
  useEffect(() => {
    if (!isPlaying || !synthAudioEnabled) return;
    lanes.forEach((lane, laneIndex) => {
      // Both players on the same part: play it once
      if (laneIndex > 0 && isSamePart(lane.part, lanes[0].part)) return;
      for (const note of lane.part.tab.notes) {
        if (note.dead) continue;
        const key = synthKey(laneIndex, note.id);
        if (
          note.timeMs >= currentTimeMs - 40 &&
          note.timeMs <= currentTimeMs + 40 &&
          !synthPlayedNotesRef.current.has(key)
        ) {
          synthPlayedNotesRef.current.add(key);
          SoundFX.playGuitarNote(note.freqHz, note.durationMs, 0.25);
        }
      }
    });
  }, [isPlaying, synthAudioEnabled, currentTimeMs, lanes]);

  // Render Canvas Scene
  const drawGame = useEffectEvent((ctx: CanvasRenderingContext2D) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { width, dpr, background, layouts } = scene;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(background, 0, 0, background.width / dpr, background.height / dpr);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px Inter, sans-serif';
    const position = positionRef.current;
    const pixelsPerMs = PIXELS_PER_MS * speed;
    const isJudging = isPlaying && !runFinishedRef.current;

    // 3. Process & Draw Notes, lane by lane, each judged by the pitch of its own player
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      const { player } = lanes[laneIndex];
      const layout = layouts[laneIndex];
      const noteHeight = noteHeights[laneIndex];
      const noteStates = noteStatesRef.current[laneIndex];
      const latestPitch = getLatestPitch(player);

      for (const { note, path, fret, subtitle, fretX, subtitleX, fretFont, subtitleFont } of laneGraphics[laneIndex]) {
        const timeDiff = note.timeMs - position;
        const noteX = HIT_LINE_X + timeDiff * pixelsPerMs;

        // Note Y position based on its string
        const noteY = stringY(layout, note.string);
        const stringColor = palette.strings[(note.string) - 1] || palette.muted;

        let state = noteStates.get(note.id) || 'pending';

        // Check if note is inside the active hit window and matches audio engine pitch. Judged before
        // culling, so a note that left the screen still pending is missed instead of forgotten.
        if (state === 'pending' && isJudging) {
          state = judgePendingNote(player, note, timeDiff, latestPitch, noteY);
          if (state !== 'pending') noteStates.set(note.id, state);
        }

        // Only draw if within screen view
        if (noteX < -100 || noteX > width + 100) continue;

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
    }

    // 4. Draw & Update Sparks / Particles
    const { particles, texts } = effectsRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.035;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
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
    for (let i = texts.length - 1; i >= 0; i--) {
      const ft = texts[i];
      ft.y -= 1.2;
      ft.alpha -= 0.025;

      if (ft.alpha <= 0) {
        texts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = '900 20px Inter, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  });

  const renderFrame = useEffectEvent((now: number) => {
    const elapsed = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    if (online && !isPlaying && !runFinishedRef.current && Date.now() >= online.startAtMs) setIsPlaying(true);
    // Online, the song follows the clock: a late start or a hidden tab catches up instead of drifting apart
    const delta = online
      ? Math.max(0, Date.now() - online.startAtMs - positionRef.current)
      : Math.min(elapsed, MAX_FRAME_GAP_MS) * speed;
    // The guard covers frames that run before the pause at the end is committed
    if (isPlaying && !runFinishedRef.current) {
      if (!runStartedRef.current) {
        runStartedRef.current = true;
        // Starting after a seek forward skips the beginning: not a full run, and the notes left behind
        // are skipped (not missed)
        if (positionRef.current > 0) {
          integrityRef.current.jumped = true;
          skipNotesBefore(positionRef.current);
        }
      }
      const next = Math.min(positionRef.current + delta, durationMs);
      positionRef.current = next;
      setCurrentTimeMs(next);
      if (metronomeEnabled) metronome.update(next);
      if (next >= durationMs) {
        setIsPlaying(false);
        finishRun();
      }
      if (online) {
        const { score } = playersRef.current[0];
        online.onProgress({ score: score.score, combo: score.combo, accuracy: accuracyPercent(score), positionMs: next, finished: next >= durationMs });
      }
    }
    // Some DPR changes do not dispatch resize or media-query events.
    if (sceneRef.current && sceneRef.current.dpr !== (window.devicePixelRatio || 1)) {
      syncCanvasSizeRef.current?.();
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGame(ctx);
  });

  // A hidden tab gets few or no frames: pause instead of letting the song run on unseen
  useEffect(() => {
    if (isOnline) return;
    const pauseWhenHidden = () => {
      if (document.hidden) setIsPlaying(false);
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [isOnline]);

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

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // A reset zeroes the score, so the run that follows is a new, clean one
  const resetRun = (play: boolean) => {
    positionRef.current = 0;
    setCurrentTimeMs(0);
    playersRef.current = freshPlayers();
    setScores(playersRef.current.map((run) => run.score));
    runStartedRef.current = false;
    integrityRef.current = { jumped: false, speedChanged: false };
    runFinishedRef.current = false;
    setRunSummary(null);
    for (const noteStates of noteStatesRef.current) noteStates.clear();
    synthPlayedNotesRef.current.clear();
    effectsRef.current = { particles: [], texts: [] };
    ranked.controller.clearRun();
    setIsPlaying(play);
  };

  // A ranked run only plays once the server has opened its session
  const startRankedRun = async () => {
    setSpeed(1);
    if (await ranked.controller.beginRun()) setIsPlaying(true);
  };

  const restartRun = () => {
    if (!ranked.isOn) {
      resetRun(true);
      return;
    }
    resetRun(false);
    void startRankedRun();
  };

  const togglePlay = () => {
    if (currentTimeMs >= durationMs) restartRun();
    else if (isPlaying) setIsPlaying(false);
    else if (ranked.isOn && !ranked.sessionId) void startRankedRun();
    else setIsPlaying(true);
  };

  // A ranked run goes from the start at 1×, so turning it on only touches the current run once the account and
  // the part are confirmed: giving up leaves the song paused where it was
  const toggleRanked = async () => {
    if (ranked.isOn) {
      ranked.controller.turnOff();
      return;
    }
    setIsPlaying(false);
    if (await ranked.controller.turnOn()) {
      resetRun(false);
      setSpeed(1);
    }
  };

  const openRankingAccount = () => {
    setIsPlaying(false);
    openAccount();
  };

  const seekTo = (target: number) => {
    const previous = positionRef.current;
    positionRef.current = target;
    setCurrentTimeMs(target);
    // Notes ahead sound again in the synth
    forEachNote((note, _noteStates, laneIndex) => {
      if (note.timeMs > target) synthPlayedNotesRef.current.delete(synthKey(laneIndex, note.id));
    });
    // Before the run starts, seeking only moves the start point (renderFrame checks it when playback begins)
    if (!runStartedRef.current) return;

    // From here on the run is practice: a jumped run is never saved (no record, challenge or ranking, and
    // the ranked mode of phase 2 locks the seek bar), so judging notes again can't inflate anything kept
    integrityRef.current.jumped = true;
    if (target < previous) {
      // Going back reopens the notes ahead, to play that passage again with hits and misses shown
      forEachNote((note, noteStates) => {
        if (note.timeMs > target) noteStates.delete(note.id);
      });
    } else {
      skipNotesBefore(target);
    }
    if (target >= durationMs) {
      setIsPlaying(false);
      finishRun();
    }
  };

  const changeSpeed = (value: number) => {
    if (ranked.isOn) return;
    if (runStartedRef.current) integrityRef.current.speedChanged = true;
    setSpeed(value);
  };

  const toolClass = 'flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500 disabled:cursor-not-allowed disabled:opacity-50';
  const lockedHint = isOnline ? 'Na dupla online a música segue sem pausa, em 1×.' : ranked.isOn ? 'Partidas ranqueadas valem só em 1× e sem saltos.' : undefined;
  const lockedHelp = ranked.isOn ? rankedHelpId : undefined;
  const duoParts = isDuo
    ? (isSamePart(lanes[0].part, lanes[1].part) ? `${mainTab.trackName} (os dois)` : `${mainTab.trackName} + ${lanes[1].part.tab.trackName}`)
    : '';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-ink-950 text-ink-100 select-none">
      <header className="shrink-0 border-b border-ink-700 bg-ink-900 px-4 py-3 sm:px-6 [@media(max-height:500px)]:py-1">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onExit} aria-label="Voltar ao início" className="flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg"><BrandMark size={26} className="[&>span]:text-lg" /></button>
          <div className="min-w-0 flex-1 font-display">
            <h1 className="truncate text-base font-bold sm:text-xl">{mainTab.title}</h1>
            <p className="truncate text-xs text-ink-300">{isDuo ? `Dupla · ${duoParts}` : `${mainTab.artist} · ${mainTab.trackName}`}</p>
          </div>
          {isDuo
            ? <div className="hidden shrink-0 gap-2 sm:flex"><LiveTuner player={0} label="J1" /><LiveTuner player={1} label="J2" /></div>
            : <LiveTuner />}
          {!isOnline && (
            <button onClick={onOpenSearch} aria-label="Escolher outra música" className={toolClass}><Search size={17} /><span className="hidden lg:inline">Mudar música</span></button>
          )}
        </div>
        {isDuo ? <DuoHud scores={scores} names={names} /> : <SoloHud score={scores[0]} goal={challenge?.score} />}
      </header>
      <main ref={canvasContainerRef} aria-label="Pista de prática de guitarra" className="relative min-h-0 w-full flex-1 overflow-hidden">
        <canvas ref={canvasRef} aria-label={isDuo ? 'Notas das duas partes: jogador 1 em cima, jogador 2 embaixo' : 'Notas da tablatura nas seis cordas'} className="absolute inset-0 block size-full" />
        {/* A duo game also needs the input in duo mode: otherwise player 2 is never heard */}
        {(!isAudioRunning || (isDuo && channelMode !== 'duo')) && <button onClick={() => void startAudio(undefined, isDuo ? 'duo' : undefined)} className="absolute right-3 top-2 min-h-10 cursor-pointer rounded-xl border border-signal-500/30 bg-ink-900/90 px-3 text-xs font-semibold text-signal-300">Conectar guitarra{isDuo ? 's' : ''}</button>}
      </main>
      {online && <div className="shrink-0 px-3 sm:px-6">{online.hud}</div>}
      <footer className="shrink-0 border-t border-ink-700 bg-ink-900 px-3 py-3 sm:px-6 [@media(max-height:500px)]:py-1">
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} disabled={isOnline || ranked.isBusy} aria-busy={ranked.isBusy} aria-label={isPlaying ? 'Pausar' : 'Tocar'} title={lockedHint} className={'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-amp-400 text-ink-950 transition hover:bg-amp-300 ' + (isOnline ? 'disabled:cursor-not-allowed disabled:opacity-50' : 'disabled:cursor-wait disabled:opacity-70')}>{ranked.isBusy ? <Loader2 size={22} className="animate-spin" /> : isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
          <button onClick={restartRun} disabled={isOnline || ranked.isBusy} aria-label="Reiniciar música" title={lockedHint} className={toolClass}><RotateCcw size={18} /></button>
          <span className="font-mono text-xs text-ink-300">{formatTime(currentTimeMs)}</span>
          <input aria-label="Posição da música" type="range" min={0} max={durationMs} value={currentTimeMs} disabled={isOnline || ranked.isOn} title={lockedHint} aria-describedby={lockedHelp}
            onChange={(event) => seekTo(Number(event.target.value))} className="h-10 min-w-0 flex-1 cursor-pointer accent-amp-400 disabled:cursor-not-allowed disabled:opacity-50" />
          <span className="font-mono text-xs text-ink-300">{formatTime(durationMs)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {!isOnline && ranked.isAvailable && (
            <button role="switch" aria-checked={ranked.isOn} aria-describedby={lockedHelp} onClick={() => void toggleRanked()} className={toolClass + (ranked.isOn ? ' border-amp-400! text-amp-300!' : '')}>
              {ranked.phase === 'preparing' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trophy size={16} aria-hidden="true" />}<span>Valer para o ranking</span>
              <span aria-hidden="true" className={'relative h-4 w-7 shrink-0 rounded-full transition ' + (ranked.isOn ? 'bg-amp-400' : 'bg-ink-600')}>
                <span className={'absolute top-0.5 size-3 rounded-full bg-ink-100 transition-all ' + (ranked.isOn ? 'left-3.5' : 'left-0.5')} />
              </span>
            </button>
          )}
          <label title={lockedHint} className={toolClass + ((isOnline || ranked.isOn) ? ' cursor-not-allowed! opacity-50' : '')}><span className="sr-only">Velocidade</span><select aria-label="Velocidade" value={speed} disabled={isOnline || ranked.isOn} aria-describedby={lockedHelp} onChange={event => changeSpeed(Number(event.target.value))} className="min-h-10 cursor-pointer bg-ink-800 font-mono outline-none disabled:cursor-not-allowed">{[0.5, 0.75, 1].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          <button aria-label="Metrônomo" aria-pressed={metronomeEnabled} onClick={() => setMetronomeEnabled(!metronomeEnabled)} className={toolClass + (metronomeEnabled ? ' border-amp-400! text-amp-300!' : '')}><Clock size={16} /><span className="hidden sm:inline">Metrônomo</span></button>
          <button aria-label="Sintetizador da tablatura" aria-pressed={synthAudioEnabled} onClick={() => setSynthAudioEnabled(!synthAudioEnabled)} className={toolClass + (synthAudioEnabled ? ' border-signal-500 text-signal-300' : '')}>{synthAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span className="hidden sm:inline">Sintetizador</span></button>
          <button aria-label="Configurações de áudio" onClick={onOpenAudioSettings} className={toolClass}><Sliders size={16} /><span className="hidden sm:inline">Áudio</span></button>
          <button aria-label="Abrir amplificador TONE3000" onClick={onOpenTone3000Rack} className={toolClass + ' text-amp-300!'}><Zap size={16} /><span>{toneSettings ? AMP_PRESETS[toneSettings.preset]?.badge : 'Amp'}</span></button>
          <button aria-label={toneSettings?.isMonitoringEnabled ? 'Silenciar guitarra' : 'Ouvir guitarra'} aria-pressed={toneSettings?.isMonitoringEnabled ?? false} onClick={() => { if (tone3000 && toneSettings) tone3000.setMonitoringEnabled(!toneSettings.isMonitoringEnabled); }} className={toolClass}>{toneSettings?.isMonitoringEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
          {!isOnline && isRankingOn && <button aria-label="Minha conta do ranking" onClick={openRankingAccount} className={toolClass}><UserRound size={16} /><span className="hidden lg:inline">Minha conta</span></button>}
        </div>
        {!isOnline && ranked.isAvailable && (
          <div id={rankedHelpId} role="status" aria-live="polite" className="text-xs leading-5">
            {ranked.notice && <p className={ranked.notice.tone === 'error' ? 'text-miss' : 'text-near'}>{ranked.notice.text}</p>}
            {ranked.phase !== 'off' && <p className="text-amp-200">{RANKED_STATUS[ranked.phase]}</p>}
          </div>
        )}
      </footer>
      {runSummary && <ModalFrame titleId="practice-result" onClose={() => resetRun(false)} className={(isDuo ? 'max-w-xl' : 'max-w-md') + ' overflow-y-auto text-center'}>
        <ResultPanel titleId="practice-result" summary={runSummary} parts={lanes.map((lane) => lane.part)} names={isDuo ? names : null}
          challenge={challenge} initialShareOpen={devPreset?.shareOpen} ranked={ranked.submission} onRetryRanked={ranked.controller.retrySubmission}
          onPlayAgain={restartRun} onChooseSong={() => { resetRun(false); onOpenSearch(); }} />
      </ModalFrame>}
    </div>
  );
};
