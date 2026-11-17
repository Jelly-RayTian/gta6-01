// The law: crimes feed a heat value that maps to 0-5 stars; cruisers chase and ram, officers dismount,
// roadblocks appear at 4+ stars, and the player can lose the heat by staying out of sight, or be busted.
import { W, emit, note } from './world.js';
import { S, N, DIRS, rnd, rr, pick, clamp, dist } from './config.js';
import { spawnTrafficCar } from './traffic.js';
import { driveToward, lanePoint, chooseDir } from './traffic.js';
import { spawnCar, stepCar, removeCar } from './vehicles.js';
import { segBlocked } from './city.js';
import { spawnOfficer } from './combat.js';

export const THRESH = [1, 3, 6, 10, 15];
const TARGET = [0, 2, 3, 4, 6, 7];
export const starsOf = (heat) => THRESH.filter((t) => heat >= t).length;

function witnessed(x, z) {
  for (const c of W.cars) if (c.type === 'police' && !c.wreck && c.ai && dist(c.x, c.z, x, z) < 90 && !segBlocked(c.x, c.z, x, z, 0, 2)) return true;
  for (const o of W.cops) if (o.state !== 'dead' && dist(o.x, o.z, x, z) < 90 && !segBlocked(o.x, o.z, x, z)) return true;
  for (const p of W.peds) if (p.state !== 'dead' && dist(p.x, p.z, x, z) < 24 && !segBlocked(p.x, p.z, x, z)) return true;
  return false;
}
/** Report a crime of `points` severity at a place; only counts when someone could have seen it. */
export function crime(points, x, z, force = false) {
  const w = W.wanted;
  if (!force && w.stars === 0 && !witnessed(x, z)) return;
  w.heat = Math.min(20, w.heat + points); w.unseen = 0;
}
export function setStars(n) { W.wanted.heat = n ? THRESH[n - 1] + 0.01 : 0; W.wanted.unseen = 0; W.wanted.stars = starsOf(W.wanted.heat); }
export function clearWanted() {
  setStars(0);
  for (const c of [...W.cars]) if (c.ai && c.ai.mode === 'block') removeCar(c); else if (c.ai && c.ai.mode === 'chase') { c.ai.mode = 'traffic'; c.siren = false; c.boost = 1; snapToNode(c); }
}
function snapToNode(c) { c.ai.i = clamp(Math.round(c.x / S), 0, N); c.ai.j = clamp(Math.round(c.z / S), 0, N); c.ai.d = [0, 1, 2, 3].reduce((b, k) => (Math.cos(c.h - Math.atan2(DIRS[k][0], DIRS[k][1])) > Math.cos(c.h - Math.atan2(DIRS[b][0], DIRS[b][1])) ? k : b), 0); }

function spawnChaser() {
  const P = W.player;
  for (let tries = 0; tries < 12; tries++) {
    const r = Math.floor(rnd() * (N + 1)), sg = Math.floor(rnd() * N), vertical = rnd() < 0.5, d = vertical ? 1 + Math.floor(rnd() * 2) * 2 : Math.floor(rnd() * 2) * 2;
    const i = vertical ? r : sg, j = vertical ? sg : r, [lx, lz] = lanePoint(i, j, d), x = lx + (vertical ? 0 : S / 2), z = lz + (vertical ? S / 2 : 0);
    const dd = dist(x, z, P.x, P.z); if (dd < 85 || dd > 190) continue;
    const car = spawnTrafficCar('police', i, j, d, { driver: 'cop' }); car.x = x; car.z = z; car.driver = 'cop';
    car.ai.mode = 'chase'; car.siren = true; car.ai.stuck = 0; car.ai.dismount = 4; return car;
  }
}

/** Put a police cruiser straight into chase mode at a place (used to stage chases). */
export function spawnChaserNear(x, z, h) {
  const car = spawnCar('police', x, z, h, { driver: 'cop' }); car.ai = { mode: 'chase', i: 0, j: 0, d: 0, stuck: 0, dismount: 5 }; snapToNode(car); car.siren = true; car.vx = Math.sin(h) * 20; car.vz = Math.cos(h) * 20; return car;
}
function chaseStep(car, dt) {
  const ai = car.ai, P = W.player, w = W.wanted;
  const px = P.car ? P.car.x + P.car.vx * 0.5 : P.x, pz = P.car ? P.car.z + P.car.vz * 0.5 : P.z, d = dist(car.x, car.z, px, pz);
  car.boost = w.stars >= 4 ? 1.12 : w.stars >= 3 ? 1.04 : 0.95;
  let c, tx = px, tz = pz;
  const direct = d < 55 && !segBlocked(car.x, car.z, px, pz, 0, 2);
  if (!direct) {
    const [nx, nz] = lanePoint(ai.i, ai.j, ai.d);
    if ((nx - car.x) * DIRS[ai.d][0] + (nz - car.z) * DIRS[ai.d][1] < 10) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < 4; k++) { if (k === (ai.d + 2) % 4) continue; const ni = ai.i + DIRS[k][0], nj = ai.j + DIRS[k][1]; if (ni < 0 || nj < 0 || ni > N || nj > N) continue; const dd = dist(ni * S, nj * S, px, pz) + (rnd() < 0.15 ? rr(0, 120) : 0); if (dd < bd) { bd = dd; best = k; } }
      if (best < 0) best = chooseDir(ai.i, ai.j, ai.d);
      ai.d = best; ai.i = clamp(ai.i + DIRS[best][0], 0, N); ai.j = clamp(ai.j + DIRS[best][1], 0, N);
    }
    [tx, tz] = lanePoint(ai.i, ai.j, ai.d);
  }
  const r = driveToward(car, tx, tz, car.T.maxSp * car.boost * 0.9, false); c = r.c;
  if (direct && d < 14) c.thr = d < 6 && Math.abs(car.sp) > 9 ? 0.3 : 1;
  if (Math.abs(car.sp) < 2 && d > 7) { ai.stuck += dt; if (ai.stuck > 1.3) { c.thr = -1; c.steer = -c.steer; if (ai.stuck > 2.4) ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
  stepCar(car, c, dt);
  // officers dismount when the suspect is on foot or stopped
  ai.dismount -= dt;
  const onFoot = !P.car || Math.abs(P.car.sp) < 2.5;
  if (ai.dismount <= 0 && onFoot && d < 24 && Math.abs(car.sp) < 6 && W.cops.filter((o) => o.state !== 'dead').length < 3 + w.stars) {
    ai.dismount = 7; spawnOfficer(car.x + Math.cos(car.h) * 2.4, car.z - Math.sin(car.h) * 2.4);
  }
}

function placeRoadblock() {
  const P = W.player, ref = P.car ? Math.atan2(P.car.vx, P.car.vz) : P.h;
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(rnd() * (N + 1)), j = Math.floor(rnd() * (N + 1)), x = i * S, z = j * S, d = dist(x, z, P.x, P.z);
    if (d < 90 || d > 170) continue;
    if (Math.cos(Math.atan2(x - P.x, z - P.z) - ref) < 0.3) continue;
    for (const s of [-1, 1]) { const car = spawnCar('police', x + s * 4.4, z, Math.PI / 2 + (s > 0 ? 0.3 : -0.2), { driver: 'cop' }); car.ai = { mode: 'block' }; car.siren = true; }
    note('Roadblock ahead!', 3); return;
  }
}

