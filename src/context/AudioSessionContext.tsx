import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AudioEngine, type DetectedPitch, type InputChannelMode } from '../services/audioEngine';
import type { Tone3000AmpEngine } from '../services/tone3000Amp';

export interface AudioSessionValue {
  audioEngine: AudioEngine;
  tone3000: Tone3000AmpEngine | null;
  isAudioRunning: boolean;
  latestPitch: DetectedPitch | null;
  selectedDeviceId: string;
  channelMode: InputChannelMode;
  startAudio: (deviceId?: string, mode?: InputChannelMode) => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;
  changeChannelMode: (mode: InputChannelMode) => Promise<void>;
}

const AudioSessionContext = createContext<AudioSessionValue | null>(null);

export const AudioSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioEngine] = useState(() => new AudioEngine());

  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [latestPitch, setLatestPitch] = useState<DetectedPitch | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [channelMode, setChannelMode] = useState<InputChannelMode>('ch1');
  const [tone3000, setTone3000] = useState<Tone3000AmpEngine | null>(null);

  const startAudio = useCallback(
    async (deviceId = selectedDeviceId, mode = channelMode) => {
      try {
        await audioEngine.start(deviceId, mode, setLatestPitch);
        setTone3000(audioEngine.getTone3000());
        setIsAudioRunning(true);
      } catch (err) {
        console.error('Failed to start audio engine:', err);
        alert('Permissão de microfone/áudio necessária para escutar a interface.');
      }
    },
    [audioEngine, selectedDeviceId, channelMode]
  );

  const changeDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (isAudioRunning) await startAudio(deviceId, channelMode);
    },
    [isAudioRunning, channelMode, startAudio]
  );

  const changeChannelMode = useCallback(
    async (mode: InputChannelMode) => {
      setChannelMode(mode);
      if (isAudioRunning) await startAudio(selectedDeviceId, mode);
    },
    [isAudioRunning, selectedDeviceId, startAudio]
  );

  useEffect(() => () => void audioEngine.dispose(), [audioEngine]);

  const value = useMemo<AudioSessionValue>(
    () => ({
      audioEngine,
      tone3000,
      isAudioRunning,
      latestPitch,
      selectedDeviceId,
      channelMode,
      startAudio,
      changeDevice,
      changeChannelMode
    }),
    [audioEngine, tone3000, isAudioRunning, latestPitch, selectedDeviceId, channelMode, startAudio, changeDevice, changeChannelMode]
  );

  return <AudioSessionContext.Provider value={value}>{children}</AudioSessionContext.Provider>;
};

export const useAudioSession = (): AudioSessionValue => {
  const ctx = useContext(AudioSessionContext);
  if (!ctx) throw new Error('useAudioSession must be used within AudioSessionProvider');
  return ctx;
};
