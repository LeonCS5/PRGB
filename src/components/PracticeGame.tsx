import React, { useEffect, useId, useRef, useState, useEffectEvent, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
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
  UserRound,
  MessageSquareWarning,
  Repeat,
  SkipForward,
  Palette,
  X
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { GameScaleControls, ScaleToast, type ScaleToastData } from './GameScaleControls';
import { formatScale } from './gameScaleKit';
import { buildScaleMap, formatZoomLabel, trackPixelsPerMs, type ScaleMap } from './noteSpacing';
import { analyzeTechniques, type PalmMuteRun, type TechniqueLink } from './techniques';
import { AudioRouteBadge } from './AudioRouting';
import { GameMoreSheet } from './GameMoreSheet';
import { ToolButton, ToolGroup } from './GameToolbar';
import { SHORTCUT_KEYS, shortcutFor, stepOption, toolClass } from './gameToolbarKit';
import { resumeOpacity, useResumeCountdown } from './resumeCountdown';
import { LazyScreen } from './OnDemand';
import { lazyWithRetry } from './lazyLoad';
import { TechniqueLegend } from './appearance/TechniqueLegend';
import { QuickAppearancePanel } from './QuickAppearancePanel';
import { ModalFrame } from './ModalFrame';
import { DuoHud, LiveTuner, SoloHud } from './GameHud';
import { ResultPanel } from './ResultPanel';
import { SessionStrip } from './SessionStrip';
import type { GameDevPreset } from './devScenes';
import {
  buildNoteGraphics,
  drawLaneBackground,
  layoutLanes,
  createLayer,
  noteDiameterFor,
  noteScaleOf,
  remScale,
  readRootFontPx,
  DEFAULT_ROOT_PX,
  FRET_FONT_FLOOR_REM,
  NOTE_READABLE_REM,
  MAX_NOTE_HEIGHT,
  playHitFeedback,
  stringY,
  depthAlphaAt,
  beatLineColor,
  hitLineX,
  PIXELS_PER_MS,
  type HitEffects,
  type LaneLayout
} from './practiceLanes';
import { useGameplayLook } from './useGameplayLook';
import { computeGuide, createGuideFrame, drawGuide, type GuideDrawExtras, type GuideFrame } from './guideShadow';
import { GameEffects, type EffectArea } from './gameEffects';
import { createBlockDraw, drawAloneSlide, drawPalmMuteBracket, trailFor, type BlockDraw, type NoteState } from './noteStyles';
import { clearPlayed, createSynthLane, dueNotes, unmarkAfter, unmarkPlayed } from './synthSchedule';
import { beginLane, beginLaneFrame, createLaneDrawEnv, drawBlockInLane, drawNoteInLane, type LaneTechniques } from './laneDraw';
import { useModals } from '../context/ModalsContext';
import type { NoteEvent } from '../services/tabsApi';
import type { DetectedPitch, PlayerSlot } from '../services/audioEngine';
import type { Challenge } from '../services/challenge';
import { useAudioSession } from '../context/AudioSessionContext';
import { DEFAULT_PLAYER_NAMES, type GamePart, type PersonalBestOutcome, type RankedStart, type RunSummary, type SessionRunProps } from '../context/gameSession';
import { useRanking } from '../context/ranking';
import type { RankedPhase } from '../context/rankedRun';
import { useRankedRun } from '../context/useRankedRun';
import { getSessionSettings, isLegendSeen, markLegendSeen, saveSessionSettings, SPEED_OPTIONS, ZOOM_AUTO } from '../context/sessionSettings';
import { countInOpacity, countInRemainingMs, countInStartPositionMs, COUNT_IN_MS } from './countIn';
import { clockViewOf, formatClock, positionValueText, sameClockView, type ClockView } from './clockView';
import { buildCountIn, MetronomeScheduler, SoundFX } from '../services/synthAudio';
import { isExerciseSongId } from '../services/exerciseIds';
import { isRankableSongId } from '../services/rankable';
import {
  accuracyPercent,
  applyJudgement,
  buildJudgeContexts,
  consumeAttack,
  createAttackLedger,
  createScoreState,
  judgeNote,
  noteTimeDiffMs,
  HIT_EARLY_MS,
  HIT_LATE_MS,
  type AttackLedger,
  type JudgeContext,
  type ScoreState
} from '../services/scoring';
import { getPersonalBest, recordRun } from '../services/records';
import { recordRunProgress } from '../context/progressStore';
import {
  AmpEngine,
  AMP_PRESETS,
  type AmpSettings
} from '../services/ampEngine';

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
  ampEngine?: AmpEngine | null;
  onOpenAmpRack?: () => void;
  rankedStart?: RankedStart | null;
  onRankedTabOutdated?: () => Promise<string | null>;
  devPreset?: GameDevPreset | null;
  online?: OnlineRun | null;
  session?: SessionRunProps | null; // set while a practice session runs: solo exercises only
}

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

// The lap is part of the key: in training mode the tail of one lap and the head of the next overlap in time

// Safari before 16.4 has no OffscreenCanvas: a canvas that is never attached to the page does the same job

// A longer gap between frames (a stall, a slow device) only moves the song this far, so it never jumps
// past notes nobody could play; a hidden tab pauses instead (visibilitychange)
const MAX_FRAME_GAP_MS = 100;

// The full Appearance screen opens over the game (which stays paused underneath), so it loads on demand
const AppearanceScreen = lazyWithRetry(() => import('./AppearanceScreen'), (module) => module.AppearanceScreen);

const SYNTH_LOOKAHEAD_MS = 120; // real time the guide notes are scheduled ahead of the line
const SYNTH_GRACE_MS = 60; // a frame that ran late still plays a note it just passed
const SESSION_TAIL_MS = 800; // past the last note: the late hit window (260 ms) plus room for the latency compensation

const isSamePart = (a: GamePart, b: GamePart) => a.tab.songId === b.tab.songId && a.partId === b.partId;

const RANKED_STATUS: Record<Exclude<RankedPhase, 'off'>, string> = {
  preparing: 'Conferindo sua conta e a faixa no ranking…',
  ready: 'Valendo para o ranking: toque a música inteira em 1×, sem saltos. Você pode pausar.',
  starting: 'Abrindo a partida no ranking…',
  running: 'Valendo para o ranking: velocidade travada em 1× e posição da música bloqueada.'
};

const LEGEND_TEXT = 'Cada linha é uma corda (a de baixo é a mais grossa). O número é a casa: 0 é a corda solta. Toque a nota quando ela cruzar a linha laranja; o jogo mostra Perfeito, Bom ou Errou.';

