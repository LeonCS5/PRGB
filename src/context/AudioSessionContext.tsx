import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { audioDeviceName, isSystemAlias, pickInstrumentInput, pickMonitorOutput, type AudioOptions } from '../services/audioDevices';
import { AudioEngine, type ActiveAudioInput, type DetectedPitch, type InputChannelMode, type PlayerSlot } from '../services/audioEngine';
import type { AmpEngine } from '../services/ampEngine';
import { readPreferences, savePreferences } from './preferences';
import { getAudioErrorMessage } from './uiErrors';

// The output was feeding the input: 'moved' to other speakers, or 'muted' when there is no safe place to go
export type AudioRouteAlert = { kind: 'moved'; outputName: string } | { kind: 'muted' };

export interface AudioSessionValue {
  audioEngine: AudioEngine;
  ampEngine: AmpEngine | null;
  isAudioRunning: boolean;
  audioError: string | null;
  dismissAudioError: () => void;
  getLatestPitch: (player?: PlayerSlot) => DetectedPitch | null;
  // Duo: frames since the last start in which both guitars had a detected note (capped at 1000)
  getDuoFramesBothPlaying: () => number;
  selectedDeviceId: string;
  activeInput: ActiveAudioInput | null;
  outputDeviceId: string;
  outputName: string; // what is playing, so that a wrong route can be seen at a glance
  routeAlert: AudioRouteAlert | null;
  channelMode: InputChannelMode;
  audioOptions: AudioOptions;
  startAudio: (deviceId?: string, mode?: InputChannelMode) => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;
  changeOutputDevice: (deviceId: string) => Promise<boolean>;
  changeChannelMode: (mode: InputChannelMode) => Promise<void>;
  changeAudioOptions: (changes: Partial<AudioOptions>) => Promise<void>;
}

// Latest pitch per player: single-player modes only use slot 0, duo mode fills both
interface PitchStore {
  getSnapshot: (player?: PlayerSlot) => DetectedPitch | null;
  subscribe: (listener: () => void) => () => void;
  publish: (pitch: DetectedPitch | null, player?: PlayerSlot) => void;
  getBothPlayingFrames: () => number;
  resetBothPlayingFrames: () => void;
}

const BOTH_PLAYING_FRAMES_MAX = 1000;

const PitchContext = createContext<PitchStore | null>(null);

const createPitchStore = (): PitchStore => {
  const latestPitch: [DetectedPitch | null, DetectedPitch | null] = [null, null];
  const listeners = new Set<() => void>();
  let bothPlayingFrames = 0;
  return {
    getSnapshot: (player = 0) => latestPitch[player],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (pitch, player = 0) => {
      if (Object.is(latestPitch[player], pitch)) return;
      latestPitch[player] = pitch;
      // The engine reports player 1 right after player 0 in each frame
      if (player === 1 && pitch && latestPitch[0]) bothPlayingFrames = Math.min(bothPlayingFrames + 1, BOTH_PLAYING_FRAMES_MAX);
      listeners.forEach((listener) => listener());
    },
    getBothPlayingFrames: () => bothPlayingFrames,
    resetBothPlayingFrames: () => { bothPlayingFrames = 0; }
  };
};

export const useLatestPitch = (player: PlayerSlot = 0): DetectedPitch | null => {
  const store = useContext(PitchContext);
  if (!store) throw new Error('useLatestPitch must be used within AudioSessionProvider');
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot(player));
};

const AudioSessionContext = createContext<AudioSessionValue | null>(null);

