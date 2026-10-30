// Hook and context accessor for the online room.
// Separated from RoomProvider.tsx so that the .tsx file exports only the React component
// (required by react/only-export-components lint rule).

import { createContext, useContext } from 'react';
import type { RoomController, RoomState } from './room';

export interface RoomValue {
  state: RoomState;
  controller: RoomController;
  /** Creates a new room. Rejects with RoomError. */
  openRoom: (nickname: string) => Promise<void>;
  /** Joins an existing room by code. Rejects with RoomError. */
  enterRoom: (code: string, nickname: string) => Promise<void>;
  /** Validates a typed code and returns the normalized version, or null. */
  parseCode: (input: string) => string | null;
  /** Leaves (or closes) the current room. */
  leaveRoom: () => Promise<void>;
}

export const RoomContext = createContext<RoomValue | null>(null);

export const useRoom = (): RoomValue => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
};
