// The single shared game state: every module reads and writes this one object.
export const W = {
  scene: null, camera: null,
  time: 0, clock: 15.5, state: 'title',
  cars: [], peds: [], cops: [], enemies: [], pickups: [], solidsExtra: [],
  player: null, wanted: { heat: 0, stars: 0, unseen: 0, arrest: 0, spawnT: 0, blockT: 0, flash: 0 },
  mission: null, done: [], money: 0,
  stats: { kills: 0, wrecks: 0, arrests: 0, deaths: 0, stolen: 0, distance: 0, playtime: 0, shots: 0 },
  shake: 0, hurt: 0, events: [], toast: null, banner: null, noise: null,
  cam: { yaw: 0, pitch: 0.25, idle: 0, fov: 65 },
};
export const note = (text, secs = 4) => { W.toast = { text, t: secs }; };
export const banner = (text, sub, secs = 4) => { W.banner = { text, sub, t: secs }; };
/** Queue a one-frame game event (sound, shot noise, crash) for audio and pedestrians to react to. */
export const emit = (type, x, z, v = 1) => W.events.push({ type, x, z, v });
