// TONE3000 Low-Latency Guitar Amp Modeler & Monitoring DSP Engine
// Provides real-time guitar sound with tube preamp emulation, multi-stage cabinet filtering,
// 4-band tone stack EQ, downward expander noise gate, and studio room ambience.

export type AmpPresetId = 'metal' | 'crunch' | 'clean' | 'lead' | 'acoustic' | 'direct_di';
export type CabSimType = '4x12_vintage' | '2x12_british' | '1x12_tweed' | '4x12_metal' | 'bypass';

export interface Tone3000Settings {
  isMonitoringEnabled: boolean; // Main guitar sound monitoring toggle
  preset: AmpPresetId;
  gain: number; // 0 to 100
  bass: number; // -12 to +12 dB
  mid: number; // -12 to +12 dB
  treble: number; // -12 to +12 dB
  presence: number; // -12 to +12 dB
  masterVolume: number; // 0 to 1 (0 to 100%)
  gateThreshold: number; // -80 to -20 dB
  reverbMix: number; // 0 to 1
  cabSim: CabSimType;
}

export const TONE3000_DEFAULT_SETTINGS: Tone3000Settings = {
  isMonitoringEnabled: true,
  preset: 'metal',
  gain: 65,
  bass: 2,
  mid: -1,
  treble: 3,
  presence: 4,
  masterVolume: 0.75,
  gateThreshold: -45,
  reverbMix: 0.15,
  cabSim: '4x12_metal'
};

export const AMP_PRESETS: Record<AmpPresetId, {
  name: string;
  tagline: string;
  badge: string;
  settings: Partial<Tone3000Settings>;
}> = {
  metal: {
    name: 'TONE3000 Modern Metal',
    tagline: 'Alto ganho agressivo, graves potentes e médios focados para riffs pesados',
    badge: '⚡ Metal High-Gain',
    settings: {
      gain: 75,
      bass: 3.5,
      mid: -1.5,
      treble: 3.0,
      presence: 4.5,
      cabSim: '4x12_metal',
      reverbMix: 0.12,
      gateThreshold: -42
    }
  },
  crunch: {
    name: 'British Plexi Crunch',
    tagline: 'Overdrive clássico valvulado com dinâmica rica para rock clássico e blues',
    badge: '🔥 British Crunch',
    settings: {
      gain: 45,
      bass: 1.5,
      mid: 2.0,
      treble: 2.5,
      presence: 3.0,
      cabSim: '2x12_british',
      reverbMix: 0.18,
      gateThreshold: -50
    }
  },
  clean: {
    name: 'California Clean Deluxe',
    tagline: 'Som cristalino, brilhante e quente com headroom amplo',
    badge: '🎸 Clean Deluxe',
    settings: {
      gain: 20,
      bass: 1.0,
      mid: 0.5,
      treble: 3.5,
      presence: 3.0,
      cabSim: '1x12_tweed',
      reverbMix: 0.25,
      gateThreshold: -58
    }
  },
  lead: {
    name: 'Liquid Solo Lead',
    tagline: 'Sustain infinito, compressão suave e harmônicos cantantes para solos',
    badge: '🚀 Solo Lead',
    settings: {
      gain: 80,
      bass: 2.0,
      mid: 4.0,
      treble: 2.0,
      presence: 3.5,
      cabSim: '4x12_vintage',
      reverbMix: 0.28,
      gateThreshold: -46
    }
  },
  acoustic: {
    name: 'Acoustic Simulator',
    tagline: 'Simulação de ressonância acústica para violão ou captadores piezo',
    badge: '🌿 Acústico / Piezo',
    settings: {
      gain: 15,
      bass: 4.0,
      mid: -3.0,
      treble: 5.0,
      presence: 4.0,
      cabSim: '1x12_tweed',
      reverbMix: 0.22,
      gateThreshold: -60
    }
  },
  direct_di: {
    name: 'Direct Monitor (Raw DI)',
    tagline: 'Sinal 100% puro e sem processamento direto da interface de áudio',
    badge: '🔌 Direct Clean (DI)',
    settings: {
      gain: 30,
      bass: 0,
      mid: 0,
      treble: 0,
      presence: 0,
      cabSim: 'bypass',
      reverbMix: 0,
      gateThreshold: -70
    }
  }
};

