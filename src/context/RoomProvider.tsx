import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { createRoom, joinRoom, normalizeRoomCode } from '../services/backend/roomChannel';
import { RoomController } from './room';
import { RoomContext } from './useRoom';
import type { RoomValue } from './useRoom';

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [controller] = useState(() => new RoomController());

  const subscribe = useCallback(
    (listener: () => void) => controller.subscribe(listener),
    [controller],
  );
  const getSnapshot = useCallback(() => controller.getState(), [controller]);

  const state = useSyncExternalStore(subscribe, getSnapshot);

  const openRoom = useCallback(async (nickname: string) => {
    const handle = await createRoom();
    controller.attach(handle, nickname);
  }, [controller]);

  const enterRoom = useCallback(async (code: string, nickname: string) => {
    const handle = await joinRoom(code);
    controller.attach(handle, nickname);
  }, [controller]);

  const leaveRoom = useCallback(() => controller.leave(), [controller]);

  const value = useMemo<RoomValue>(() => ({
    state,
    controller,
    openRoom,
    enterRoom,
    parseCode: normalizeRoomCode,
    leaveRoom,
  }), [state, controller, openRoom, enterRoom, leaveRoom]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
