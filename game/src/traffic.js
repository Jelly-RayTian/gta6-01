// AI drivers: traffic that follows the road grid lane by lane, stops for obstacles and honks;
// the same pursuit steering is reused by police (police.js) through driveToward().
import { W, emit } from './world.js';
import { S, N, DIRS, rnd, rr, pick, clamp, angDiff } from './config.js';
import { spawnCar, stepCar, removeCar } from './vehicles.js';

const laneOffset = 4.2;
export const lanePoint = (i, j, d) => [i * S + -DIRS[d][1] * laneOffset, j * S + DIRS[d][0] * laneOffset];

export function chooseDir(i, j, d) {
  const opts = [];
  for (let k = 0; k < 4; k++) { if (k === (d + 2) % 4) continue; const ni = i + DIRS[k][0], nj = j + DIRS[k][1]; if (ni < 0 || nj < 0 || ni > N || nj > N) continue; opts.push(k, ...(k === d ? [k, k] : [])); }
  return opts.length ? pick(opts) : (d + 2) % 4;
}
export function spawnTrafficCar(type, i, j, d, extra = {}) {
  // (i,j) is the segment's low-end node; d the travel direction along it.
  const [lx, lz] = lanePoint(i, j, d), along = rr(10, S - 10);
  const x = lx + Math.abs(DIRS[d][0]) * along, z = lz + Math.abs(DIRS[d][1]) * along;
  const car = spawnCar(type, x, z, Math.atan2(DIRS[d][0], DIRS[d][1]), { driver: 'ai', ...extra });
  car.ai = { mode: 'traffic', i: i + (d === 0 ? 1 : 0), j: j + (d === 1 ? 1 : 0), d, blocked: 0, ignore: 0, speedMul: rr(0.85, 1.1) };
  return car;
}
export function spawnParked(i, j, d) {
  const [lx, lz] = lanePoint(i, j, d), along = rr(14, S - 14), side = 2.6; // curb lane, outside the travel lane
  const x = lx + Math.abs(DIRS[d][0]) * along - DIRS[d][1] * side, z = lz + Math.abs(DIRS[d][1]) * along + DIRS[d][0] * side;
  return spawnCar(pick(['sedan', 'sedan', 'taxi', 'sports', 'truck']), x, z, Math.atan2(DIRS[d][0], DIRS[d][1]), {});
}
export function populateTraffic(count = 26, parked = 16) {
  const edge = () => { const r = Math.floor(rnd() * (N + 1)), sg = Math.floor(rnd() * N); return rnd() < 0.5 ? [r, sg, 1 + Math.floor(rnd() * 2) * 2] : [sg, r, Math.floor(rnd() * 2) * 2]; };
  for (let k = 0; k < count; k++) { const [i, j, d] = edge(); spawnTrafficCar(pick(['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck']), i, j, d); }
  for (let k = 0; k < parked; k++) { const [i, j, d] = edge(); spawnParked(i, j, d); }
}

/** Steer a car toward a point. Returns the controls and the heading error. */
export function driveToward(car, tx, tz, cruise, careful = true) {
  const want = Math.atan2(tx - car.x, tz - car.z), err = angDiff(want, car.h), speed = car.sp;
  const turn = Math.abs(err);
  const target = turn > 0.9 ? 5 : turn > 0.45 ? 9 : cruise;
  const c = { steer: clamp(err * 2.4, -1, 1), thr: 0, hb: false };
  if (speed < target - 1) c.thr = 1; else if (speed > target + 2) c.thr = -0.6; else c.thr = speed < target ? 0.3 : 0;
  if (!careful && turn > 1.6 && speed > 6) c.thr = -1;
  return { c, err, want };
}

export function obstacleAhead(car, range) {
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = fz, lz = -fx;
  let best = 99, what = null;
  const test = (x, z, lateral, o) => { const dx = x - car.x, dz = z - car.z, ah = dx * fx + dz * fz, sd = dx * lx + dz * lz; if (ah > 0.5 && ah < range && Math.abs(sd) < lateral && ah < best) { best = ah; what = o; } };
  for (const o of W.cars) if (o !== car && !(o.wreck && o.burn <= 0 && false)) test(o.x, o.z, 2.3 + (o.r - 2) * 0.4, o);
  for (const p of W.peds) if (p.state !== 'dead') test(p.x, p.z, 1.6, p);
  const P = W.player; if (!P.car) test(P.x, P.z, 1.6, P);
  return { dist: best, what };
}

export function updateTraffic(dt) {
  for (const car of W.cars) {
    const ai = car.ai;
    if (!ai || ai.mode !== 'traffic' || car.wreck) continue;
    const [tx, tz] = lanePoint(ai.i, ai.j, ai.d);
    const nx = DIRS[ai.d][0], nz = DIRS[ai.d][1];
    // reached the node: pick the next leg
    const remaining = (tx - car.x) * nx + (tz - car.z) * nz;
    if (remaining < 10) {
      const nd = chooseDir(ai.i, ai.j, ai.d); ai.d = nd; ai.i = clamp(ai.i + DIRS[nd][0], 0, N); ai.j = clamp(ai.j + DIRS[nd][1], 0, N);
    }
    const [px, pz] = lanePoint(ai.i, ai.j, ai.d);
    const cruise = car.type.maxSp ? 0 : 0, base = car.T.maxSp * 0.42 * ai.speedMul;
    void cruise;
    const { c } = driveToward(car, px, pz, base);
    const ob = obstacleAhead(car, 7 + Math.max(0, car.sp) * 0.9);
    if (ob.dist < 99 && ai.ignore <= 0) {
      const stopAt = 3.8; c.thr = ob.dist < stopAt + car.sp * 0.4 ? -1 : 0;
      ai.blocked += dt;
      if (ai.blocked > 0.8 && ai.blocked < 0.85 && (ob.what === W.player || ob.what?.state)) { car.honk = 0.5; emit('honk', car.x, car.z, 1); }
      if (ai.blocked > 4) { ai.ignore = 2.5; ai.blocked = 0; car.honk = 0.5; emit('honk', car.x, car.z, 1); }
    } else { ai.blocked = Math.max(0, ai.blocked - dt); ai.ignore -= dt; }
    car.honk = Math.max(0, car.honk - dt);
    stepCar(car, c, dt);
  }
  // idle cars (parked, stolen and left, wrecks) just coast to a stop
  for (const car of W.cars) if (!car.ai && car.driver !== 'player') stepCar(car, { thr: 0, steer: 0, hb: car.wreck || Math.abs(car.sp) < 6 }, dt);
}
export { removeCar };