export class Tone3000AmpEngine {
  private ctx: AudioContext;
  private settings: Tone3000Settings = { ...TONE3000_DEFAULT_SETTINGS };

  // Nodes
  public inputNode: GainNode;
  private gateGainNode: GainNode;
  private preGainNode: GainNode;
  private waveShaperNode: WaveShaperNode;
  private toneBassNode: BiquadFilterNode;
  private toneMidNode: BiquadFilterNode;
  private toneTrebleNode: BiquadFilterNode;
  private tonePresenceNode: BiquadFilterNode;
  
  // Cabinet filters (Multi-pole speaker simulation)
  private cabSubCutNode: BiquadFilterNode;
  private cabResonanceNode: BiquadFilterNode;
  private cabLowPass1Node: BiquadFilterNode;
  private cabLowPass2Node: BiquadFilterNode;
  private cabMidScoopNode: BiquadFilterNode;
  private cabDryGainNode: GainNode;
  private cabWetGainNode: GainNode;

  // Reverb / Ambience
  private reverbNode: ConvolverNode;
  private reverbWetGainNode: GainNode;
  private reverbDryGainNode: GainNode;

  // Output
  private masterGainNode: GainNode;
  private outputAnalyserNode: AnalyserNode;

  // State
  private isGateOpen = true;
  private listeners: Array<(settings: Tone3000Settings) => void> = [];

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;

    // 1. Input Gain & Gate
    this.inputNode = this.ctx.createGain();
    this.inputNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.gateGainNode = this.ctx.createGain();
    this.gateGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // 2. Preamp Gain Stage
    this.preGainNode = this.ctx.createGain();
    this.preGainNode.gain.setValueAtTime(this.calculatePreGain(this.settings.gain), this.ctx.currentTime);

    // 3. Tube Saturation / Non-Linear WaveShaper
    this.waveShaperNode = this.ctx.createWaveShaper();
    this.waveShaperNode.oversample = '4x';
    this.waveShaperNode.curve = this.createDistortionCurve(this.settings.gain, this.settings.preset);

    // 4. Tone Stack 4-Band Equalizer
    // Bass (Low Shelf @ 110Hz)
    this.toneBassNode = this.ctx.createBiquadFilter();
    this.toneBassNode.type = 'lowshelf';
    this.toneBassNode.frequency.setValueAtTime(110, this.ctx.currentTime);
    this.toneBassNode.gain.setValueAtTime(this.settings.bass, this.ctx.currentTime);

    // Mid (Peaking @ 750Hz, Q=1.2)
    this.toneMidNode = this.ctx.createBiquadFilter();
    this.toneMidNode.type = 'peaking';
    this.toneMidNode.frequency.setValueAtTime(750, this.ctx.currentTime);
    this.toneMidNode.Q.setValueAtTime(1.2, this.ctx.currentTime);
    this.toneMidNode.gain.setValueAtTime(this.settings.mid, this.ctx.currentTime);

    // Treble (High Shelf @ 2800Hz)
    this.toneTrebleNode = this.ctx.createBiquadFilter();
    this.toneTrebleNode.type = 'highshelf';
    this.toneTrebleNode.frequency.setValueAtTime(2800, this.ctx.currentTime);
    this.toneTrebleNode.gain.setValueAtTime(this.settings.treble, this.ctx.currentTime);

    // Presence (Peaking @ 4500Hz, Q=1.5)
    this.tonePresenceNode = this.ctx.createBiquadFilter();
    this.tonePresenceNode.type = 'peaking';
    this.tonePresenceNode.frequency.setValueAtTime(4500, this.ctx.currentTime);
    this.tonePresenceNode.Q.setValueAtTime(1.5, this.ctx.currentTime);
    this.tonePresenceNode.gain.setValueAtTime(this.settings.presence, this.ctx.currentTime);

