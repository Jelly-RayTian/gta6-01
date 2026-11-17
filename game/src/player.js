// The player: on-foot movement, entering / leaving / driving vehicles, taking hits from cars.
import { W, emit, note } from './world.js';
import { rnd, clamp, dist, angDiff, WORLD, LIMIT } from './config.js';
import { resolveCircle, inSolid } from './city.js';
import { humanMesh, animateHuman, spawnPed } from './pedestrians.js';
import { stepCar, damageCar, carName } from './vehicles.js';
import { crime } from './police.js';
import { damagePlayer } from './combat.js';
import { shake, smoke } from './fx.js';

export function createPlayer(x, z) {
  const mesh = humanMesh('#f0c419', '#2f4f8a', '#e2b38c', '#c9402a');
  W.scene.add(mesh);
  W.player = { kind: 'player', x, z, y: 0, vy: 0, vx: 0, vz: 0, h: 0, hp: 100, car: null, mesh, phase: 0, ammo: 12, reserve: 72, reloadT: 0, cool: 0, fireT: 0, punchT: 0, ground: true, enterCool: 0 };
}
export function nearestCar(P, range = 3.8) {
  let best = null, bd = range;
  for (const c of W.cars) { if (c.wreck) continue; const d = dist(c.x, c.z, P.x, P.z); if (d < bd && Math.hypot(c.vx, c.vz) < 9) { bd = d; best = c; } }
  return best;
}
export function enterCar(car) {
  const P = W.player;
  if (car.driver === 'ai' || car.driver === 'cop') {
    const side = { x: car.x + Math.cos(car.h) * 2.4, z: car.z - Math.sin(car.h) * 2.4 };
    const p = spawnPed(Math.round(side.x / 90), Math.round(side.z / 90), 0); p.x = side.x; p.z = side.z; p.state = 'flee'; p.t = 8; p.fleeFrom = [car.x, car.z]; emit('scream', car.x, car.z);
    crime(car.type === 'police' ? 5 : 1.3, car.x, car.z); W.stats.stolen++;
  }
  car.driver = 'player'; car.ai = null; car.siren = false; car.boost = 1; P.car = car; P.mesh.visible = false; P.enterCool = 0.4; emit('door', car.x, car.z);
  note(`${carName(car)}`, 2);
}
export function leaveCar() {
  const P = W.player, car = P.car; if (!car) return;
  for (const s of [1, -1]) {
    const x = car.x + Math.cos(car.h) * 2.5 * s, z = car.z - Math.sin(car.h) * 2.5 * s;
    if (!inSolid(x, z, 0.6)) { P.x = x; P.z = z; break; }
    P.x = car.x - Math.sin(car.h) * 3; P.z = car.z - Math.cos(car.h) * 3;
  }
  car.driver = null; P.car = null; P.mesh.visible = true; P.vx = P.vz = 0; P.enterCool = 0.4; emit('door', car.x, car.z);
}

export function updatePlayer(dt, inp) {
  const P = W.player; P.enterCool -= dt;
  if (P.car) {
    const car = P.car;
    stepCar(car, inp.ctl ?? { thr: (inp.fwd ? 1 : 0) - (inp.back ? 1 : 0), steer: (inp.left ? 1 : 0) - (inp.right ? 1 : 0), hb: inp.hb, idleBrake: 0.5 }, dt);
    if (inp.horn) car.honk = 0.2;
    P.x = car.x; P.z = car.z; P.h = car.h; P.vx = car.vx; P.vz = car.vz;
    W.stats.distance += Math.hypot(car.vx, car.vz) * dt;
    if (car.wreck && car.burn > 12) { P.hp -= 70; leaveCar(); P.vy = 5; shake(1); }
    if (inp.enter && P.enterCool <= 0 && Math.hypot(car.vx, car.vz) < 12) leaveCar();
    return;
  }
  // walking
  const cy = Math.cos(W.cam.yaw), sy = Math.sin(W.cam.yaw);
  const f = (inp.fwd ? 1 : 0) - (inp.back ? 1 : 0), r = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let mx = sy * f - cy * r, mz = cy * f + sy * r;   // camera right is (-cos, sin)
  const len = Math.hypot(mx, mz); if (len > 0) { mx /= len; mz /= len; }
  const speed = (inp.sprint && !inp.aim ? 7.6 : inp.aim ? 2.6 : 4.4) * (P.reloadT > 0 ? 0.8 : 1);
  P.vx += (mx * speed - P.vx) * Math.min(1, dt * 10); P.vz += (mz * speed - P.vz) * Math.min(1, dt * 10);
  if (inp.jump && P.ground) { P.vy = 6.8; P.ground = false; }
  P.vy -= 20 * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) { P.vy = 0; P.ground = true; }
  P.x += P.vx * dt; P.z += P.vz * dt;
  resolveCircle(P, 0.45);
  for (const c of W.cars) {   // cars are solid; fast ones hurt
    const fx = Math.sin(c.h), fz = Math.cos(c.h), off = c.T.len * 0.27;
    for (const o of [off, 0, -off]) {
      const dx = P.x - (c.x + fx * o), dz = P.z - (c.z + fz * o), d = Math.hypot(dx, dz), min = c.T.w * 0.5 + 0.5;
      if (d < min && d > 1e-3 && P.y < 1.2) {
        P.x += (dx / d) * (min - d); P.z += (dz / d) * (min - d);
        const sp = Math.hypot(c.vx, c.vz);
        if (sp > 5 && !c.wreck) { damagePlayer(sp * 1.6, c.vx * 0.3, c.vz * 0.3); emit('thud', P.x, P.z); if (c.driver === 'ai') c.ai.ignore = 0; }
      }
    }
  }
  P.x = clamp(P.x, -LIMIT, WORLD + LIMIT); P.z = clamp(P.z, -LIMIT, WORLD + LIMIT);
  const moving = Math.hypot(P.vx, P.vz);
  const face = inp.aim || P.fireT > 0 ? W.cam.yaw : moving > 0.5 ? Math.atan2(P.vx, P.vz) : P.h;
  if (inp.aimAt) P.h = Math.atan2(inp.aimAt.x - P.x, inp.aimAt.z - P.z); else P.h += angDiff(face, P.h) * Math.min(1, dt * 14);
  W.stats.distance += moving * dt;
  P.phase += moving * dt * 2.2; P.mesh.position.set(P.x, P.y, P.z); P.mesh.rotation.y = P.h;
  animateHuman(P.mesh, P.phase, clamp(moving / 8, 0, 0.9));
  P.mesh.userData.arms[1].rotation.x = P.punchT > 0 ? -1.5 : P.fireT > 0 || inp.aim ? -1.45 : P.mesh.userData.arms[1].rotation.x;
  // interaction
  if (inp.enter && P.enterCool <= 0) { const c = nearestCar(P); if (c) enterCar(c); }
}
void rnd; void smoke; void damageCar;
