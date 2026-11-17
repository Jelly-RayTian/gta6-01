// Vehicle types, meshes, arcade handling physics and car-vs-world / car-vs-car collisions.
import * as THREE from 'three';
import { W, emit, note } from './world.js';
import { WORLD, LIMIT, clamp, angDiff, rr, pick } from './config.js';
import { resolveCircle } from './city.js';
import { smoke, sparks, explosion, shake } from './fx.js';

export const TYPES = {
  sedan: { name: 'Marlin Sedan', maxSp: 36, acc: 15, steer: 1.9, grip: 6.5, hp: 100, len: 4.5, w: 1.9, h: 0.75, cab: 0.65, colors: ['#3a6ea5', '#c9c9c9', '#2e8b57', '#8b2e2e', '#e0e0e0'] },
  taxi: { name: 'Sunny Cab', maxSp: 38, acc: 16, steer: 2.0, grip: 6.8, hp: 100, len: 4.5, w: 1.9, h: 0.75, cab: 0.65, colors: ['#f2c21b'] },
  sports: { name: 'Corsa GT', maxSp: 55, acc: 28, steer: 2.2, grip: 8.5, hp: 90, len: 4.4, w: 1.95, h: 0.62, cab: 0.5, colors: ['#d92b2b', '#f2711c', '#1fa3d6', '#f2e12b'] },
  truck: { name: 'Hauler Truck', maxSp: 28, acc: 9, steer: 1.4, grip: 5.5, hp: 170, len: 6.8, w: 2.5, h: 1.2, cab: 0.9, colors: ['#e8e2d0', '#b04a2a', '#4a6b8a'] },
  police: { name: 'SBPD Cruiser', maxSp: 47, acc: 23, steer: 2.1, grip: 7.5, hp: 120, len: 4.6, w: 1.95, h: 0.75, cab: 0.65, colors: ['#f4f4f4'] },
};
const geo = { box: new THREE.BoxGeometry(1, 1, 1), wheel: new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2) };
const mats = {};
const mat = (c, o = {}) => (mats[c + JSON.stringify(o)] ??= new THREE.MeshLambertMaterial({ color: c, ...o }));
const part = (g, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };

export function carMesh(type, color) {
  const T = TYPES[type], g = new THREE.Group(), bodyColor = type === 'police' ? '#f4f4f4' : color;
  g.add(part(geo.box, mat(bodyColor), 0, 0.55, 0, T.w, T.h * 0.7, T.len));
  if (type === 'truck') { g.add(part(geo.box, mat(bodyColor), 0, 1.5, -1.0, T.w, 2.1, 4.4)); g.add(part(geo.box, mat('#2a3138'), 0, 1.45, 2.35, T.w * 0.96, 0.6, 0.15)); }
  else { g.add(part(geo.box, mat('#222c36'), 0, 0.55 + T.h * 0.35 + T.cab / 2, -0.15, T.w * 0.88, T.cab, T.len * 0.52)); g.add(part(geo.box, mat(bodyColor), 0, 0.55 + T.h * 0.35 + T.cab, -0.15, T.w * 0.84, 0.08, T.len * 0.48)); }
  if (type === 'police') { g.add(part(geo.box, mat('#101418'), 0, 0.62, 0, T.w + 0.02, 0.28, T.len * 0.7)); g.userData.barR = part(geo.box, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -0.4, 1.78, -0.15, 0.7, 0.18, 0.3); g.userData.barB = part(geo.box, new THREE.MeshBasicMaterial({ color: 0x2255ff }), 0.4, 1.78, -0.15, 0.7, 0.18, 0.3); g.add(g.userData.barR, g.userData.barB); }
  if (type === 'taxi') g.add(part(geo.box, mat('#fff7c0', { emissive: 0x554400 }), 0, 1.78, -0.15, 0.7, 0.2, 0.35));
  if (type === 'sports') g.add(part(geo.box, mat('#101418'), 0, 1.02, -1.9, T.w * 0.9, 0.08, 0.5));
  const hl = mat('#ffeeaa', { emissive: 0x665522 }), tl = mat('#ff2a2a', { emissive: 0x550000 });
  for (const sx of [-0.7, 0.7]) { g.add(part(geo.box, hl, sx * T.w / 1.45, 0.62, T.len / 2, 0.3, 0.16, 0.08)); g.add(part(geo.box, tl, sx * T.w / 1.45, 0.62, -T.len / 2, 0.32, 0.16, 0.08)); }
  g.userData.wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const w = part(geo.wheel, mat('#15171a'), sx * (T.w / 2 - 0.05), 0.38, sz * T.len * 0.31, 1, 1, 1); w.scale.set(type === 'truck' ? 1.2 : 1, type === 'truck' ? 1.2 : 1, type === 'truck' ? 1.2 : 1); g.add(w); g.userData.wheels.push(w); }
  return g;
}

