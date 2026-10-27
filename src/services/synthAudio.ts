// Web Audio Synthesizer for Song Playback, Metronome, and Hit Sounds

import type { BeatMark } from './songsterrApi';

export class SoundFX {
  private static ctx: AudioContext | null = null;

  static getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      // webkitAudioContext (old Safari) isn't part of the DOM lib typings
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play guitar note synthesis with realistic pluck envelope
   */
  static playGuitarNote(freqHz: number, durationMs = 800, volume = 0.3): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle wave with slight harmonics sounds like electric guitar clean
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqHz, ctx.currentTime);

      const now = ctx.currentTime;
      const durSec = Math.max(0.1, durationMs / 1000);

      // Fast pluck attack + exponential decay
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durSec);
    } catch {
      // AudioContext unavailable
    }
  }

  /**
   * Perfect hit chime sound (crisp rewarding tone)
   */
  static playPerfectHit(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignore
    }
  }

  /**
   * Miss sound (subtle error thump)
   */
  static playMissSound(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore
    }
  }

  /**
   * Metronome click, at `when` on the audio clock (now by default)
   */
  static playClick(accent = false, when?: number): OscillatorNode | null {
    try {
      const ctx = this.getContext();
      const now = Math.max(when ?? ctx.currentTime, ctx.currentTime);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(accent ? 1200 : 800, now);

      gain.gain.setValueAtTime(accent ? 0.3 : 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
      return osc;
    } catch {
      return null;
    }
  }
}

/**
 * Sample-accurate metronome: clicks are scheduled slightly ahead on the AudioContext clock
 * instead of fired from React renders. The game loop calls update() with the song position;
 * the scheduler maps song time to audio time and re-anchors on seek, speed change or drift.
 */
export class MetronomeScheduler {
  private static readonly LOOKAHEAD_SEC = 0.12;
  private static readonly RESYNC_MS = 30;
  private static readonly LATE_TOLERANCE_SEC = 0.03;

  private beats: BeatMark[] = [];
  private rate = 1;
  private running = false;
  private anchorAudioTime = 0;
  private anchorSongMs = 0;
  private nextBeat = 0;
  private resyncOnResume = false;
  private scheduled: { osc: OscillatorNode; at: number }[] = [];
  private readonly getContext: () => AudioContext;

  constructor(getContext: () => AudioContext = () => SoundFX.getContext()) {
    this.getContext = getContext;
  }

  start(beats: BeatMark[], songMs: number, rate: number): void {
    this.beats = beats;
    this.rate = rate > 0 ? rate : 1;
    this.running = true;
    this.resync(songMs);
    // Schedule right away: waiting for the next frame would drop a beat sitting exactly at songMs
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.cancelPending();
  }

  update(songMs: number): void {
    if (!this.running) return;
    const ctx = this.getContext();
    // A suspended context's clock is frozen: anything queued would pile up and fire at once on resume
    if (ctx.state !== 'running') {
      this.cancelPending();
      // The cancelled beats are behind the cursor; rewind on resume even if no drift built up
      this.resyncOnResume = true;
      return;
    }
    if (this.resyncOnResume || Math.abs(this.songMsAt(ctx.currentTime) - songMs) > MetronomeScheduler.RESYNC_MS) {
      this.resyncOnResume = false;
      this.resync(songMs);
    }
    this.schedule();
  }

  private schedule(): void {
    const ctx = this.getContext();
    if (ctx.state !== 'running') return;
    const horizonMs = this.songMsAt(ctx.currentTime + MetronomeScheduler.LOOKAHEAD_SEC);
    while (this.nextBeat < this.beats.length && this.beats[this.nextBeat].timeMs <= horizonMs) {
      const beat = this.beats[this.nextBeat++];
      const at = this.audioTimeAt(beat.timeMs);
      // Slightly late beats (one frame) still sound now; older ones were skipped by a seek or stall
      if (at < ctx.currentTime - MetronomeScheduler.LATE_TOLERANCE_SEC) continue;
      const osc = SoundFX.playClick(beat.accent, at);
      if (osc) this.scheduled.push({ osc, at: Math.max(at, ctx.currentTime) });
    }
    this.scheduled = this.scheduled.filter((click) => click.at >= ctx.currentTime);
  }

  private resync(songMs: number): void {
    this.cancelPending();
    this.anchorAudioTime = this.getContext().currentTime;
    this.anchorSongMs = songMs;
    const index = this.beats.findIndex((beat) => beat.timeMs >= songMs);
    this.nextBeat = index < 0 ? this.beats.length : index;
  }

  // Clicks already queued would otherwise sound at the old position after a seek or pause
  private cancelPending(): void {
    if (this.scheduled.length === 0) return;
    const now = this.getContext().currentTime;
    for (const click of this.scheduled) {
      if (click.at >= now) click.osc.stop();
    }
    this.scheduled = [];
  }

  private songMsAt(audioTime: number): number {
    return this.anchorSongMs + (audioTime - this.anchorAudioTime) * 1000 * this.rate;
  }

  private audioTimeAt(songMs: number): number {
    return this.anchorAudioTime + (songMs - this.anchorSongMs) / 1000 / this.rate;
  }
}
