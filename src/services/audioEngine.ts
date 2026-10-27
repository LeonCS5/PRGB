// Professional Guitar/Bass Audio Engine for Real-Time Pitch Detection
// Modeled after Yousician & TONE3000 low-latency WASAPI/ASIO configurations

export interface DetectedPitch {
  frequency: number; // Hz
  midiNote: number;
  noteName: string;
  cents: number; // tuning offset from perfect pitch (-50 to +50)
  clarity: number; // 0 to 1 confidence
  volume: number; // 0 to 1 RMS level
  stringEstimate?: number; // estimated guitar string (1 to 6)
  fretEstimate?: number; // estimated fret
}

import { Tone3000AmpEngine } from './tone3000Amp';

export type InputChannelMode = 'ch1' | 'ch2' | 'both';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private tone3000: Tone3000AmpEngine | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private onPitchCallback: ((pitch: DetectedPitch | null) => void) | null = null;

  private selectedDeviceId = '';
  private channelMode: InputChannelMode = 'both';

  // Guitar frequency bounds (E1 ~ 41 Hz for 4-string bass up to B5 ~ 987 Hz for guitar)
  private readonly MIN_FREQ = 40;
  private readonly MAX_FREQ = 1100;
  private readonly BUFFER_SIZE = 2048;

  private static readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  constructor() {
    // Audio engine initialized in idle state
  }

  /**
   * Enumerate available audio input devices (microphones & audio interfaces)
   */
  async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audioinput');
    } catch (err) {
      console.warn('Failed to enumerate audio devices:', err);
      return [];
    }
  }

  /**
   * Start listening to the audio interface / microphone with raw studio settings
   */
  async start(
    deviceId?: string,
    channelMode: InputChannelMode = 'both',
    onPitch?: (pitch: DetectedPitch | null) => void
  ): Promise<void> {
    if (this.isRunning) await this.stop();

    if (deviceId) this.selectedDeviceId = deviceId;
    this.channelMode = channelMode;
    if (onPitch) this.onPitchCallback = onPitch;

    // The AudioContext (and the TONE3000 chain bound to it) is reused across
    // reconnections so switching device/channel doesn't rebuild the amp or click.
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      this.tone3000 = null;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Constraints configured for clean guitar input without Windows noise suppression distortion
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: { ideal: 48000 }
      },
      video: false
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Channel Routing (Input 1 / Input 2 / Stereo)
    this.splitterNode = this.audioContext.createChannelSplitter(2);
    this.mergerNode = this.audioContext.createChannelMerger(1);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.BUFFER_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.1;
    this.buffer = new Float32Array(this.analyserNode.fftSize);

    this.sourceNode.connect(this.splitterNode);

    if (this.channelMode === 'ch1') {
      // Route only channel 1 (Left)
      this.splitterNode.connect(this.mergerNode, 0, 0);
    } else if (this.channelMode === 'ch2') {
      // Route only channel 2 (Right)
      this.splitterNode.connect(this.mergerNode, 1, 0);
    } else {
      // Mix both channels
      this.splitterNode.connect(this.mergerNode, 0, 0);
      this.splitterNode.connect(this.mergerNode, 1, 0);
    }

    this.mergerNode.connect(this.analyserNode);

    // Initialize and route to TONE3000 Amp Modeler for live low-latency guitar monitoring
    if (!this.tone3000) {
      this.tone3000 = new Tone3000AmpEngine(this.audioContext);
    }
    this.mergerNode.connect(this.tone3000.inputNode);

    this.isRunning = true;
    this.loopDetection();
  }

  /**
   * Stop audio capture. Keeps the AudioContext and TONE3000 chain alive for the next start().
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    this.sourceNode?.disconnect();
    this.splitterNode?.disconnect();
    this.mergerNode?.disconnect();
    this.analyserNode?.disconnect();

    this.sourceNode = null;
    this.splitterNode = null;
    this.mergerNode = null;
    this.analyserNode = null;
  }

  /**
   * Stop capture and fully release the AudioContext and TONE3000 chain
   */
  async dispose(): Promise<void> {
    await this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
    this.tone3000 = null;
  }

  /**
   * Continuous pitch detection loop
   */
  private loopDetection = () => {
    if (!this.isRunning || !this.analyserNode || !this.buffer || !this.audioContext) return;

    this.analyserNode.getFloatTimeDomainData(this.buffer);

    // Calculate RMS volume level
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);

    // Real-time TONE3000 noise gate processing
    if (this.tone3000) {
      this.tone3000.processGate(rms);
    }

    // Minimum noise gate threshold for pitch detection
    if (rms < 0.01) {
      if (this.onPitchCallback) this.onPitchCallback(null);
      this.animationFrameId = requestAnimationFrame(this.loopDetection);
      return;
    }

    // Normalized Square Difference Function (NSDF) / MPM Algorithm
    const pitch = this.detectPitchNSDF(this.buffer, this.audioContext.sampleRate, rms);

    if (this.onPitchCallback) {
      this.onPitchCallback(pitch);
    }

    this.animationFrameId = requestAnimationFrame(this.loopDetection);
  };

  /**
   * Normalized Square Difference Function (NSDF) with parabolic interpolation
   */
  private detectPitchNSDF(
    buffer: Float32Array,
    sampleRate: number,
    volume: number
  ): DetectedPitch | null {
    const minPeriod = Math.floor(sampleRate / this.MAX_FREQ);
    const maxPeriod = Math.floor(sampleRate / this.MIN_FREQ);

    const length = buffer.length;
    const nsdf = new Float32Array(maxPeriod + 1);

    // Compute autocorrelation & squared sum
    for (let tau = 0; tau <= maxPeriod; tau++) {
      let acf = 0;
      let divisor = 0;
      for (let i = 0; i < length - tau; i++) {
        acf += buffer[i] * buffer[i + tau];
        divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
      }
      nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
    }

    // Find first key peak above threshold
    let maxIndex = -1;
    let maxValue = -1;
    let inPeak = false;
    const threshold = 0.55; // 55% peak clarity threshold for guitar harmonics

    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (nsdf[tau] > threshold) {
        inPeak = true;
        if (nsdf[tau] > maxValue) {
          maxValue = nsdf[tau];
          maxIndex = tau;
        }
      } else if (inPeak) {
        // Exit peak
        break;
      }
    }

    if (maxIndex <= 0 || maxValue < threshold) {
      return null;
    }

    // Parabolic interpolation around peak
    let period = maxIndex;
    if (maxIndex > 0 && maxIndex < maxPeriod) {
      const alpha = nsdf[maxIndex - 1];
      const beta = nsdf[maxIndex];
      const gamma = nsdf[maxIndex + 1];
      const delta = (0.5 * (alpha - gamma)) / (alpha - 2 * beta + gamma);
      if (isFinite(delta) && Math.abs(delta) < 1) {
        period += delta;
      }
    }

    const frequency = sampleRate / period;
    if (frequency < this.MIN_FREQ || frequency > this.MAX_FREQ) {
      return null;
    }

    // MIDI note number: 69 + 12 * log2(freq / 440)
    const midiFloat = 69 + 12 * Math.log2(frequency / 440);
    const midiNote = Math.round(midiFloat);
    const cents = Math.round((midiFloat - midiNote) * 100);

    const noteName = AudioEngine.getNoteName(midiNote);

    return {
      frequency: Math.round(frequency * 10) / 10,
      midiNote,
      noteName,
      cents,
      clarity: Math.min(1, Math.round(maxValue * 100) / 100),
      volume: Math.min(1, Math.round(volume * 100) / 100)
    };
  }

  static getNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    const name = AudioEngine.NOTE_NAMES[midi % 12];
    return `${name}${octave}`;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getTone3000(): Tone3000AmpEngine | null {
    return this.tone3000;
  }
}
