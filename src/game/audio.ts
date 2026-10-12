export class AudioBus {
  ctx: AudioContext | null = null;
  music = 0.55;
  sfx = 0.8;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private nextNote = 0;
  private biome = "sand";

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.018 * this.music;
    this.droneGain.connect(this.ctx.destination);
    this.drone = this.ctx.createOscillator();
    this.drone.type = "sine";
    this.drone.frequency.value = 98;
    this.drone.connect(this.droneGain);
    this.drone.start();
    this.nextNote = this.ctx.currentTime + 0.2;
  }

  setMusic(v: number): void {
    this.music = v;
    if (this.droneGain && this.ctx) this.droneGain.gain.value = 0.02 * v;
  }

  setSfx(v: number): void {
    this.sfx = v;
  }

  tick(biome: string, hour: number): void {
    if (!this.ctx || !this.drone) return;
    this.biome = biome;
    const night = hour < 5 || hour > 19;
    const root = night ? 82 : biome === "frost" ? 110 : biome === "ash" ? 73 : biome === "life" ? 123 : 98;
    this.drone.frequency.setTargetAtTime(root, this.ctx.currentTime, 0.4);
    if (this.ctx.currentTime < this.nextNote) return;
    const scale = biome === "life" ? [0, 2, 3, 7, 10] : biome === "frost" ? [0, 3, 5, 7, 12] : [0, 1, 4, 7, 8, 11];
    const step = scale[Math.floor(Math.random() * scale.length)];
    const freq = root * Math.pow(2, step / 12) * (Math.random() > 0.7 ? 2 : 1);
    this.tone(freq, 0.22, "triangle", 0.045 * this.music);
    this.nextNote = this.ctx.currentTime + (night ? 1.4 : 0.85);
  }

  tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || gain <= 0.001) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  swing(): void {
    this.tone(180 + Math.random() * 80, 0.12, "sawtooth", 0.04 * this.sfx);
  }

  hit(): void {
    this.tone(90, 0.08, "square", 0.06 * this.sfx);
    this.tone(240, 0.06, "triangle", 0.04 * this.sfx);
  }

  hurt(): void {
    this.tone(70, 0.2, "sawtooth", 0.07 * this.sfx);
  }

  blip(): void {
    this.tone(520, 0.07, "sine", 0.04 * this.sfx);
  }

  foot(): void {
    this.tone(50 + Math.random() * 20, 0.05, "sine", 0.02 * this.sfx);
  }
}
