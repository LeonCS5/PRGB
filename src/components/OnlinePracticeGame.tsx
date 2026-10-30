// PracticeGame for an online duo: one player's part on this computer, the partner only as numbers.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PracticeGame, type OnlineProgress, type OnlineRun } from './PracticeGame';
import { OnlineHud } from './OnlineHud';
import { OnlineResultPanel } from './OnlineResultPanel';
import { useRoom } from '../context/useRoom';
import { matchOutcome, teamScore } from '../context/room';
import { getRoomErrorByCode } from '../context/uiErrors';
import type { GamePart, RunSummary } from '../context/gameSession';
import { PROGRESS_INTERVAL_MS } from '../services/backend/roomChannel';
import { accuracyPercent } from '../services/scoring';
import type { Tone3000AmpEngine } from '../services/tone3000Amp';

export interface OnlinePracticeGameProps {
  myPart: GamePart;
  partnerName: string;
  startAtMs: number;
  onOpenAudioSettings: () => void;
  onExit: () => void;
  onBackToRoom: () => void;
  tone3000?: Tone3000AmpEngine | null;
  onOpenTone3000Rack?: () => void;
}

const secondsUntil = (startAtMs: number) => Math.ceil((startAtMs - Date.now()) / 1000);

const Countdown: React.FC<{ startAtMs: number }> = ({ startAtMs }) => {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(startAtMs));

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const left = secondsUntil(startAtMs);
      setSecondsLeft(left);
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startAtMs]);

  if (secondsLeft <= 0) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center bg-ink-950/60">
      <p className="text-sm font-semibold text-ink-200">Prepare-se</p>
      <p className="font-display text-8xl font-bold text-amp-300">{secondsLeft}</p>
    </div>
  );
};

export const OnlinePracticeGame: React.FC<OnlinePracticeGameProps> = ({
  myPart,
  partnerName,
  startAtMs,
  onOpenAudioSettings,
  onExit,
  onBackToRoom,
  tone3000,
  onOpenTone3000Rack,
}) => {
  const { state, controller, leaveRoom } = useRoom();
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const lastSentPositionRef = useRef(-Infinity);

  const handleProgress = useCallback((progress: OnlineProgress) => {
    if (progress.finished || progress.positionMs - lastSentPositionRef.current >= PROGRESS_INTERVAL_MS) {
      lastSentPositionRef.current = progress.positionMs;
      controller.sendProgress({ type: 'progress', ...progress });
    }
    controller.notifyMyScore(progress.score);
  }, [controller]);

  const exit = () => {
    void leaveRoom();
    onExit();
  };

  const backToRoom = () => {
    controller.backToLobby();
    onBackToRoom();
  };

  const team = teamScore(state);
  const notice = state.phase === 'closed'
    ? 'Sala encerrada'
    : state.error
      ? getRoomErrorByCode(state.error)
      : state.peer?.online ? null : 'Parceiro desconectado';

  const online = useMemo<OnlineRun>(() => ({
    startAtMs,
    onProgress: handleProgress,
    onFinished: setSummary,
    hud: (
      <OnlineHud partnerProgress={state.partnerProgress} teamScore={team} partnerName={partnerName}
        durationMs={myPart.tab.totalDurationMs} notice={notice} />
    ),
  }), [startAtMs, handleProgress, state.partnerProgress, team, partnerName, myPart, notice]);

  const myRun = summary?.scores[0];

  return (
    <div className="h-dvh w-full">
      <PracticeGame parts={[myPart]} playerNames={null} challenge={null} onOpenSearch={() => undefined} onExit={exit}
        onOpenAudioSettings={onOpenAudioSettings} tone3000={tone3000} onOpenTone3000Rack={onOpenTone3000Rack} online={online} />
      <Countdown startAtMs={startAtMs} />
      {myRun && (
        <OnlineResultPanel myScore={myRun.score} myAccuracy={accuracyPercent(myRun)} partnerName={partnerName}
          partnerProgress={state.partnerProgress} teamScore={team} outcome={matchOutcome(state)}
          isRoomActive={state.phase === 'match'} onBackToRoom={backToRoom} onExit={exit} />
      )}
    </div>
  );
};
