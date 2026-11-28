import { useCallback, useEffect, useEffectEvent, useState } from 'react';

export const RESUME_SECONDS = 3;
export const RESUME_TICK_MS = 1000;

// Closing a panel in the middle of a song gives the player a short count before the notes move again.
// It is fainter than the count-in of a new run: the player already has the song in their head.
export const RESUME_OPACITY_MAX = 0.55;
export const RESUME_OPACITY_MIN = 0.35;

export const resumeOpacity = (secondsLeft: number): number => {
  const share = Math.min(1, Math.max(0, secondsLeft / RESUME_SECONDS));
  return RESUME_OPACITY_MIN + (RESUME_OPACITY_MAX - RESUME_OPACITY_MIN) * share;
};

// 3 → 2 → 1 → null (play)
export const nextResumeStep = (secondsLeft: number): number | null => (secondsLeft > 1 ? secondsLeft - 1 : null);

export interface ResumeCountdown {
  secondsLeft: number | null;
  begin: () => void;
  cancel: () => void;
}

// UI timing only: the notes and the sounds keep their own clocks (the AudioContext), this just delays "play"
export const useResumeCountdown = (onDone: () => void): ResumeCountdown => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const done = useEffectEvent(onDone);
  useEffect(() => {
    if (secondsLeft === null) return;
    const timer = window.setTimeout(() => {
      const next = nextResumeStep(secondsLeft);
      setSecondsLeft(next);
      if (next === null) done();
    }, RESUME_TICK_MS);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);
  const begin = useCallback(() => setSecondsLeft(RESUME_SECONDS), []);
  const cancel = useCallback(() => setSecondsLeft(null), []);
  return { secondsLeft, begin, cancel };
};
