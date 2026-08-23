let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let muted = false;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfx.connect(master);
    master.connect(ctx.destination);
    master.gain.value = 0.7;
    sfx.gain.value = 0.9;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function bus() {
  if (!ctx || !sfx) unlockAudio();
  return { ctx, sfx };
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  gain = 0.12,
  slide?: number,
) {
  const { ctx: c, sfx: s } = bus();
  if (!c || !s || muted) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), now + duration);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g);
  g.connect(s);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noise(duration: number, gain = 0.08) {
  const { ctx: c, sfx: s } = bus();
  if (!c || !s || muted) return;
  const n = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(s);
  src.start();
}

export const sfxPlay = {
  jump: () => tone(320, 0.09, "square", 0.08, 420),
  double: () => tone(380, 0.1, "square", 0.09, 540),
  land: () => noise(0.06, 0.07),
  coin: () => {
    tone(880, 0.07, "sine", 0.09);
    setTimeout(() => tone(1320, 0.09, "sine", 0.07), 50);
  },
  checkpoint: () => {
    tone(520, 0.08, "triangle", 0.08);
    setTimeout(() => tone(660, 0.12, "triangle", 0.07), 70);
  },
  death: () => {
    noise(0.12, 0.1);
    tone(220, 0.22, "sawtooth", 0.08, 70);
  },
  win: () => {
    tone(440, 0.12, "triangle", 0.08);
    setTimeout(() => tone(554, 0.12, "triangle", 0.08), 110);
    setTimeout(() => tone(659, 0.2, "triangle", 0.09), 220);
  },
  flag: () => tone(523, 0.16, "triangle", 0.08, 784),
};

export function setMuted(next: boolean) {
  muted = next;
  if (master) master.gain.setTargetAtTime(next ? 0 : 0.7, master.context.currentTime, 0.03);
}

export function isMuted() {
  return muted;
}

export function resumeAudio() {
  if (ctx?.state === "suspended") void ctx.resume();
}