let nextId = 1;
export function spawnCar(type, x, z, h, opts = {}) {
  const T = TYPES[type], color = opts.color ?? pick(T.colors);
  const car = { id: nextId++, type, T, x, z, h, vx: 0, vz: 0, sp: 0, lat: 0, steer: 0, hp: T.hp, driver: opts.driver ?? null, ai: opts.ai ?? null, mesh: carMesh(type, color), color, wreck: false, burn: 0, skid: 0, honk: 0, roll: 0, mission: false, siren: false, r: type === 'truck' ? 3 : 2.1 };
  W.scene.add(car.mesh); W.cars.push(car); syncCar(car); return car;
}
export function removeCar(car) { W.scene.remove(car.mesh); const i = W.cars.indexOf(car); if (i >= 0) W.cars.splice(i, 1); }
export function syncCar(car) { const m = car.mesh; m.position.set(car.x, 0, car.z); m.rotation.y = car.h; m.rotation.z = car.roll; for (const w of m.userData.wheels) w.rotation.x += car.sp * 0.016; }

export function damageCar(car, amount, byPlayer = false) {
  if (car.wreck || amount <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.wreck = true; car.hp = 0; car.burn = 14; explosion(car.x, 1, car.z); shake(0.9); emit('boom', car.x, car.z, 1);
    car.mesh.traverse((o) => { if (o.isMesh && o.material.color) { o.material = o.material.clone(); o.material.color.setScalar(0.07); if (o.material.emissive) o.material.emissive.setScalar(0); } });
    if (byPlayer) W.stats.wrecks++;
    car.ai = null; car.vx *= 0.3; car.vz *= 0.3;
  }
}
const lamp = (car, dt) => { if (car.type === 'police' && !car.wreck) { const on = Math.floor(W.time * 7) % 2; car.mesh.userData.barR.visible = !!on; car.mesh.userData.barB.visible = !on; void dt; } };