export function updatePolice(dt) {
  const w = W.wanted, P = W.player;
  w.stars = starsOf(w.heat);
  for (const ev of W.events) if (ev.type === 'carhit' && w.stars > 0) { /* ramming cops is already part of the chase */ }
  if (w.stars === 0) {
    for (const c of W.cars) if (c.ai?.mode === 'chase') { c.ai.mode = 'traffic'; c.siren = false; c.boost = 1; snapToNode(c); }
    // patrol cars notice nothing on their own; lay-low heat just cools
    w.heat = Math.max(0, w.heat - dt * 0.05); w.arrest = 0; w.spawnT = 0; return;
  }
  // line of sight
  w.sightT = (w.sightT ?? 0) - dt;
  if (w.sightT <= 0) {
    w.sightT = 0.25; let seen = false, near = 999;
    for (const c of W.cars) if (c.type === 'police' && !c.wreck && c.ai && c.ai.mode !== 'traffic') { const d = dist(c.x, c.z, P.x, P.z); near = Math.min(near, d); if (d < 80 && !segBlocked(c.x, c.z, P.x, P.z, 0, 2)) seen = true; }
    for (const o of W.cops) if (o.state !== 'dead') { const d = dist(o.x, o.z, P.x, P.z); near = Math.min(near, d); if (d < 80 && !segBlocked(o.x, o.z, P.x, P.z)) seen = true; }
    w.seen = seen; w.near = near;
  }
  if (w.seen || w.near < 38) w.unseen = 0; else w.unseen += dt;
  if (w.unseen > 8) { w.unseen = 0; const s = w.stars - 1; w.heat = s ? THRESH[s - 1] + 0.01 : 0; if (!s) { note('You lost the cops.', 3); clearWanted(); } else note('Cops lost track of you... keep hiding.', 3); }
  // chasers
  const chasers = W.cars.filter((c) => c.ai?.mode === 'chase' && !c.wreck);
  for (const c of W.cars) if (c.type === 'police' && c.ai?.mode === 'traffic' && !c.wreck && dist(c.x, c.z, P.x, P.z) < 220) { c.ai.mode = 'chase'; c.siren = true; c.ai.stuck = 0; c.ai.dismount = 5; chasers.push(c); }
  w.spawnT -= dt;
  if (chasers.length < TARGET[w.stars] && w.spawnT <= 0) { w.spawnT = 1.6; spawnChaser(); }
  for (const c of chasers) { if (dist(c.x, c.z, P.x, P.z) > 320) { removeCar(c); continue; } chaseStep(c, dt); }
  for (const c of W.cars) if (c.ai?.mode === 'block') { stepCar(c, { thr: 0, steer: 0, hb: true }, dt); if (dist(c.x, c.z, P.x, P.z) > 260) removeCar(c); }
  w.blockT -= dt;
  if (w.stars >= 4 && w.blockT <= 0) { w.blockT = 22; if (W.cars.filter((c) => c.ai?.mode === 'block').length < 4) placeRoadblock(); }
  // arrest: an officer or cruiser right next to a player who is not moving
  const slow = P.car ? Math.abs(P.car.sp) < 3.5 : Math.hypot(P.vx ?? 0, P.vz ?? 0) < 2.5;
  let close = false;
  for (const o of W.cops) if (o.state !== 'dead' && dist(o.x, o.z, P.x, P.z) < 2.8) close = true;
  for (const c of W.cars) if (c.type === 'police' && c !== P.car && !c.wreck && dist(c.x, c.z, P.x, P.z) < 4.2) close = true;
  w.arrest = clamp(w.arrest + (close && slow ? dt : -dt * 1.2), 0, 3);
  w.flash += dt;
}
void pick; void emit;
