"use client";

/**
 * Synthesized board audio — zero asset files, pure WebAudio. Created lazily
 * on the operator's "Sound" click (autoplay policy needs a gesture). Views
 * fire cues via `sfx("tick")` etc.; everything is quiet-by-design so the
 * hall's own energy stays the star.
 */

type Cue =
  | "join"
  | "swoosh"
  | "tick"
  | "stinger"
  | "soft"
  | "fanfare";

class BoardSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  get enabled() {
    return this.ctx !== null;
  }

  enable() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  disable() {
    this.stopPad();
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  /** Soft two-oscillator ambient pad (lobby + winners). */
  startPad() {
    if (!this.ctx || !this.master || this.padNodes.length) return;
    const freqs = [130.81, 196.0]; // C3 + G3 — an open fifth, unobtrusive
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = Math.random() * 8 - 4;
      filter.type = "lowpass";
      filter.frequency.value = 420;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 2.5);
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      this.padNodes.push({ osc, gain });
    }
  }

  stopPad() {
    if (!this.ctx) return;
    for (const { osc, gain } of this.padNodes) {
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);
      osc.stop(this.ctx.currentTime + 1.4);
    }
    this.padNodes = [];
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    peak: number,
    type: OscillatorType = "sine",
    glideTo?: number
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  play(cue: Cue) {
    if (!this.ctx) return;
    switch (cue) {
      case "join": // cheerful rising blip
        this.tone(880, 0, 0.16, 0.12, "sine", 1318.5);
        break;
      case "swoosh": // question entrance riser
        this.tone(180, 0, 0.45, 0.1, "sawtooth", 720);
        break;
      case "tick": // last-5-seconds clock
        this.tone(1050, 0, 0.06, 0.09, "square");
        break;
      case "stinger": // reveal chord (C-E-G)
        this.tone(523.25, 0, 0.9, 0.1);
        this.tone(659.25, 0, 0.9, 0.08);
        this.tone(783.99, 0, 0.9, 0.08);
        break;
      case "soft": // interstitial arrival
        this.tone(523.25, 0, 0.3, 0.06, "triangle");
        break;
      case "fanfare": // winners arpeggio + octave crown
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(f, i * 0.16, 0.5, 0.11, "triangle")
        );
        this.tone(1046.5, 0.75, 1.4, 0.1);
        this.tone(1318.5, 0.75, 1.4, 0.07);
        break;
    }
  }
}

export const boardSynth = new BoardSynth();

/** Fire a sound cue from anywhere on the board. No-op while sound is off. */
export function sfx(cue: Cue) {
  boardSynth.play(cue);
}