export const AudioSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences] = useState(readPreferences);
  const [audioEngine] = useState(() => new AudioEngine(preferences.audioOptions));
  const initializedAmp = useRef<AmpEngine | null>(null);

  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const dismissAudioError = useCallback(() => setAudioError(null), []);
  const [pitchStore] = useState(createPitchStore);
  const [selectedDeviceId, setSelectedDeviceId] = useState(preferences.deviceId);
  const [channelMode, setChannelMode] = useState<InputChannelMode>(preferences.channelMode);
  const [ampEngine, setAmpEngine] = useState<AmpEngine | null>(null);
  const [activeInput, setActiveInput] = useState<ActiveAudioInput | null>(null);
  const [outputDeviceId, setOutputDeviceId] = useState(preferences.outputDeviceId);
  const [outputName, setOutputName] = useState('');
  const [routeAlert, setRouteAlert] = useState<AudioRouteAlert | null>(null);
  const [audioOptions, setAudioOptions] = useState(preferences.audioOptions);

  const refreshOutputName = useCallback(async (deviceId: string) => {
    const outputs = await audioEngine.getAudioOutputDevices();
    // Firefox doesn't say which output is the default one
    const playing = outputs.find((device) => device.deviceId === (deviceId || 'default'));
    setOutputName(playing ? audioDeviceName(playing.label) : '');
  }, [audioEngine]);

  // Nothing was chosen yet and the system's default input is usually the computer's microphone
  const findInstrumentInput = useCallback(async () => {
    if (audioEngine.getSelectedDeviceId() || readPreferences().inputChosen) return null;
    await audioEngine.unlockDeviceLabels();
    return pickInstrumentInput(await audioEngine.getAudioInputDevices());
  }, [audioEngine]);

  const startAudio = useCallback(
    async (deviceId = selectedDeviceId, mode = channelMode) => {
      setAudioError(null);
      try {
        pitchStore.resetBothPlayingFrames();
        const output = readPreferences().outputDeviceId;
        if (!await audioEngine.setOutputDevice(output)) {
          setOutputDeviceId('');
          savePreferences({ outputDeviceId: '' });
        }
        // Before anything is opened: the computer's microphone must not reach the amp, not even for a moment
        const known = deviceId ? null : await findInstrumentInput();
        await audioEngine.start(known?.deviceId ?? deviceId, mode, pitchStore.publish);
        // Player 2 only exists in duo mode; don't leave its last note behind
        if (mode !== 'duo') pitchStore.publish(null, 1);
        const amp = audioEngine.getAmp();
        if (amp && initializedAmp.current !== amp) {
          const settings = readPreferences().ampEngine ?? preferences.ampEngine;
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
        setSelectedDeviceId(audioEngine.getSelectedDeviceId());
        setActiveInput(audioEngine.getActiveInput());
        void refreshOutputName(readPreferences().outputDeviceId);
        setChannelMode(mode);
        setAmpEngine(amp);
        setIsAudioRunning(true);
      } catch (err) {
        setIsAudioRunning(false);
        pitchStore.publish(null, 0);
        pitchStore.publish(null, 1);
        setAudioError(getAudioErrorMessage(err));
      }
    },
    [audioEngine, selectedDeviceId, channelMode, preferences, pitchStore, findInstrumentInput, refreshOutputName]
  );

  const changeDevice = useCallback(
    async (deviceId: string) => {
      savePreferences({ inputChosen: true });
      setSelectedDeviceId(deviceId);
      if (isAudioRunning) await startAudio(deviceId, channelMode);
    },
    [isAudioRunning, channelMode, startAudio]
  );

  const changeOutputDevice = useCallback(
    async (deviceId: string) => {
      const id = isSystemAlias(deviceId) ? '' : deviceId;
      setRouteAlert(null);
      const applied = await audioEngine.setOutputDevice(id);
      const saved = applied ? audioEngine.getOutputDeviceId() : '';
      savePreferences({ outputDeviceId: saved });
      setOutputDeviceId(saved);
      await refreshOutputName(saved);
      return applied;
    },
    [audioEngine, refreshOutputName]
  );

  useEffect(() => {
    audioEngine.setFeedbackListener(() => {
      const moveAway = async () => {
        const input = audioEngine.getActiveInput() ?? { label: '', groupId: '' };
        // A chosen output is the player's call: it stays, silent, until they pick another
        const target = readPreferences().outputDeviceId
          ? null
          : pickMonitorOutput(await audioEngine.getAudioOutputDevices(), input);
        const moved = target && target.deviceId !== audioEngine.getOutputDeviceId() && await changeOutputDevice(target.deviceId);
        setRouteAlert(moved && target ? { kind: 'moved', outputName: audioDeviceName(target.label) } : { kind: 'muted' });
      };
      void moveAway();
    });
    return () => audioEngine.setFeedbackListener(null);
  }, [audioEngine, changeOutputDevice]);

  const changeChannelMode = useCallback(
    async (mode: InputChannelMode) => {
      setChannelMode(mode);
      if (isAudioRunning) await startAudio(selectedDeviceId, mode);
    },
    [isAudioRunning, selectedDeviceId, startAudio]
  );

  const changeAudioOptions = useCallback(
    async (changes: Partial<AudioOptions>) => {
      const next = { ...readPreferences().audioOptions, ...changes };
      setAudioOptions(next);
      savePreferences({ audioOptions: next });
      const restart = await audioEngine.setAudioOptions(next);
      if (restart && isAudioRunning) await startAudio(selectedDeviceId, channelMode);
    },
    [audioEngine, isAudioRunning, selectedDeviceId, channelMode, startAudio]
  );

  useEffect(() => () => void audioEngine.dispose(), [audioEngine]);

  // Duo is a temporary session mode: the saved channel stays the one to go back to afterwards
  useEffect(() => {
    savePreferences(channelMode === 'duo' ? { deviceId: selectedDeviceId } : { deviceId: selectedDeviceId, channelMode });
  }, [selectedDeviceId, channelMode]);

  useEffect(() => {
    if (!ampEngine) return;
    savePreferences({ ampEngine: ampEngine.getSettings() });
    return ampEngine.subscribe((settings) => savePreferences({ ampEngine: settings }));
  }, [ampEngine]);

  const value = useMemo<AudioSessionValue>(
    () => ({
      audioEngine,
      ampEngine,
      isAudioRunning,
      audioError,
      dismissAudioError,
      getLatestPitch: pitchStore.getSnapshot,
      getDuoFramesBothPlaying: pitchStore.getBothPlayingFrames,
      selectedDeviceId,
      activeInput,
      outputDeviceId,
      outputName,
      routeAlert,
      channelMode,
      audioOptions,
      startAudio,
      changeDevice,
      changeOutputDevice,
      changeChannelMode,
      changeAudioOptions
    }),
    [audioEngine, ampEngine, isAudioRunning, audioError, dismissAudioError, pitchStore, selectedDeviceId, activeInput, outputDeviceId, outputName, routeAlert, channelMode, startAudio, changeDevice, changeOutputDevice, changeChannelMode, audioOptions, changeAudioOptions]
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