    // 5. Cabinet Simulation Filter Chain
    // Sub cut (removes unwanted infrasonic sub-bass mud below 70Hz)
    this.cabSubCutNode = this.ctx.createBiquadFilter();
    this.cabSubCutNode.type = 'highpass';
    this.cabSubCutNode.frequency.setValueAtTime(70, this.ctx.currentTime);

    // Cab thump / low-end closed-back resonance @ 100Hz
    this.cabResonanceNode = this.ctx.createBiquadFilter();
    this.cabResonanceNode.type = 'peaking';
    this.cabResonanceNode.frequency.setValueAtTime(100, this.ctx.currentTime);
    this.cabResonanceNode.Q.setValueAtTime(1.6, this.ctx.currentTime);
    this.cabResonanceNode.gain.setValueAtTime(4.0, this.ctx.currentTime);

    // Speaker cone midrange character
    this.cabMidScoopNode = this.ctx.createBiquadFilter();
    this.cabMidScoopNode.type = 'peaking';
    this.cabMidScoopNode.frequency.setValueAtTime(3200, this.ctx.currentTime);
    this.cabMidScoopNode.Q.setValueAtTime(2.2, this.ctx.currentTime);
    this.cabMidScoopNode.gain.setValueAtTime(2.5, this.ctx.currentTime);

    // 2-pole steep lowpass rolloff (guitar speaker cutoff @ 4800Hz)
    this.cabLowPass1Node = this.ctx.createBiquadFilter();
    this.cabLowPass1Node.type = 'lowpass';
    this.cabLowPass1Node.frequency.setValueAtTime(4800, this.ctx.currentTime);
    this.cabLowPass1Node.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.cabLowPass2Node = this.ctx.createBiquadFilter();
    this.cabLowPass2Node.type = 'lowpass';
    this.cabLowPass2Node.frequency.setValueAtTime(5400, this.ctx.currentTime);
    this.cabLowPass2Node.Q.setValueAtTime(0.707, this.ctx.currentTime);

    this.cabWetGainNode = this.ctx.createGain();
    this.cabWetGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.cabDryGainNode = this.ctx.createGain();
    this.cabDryGainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // 6. Studio Room Ambience Reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.buildRoomImpulseResponse(this.ctx);

    this.reverbWetGainNode = this.ctx.createGain();
    this.reverbWetGainNode.gain.setValueAtTime(this.settings.reverbMix, this.ctx.currentTime);

    this.reverbDryGainNode = this.ctx.createGain();
    this.reverbDryGainNode.gain.setValueAtTime(1.0 - this.settings.reverbMix * 0.4, this.ctx.currentTime);

    // 7. Master Output & Monitoring
    this.masterGainNode = this.ctx.createGain();
    const initialMaster = this.settings.isMonitoringEnabled ? this.settings.masterVolume : 0.0;
    this.masterGainNode.gain.setValueAtTime(initialMaster, this.ctx.currentTime);

    this.outputAnalyserNode = this.ctx.createAnalyser();
    this.outputAnalyserNode.fftSize = 512;

    // Connect Signal Chain:
    // Input -> Gate -> PreGain -> WaveShaper -> ToneStack (Bass -> Mid -> Treble -> Presence)
    this.inputNode.connect(this.gateGainNode);
    this.gateGainNode.connect(this.preGainNode);
    this.preGainNode.connect(this.waveShaperNode);
    this.waveShaperNode.connect(this.toneBassNode);
    this.toneBassNode.connect(this.toneMidNode);
    this.toneMidNode.connect(this.toneTrebleNode);
    this.toneTrebleNode.connect(this.tonePresenceNode);

    // ToneStack splits to:
    // 1) Cab Wet Filter Chain (SubCut -> Resonance -> MidScoop -> LowPass1 -> LowPass2 -> CabWetGain)
    this.tonePresenceNode.connect(this.cabSubCutNode);
    this.cabSubCutNode.connect(this.cabResonanceNode);
    this.cabResonanceNode.connect(this.cabMidScoopNode);
    this.cabMidScoopNode.connect(this.cabLowPass1Node);
    this.cabLowPass1Node.connect(this.cabLowPass2Node);
    this.cabLowPass2Node.connect(this.cabWetGainNode);

