// Thin layer between the game and the pure progress logic (services/progress.ts): load, apply, save.
// Everything stays in this browser. Only a solo run counts; the caller names the mode so the rule lives here.
import { loadProgress, recordEvent, recordRun, saveProgress, setWeeklyGoal, type FinishedRun, type Progress, type RunReport, type WeeklyGoal } from '../services/progress';

export type ProgressMode = 'solo' | 'duo' | 'online' | 'preview';

export interface RunProgress {
  report: RunReport;
  countedMs: number; // rehearsal time this run added
}

/**
 * Saves a finished run into the player's progress and returns what changed. Duo (two people in one browser),
 * online and DEV previews never touch it: they return undefined.
 */
export function recordRunProgress(mode: ProgressMode, run: FinishedRun, now: number, storage?: Storage): RunProgress | undefined {
  if (mode !== 'solo') return undefined;
  const before = loadProgress(storage);
  const { progress, report } = recordRun(before, run, now);
  saveProgress(progress, storage);
  return { report, countedMs: progress.totals.practiceMs - before.totals.practiceMs };
}

// The latency test saved its adjustment: unlocks that pick once. Returns the ids unlocked now.
export function recordLatencyTestSaved(now: number, storage?: Storage): string[] {
  const { progress, unlocked } = recordEvent(loadProgress(storage), { type: 'latencyTestSaved' }, now);
  if (unlocked.length > 0) saveProgress(progress, storage);
  return unlocked;
}

export const formatCountedTime = (ms: number): string => {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  if (seconds < 60) return 'menos de 1 minuto';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
};

// The weekly goal chosen on the progress screen: saved on its own, so a run finishing later reads it back
export function saveWeeklyGoal(goal: WeeklyGoal | null, storage?: Storage): Progress {
  const next = setWeeklyGoal(loadProgress(storage), goal);
  saveProgress(next, storage);
  return next;
}