/** Advance one car with controls { thr:-1..1, steer:-1..1, hb:bool }. */
export function stepCar(car, c, dt) {
  const T = car.T;
  if (car.wreck) c = { thr: 0, steer: 0, hb: true };
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = fz, lz = -fx;
  let sp = car.vx * fx + car.vz * fz, lat = car.vx * lx + car.vz * lz;
  const boost = car.boost ?? 1, maxSp = T.maxSp * boost;
  if (c.thr > 0) { if (sp < -0.5) sp += 30 * dt; else sp += c.thr * T.acc * boost * dt * clamp(1.15 - sp / maxSp, 0, 1); }
  else if (c.thr < 0) { if (sp > 0.6) sp -= 26 * dt; else sp = Math.max(sp + c.thr * T.acc * 0.55 * dt, -maxSp * 0.3); }
  else sp *= 1 - (c.idleBrake ?? 0.3) * dt;
  if (c.hb) sp *= 1 - 1.8 * dt;
  const sgn = sp >= 0 ? 1 : -1, speedFactor = clamp(Math.abs(sp) / 5, 0, 1) / (1 + Math.abs(sp) / 38);
  car.steer += (c.steer - car.steer) * Math.min(1, 7 * dt);
  car.h += car.steer * T.steer * speedFactor * sgn * dt * (c.hb ? 1.5 : 1);
  const grip = c.hb ? 1.4 : T.grip;
  lat *= Math.exp(-grip * dt);
  const nfx = Math.sin(car.h), nfz = Math.cos(car.h);
  car.vx = nfx * sp + nfz * lat; car.vz = nfz * sp - nfx * lat;
  car.sp = sp; car.lat = lat;
  car.x += car.vx * dt; car.z += car.vz * dt;
  car.roll += (-car.steer * clamp(sp / 40, -1, 1) * 0.06 - car.roll) * Math.min(1, 6 * dt);
  car.skid = Math.abs(lat) > 3.2 || (c.hb && Math.abs(sp) > 8) ? 1 : 0;
  if (car.skid && Math.random() < 0.5) smoke(car.x - nfx * 1.5, 0.2, car.z - nfz * 1.5, 0.85);
  if (car.burn > 0) { car.burn -= dt; smoke(car.x, 1.2, car.z, 0.15); }
  else if (car.hp < 35 && !car.wreck) smoke(car.x + nfx * 1.6, 1.0, car.z + nfz * 1.6, 0.3);
  collideCarWorld(car);
  car.x = clamp(car.x, -LIMIT, WORLD + LIMIT); car.z = clamp(car.z, -LIMIT, WORLD + LIMIT);
  lamp(car, dt); syncCar(car);
}

function collideCarWorld(car) {
  const fx = Math.sin(car.h), fz = Math.cos(car.h), off = car.T.len * 0.28;
  for (const o of [off, -off]) {
    const p = { x: car.x + fx * o, z: car.z + fz * o }, ox = p.x, oz = p.z;
    const n = resolveCircle(p, car.T.w * 0.55);
    if (!n) continue;
    car.x += p.x - ox; car.z += p.z - oz;
    const vn = car.vx * n.x + car.vz * n.z;
    if (vn < 0) {
      car.vx -= 1.35 * vn * n.x; car.vz -= 1.35 * vn * n.z;
      const hit = -vn; if (hit > 4) { damageCar(car, (hit - 3) * 2.2, false); sparks(p.x - n.x * 0.5, 0.8, p.z - n.z * 0.5, 6); emit('crash', car.x, car.z, Math.min(1, hit / 15)); if (car.driver === 'player') shake(Math.min(0.8, hit / 22)); }
    }
  }
}

/** Resolve overlaps between every pair of cars (and tell listeners about hard hits). */
export function collideCars() {
  const cs = W.cars;
  for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
    const A = cs[a], B = cs[b], dx = B.x - A.x, dz = B.z - A.z, min = A.r + B.r - 0.6;
    if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
    const d = Math.hypot(dx, dz);
    if (d >= min || d < 1e-3) continue;
    const nx = dx / d, nz = dz / d, push = (min - d) / 2;
    A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
    const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
    if (rv < 0) {
      const mA = A.type === 'truck' ? 2.5 : 1, mB = B.type === 'truck' ? 2.5 : 1, j = -(1.4) * rv / (1 / mA + 1 / mB);
      A.vx -= nx * j / mA; A.vz -= nz * j / mA; B.vx += nx * j / mB; B.vz += nz * j / mB;
      const hit = -rv;
      if (hit > 3) {
        damageCar(A, (hit - 2) * 2 * mB, B.driver === 'player'); damageCar(B, (hit - 2) * 2 * mA, A.driver === 'player');
        sparks((A.x + B.x) / 2, 0.9, (A.z + B.z) / 2, 8); emit('crash', A.x, A.z, Math.min(1, hit / 14));
        if (A.driver === 'player' || B.driver === 'player') shake(Math.min(0.9, hit / 18));
        emit('carhit', A.x, A.z, hit); A.hitBy = B; B.hitBy = A; A.hitT = B.hitT = W.time;
      }
    }
  }
}
export const carName = (car) => car.T.name;
void note; void rr; void angDiff;