    // 2) Cab Dry (Bypass route)
    this.tonePresenceNode.connect(this.cabDryGainNode);

    // Cabinet output connects to Reverb Stage (Wet + Dry)
    this.cabWetGainNode.connect(this.reverbDryGainNode);
    this.cabWetGainNode.connect(this.reverbNode);
    this.cabDryGainNode.connect(this.reverbDryGainNode);
    this.cabDryGainNode.connect(this.reverbNode);

    this.reverbNode.connect(this.reverbWetGainNode);

    // Mix to Master Output
    this.reverbDryGainNode.connect(this.masterGainNode);
    this.reverbWetGainNode.connect(this.masterGainNode);

    // Connect to Analyser and Audio Destination (Speakers / Headphones)
    this.masterGainNode.connect(this.outputAnalyserNode);
    this.masterGainNode.connect(this.ctx.destination);

    // Apply Cab Sim preset
    this.applyCabSimSettings(this.settings.cabSim);
  }

  /**
   * Process noise gate state using incoming guitar RMS level
   */
  public processGate(inputRms: number): void {
    if (!this.settings.isMonitoringEnabled) return;

    // Convert RMS to approx dB
    const db = inputRms > 0.00001 ? 20 * Math.log10(inputRms) : -100;
    const threshold = this.settings.gateThreshold;

    const now = this.ctx.currentTime;
    if (db < threshold) {
      if (this.isGateOpen) {
        this.isGateOpen = false;
        // Fast, smooth downward expansion (avoids click)
        this.gateGainNode.gain.cancelScheduledValues(now);
        this.gateGainNode.gain.setTargetAtTime(0.0001, now, 0.035);
      }
    } else {
      if (!this.isGateOpen) {
        this.isGateOpen = true;
        // Instant attack
        this.gateGainNode.gain.cancelScheduledValues(now);
        this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.004);
      }
    }
  }

  /**
   * Enable or disable live guitar monitoring (hearing through speakers/headphones)
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.settings.isMonitoringEnabled = enabled;
    const now = this.ctx.currentTime;
    const targetGain = enabled ? this.settings.masterVolume : 0.0;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setTargetAtTime(targetGain, now, 0.02);
    this.notifyListeners();
  }

  /**
   * Select an Amp Preset (Metal, Crunch, Clean, Lead, Acoustic, Direct DI)
   */
  public setPreset(presetId: AmpPresetId): void {
    const presetData = AMP_PRESETS[presetId];
    if (!presetData) return;

    this.settings.preset = presetId;
    if (presetData.settings.gain !== undefined) this.settings.gain = presetData.settings.gain;
    if (presetData.settings.bass !== undefined) this.settings.bass = presetData.settings.bass;
    if (presetData.settings.mid !== undefined) this.settings.mid = presetData.settings.mid;
    if (presetData.settings.treble !== undefined) this.settings.treble = presetData.settings.treble;
    if (presetData.settings.presence !== undefined) this.settings.presence = presetData.settings.presence;
    if (presetData.settings.cabSim !== undefined) this.settings.cabSim = presetData.settings.cabSim;
    if (presetData.settings.reverbMix !== undefined) this.settings.reverbMix = presetData.settings.reverbMix;
    if (presetData.settings.gateThreshold !== undefined) this.settings.gateThreshold = presetData.settings.gateThreshold;

    this.applyAllSettings();
    this.notifyListeners();
  }

  public setGain(value: number): void {
    this.settings.gain = Math.max(0, Math.min(100, value));
    const now = this.ctx.currentTime;
    this.preGainNode.gain.setTargetAtTime(this.calculatePreGain(this.settings.gain), now, 0.02);
    this.waveShaperNode.curve = this.createDistortionCurve(this.settings.gain, this.settings.preset);
    this.notifyListeners();
  }

  public setBass(value: number): void {
    this.settings.bass = Math.max(-12, Math.min(12, value));
    this.toneBassNode.gain.setTargetAtTime(this.settings.bass, this.ctx.currentTime, 0.02);
    this.notifyListeners();
  }

  public setMid(value: number): void {
    this.settings.mid = Math.max(-12, Math.min(12, value));
    this.toneMidNode.gain.setTargetAtTime(this.settings.mid, this.ctx.currentTime, 0.02);
    this.notifyListeners();
  }

  public setTreble(value: number): void {
    this.settings.treble = Math.max(-12, Math.min(12, value));
    this.toneTrebleNode.gain.setTargetAtTime(this.settings.treble, this.ctx.currentTime, 0.02);
    this.notifyListeners();
  }

  public setPresence(value: number): void {
    this.settings.presence = Math.max(-12, Math.min(12, value));
    this.tonePresenceNode.gain.setTargetAtTime(this.settings.presence, this.ctx.currentTime, 0.02);
    this.notifyListeners();
  }

  public setMasterVolume(value: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, value));
    if (this.settings.isMonitoringEnabled) {
      this.masterGainNode.gain.setTargetAtTime(this.settings.masterVolume, this.ctx.currentTime, 0.02);
    }
    this.notifyListeners();
  }

  public setGateThreshold(value: number): void {
    this.settings.gateThreshold = Math.max(-80, Math.min(-20, value));
    this.notifyListeners();
  }

  public setReverbMix(value: number): void {
    this.settings.reverbMix = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    this.reverbWetGainNode.gain.setTargetAtTime(this.settings.reverbMix, now, 0.02);
    this.reverbDryGainNode.gain.setTargetAtTime(1.0 - this.settings.reverbMix * 0.4, now, 0.02);
    this.notifyListeners();
  }

  public setCabSim(cab: CabSimType): void {
    this.settings.cabSim = cab;
    this.applyCabSimSettings(cab);
    this.notifyListeners();
  }

  public getSettings(): Tone3000Settings {
    return { ...this.settings };
  }

  public subscribe(listener: (settings: Tone3000Settings) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const copy = this.getSettings();
    this.listeners.forEach((cb) => cb(copy));
  }

  /**
   * Apply all audio parameters to the DSP graph
   */
  private applyAllSettings(): void {
    const now = this.ctx.currentTime;
    this.preGainNode.gain.setTargetAtTime(this.calculatePreGain(this.settings.gain), now, 0.02);
    this.waveShaperNode.curve = this.createDistortionCurve(this.settings.gain, this.settings.preset);
    this.toneBassNode.gain.setTargetAtTime(this.settings.bass, now, 0.02);
    this.toneMidNode.gain.setTargetAtTime(this.settings.mid, now, 0.02);
    this.toneTrebleNode.gain.setTargetAtTime(this.settings.treble, now, 0.02);
    this.tonePresenceNode.gain.setTargetAtTime(this.settings.presence, now, 0.02);
    this.reverbWetGainNode.gain.setTargetAtTime(this.settings.reverbMix, now, 0.02);
    this.reverbDryGainNode.gain.setTargetAtTime(1.0 - this.settings.reverbMix * 0.4, now, 0.02);
    this.applyCabSimSettings(this.settings.cabSim);

    if (this.settings.isMonitoringEnabled) {
      this.masterGainNode.gain.setTargetAtTime(this.settings.masterVolume, now, 0.02);
    }
  }

  private applyCabSimSettings(cab: CabSimType): void {
    const now = this.ctx.currentTime;
    if (cab === 'bypass') {
      this.cabWetGainNode.gain.setTargetAtTime(0.0, now, 0.02);
      this.cabDryGainNode.gain.setTargetAtTime(1.0, now, 0.02);
      return;
    }

    this.cabDryGainNode.gain.setTargetAtTime(0.0, now, 0.02);
    this.cabWetGainNode.gain.setTargetAtTime(1.0, now, 0.02);

    if (cab === '4x12_metal') {
      this.cabLowPass1Node.frequency.setTargetAtTime(4600, now, 0.02);
      this.cabResonanceNode.frequency.setTargetAtTime(95, now, 0.02);
      this.cabResonanceNode.gain.setTargetAtTime(5.5, now, 0.02);
      this.cabMidScoopNode.gain.setTargetAtTime(2.0, now, 0.02);
    } else if (cab === '4x12_vintage') {
      this.cabLowPass1Node.frequency.setTargetAtTime(5000, now, 0.02);
      this.cabResonanceNode.frequency.setTargetAtTime(105, now, 0.02);
      this.cabResonanceNode.gain.setTargetAtTime(4.0, now, 0.02);
      this.cabMidScoopNode.gain.setTargetAtTime(3.5, now, 0.02);
    } else if (cab === '2x12_british') {
      this.cabLowPass1Node.frequency.setTargetAtTime(5200, now, 0.02);
      this.cabResonanceNode.frequency.setTargetAtTime(115, now, 0.02);
      this.cabResonanceNode.gain.setTargetAtTime(3.0, now, 0.02);
      this.cabMidScoopNode.gain.setTargetAtTime(2.5, now, 0.02);
    } else if (cab === '1x12_tweed') {
      this.cabLowPass1Node.frequency.setTargetAtTime(5600, now, 0.02);
      this.cabResonanceNode.frequency.setTargetAtTime(130, now, 0.02);
      this.cabResonanceNode.gain.setTargetAtTime(2.0, now, 0.02);
      this.cabMidScoopNode.gain.setTargetAtTime(1.5, now, 0.02);
    }
  }

  private calculatePreGain(gainSlider: number): number {
    // Non-linear gain curve: 0 to 100 maps to 0.5x up to 35x
    const norm = gainSlider / 100;
    return 0.5 + Math.pow(norm, 1.8) * 30;
  }

  /**
   * Generates tube saturation transfer curves with realistic asymmetric harmonics
   */
  private createDistortionCurve(gain: number, preset: AmpPresetId, samples = 2048): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(samples);
    const amount = (gain / 100) * 15;

    if (preset === 'direct_di') {
      for (let i = 0; i < samples; i++) {
        curve[i] = (i * 2) / samples - 1;
      }
      return curve;
    }

    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      if (preset === 'clean') {
        // Soft tube compression & warmth (tanh)
        curve[i] = Math.tanh(x * (1.2 + amount * 0.15));
      } else if (preset === 'crunch') {
        // Asymmetric clipping with 2nd order even harmonics (vintage tube feel)
        const biased = x + 0.12 * x * x;
        const k = amount * 1.5;
        curve[i] = ((2.5 + k) * biased * 25 * deg) / (Math.PI + k * Math.abs(biased));
      } else if (preset === 'lead') {
        // Rich singing lead with compression and soft clipping
        const k = amount * 2.5;
        const x_sat = Math.tanh(x * (1.4 + amount * 0.2));
        curve[i] = ((1 + k) * x_sat) / (1 + k * Math.abs(x_sat));
      } else if (preset === 'metal') {
        // High gain tight saturation with punchy attack
        const drive = x * (amount * 0.6 + 3);
        curve[i] = Math.max(-0.96, Math.min(0.96, (1.8 * drive) / (1 + Math.abs(drive))));
      } else if (preset === 'acoustic') {
        // Mild acoustic body excitation
        curve[i] = Math.sin(x * Math.PI * 0.5);
      }
    }
    return curve;
  }

  /**
   * Procedural impulse response for realistic studio room ambience
   */
  private buildRoomImpulseResponse(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.9;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    const decay = 3.2;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.exp(-t * decay);
      // Diffuse reflections
      left[i] = (Math.random() * 2 - 1) * env * (1 - t * 0.3);
      right[i] = (Math.random() * 2 - 1) * env * (1 - t * 0.3);
    }
    return impulse;
  }

  public getOutputLevel(): number {
    const data = new Uint8Array(this.outputAnalyserNode.frequencyBinCount);
    this.outputAnalyserNode.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i] - 128);
      if (val > max) max = val;
    }
    return Math.min(1, max / 128);
  }
}