export const PracticeGame: React.FC<PracticeGameProps> = ({
  parts,
  playerNames = null,
  challenge = null,
  onOpenSearch,
  onExit,
  onOpenAudioSettings,
  ampEngine,
  onOpenAmpRack,
  rankedStart = null,
  onRankedTabOutdated,
  devPreset = null,
  online = null,
  session = null,
}) => {
  const isOnline = online != null;
  const { audioEngine, getLatestPitch, isAudioRunning, startAudio, channelMode } = useAudioSession();
  const { isConfigured: isRankingOn, hasAccount, openAccount } = useRanking();
  const { look, appearance } = useGameplayLook();
  const { palette, kit, strings } = look;
  // What the guide needs besides the frame; rebuilt only when the look changes, never per frame
  const guideExtras = useMemo<GuideDrawExtras>(
    () => ({ shadow: appearance.guide.shadow, stringColors: palette.strings, noteStyle: look.noteStyle }),
    [appearance.guide.shadow, palette.strings, look.noteStyle]
  );
  // The canvas loop reads the settings from refs: changing them never restarts the loop or the audio
  const effectSettingsRef = useRef(appearance.effects);
  const guideFramesRef = useRef<GuideFrame[]>([]); // one per lane, reused every frame
  useEffect(() => {
    effectSettingsRef.current = appearance.effects;
  });
  const gameEffects = useMemo(() => new GameEffects(), []);
  const effectAreaRef = useRef<EffectArea>({ hitLineX: hitLineX(0), width: 0, height: 0, top: 0, bottom: 0 });
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
  // In the middle of a session the run ends once the last note could still be judged, not at the end of the bar:
  // the quiet tail would only be a pause before the next exercise
  const endMs = useMemo(() => {
    if (isDuo || !session || session.queue.index >= session.queue.items.length - 1) return durationMs;
    const lastNoteMs = Math.max(0, ...mainTab.notes.map((note) => note.timeMs));
    return Math.min(durationMs, lastNoteMs + SESSION_TAIL_MS);
  }, [isDuo, session, mainTab, durationMs]);
  const isExercise = isExerciseSongId(mainTab.songId);
  const changeLabel = isExercise ? 'Mudar exercício' : 'Mudar música';
  const ranked = useRankedRun({
    // The server only ranks content seeded in the database
    part: isDuo || !isRankableSongId(mainTab.songId) ? null : lanes[0].part,
    start: rankedStart,
    reloadTab: onRankedTabOutdated,
    devSessionId: devPreset?.rankedSessionId
  });
  const rankedHelpId = useId();
  const trainingHelpId = useId();

  // PRGB Amp State
  const [toneSettings, setToneSettings] = useState<AmpSettings | null>(
    () => ampEngine ? ampEngine.getSettings() : null
  );

  const [settingsAmp, setSettingsAmp] = useState(ampEngine);
  if (settingsAmp !== ampEngine) {
    setSettingsAmp(ampEngine);
    setToneSettings(ampEngine ? ampEngine.getSettings() : null);
  }

  useEffect(() => {
    if (!ampEngine) return;
    return ampEngine.subscribe((s) => setToneSettings(s));
  }, [ampEngine]);

  // Playback state. positionRef is the song clock: the canvas, the judging and the synth read it every frame, and no
  // render depends on it. React renders again only when what the screen shows of it (clockView) changes.
  const [isPlaying, setIsPlaying] = useState(() => devPreset?.playing ?? false);
  const [initialPositionMs] = useState(() => devPreset?.positionMs ?? 0);
  const positionRef = useRef(initialPositionMs);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const countInOverlayRef = useRef<HTMLDivElement | null>(null);
  const autoMapRef = useRef<ScaleMap | null>(null); // the Auto scale of the song, read by the clock to say what is under the line
  // Each exercise of a practice session remounts the game: the choices made in the session come back as the start
  const [startSettings] = useState(() => getSessionSettings(session?.queue.id));
  const [speed, setSpeed] = useState(startSettings.speed);
  const [zoom, setZoom] = useState(startSettings.zoom);
  const countTotalMs = session?.leadInMs ?? COUNT_IN_MS;
  const [clockView, setClockView] = useState<ClockView>(() => clockViewOf(initialPositionMs, startSettings.speed, countTotalMs));
  const clockViewRef = useRef(clockView);
  // Every move of the song clock goes through here: the clock, the seek bar and the count's fade follow it at once
  // (written on their elements, outside React), and React hears of it only when a shown value changes
  const commitClock = (positionMs: number, rate: number = speed) => {
    positionRef.current = positionMs;
    const slider = sliderRef.current;
    if (slider) {
      const shown = String(Math.max(0, Math.round(positionMs)));
      if (slider.value !== shown) slider.value = shown;
    }
    const overlay = countInOverlayRef.current;
    if (overlay) overlay.style.opacity = String(countInOpacity(countInRemainingMs(positionMs, rate), countTotalMs));
    const view = clockViewOf(positionMs, rate, countTotalMs, autoMapRef.current?.factorAt(positionMs) ?? 1);
    if (sameClockView(view, clockViewRef.current)) return;
    clockViewRef.current = view;
    setClockView(view);
  };
  // The bar starts where the clock does (a dev preset can start it elsewhere); after that commitClock moves it
  useEffect(() => {
    if (sliderRef.current) sliderRef.current.value = String(Math.max(0, Math.round(positionRef.current)));
  }, []);
  const [scaleToast, setScaleToast] = useState<ScaleToastData | null>(null);
  const announceScale = (text: string) => setScaleToast((previous) => ({ id: (previous?.id ?? 0) + 1, text }));
  const clearScaleToast = useCallback(() => setScaleToast(null), []);
  const [synthAudioEnabled, setSynthAudioEnabled] = useState(startSettings.synth);
  const [metronomeEnabled, setMetronomeEnabled] = useState(startSettings.metronome);
  // Training mode loops an exercise for as long as the player wants: each lap starts as the last one ends
  const [isTraining, setIsTraining] = useState(startSettings.training);
  const queueId = session?.queue.id ?? null;
  useEffect(() => {
    if (queueId !== null) saveSessionSettings(queueId, { speed, metronome: metronomeEnabled, synth: synthAudioEnabled, training: isTraining, zoom });
  }, [queueId, speed, metronomeEnabled, synthAudioEnabled, isTraining, zoom]);
  // "Aparência rápida" (a side panel) and the full screen both stop the song; closing them brings it back after a short count
  const [appearanceLayer, setAppearanceLayer] = useState<'quick' | 'full' | null>(null);
  const resumeAfterAppearanceRef = useRef(false);
  const resume = useResumeCountdown(() => setIsPlaying(true));
  const [lap, setLap] = useState(1);
  const lapRef = useRef(1);
  // The clock turns a little before the lap ends, so the old lap's last notes and the new lap's first ones are both
  // judged for a while (see startNextLap)
  const lapOverlapRef = useRef(false);
  const previousLapStatesRef = useRef<Map<string, NoteState>[] | null>(null);

  // Scoring: playersRef is read and written by the canvas loop, `scores` mirrors it for the HUD
  const [initialPlayers] = useState<PlayerRun[]>(() => devPreset ? devPreset.scores.map((score) => ({ score, attacks: createAttackLedger() })) : freshPlayers());
  const playersRef = useRef(initialPlayers);
  const [scores, setScores] = useState<ScoreState[]>(() => initialPlayers.map((run) => run.score));

  // Run integrity: a run counts for records and challenges only if it was played from start to end
  // at one speed. Seeking (either way) or changing speed after the run started marks it.
  const runStartedRef = useRef(devPreset !== null);
  const integrityRef = useRef({ jumped: false, speedChanged: false });
  const runFinishedRef = useRef(false);
  const playedMsRef = useRef(0);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [legendSeen, setLegendSeen] = useState(() => isLegendSeen());
  const [pendingLeave, setPendingLeave] = useState<'exit' | 'end' | null>(null);
  const leaveTitleId = useId();

  // Note hit tracking, one map per lane
  const noteStatesRef = useRef<Map<string, NoteState>[]>([new Map(), new Map()]);
  const effectsRef = useRef<HitEffects>({ particles: [], texts: [] });
  const lastFrameTimeRef = useRef<number>(0);
  const [metronome] = useState(() => new MetronomeScheduler());
  const [countIn] = useState(() => new MetronomeScheduler());
  const countInBeats = useMemo(() => buildCountIn(clockTab.beatGrid, clockTab.initialBpm), [clockTab]);
  // The guide notes of each lane, sorted by time once, with which of them went to the audio clock (synthSchedule.ts)
  const synthLanes = useMemo(() => lanes.map((lane) => createSynthLane(lane.part.tab.notes)), [lanes]);
  // One set of drawing parameters, refilled every frame (laneDraw.ts): no closures or objects per lane per frame
  const [laneEnv] = useState(createLaneDrawEnv);
  // Guide notes handed to the audio clock but not yet due: a pause or a seek has to take them back
  const synthPendingRef = useRef<{ laneIndex: number; noteIndex: number; lap: number; cancelIfPending: () => boolean }[]>([]);
  const cancelPendingSynth = () => {
    // A note taken back before it sounded is not played yet: it can be scheduled again on resume
    for (const note of synthPendingRef.current) {
      if (note.cancelIfPending()) unmarkPlayed(synthLanes[note.laneIndex], note.noteIndex, note.lap);
    }
    synthPendingRef.current = [];
  };

  const sceneRef = useRef<{
    width: number;
    height: number;
    dpr: number;
    background: OffscreenCanvas | HTMLCanvasElement;
    layouts: LaneLayout[];
  } | null>(null);

  const syncCanvasSizeRef = useRef<(() => void) | null>(null);
  // What the notes are sized from: the distance between strings of each lane and the root font size (rem), measured when
  // the canvas is resized. The note size choice multiplies it; nothing here is a fixed number of pixels.
  const [laneGeometry, setLaneGeometry] = useState<{ spacings: number[]; rootPx: number } | null>(null);
  const [trackWidth, setTrackWidth] = useState(0); // canvas width: the window of music across the track follows it
  const rootPx = laneGeometry?.rootPx ?? DEFAULT_ROOT_PX;
  const noteScale = appearance.noteSize / 100;
  const noteHeights = useMemo(
    () => laneGeometry ? laneGeometry.spacings.map((spacing) => noteDiameterFor(spacing, noteScale, laneGeometry.rootPx)) : lanes.map(() => MAX_NOTE_HEIGHT),
    [laneGeometry, noteScale, lanes]
  );

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
      const { layer: background, ctx } = createLayer(canvas.width, canvas.height);
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Clear background
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);

      const root = readRootFontPx();
      const layouts = layoutLanes(height, lanes.map((lane) => lane.part.tab.stringCount), root);
      const spacings = layouts.map((layout) => layout.stringSpacing);
      setTrackWidth(width);
      setLaneGeometry((current) => current && current.rootPx === root && current.spacings.length === spacings.length && current.spacings.every((value, index) => value === spacings[index]) ? current : { spacings, rootPx: root });
      layouts.forEach((layout, index) => {
        const label = isDuo
          ? {
            text: `${names[index] === DEFAULT_PLAYER_NAMES[index] ? names[index].toUpperCase() : names[index]} · CANAL ${index + 1}`,
            color: palette.players[index]
          }
          : null;
        drawLaneBackground(ctx, layout, width, palette, label, hitLineX(width, root), strings, root);
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
  }, [lanes, names, isDuo, palette, strings]);

  const particlePath = useMemo(() => {
    const path = new Path2D();
    path.arc(0, 0, 1, 0, Math.PI * 2);
    return path;
  }, []);

  // The judging does not need the canvas: with no scene (a 0x0 container) it uses a nominal height
  const fallbackLayouts = useMemo(() => layoutLanes(400, lanes.map((lane) => lane.part.tab.stringCount)), [lanes]);

  // How the song is spread along the track. The base scale is a window of music across the canvas, so the scroll feels
  // the same on every screen; on top of it the scale follows how busy the song is (noteSpacing.ts): it falls where the
  // notes come fast and rises, up to 1.5x, where they are slow. A fixed zoom is that scale all through. The scale
  // depends on the song alone, so both players of a duo online agree.
  const showTechniques = appearance.techniques.show;
  // On a narrow screen the window of music is shorter than that: a note needs its place (trackPixelsPerMs)
  const noteWidthPx = noteHeights.reduce((widest, height) => Math.max(widest, height), 0);
  const baseScale = trackWidth > 0 ? trackPixelsPerMs(trackWidth, hitLineX(trackWidth, rootPx), noteWidthPx) : PIXELS_PER_MS;
  const laneNotes = useMemo(() => lanes.map((lane) => lane.part.tab.notes), [lanes]);
  const autoMap = useMemo(
    () => buildScaleMap(laneNotes, ZOOM_AUTO, { noteWidthPx, pixelsPerMs: baseScale }, isOnline || showTechniques),
    [laneNotes, noteWidthPx, baseScale, isOnline, showTechniques]
  );
  const scaleMap = useMemo(
    () => zoom === ZOOM_AUTO ? autoMap : buildScaleMap(laneNotes, zoom, { noteWidthPx, pixelsPerMs: baseScale }, showTechniques),
    [autoMap, laneNotes, zoom, noteWidthPx, baseScale, showTechniques]
  );
  const refreshClock = useEffectEvent(() => commitClock(positionRef.current));
  useEffect(() => {
    autoMapRef.current = autoMap;
    refreshClock(); // what the Zoom card shows follows the new map even while paused
  }, [autoMap]);
  const autoZoom = clockView.autoTenths / 10;
  const changeZoom = (value: number) => {
    setZoom(value);
    announceScale(`Espaçamento ${formatZoomLabel(value, autoZoom)}`);
  };

  const laneGraphics = useMemo(
    () => lanes.map((lane, index) => buildNoteGraphics(lane.part.tab.notes, noteHeights[index], look.noteStyle, scaleMap.noteScale, 1, appearance.guide.shadow.preserveNote ? NOTE_READABLE_REM * rootPx : 0, FRET_FONT_FLOOR_REM * rootPx, showTechniques)),
    [lanes, noteHeights, look.noteStyle, scaleMap, appearance.guide.shadow.preserveNote, rootPx, showTechniques]
  );
  // The techniques by lane, from the notes (indexes are those of laneGraphics): the blocks of notes joined by a hammer-on, a
  // pull-off or a slide (drawn as one piece each), the slides that only enter or leave a note, and the palm mute stretches
  const laneTechniques = useMemo(() => lanes.map((lane, laneIndex): LaneTechniques | null => {
    if (!showTechniques) return null;
    const analysis = analyzeTechniques(lane.part.tab.notes);
    const graphics = laneGraphics[laneIndex];
    const blockAt = new Int32Array(graphics.length).fill(-1); // the block a note starts, drawn when the loop reaches it
    const inBlock = new Uint8Array(graphics.length);
    const draws: BlockDraw[] = [];
    analysis.blocks.forEach((block, blockNumber) => {
      draws.push(createBlockDraw(block.indexes.map((index) => graphics[index]), block.links));
      blockAt[block.indexes[0]] = blockNumber;
      for (const index of block.indexes) inBlock[index] = 1;
    });
    return { draws, indexes: analysis.blocks.map((block) => block.indexes), blockAt, inBlock, alone: analysis.alone as TechniqueLink[], runs: analysis.palmMuteRuns as PalmMuteRun[] };
  }), [lanes, laneGraphics, showTechniques]);

  // What each note needs from the hand (a pick, or only a change of note for a hammer-on, pull-off or slide), by lane
  const judgeContexts = useMemo(() => lanes.map((lane) => buildJudgeContexts(lane.part.tab.notes)), [lanes]);

  // Every judgement of a pending note goes through here, with the full pitch of the note's player
  const judgePendingNote = (player: PlayerSlot, note: NoteEvent, timeDiffMs: number, pitch: DetectedPitch | null, y: number, context?: JudgeContext): NoteState => {
    const run = playersRef.current[player];
    const outcome = judgeNote(note, timeDiffMs, pitch, run.attacks, context);
    if (outcome === null) return 'pending';
    if (outcome === 'skip') return 'skipped';
    const players = playersRef.current.slice();
    players[player] = {
      score: applyJudgement(run.score, outcome),
      // A hit spends the attack, so a held note can't also hit the repeated notes after it
      attacks: outcome !== 'miss' && pitch ? consumeAttack(run.attacks, pitch.attackId, note.timeMs, pitch.changeId) : run.attacks
    };
    playersRef.current = players;
    setScores(players.map((run) => run.score));
    const lineX = hitLineX(sceneRef.current?.width ?? 0, rootPx);
    const fxUnit = noteScaleOf(noteHeights[Math.max(0, lanes.findIndex((lane) => lane.player === player))] ?? noteHeights[0] ?? MAX_NOTE_HEIGHT);
    playHitFeedback(outcome, note, lineX, y, palette, effectsRef.current, appearance.hitSounds, fxUnit);
    gameEffects.onJudgement(outcome, lineX, y, performance.now(), effectSettingsRef.current, palette.hit, palette.near, fxUnit);
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
    if (note.timeMs - position < -HIT_LATE_MS && (noteStates.get(note.id) ?? 'pending') === 'pending') {
      noteStates.set(note.id, 'skipped');
    }
  });

  // At the end every note still pending is past its window for good: the same rule as a note that
  // scrolled by unplayed (miss, or skip for dead/grace/ghost), so the HUD and the result agree
  const expirePendingNotes = (statesByLane: Map<string, NoteState>[] = noteStatesRef.current) => {
    let players = playersRef.current;
    lanes.forEach((lane, laneIndex) => {
      const noteStates = statesByLane[laneIndex];
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

  // The lap turns HIT_EARLY_MS before its end, so the first notes of the next one can be hit early, and the last notes
  // of the old lap keep being judged (on the old clock) until their late window closes: nothing is missed unfairly
  const startNextLap = (position: number) => {
    expirePreviousLap();
    previousLapStatesRef.current = noteStatesRef.current.map((states) => new Map(states));
    lapOverlapRef.current = true;
    for (const noteStates of noteStatesRef.current) noteStates.clear();
    lapRef.current += 1;
    setLap(lapRef.current);
    // The clock jumps back a whole lap: the clicks start over from the beat the new position is on
    if (metronomeEnabled) metronome.start(clockTab.beatGrid, position, speed);
  };

  // Whatever the old lap still had pending is past its window for good: the same rule as at the end of a run
  const expirePreviousLap = () => {
    lapOverlapRef.current = false;
    const previous = previousLapStatesRef.current;
    if (previous) expirePendingNotes(previous);
  };

  const finishRun = () => {
    if (runFinishedRef.current) return;
    runFinishedRef.current = true;
    if (!devPreset && !online) {
      markLegendSeen();
      setLegendSeen(true);
    }
    // DEV scenes start at the end with made-up scores: their notes were never played
    if (!devPreset) {
      expirePreviousLap();
      expirePendingNotes();
    }
    const { speedChanged } = integrityRef.current;
    const laps = lapRef.current;
    // Several laps add up to more than one run could score, so they go no further than the result
    const jumped = integrityRef.current.jumped || laps > 1;
    const finalScores = playersRef.current.slice(0, lanes.length).map((run) => run.score);
    const summary: RunSummary = { scores: finalScores, speed, jumped: integrityRef.current.jumped, speedChanged, laps, personalBest: null };

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
    // Online returned above; a duo or a DEV preview is recognized (and left out) by recordRunProgress
    const progress = recordRunProgress(isDuo ? 'duo' : devPreset ? 'preview' : 'solo', {
      songId: lanes[0].part.tab.songId,
      partId: lanes[0].part.partId,
      score: finalScores[0],
      speed,
      jumped: summary.jumped,
      speedChanged,
      laps,
      playedMs: playedMsRef.current
    }, Date.now());
    // In a session only the last exercise shows a result: the others hand over to the next one at once
    const hasNextInSession = !isDuo && session !== null && session.queue.index < session.queue.items.length - 1;
    if (!hasNextInSession) setRunSummary({ ...summary, personalBest, progress });
    // The session keeps what this exercise earned, to show it at the end
    if (!isDuo) session?.onRunFinished({ title: lanes[0].part.tab.title, stars: progress?.report.stars ?? 0, accuracy: accuracyPercent(finalScores[0]), score: finalScores[0].score });
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

  // A negative clock in a later training lap is the overlap with the lap before, not a count-in
  const isCountingIn = clockView.before && lap === 1;
  const startCountIn = useEffectEvent(() => {
    countIn.start(countInBeats, positionRef.current, speed);
  });

  useEffect(() => {
    if (!isPlaying || !isCountingIn) return;
    startCountIn();
    return () => countIn.stop();
  }, [isPlaying, isCountingIn, speed, countIn]);

  // Notes already queued ahead of the line must not sound over a pause or after the sound is turned off
  const dropPendingSynth = useEffectEvent(() => cancelPendingSynth());
  useEffect(() => {
    if (!isPlaying || !synthAudioEnabled) dropPendingSynth();
  }, [isPlaying, synthAudioEnabled]);

  // Synth preview of song notes: every frame, against the song clock itself (where the song is now)
  const scheduleSynth = () => {
    if (!isPlaying || !synthAudioEnabled) return;
    const position = positionRef.current;
    // The output delay is part of the lead, so a note due inside it is still handed over before it is late
    const lookaheadMs = (SYNTH_LOOKAHEAD_MS + SoundFX.outputLatencySec() * 1000) * speed;
    const graceMs = SYNTH_GRACE_MS * speed;
    // Right after a lap turns, the old lap's last notes are still ahead on the old clock: a second pass for them
    const passes = lap > 1 && position < HIT_LATE_MS ? 2 : 1;
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      // Both players on the same part: play it once
      if (laneIndex > 0 && isSamePart(lanes[laneIndex].part, lanes[0].part)) continue;
      const synthLane = synthLanes[laneIndex];
      const notes = lanes[laneIndex].part.tab.notes;
      for (let pass = 0; pass < passes; pass++) {
        const passLap = pass === 0 ? lap : lap - 1;
        const at = pass === 0 ? position : position + durationMs;
        // Notes about to cross the line are scheduled on the audio clock, so the sound lands on the line
        // instead of on the next frame; the delay is real time, the note's distance is song time
        const count = dueNotes(synthLane, at, passLap, lookaheadMs, graceMs);
        for (let due = 0; due < count; due++) {
          const noteIndex = synthLane.due[due];
          const note = notes[noteIndex];
          const handle = SoundFX.playGuitarNote(note.freqHz, note.durationMs, 0.25, Math.max(0, note.timeMs - at) / speed / 1000);
          if (handle) synthPendingRef.current = [...synthPendingRef.current.slice(-31), { laneIndex, noteIndex, lap: passLap, ...handle }];
        }
      }
    }
  };

  // Judges the pending notes against what the player is playing now. It runs every frame whether or not there is
  // a canvas to draw on: a scene that does not exist yet (a hidden or 0x0 container) must not stop the scoring.
  const judgeNotes = () => {
    if (!isPlaying || runFinishedRef.current) return;
    const position = positionRef.current;
    const layouts = sceneRef.current?.layouts ?? fallbackLayouts;
    lanes.forEach((lane, laneIndex) => {
      const { player } = lane;
      const latestPitch = getLatestPitch(player);
      const latencyMs = audioEngine.getLatencyCompensationMs();
      const judgeLap = (noteStates: Map<string, NoteState>, lapPosition: number) => {
        for (const graphic of laneGraphics[laneIndex]) {
          const { note } = graphic;
          if ((noteStates.get(note.id) ?? 'pending') !== 'pending') continue;
          // The delay is real time and the position is song time, which runs slower at a lower speed
          const state = judgePendingNote(player, note, noteTimeDiffMs(note.timeMs, lapPosition, latencyMs, speed), latestPitch, stringY(layouts[laneIndex], note.string), judgeContexts[laneIndex].get(note.id));
          if (state === 'pending') continue;
          noteStates.set(note.id, state);
          // A chord is judged once: the rest of it shows the same result
          if (!note.chord) continue;
          for (const peer of lane.part.tab.notes) {
            if (peer.chordMember && peer.timeMs === note.timeMs) noteStates.set(peer.id, state);
          }
        }
      };
      // The old lap first: its notes come earlier, so they get the attack first
      const previous = lapOverlapRef.current ? previousLapStatesRef.current?.[laneIndex] : undefined;
      if (previous) judgeLap(previous, position + durationMs);
      judgeLap(noteStatesRef.current[laneIndex], position);
    });
  };

  // Render Canvas Scene
  const drawGame = useEffectEvent((ctx: CanvasRenderingContext2D, now: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { width, dpr, background, layouts } = scene;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(background, 0, 0, background.width / dpr, background.height / dpr);
    const effectSettings = effectSettingsRef.current;
    const area = effectAreaRef.current;
    const lineX = hitLineX(width, rootPx);
    // Sizes written for a 16 px root follow the root of this screen (u); what belongs to the note follows the note (fxUnit)
    const u = remScale(rootPx);
    const fxUnit = noteScaleOf(noteWidthPx);
    const depthRange = width - lineX;
    area.hitLineX = lineX;
    area.width = width;
    area.height = scene.height;
    area.unit = fxUnit;
    area.top = layouts[0].top + layouts[0].topMargin - 20 * u;
    area.bottom = layouts[layouts.length - 1].top + layouts[layouts.length - 1].height - layouts[layouts.length - 1].topMargin + 20 * u;
    let combo = 0;
    for (const run of playersRef.current) combo = Math.max(combo, run.score.combo);
    gameEffects.drawUnder(ctx, now, effectSettings, area, combo, getLatestPitch(0)?.volume ?? 0, palette.signal);
    const trail = effectSettings.noteTrail ? trailFor(effectSettings.intensity) : null;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${13 * u}px Inter, sans-serif`;
    const position = positionRef.current;
    // Everything along the track sits at lineX + S(t) - S(shown position), S being the integral of the scale
    // Before a run from the very start the clock rests at 0, but the lane shows the state the count begins with: empty
    // at the line, the first note a whole count away. Every frame of the count then scrolls it in from far away.
    const atRest = !online && !isPlaying && !runStartedRef.current && position === 0;
    const shownPosition = atRest ? countInStartPositionMs(session?.leadInMs ?? COUNT_IN_MS, speed) : position;
    const trackBase = scaleMap.xOf(shownPosition);
    beginLaneFrame(laneEnv, { ctx, width, lineX, u, depthRange, kit, trail, signal: palette.signal });

    // 2.5 Bar and beat lines scroll with the notes and fade out into the distance
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      const layout = layouts[laneIndex];
      const boardTop = Math.max(layout.top, layout.top + layout.topMargin - 16 * u);
      const boardBottom = Math.min(layout.top + layout.height, layout.top + layout.height - layout.topMargin + 16 * u);
      for (const beat of clockTab.beatGrid) {
        const beatX = lineX + scaleMap.xOf(beat.timeMs) - trackBase;
        if (beatX < lineX - 60 * u || beatX > width + 60 * u) continue;
        ctx.beginPath();
        ctx.strokeStyle = beatLineColor(beat.accent, depthAlphaAt(beatX, lineX, depthRange));
        ctx.lineWidth = beat.accent ? 1.5 : 1;
        ctx.moveTo(beatX, boardTop);
        ctx.lineTo(beatX, boardBottom);
        ctx.stroke();
      }
    }

    // 3. Draw the notes, lane by lane (judgeNotes has already decided their state this frame)
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      const layout = layouts[laneIndex];
      const noteHeight = noteHeights[laneIndex];
      const noteStates = noteStatesRef.current[laneIndex];
      const laneUnit = noteScaleOf(noteHeight);
      // The chord name above its notes: a share of the note, never under 0.75 rem
      const chordFont = `bold ${Math.max(0.75 * rootPx, 15 * laneUnit)}px Inter, sans-serif`;
      const chordY = layout.top + Math.max(11 * u, layout.topMargin * 0.3);

      // The guide shadow goes under the notes: it marks the string of the next note on the hit line. It only reads
      // the song clock and the notes' states, so it never touches the judging.
      if (appearance.guide.enabled) {
        const guideFrames = guideFramesRef.current;
        const frame = guideFrames[laneIndex] ?? (guideFrames[laneIndex] = createGuideFrame());
        if (computeGuide(lanes[laneIndex].part.tab.notes, noteStates, position, speed, appearance.reducedMotion, frame, appearance.guide.shadow)) {
          const distancePx = scaleMap.xOf(position + frame.aheadMs) - trackBase;
          drawGuide(ctx, frame, layout, lineX, distancePx, palette.signal, appearance.guide.intensity, noteHeight, appearance.reducedMotion, appearance.guide.style, guideExtras);
        }
      }

      const graphics = laneGraphics[laneIndex];
      const tech = laneTechniques[laneIndex];
      const lapShift = isTraining ? scaleMap.xOf(durationMs) - scaleMap.xOf(0) : 0;
      const labelPx = Math.max(0.7 * FRET_FONT_FLOOR_REM * rootPx, 0.3 * noteHeight);
      const previousStates = previousLapStatesRef.current?.[laneIndex];

      beginLane(laneEnv, noteHeight, chordFont, chordY, labelPx);

      // Slides that only enter or leave a note: a short wedge beside it
      if (tech && noteHeight) {
        for (const link of tech.alone) {
          const graphic = graphics[link.from];
          const x = lineX + scaleMap.xOf(graphic.note.timeMs) - trackBase;
          if (x < -100 * u || x > width + 100 * u) continue;
          drawAloneSlide(ctx, link, kit, graphic.note.string, x, stringY(layout, graphic.note.string), graphic.height, labelPx, noteStates.get(graphic.note.id) || 'pending');
        }
      }

      // From the far notes to the near ones: where two overlap in a busy stretch, the one about to be played is on top
      for (let graphicIndex = graphics.length - 1; graphicIndex >= 0; graphicIndex--) {
        if (tech) {
          const blockNumber = tech.blockAt[graphicIndex];
          if (blockNumber >= 0) {
            drawBlockInLane(laneEnv, tech, graphics, noteStates, previousStates, layout, scaleMap, trackBase, blockNumber, 0, 0);
            if (isTraining) {
              drawBlockInLane(laneEnv, tech, graphics, noteStates, previousStates, layout, scaleMap, trackBase, blockNumber, lapShift, 1);
              drawBlockInLane(laneEnv, tech, graphics, noteStates, previousStates, layout, scaleMap, trackBase, blockNumber, -lapShift, -1);
            }
            continue;
          }
          if (tech.inBlock[graphicIndex]) continue; // a segment of a block, drawn with it
        }
        const graphic = graphics[graphicIndex];
        const { note } = graphic;
        const noteX = lineX + scaleMap.xOf(note.timeMs) - trackBase;

        const noteY = stringY(layout, note.string);

        const state = noteStates.get(note.id) || 'pending';

        drawNoteInLane(laneEnv, graphic, noteX, noteY, state);
        if (isTraining) {
          // The laps join up: the next one comes in behind this one, and the last one scrolls away ahead of it
          drawNoteInLane(laneEnv, graphic, noteX + lapShift, noteY, 'pending');
          const previous = previousStates?.get(note.id);
          if (previous) drawNoteInLane(laneEnv, graphic, noteX - lapShift, noteY, previous);
        }
      }

      // A palm mute is one bracket over its whole stretch of notes, with one PM label: never a tag on each note
      if (tech && noteHeight) {
        for (const run of tech.runs) {
          const first = graphics[run.first];
          const last = graphics[run.last];
          const x0 = lineX + scaleMap.xOf(first.note.timeMs) - trackBase - noteHeight / 2;
          const x1 = lineX + scaleMap.xOf(last.note.timeMs) - trackBase + Math.max(last.tailPx, noteHeight * 0.7);
          if (x1 < -100 * u || x0 > width + 100 * u) continue;
          drawPalmMuteBracket(ctx, kit, first.note.string, x0, x1, stringY(layout, run.topString) - noteHeight * 0.78, noteHeight, labelPx, 0);
        }
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
      ft.y -= 1.2 * fxUnit;
      ft.alpha -= 0.025;

      if (ft.alpha <= 0) {
        texts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `900 ${Math.max(0.875 * rootPx, 20 * fxUnit)}px Inter, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10 * fxUnit;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
    gameEffects.drawOver(ctx, now, effectSettings);
  });

  const renderFrame = useEffectEvent((now: number) => {
    const elapsed = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const startsNow = online && !isPlaying && !runFinishedRef.current && Date.now() >= online.startAtMs;
    if (startsNow) setIsPlaying(true);
    // Online, the song follows the clock: a late start or a hidden tab catches up instead of drifting apart
    const delta = online
      ? Math.max(0, Date.now() - online.startAtMs - positionRef.current)
      : Math.min(elapsed, MAX_FRAME_GAP_MS) * speed;
    // The guard covers frames that run before the pause at the end is committed
    if ((isPlaying || startsNow) && !runFinishedRef.current) {
      let next = Math.min(positionRef.current + delta, durationMs);
      if (isTraining && !online && next >= durationMs - HIT_EARLY_MS) {
        next -= durationMs;
        startNextLap(next);
      }
      if (lapOverlapRef.current && next >= HIT_LATE_MS) expirePreviousLap();
      if (!runStartedRef.current && next >= 0) {
        runStartedRef.current = true;
        // Starting after a seek forward skips the beginning: not a full run, and the notes left behind
        // are skipped (not missed)
        if (positionRef.current > 0) {
          integrityRef.current.jumped = true;
          skipNotesBefore(positionRef.current);
        }
      }
      if (online && delta > MAX_FRAME_GAP_MS) skipNotesBefore(next);
      // Real time actually played: not paused, not the count-in (position still negative), not a hidden tab
      if (positionRef.current >= 0) playedMsRef.current += Math.min(elapsed, MAX_FRAME_GAP_MS);
      commitClock(next);
      scheduleSynth();
      if (metronomeEnabled) metronome.update(next);
      if (next < 0) countIn.update(next);
      if (next >= endMs) {
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
    judgeNotes();
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawGame(ctx, now);
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

  // Only a run from the very start counts in: resuming, or starting after a seek, goes straight on
  const startPlaying = (rate = speed) => {
    if (!runStartedRef.current && positionRef.current === 0) {
      commitClock(countInStartPositionMs(countTotalMs, rate), rate);
    }
    setIsPlaying(true);
  };

  // Every exercise of a session after the first starts by itself, with the shorter count-in
  const shouldAutoStart = useRef(session?.autoStart ?? false);
  const autoStart = useEffectEvent(() => startPlaying());
  useEffect(() => {
    if (shouldAutoStart.current) autoStart();
  }, []);

  const skipLeadIn = () => {
    commitClock(0);
    setIsPlaying(true);
  };

  // A reset zeroes the score, so the run that follows is a new, clean one
  const resetRun = (play: boolean) => {
    resume.cancel();
    commitClock(0);
    playersRef.current = freshPlayers();
    setScores(playersRef.current.map((run) => run.score));
    runStartedRef.current = false;
    integrityRef.current = { jumped: false, speedChanged: false };
    runFinishedRef.current = false;
    playedMsRef.current = 0;
    setRunSummary(null);
    for (const noteStates of noteStatesRef.current) noteStates.clear();
    for (const synthLane of synthLanes) clearPlayed(synthLane);
    cancelPendingSynth();
    effectsRef.current = { particles: [], texts: [] };
    lapRef.current = 1;
    setLap(1);
    previousLapStatesRef.current = null;
    lapOverlapRef.current = false;
    ranked.controller.clearRun();
    if (play) startPlaying();
    else setIsPlaying(false);
  };

  // A ranked run only plays once the server has opened its session
  const startRankedRun = async () => {
    setSpeed(1);
    if (await ranked.controller.beginRun()) startPlaying(1);
  };

  const restartRun = () => {
    // The check that started by itself never holds the player: pressing play leaves the ranking out of this run
    ranked.controller.abandonAutomatic();
    if (!ranked.isOn || ranked.phase === 'preparing') {
      resetRun(true);
      return;
    }
    resetRun(false);
    void startRankedRun();
  };

  const togglePlay = () => {
    if (resume.secondsLeft !== null) {
      resume.cancel();
      setIsPlaying(true);
    } else if (positionRef.current >= durationMs) restartRun();
    else if (isPlaying) setIsPlaying(false);
    else if (ranked.phase === 'preparing' && ranked.automatic) {
      ranked.controller.abandonAutomatic();
      startPlaying();
    } else if (ranked.isOn && !ranked.sessionId) void startRankedRun();
    else startPlaying();
  };

  // A ranked run goes from the start at 1×, so turning it on only touches the current run once the account and
  // the part are confirmed: giving up leaves the song paused where it was
  const toggleRanked = async () => {
    if (ranked.isOn) return;
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

  // An account made while the game is open puts the run in the ranking right away
  const hadAccountRef = useRef(hasAccount);
  useEffect(() => {
    if (hasAccount && !hadAccountRef.current && ranked.isAvailable && !ranked.isOn) {
      // With a finished run on screen, only get the ranking ready for the next one: resetting would wipe the result
      if (runSummary === null) void toggleRanked();
      else void ranked.controller.turnOn();
    }
    hadAccountRef.current = hasAccount;
  });

  const seekTo = (target: number) => {
    const previous = positionRef.current;
    lapOverlapRef.current = false;
    commitClock(target);
    // Notes ahead sound again in the synth, and the ones already queued for the old position are taken back
    cancelPendingSynth();
    for (const synthLane of synthLanes) unmarkAfter(synthLane, target, lapRef.current);
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
    // An early hit scores while the count still runs, so a run can have begun before the clock reaches zero
    if (runStartedRef.current || noteStatesRef.current.some((states) => states.size > 0)) integrityRef.current.speedChanged = true;
    if (positionRef.current < 0) {
      commitClock(positionRef.current * (value / speed), value); // the count stays in real time
    }
    setSpeed(value);
  };

  // Leaving a run in progress loses it: ask first. A run that has not started or already ended leaves at once.
  const runInProgress = () => runStartedRef.current && !runFinishedRef.current;
  const askToLeave = (kind: 'exit' | 'end') => {
    resume.cancel();
    const leave = kind === 'exit' ? onExit : session?.onEnd;
    if (!runInProgress()) {
      leave?.();
      return;
    }
    setIsPlaying(false);
    setPendingLeave(kind);
  };
  const confirmLeave = () => {
    const kind = pendingLeave;
    setPendingLeave(null);
    if (kind === 'exit') onExit();
    else session?.onEnd();
  };

  // The legend (how to read the lanes) shows before the first run of a player who has not dismissed it
  // It lies over the bottom of the lane, so it only shows before the run: once the count starts it would hide the low string
  const showLegend = !legendSeen && !isOnline && !devPreset && !runSummary && !isPlaying && clockView.atStart;
  const dismissLegend = () => {
    markLegendSeen();
    setLegendSeen(true);
  };

  const { setFeedbackOpen } = useModals();

  // The song waits while the player looks at the options (a duo online cannot wait: it follows the shared clock)
  const openAppearance = () => {
    if (appearanceLayer) return;
    const wasResuming = resume.secondsLeft !== null;
    resume.cancel();
    if (!isOnline && (isPlaying || wasResuming)) {
      resumeAfterAppearanceRef.current = true;
      setIsPlaying(false);
    } else {
      resumeAfterAppearanceRef.current = false;
    }
    setAppearanceLayer('quick');
  };
  const closeAppearance = () => {
    setAppearanceLayer(null);
    if (!resumeAfterAppearanceRef.current) return;
    resumeAfterAppearanceRef.current = false;
    resume.begin();
  };

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    const action = shortcutFor(event);
    if (!action || appearanceLayer || pendingLeave || runSummary) return;
    if (action === 'play') {
      if (isOnline || ranked.isBusy) return;
      event.preventDefault();
      togglePlay();
    } else if (action === 'metronome') {
      setMetronomeEnabled(!metronomeEnabled);
      announceScale(`Metrônomo ${metronomeEnabled ? 'desligado' : 'ligado'}`);
    } else if (action === 'notes') {
      setSynthAudioEnabled(!synthAudioEnabled);
      announceScale(`Som das notas ${synthAudioEnabled ? 'desligado' : 'ligado'}`);
    } else if (action === 'appearance') {
      event.preventDefault();
      openAppearance();
    } else if (!isOnline && !ranked.isOn) {
      event.preventDefault();
      const next = stepOption(SPEED_OPTIONS, speed, action === 'speed-up' ? 1 : -1);
      if (next === speed) return;
      changeSpeed(next);
      announceScale(`Velocidade ${formatScale(next)}`);
    }
  });
  useEffect(() => {
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
  const lockedHint = isOnline ? 'Na dupla online a música segue sem pausa, em 1×.' : ranked.isOn ? 'Partidas ranqueadas valem só em 1× e sem saltos.' : undefined;
  const lockedHelp = ranked.isOn ? rankedHelpId : undefined;
  const duoParts = isDuo
    ? (isSamePart(lanes[0].part, lanes[1].part) ? `${mainTab.trackName} (os dois)` : `${mainTab.trackName} + ${lanes[1].part.tab.trackName}`)
    : '';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-ink-950 text-ink-100 select-none">
      <header className="shrink-0 border-b border-ink-700 bg-ink-900 px-4 py-3 sm:px-6 [@media(max-height:45rem)]:py-1.5 short:flex short:items-center short:gap-4 short:py-1!">
        <div className="flex items-center justify-between gap-3 short:min-w-0 short:flex-1">
          <button onClick={() => askToLeave('exit')} aria-label="PRGB: voltar ao início" className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg"><ArrowLeft size={18} aria-hidden="true" /><BrandMark size={26} className="[&>span]:hidden sm:[&>span]:inline [&>span]:text-lg" /></button>
          <div className="min-w-0 flex-1 font-display">
            <h1 className="truncate text-base font-bold sm:text-xl">{mainTab.title}</h1>
            <p className="truncate text-xs text-ink-300">{isDuo ? `Dupla · ${duoParts}` : `${mainTab.artist} · ${mainTab.trackName}`}</p>
          </div>
          <AudioRouteBadge />
          {isDuo
            ? <div className="hidden shrink-0 gap-2 sm:flex"><LiveTuner player={0} label="J1" /><LiveTuner player={1} label="J2" /></div>
            : <LiveTuner />}
          {session && (
            <>
              <span className="hidden shrink-0 font-mono text-xs text-signal-300 sm:inline">Sessão {session.queue.index + 1}/{session.queue.items.length}</span>
              {session.queue.index < session.queue.items.length - 1 && (
                <button onClick={session.onNext} aria-label="Ir para o próximo exercício da sessão" className={toolClass}><SkipForward size={17} aria-hidden="true" /><span>Próximo<span className="hidden lg:inline"> exercício</span></span></button>
              )}
              <button onClick={() => askToLeave('end')} aria-label="Encerrar a sessão" className={toolClass}><X size={17} /><span className="hidden lg:inline">Encerrar</span></button>
            </>
          )}
          {!isOnline && !session && (
            <button onClick={onOpenSearch} aria-label={changeLabel} className={toolClass}><Search size={17} /><span className="hidden lg:inline">{changeLabel}</span></button>
          )}
        </div>
        {isDuo ? <DuoHud scores={scores} names={names} /> : <SoloHud score={scores[0]} goal={challenge?.score} />}
      </header>
      <main ref={canvasContainerRef} aria-label="Pista de prática de guitarra" className="relative min-h-0 w-full flex-1 overflow-hidden">
        <canvas ref={canvasRef} aria-label={isDuo ? 'Notas das duas partes: jogador 1 em cima, jogador 2 embaixo' : 'Notas da tablatura nas seis cordas'} className="absolute inset-0 block size-full" />
        <ScaleToast toast={scaleToast} onDone={clearScaleToast} />
        {/* A duo game also needs the input in duo mode: otherwise player 2 is never heard */}
        {isCountingIn && (
          <>
            {/* Over the lane, in the middle, taking no room: the lane has its final size from the first frame */}
            <div ref={countInOverlayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-amp-300" style={{ opacity: clockView.countOpacity }}>
              <span className="text-sm font-semibold uppercase tracking-widest">Prepare-se</span>
              <span className="font-display text-[clamp(4rem,24vh,11rem)] font-bold leading-none">{clockView.countSecondsLeft}</span>
            </div>
            <p role="status" className="sr-only">Começa em {clockView.countSecondsLeft}</p>
            <button type="button" onClick={skipLeadIn} className="absolute left-3 top-2 z-10 min-h-11 cursor-pointer rounded-xl border border-ink-700 bg-ink-900/90 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">Pular contagem</button>
          </>
        )}
        {resume.secondsLeft !== null && !isCountingIn && (
          <>
            {/* Back from the options panel: a short count over the lane, taking no room, before the notes move again */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-amp-300" style={{ opacity: resumeOpacity(resume.secondsLeft) }}>
              <span className="text-sm font-semibold uppercase tracking-widest">Voltando</span>
              <span className="font-display text-[clamp(3rem,18vh,8rem)] font-bold leading-none">{resume.secondsLeft}</span>
            </div>
            <p role="status" className="sr-only">A música volta em {resume.secondsLeft}</p>
            <button type="button" onClick={() => { resume.cancel(); setIsPlaying(true); }} className="absolute left-3 top-2 z-10 min-h-11 cursor-pointer rounded-xl border border-ink-700 bg-ink-900/90 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">Continuar agora</button>
          </>
        )}
        {(!isAudioRunning || (isDuo && channelMode !== 'duo')) && <button onClick={() => void startAudio(undefined, isDuo ? 'duo' : undefined)} className="absolute right-3 top-2 min-h-11 cursor-pointer rounded-xl border border-signal-500/30 bg-ink-900/90 px-3 text-xs font-semibold text-signal-300">Conectar guitarra{isDuo ? 's' : ''}</button>}
        {/* Notices over the bottom of the lane: they come and go without moving it */}
        <div className="pointer-events-none absolute inset-x-3 bottom-2 z-10 flex flex-col gap-2 empty:hidden sm:inset-x-6">
          {showLegend && (
            <div role="note" className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-signal-500/30 bg-ink-900/95 py-2 pl-4 pr-2 shadow-panel [@media(max-height:40rem)]:hidden">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs leading-5 text-ink-200">{LEGEND_TEXT}</p>
                {appearance.techniques.show && appearance.techniques.legend && <TechniqueLegend compact />}
              </div>
              <button type="button" onClick={dismissLegend} className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-ink-700 bg-ink-800 px-3 text-xs font-semibold text-ink-200 transition hover:border-ink-500">Entendi</button>
            </div>
          )}
        </div>
      </main>
      {online && <div className="shrink-0 px-3 sm:px-6">{online.hud}</div>}
      <footer className="shrink-0 border-t border-ink-700 bg-ink-900 px-3 py-3 sm:px-6 [@media(max-height:45rem)]:py-1.5 short:flex short:items-center short:gap-3 short:py-1!">
        <div className="flex items-center gap-3 short:w-[42%] short:shrink-0">
          <button onClick={togglePlay} disabled={isOnline || ranked.isBusy} aria-busy={ranked.isBusy} aria-label={isPlaying ? 'Pausar' : 'Tocar'} aria-keyshortcuts="Space" title={lockedHint ?? (isPlaying ? 'Pausar (Espaço)' : 'Tocar (Espaço)')} className={'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-amp-400 text-ink-950 transition hover:bg-amp-300 ' + (isOnline ? 'disabled:cursor-not-allowed disabled:opacity-50' : 'disabled:cursor-wait disabled:opacity-70')}>{ranked.isBusy ? <Loader2 size={22} className="animate-spin" /> : isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
          <button onClick={restartRun} disabled={isOnline || ranked.isBusy} aria-label="Reiniciar música" title={lockedHint} className={toolClass}><RotateCcw size={18} /></button>
          <span className="font-mono text-xs text-ink-300">{formatClock(clockView.second * 1000)}</span>
          <input ref={sliderRef} aria-label="Posição da música" aria-valuetext={positionValueText(clockView.second, durationMs)} type="range" min={0} max={durationMs} defaultValue={0} disabled={isOnline || ranked.isOn} title={lockedHint} aria-describedby={lockedHelp}
            onChange={(event) => seekTo(Number(event.target.value))} className="h-11 min-w-0 flex-1 cursor-pointer accent-amp-400 disabled:cursor-not-allowed disabled:opacity-50" />
          <span className="font-mono text-xs text-ink-300">{formatClock(durationMs)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pb-1 [@media(max-height:45rem)]:mt-1 [@media(max-height:45rem)]:pb-0 short:relative short:[scrollbar-width:thin] short:mt-0! short:min-w-0 short:flex-1 short:flex-nowrap short:overflow-x-auto">
          {!isOnline && ranked.isAvailable && (ranked.phase === 'preparing'
            ? <span className={toolClass + ' max-sm:px-2'}><Loader2 size={16} className="animate-spin" aria-hidden="true" /><span>Conferindo<span className="max-2xl:sr-only"> o ranking</span>…</span></span>
            : ranked.isOn
              ? <span aria-describedby={lockedHelp} className={toolClass + ' max-sm:gap-1.5 max-sm:px-2 border-amp-400! text-amp-300!'}><Trophy size={16} aria-hidden="true" /><span>Valendo<span className="max-2xl:sr-only"> para o ranking</span></span></span>
              : <button onClick={() => hasAccount ? void toggleRanked() : openRankingAccount()} className={toolClass + ' max-sm:gap-1.5 max-sm:px-2'}>
                <Trophy size={16} aria-hidden="true" /><span>{!hasAccount ? <>Ranking<span className="max-2xl:sr-only">: entrar</span></> : ranked.notice?.tone === 'error' ? 'Tentar de novo' : <>Ranking<span className="max-2xl:sr-only">: ligar</span></>}</span>
              </button>)}
          {!isOnline && ranked.isAvailable && ranked.phase === 'ready' && ranked.notice?.tone === 'error' && (
            <button onClick={() => { ranked.controller.turnOff(); startPlaying(); }} className={toolClass}>Tocar sem ranking</button>
          )}
          {isExercise && !isOnline && (
            <button aria-pressed={isTraining} onClick={() => setIsTraining(!isTraining)} aria-describedby={isTraining ? trainingHelpId : undefined} className={toolClass + (isTraining ? ' border-signal-500! text-signal-300!' : '')}>
              <Repeat size={16} aria-hidden="true" /><span>Modo treino</span>{isTraining && <span className="font-mono">· volta {lap}</span>}
            </button>
          )}
          <GameScaleControls speed={speed} zoom={zoom} autoZoom={autoZoom} speedLocked={isOnline || ranked.isOn} lockedHint={lockedHint} lockedHelpId={lockedHelp}
            onSpeedChange={(value) => { changeSpeed(value); announceScale(`Velocidade ${formatScale(value)}`); }}
            onZoomChange={changeZoom} />
          <ToolButton label="Aparência" title={`Aparência rápida (${SHORTCUT_KEYS.appearance})`} icon={<Palette size={16} />} shortcut="appearance" hideLabelBelow="sm"
            disabled={!!runSummary} onClick={openAppearance} className="sm:ml-1" />
          <GameMoreSheet>{(close) => <>
            <ToolGroup label="Prática">
              <ToolButton label="Metrônomo" icon={<Clock size={16} />} pressed={metronomeEnabled} shortcut="metronome" onClick={() => setMetronomeEnabled(!metronomeEnabled)} />
              <ToolButton label="Som das notas" title={`Ouvir as notas da tab (${SHORTCUT_KEYS.notes})`} icon={synthAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} pressed={synthAudioEnabled} tone="signal" shortcut="notes"
                onClick={() => setSynthAudioEnabled(!synthAudioEnabled)} />
            </ToolGroup>
            <ToolGroup label="Som e guitarra">
              <ToolButton label="Áudio" title="Configurações de áudio" icon={<Sliders size={16} />} onClick={() => { close(); onOpenAudioSettings(); }} />
              <button aria-label={`${toneSettings ? AMP_PRESETS[toneSettings.preset]?.badge : 'Amp'}: abrir PRGB Amp`} onClick={() => { close(); onOpenAmpRack?.(); }} className={toolClass + ' text-amp-300!'}><Zap size={16} aria-hidden="true" /><span className="sm:hidden">Amp</span><span className="hidden max-w-28 truncate sm:inline">{toneSettings ? AMP_PRESETS[toneSettings.preset]?.badge : 'Amp'}</span></button>
              <ToolButton label="Ouvir minha guitarra" icon={toneSettings?.isMonitoringEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} pressed={toneSettings?.isMonitoringEnabled ?? false} tone="signal" hideLabelBelow="2xl"
                onClick={() => { if (ampEngine && toneSettings) ampEngine.setMonitoringEnabled(!toneSettings.isMonitoringEnabled); }} />
            </ToolGroup>
            <ToolGroup label="Ajuda e conta">
              <ToolButton label="Reportar problema" icon={<MessageSquareWarning size={16} />} hideLabelBelow="2xl" onClick={() => { close(); setFeedbackOpen(true); }} />
              {!isOnline && isRankingOn && <ToolButton label="Minha conta" title="Minha conta do ranking" icon={<UserRound size={16} />} hideLabelBelow="2xl" onClick={() => { close(); openRankingAccount(); }} />}
            </ToolGroup>
          </>}</GameMoreSheet>
        </div>
        {isTraining && <p id={trainingHelpId} className="text-xs leading-5 text-signal-200">O exercício recomeça sozinho. Desligue o modo treino para terminar no fim desta volta. Não conta como recorde.</p>}
        {!isOnline && ranked.isAvailable && (
          <div id={rankedHelpId} role="status" aria-live="polite" className="text-xs leading-5">
            {ranked.notice && <p className={ranked.notice.tone === 'error' ? 'text-miss' : 'text-near'}>{ranked.notice.text}</p>}
            {ranked.phase !== 'off' && <p className="text-amp-200">{RANKED_STATUS[ranked.phase]}</p>}
          </div>
        )}
      </footer>
      {appearanceLayer === 'quick' && (
        <QuickAppearancePanel onClose={closeAppearance} onOpenAll={() => setAppearanceLayer('full')} zoom={zoom} autoZoom={autoZoom} paused={!isOnline}
          onZoomChange={changeZoom} />
      )}
      {appearanceLayer === 'full' && (
        <ModalFrame titleId="game-appearance-title" onClose={closeAppearance}
          className="m-0! h-dvh max-h-none! w-full! max-w-none! overflow-hidden rounded-none! border-0! p-0! sm:p-0!">
          <LazyScreen label="a aparência" overlay onClose={closeAppearance}>
            <AppearanceScreen onExit={closeAppearance} exitLabel="Voltar à música" titleId="game-appearance-title" />
          </LazyScreen>
        </ModalFrame>
      )}
      {pendingLeave && (
        <ModalFrame titleId={leaveTitleId} onClose={() => setPendingLeave(null)} className="max-w-sm">
          <h2 id={leaveTitleId} className="font-display text-xl font-bold">{pendingLeave === 'end' ? 'Encerrar a sessão?' : 'Sair da partida?'}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-300">{pendingLeave === 'end' ? 'Os exercícios já feitos ficam no resumo. A jogada em andamento se perde.' : 'Seu progresso desta jogada se perde.'}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
            <button type="button" autoFocus onClick={() => setPendingLeave(null)} className="min-h-11 flex-1 cursor-pointer rounded-xl bg-amp-400 px-4 font-bold text-ink-950 transition hover:bg-amp-300">Continuar tocando</button>
            <button type="button" onClick={confirmLeave} className="min-h-11 flex-1 cursor-pointer rounded-xl border border-ink-700 px-4 text-sm text-ink-200 transition hover:border-ink-500">{pendingLeave === 'end' ? 'Encerrar sessão' : 'Sair'}</button>
          </div>
        </ModalFrame>
      )}
      {runSummary && <ModalFrame titleId="practice-result" onClose={() => resetRun(false)} selfOpened className={(isDuo ? 'max-w-xl' : 'max-w-md') + ' overflow-y-auto text-center'}>
        {session && <SessionStrip queue={session.queue} onEnd={session.onEnd} />}
        <ResultPanel titleId="practice-result" summary={runSummary} parts={lanes.map((lane) => lane.part)} names={isDuo ? names : null}
          challenge={challenge} initialShareOpen={devPreset?.shareOpen} ranked={ranked.submission} onRetryRanked={ranked.controller.retrySubmission}
          onPlayAgain={restartRun} onChooseSong={() => { resetRun(false); if (session) session.onEnd(); else onOpenSearch(); }} />
      </ModalFrame>}
    </div>
  );
};
