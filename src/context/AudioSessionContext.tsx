import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AudioEngine, type DetectedPitch, type InputChannelMode } from '../services/audioEngine';
import type { Tone3000AmpEngine } from '../services/tone3000Amp';
import { readPreferences, savePreferences } from './preferences';

export interface AudioSessionValue {
  audioEngine: AudioEngine;
  tone3000: Tone3000AmpEngine | null;
  isAudioRunning: boolean;
  getLatestPitch: () => DetectedPitch | null;
  selectedDeviceId: string;
  channelMode: InputChannelMode;
  startAudio: (deviceId?: string, mode?: InputChannelMode) => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;
  changeChannelMode: (mode: InputChannelMode) => Promise<void>;
}

interface PitchStore {
  getSnapshot: () => DetectedPitch | null;
  subscribe: (listener: () => void) => () => void;
  publish: (pitch: DetectedPitch | null) => void;
}

const PitchContext = createContext<PitchStore | null>(null);

const createPitchStore = (): PitchStore => {
  let latestPitch: DetectedPitch | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => latestPitch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (pitch) => {
      if (Object.is(latestPitch, pitch)) return;
      latestPitch = pitch;
      listeners.forEach((listener) => listener());
    }
  };
};

export const useLatestPitch = (): DetectedPitch | null => {
  const store = useContext(PitchContext);
  if (!store) throw new Error('useLatestPitch must be used within AudioSessionProvider');
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
};

const AudioSessionContext = createContext<AudioSessionValue | null>(null);

export const AudioSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioEngine] = useState(() => new AudioEngine());
  const [preferences] = useState(readPreferences);
  const initializedAmp = useRef<Tone3000AmpEngine | null>(null);

  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [pitchStore] = useState(createPitchStore);
  const [selectedDeviceId, setSelectedDeviceId] = useState(preferences.deviceId);
  const [channelMode, setChannelMode] = useState<InputChannelMode>(preferences.channelMode);
  const [tone3000, setTone3000] = useState<Tone3000AmpEngine | null>(null);

  const startAudio = useCallback(
    async (deviceId = selectedDeviceId, mode = channelMode) => {
      try {
        await audioEngine.start(deviceId, mode, pitchStore.publish);
        const amp = audioEngine.getTone3000();
        if (amp && initializedAmp.current !== amp) {
          const settings = readPreferences().tone3000 ?? preferences.tone3000;
          if (settings) {
            amp.setMonitoringEnabled(false);
            amp.setPreset(settings.preset);
            amp.setGain(settings.gain);
            amp.setBass(settings.bass);
            amp.setMid(settings.mid);
            amp.setTreble(settings.treble);
            amp.setPresence(settings.presence);
            amp.setMasterVolume(settings.masterVolume);
            amp.setGateThreshold(settings.gateThreshold);
            amp.setReverbMix(settings.reverbMix);
            amp.setCabSim(settings.cabSim);
            amp.setMonitoringEnabled(settings.isMonitoringEnabled);
          }
          initializedAmp.current = amp;
        }
        setSelectedDeviceId(deviceId);
        setChannelMode(mode);
        setTone3000(amp);
        setIsAudioRunning(true);
      } catch (err) {
        console.error('Failed to start audio engine:', err);
        alert('Permissão de microfone/áudio necessária para escutar a interface.');
      }
    },
    [audioEngine, selectedDeviceId, channelMode, preferences, pitchStore]
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

  useEffect(() => {
    savePreferences({ deviceId: selectedDeviceId, channelMode });
  }, [selectedDeviceId, channelMode]);

  useEffect(() => {
    if (!tone3000) return;
    savePreferences({ tone3000: tone3000.getSettings() });
    return tone3000.subscribe((settings) => savePreferences({ tone3000: settings }));
  }, [tone3000]);

  const value = useMemo<AudioSessionValue>(
    () => ({
      audioEngine,
      tone3000,
      isAudioRunning,
      getLatestPitch: pitchStore.getSnapshot,
      selectedDeviceId,
      channelMode,
      startAudio,
      changeDevice,
      changeChannelMode
    }),
    [audioEngine, tone3000, isAudioRunning, pitchStore, selectedDeviceId, channelMode, startAudio, changeDevice, changeChannelMode]
  );

  return (
    <AudioSessionContext.Provider value={value}>
      <PitchContext.Provider value={pitchStore}>{children}</PitchContext.Provider>
    </AudioSessionContext.Provider>
  );
};

export const useAudioSession = (): AudioSessionValue => {
  const ctx = useContext(AudioSessionContext);
  if (!ctx) throw new Error('useAudioSession must be used within AudioSessionProvider');
  return ctx;
};
