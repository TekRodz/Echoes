// Sons synthétisés (WebAudio) : tic-tac, plume, verre fêlé, rembobinage de bande.

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  unlock(): void {
    this.ensure();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, when = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  tick(strong: boolean): void {
    this.tone(strong ? 1500 : 2100, 0.03, 'square', strong ? 0.08 : 0.035);
  }
  scratch(): void {
    this.noise(0.07, 0.25, 3200, 2);
  }
  glass(): void {
    [2900, 3700, 4600, 5300].forEach((f, i) => this.tone(f, 0.35 - i * 0.05, 'sine', 0.06, i * 0.012));
    this.noise(0.12, 0.5, 6000, 0.8);
  }
  rewind(): void {
    this.tone(900, 0.9, 'sawtooth', 0.04, 0, 120);
    this.noise(0.9, 0.12, 1200, 0.5);
  }
  win(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.09, i * 0.09));
  }
  fail(): void {
    this.tone(160, 0.6, 'triangle', 0.15, 0, 70);
  }
  click(): void {
    this.tone(1200, 0.025, 'triangle', 0.05);
  }
}
