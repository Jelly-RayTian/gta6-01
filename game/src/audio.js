// Procedural WebAudio only: engine, sirens, gunshots, crashes, UI sounds and a looping synth-pop theme.
import { W } from './world.js';
import { dist } from './config.js';

let ctx, master, sfxBus, musicBus, engine, siren, noiseBuf, musicOn = false, nextBeat = 0, beat = 0, timer = 0, muted = false;
export const audioReady = () => !!ctx;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const mk = (type, f, g = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return [o, gn]; };
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(sfxBus);
  const [o1, g1] = mk('sawtooth', 50), [o2, g2] = mk('square', 25); g1.connect(lp); g2.connect(lp);
  const eg = ctx.createGain(); eg.gain.value = 0; lp.disconnect(); lp.connect(eg); eg.connect(sfxBus); engine = { o1, o2, lp, eg };
  const [so, sg] = mk('sawtooth', 700); const sl = ctx.createBiquadFilter(); sl.type = 'bandpass'; sl.frequency.value = 1100; const out = ctx.createGain(); out.gain.value = 0; sg.gain.value = 1; sg.connect(sl); sl.connect(out); out.connect(sfxBus); siren = { o: so, out };
}
const tone = (f, dur, type = 'sine', vol = 0.3, when = 0, slide = 0, bus = sfxBus) => {
  if (!ctx) return; const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
};
const noise = (dur, vol, freq = 1500, q = 0.7, type = 'lowpass', when = 0, bus = sfxBus) => {
  if (!ctx) return; const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
};
const near = (x, z, range = 70) => { const P = W.player; return P ? Math.max(0, 1 - dist(x, z, P.x, P.z) / range) : 1; };

export const sfx = {
  click: () => tone(660, 0.07, 'square', 0.12),
  chime: () => { tone(880, 0.25, 'sine', 0.25); tone(1320, 0.35, 'sine', 0.2, 0.09); tone(1760, 0.5, 'sine', 0.15, 0.2); },
  pickup: () => { tone(988, 0.12, 'triangle', 0.2); tone(1480, 0.18, 'triangle', 0.18, 0.07); },
  fail: () => { tone(300, 0.4, 'sawtooth', 0.2, 0, -150); tone(200, 0.6, 'sawtooth', 0.2, 0.25, -100); },
  shot: (v = 1) => { noise(0.18, 0.5 * v, 2400, 0.5, 'bandpass'); tone(160, 0.12, 'square', 0.25 * v, 0, -100); },
  reload: () => { tone(500, 0.05, 'square', 0.1); tone(300, 0.07, 'square', 0.1, 0.6); },
  empty: () => tone(240, 0.04, 'square', 0.1),
  punch: () => { noise(0.1, 0.4, 400, 1); tone(110, 0.1, 'sine', 0.3, 0, -50); },
  crash: (v = 1) => { noise(0.35, 0.6 * v, 700, 0.8); tone(90, 0.3, 'sawtooth', 0.25 * v, 0, -40); },
  boom: (v = 1) => { noise(1.1, 0.9 * v, 300, 0.7); tone(70, 0.9, 'sine', 0.6 * v, 0, -45); },
  horn: (v = 1) => { tone(392, 0.28, 'square', 0.1 * v); tone(494, 0.28, 'square', 0.08 * v); },
  hurt: () => { tone(180, 0.2, 'sawtooth', 0.25, 0, -80); },
  thud: () => { noise(0.12, 0.4, 300, 1); },
  door: () => { noise(0.08, 0.25, 900, 2, 'bandpass'); tone(150, 0.1, 'square', 0.12); },
};
/** Play the sounds that this step's events asked for, scaled by distance. */
export function playEvents(events) {
  if (!ctx) return;
  for (const e of events) {
    const n = near(e.x, e.z, e.type === 'boom' ? 160 : 90);
    if (e.type === 'shot') { if (n > 0.05) sfx.shot(Math.max(0.2, n) * e.v); }
    else if (e.type === 'crash') { if (n > 0.1) sfx.crash(n * e.v); } else if (e.type === 'boom') sfx.boom(Math.max(0.3, n));
    else if (e.type === 'honk') { if (n > 0.1) sfx.horn(n); } else if (['click', 'chime', 'fail', 'pickup', 'reload', 'punch', 'hurt', 'thud', 'door'].includes(e.type)) { if (e.type === 'click') sfx.empty(); else sfx[e.type]?.(); }
  }
}
export function updateAudio(dt) {
  if (!ctx || !engine) return;
  const P = W.player, car = P?.car, t = ctx.currentTime;
  const sp = car ? Math.abs(car.sp) : 0, load = car ? 0.12 + 0.12 * Math.min(1, sp / 30) : 0;
  const gear = Math.min(5, Math.floor(sp / 11)), rpm = (sp - gear * 11) / 11, f = 38 + sp * 1.2 + rpm * 28 + gear * 4;
  engine.o1.frequency.setTargetAtTime(f, t, 0.05); engine.o2.frequency.setTargetAtTime(f / 2, t, 0.05); engine.lp.frequency.setTargetAtTime(350 + sp * 20, t, 0.1);
  engine.eg.gain.setTargetAtTime(muted ? 0 : load, t, 0.1);
  let sirenLevel = 0;
  for (const c of W.cars) if (c.siren && !c.wreck) sirenLevel = Math.max(sirenLevel, near(c.x, c.z, 140));
  siren.o.frequency.setTargetAtTime(700 + 260 * Math.sin(W.time * 6.5), t, 0.02); siren.out.gain.setTargetAtTime(0.09 * sirenLevel, t, 0.1);
  if (musicOn) scheduleMusic();
  timer += dt;
}
export function setMusic(on) { if (!ctx) return; musicOn = on; if (on) { nextBeat = ctx.currentTime + 0.1; } }
export function duckMusic(low) { if (ctx) musicBus.gain.setTargetAtTime(low ? 0.12 : 0.22, ctx.currentTime, 0.3); }
// A-minor/F/C/G loop at 108 bpm: pad, bass, kick/hat and a plucky arpeggio.
const CH = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]], mtof = (n) => 440 * 2 ** ((n - 69) / 12);
function scheduleMusic() {
  const step = 60 / 108 / 2;
  while (nextBeat < ctx.currentTime + 0.3) {
    const when = nextBeat - ctx.currentTime, bar = Math.floor(beat / 16) % 4, s = beat % 16, ch = CH[bar];
    if (s === 0) for (const n of ch) tone(mtof(n), step * 15, 'triangle', 0.07, when, 0, musicBus);
    if (s % 2 === 0) tone(mtof(ch[0] - 24 + (s % 8 === 6 ? 7 : 0)), step * 1.6, 'sawtooth', 0.11, when, 0, musicBus);
    if (s % 4 === 0) { tone(120, 0.15, 'sine', 0.4, when, -80, musicBus); }
    if (s % 2 === 1) noise(0.04, 0.12, 7000, 1, 'highpass', when, musicBus);
    if (s % 8 === 4) noise(0.12, 0.2, 1800, 1, 'bandpass', when, musicBus);
    tone(mtof(ch[(s * 3) % 4] + 12), step * 1.2, 'square', 0.035, when, 0, musicBus);
    beat++; nextBeat += step;
  }
}
export const toggleMute = () => { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; };
