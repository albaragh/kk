export const audio = {
  ctx: null as AudioContext | null,
  master: null as GainNode | null,
  osc: null as OscillatorNode | null,
  filter: null as BiquadFilterNode | null,
  eng: null as GainNode | null,
  noise: null as AudioBufferSourceNode | null,
  noiseGain: null as GainNode | null,
  volume: 0.7,
  started: false,

  unlock() {
    if (this.started || typeof window === "undefined") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 48;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    const eng = ctx.createGain();
    eng.gain.value = 0.0001;
    osc.connect(filter);
    filter.connect(eng);
    eng.connect(master);
    osc.start();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    this.ctx = ctx;
    this.master = master;
    this.osc = osc;
    this.filter = filter;
    this.eng = eng;
    this.noise = noise;
    this.noiseGain = noiseGain;
    this.started = true;
    void ctx.resume();
  },

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  },

  engine(rpm: number, throttle: number, drifting: boolean) {
    if (!this.started || !this.osc || !this.filter || !this.eng || !this.noiseGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(42 + rpm * 95 + throttle * 18, now, 0.05);
    this.filter.frequency.setTargetAtTime(180 + rpm * 900, now, 0.05);
    this.eng.gain.setTargetAtTime((0.02 + throttle * 0.05 + rpm * 0.03) * this.volume, now, 0.05);
    this.noiseGain.gain.setTargetAtTime(drifting ? 0.04 * this.volume : 0, now, 0.08);
  },

  beep(freq = 660, dur = 0.12) {
    if (!this.started || !this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = freq;
    o.type = "square";
    g.gain.value = 0.04 * this.volume;
    o.connect(g);
    g.connect(this.master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.stop(this.ctx.currentTime + dur + 0.02);
  },
};
