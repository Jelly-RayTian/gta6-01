// Pedestrians (and the human mesh shared by the player, cops and gang members): sidewalk walking,
// fleeing from gunfire and speeding cars, being hit.
import * as THREE from 'three';
import { W, emit } from './world.js';
import { S, N, DIRS, rnd, rr, pick, clamp, dist, WORLD, LIMIT } from './config.js';
import { resolveCircle } from './city.js';
import { chooseDir } from './traffic.js';
import { crime } from './police.js';
import { dropPickup } from './combat.js';

const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(0.17, 10, 8);
const lm = {}; const mat = (c) => (lm[c] ??= new THREE.MeshLambertMaterial({ color: c }));
const SHIRTS = ['#e84c4c', '#f2c94c', '#4cc9e8', '#7bd88f', '#c084fc', '#ff9f6b', '#f5f5f5', '#2d6cdf'];
const SKINS = ['#f1c8a0', '#d9a273', '#a9754b', '#7a4f33', '#f6d9b8'];

/** A low-poly person: torso, head, hair/cap, two legs and arms that swing while moving. */
export function humanMesh(shirt, pants = '#34405a', skin = pick(SKINS), cap = null) {
  const g = new THREE.Group(), add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  add(box, mat(shirt), 0, 1.2, 0, 0.5, 0.6, 0.28);
  const head = add(ball, mat(skin), 0, 1.68, 0, 1.2, 1.3, 1.2);
  add(box, mat(cap ?? pick(['#2b2118', '#6b4a2a', '#c9a24a', '#1a1a1a'])), 0, 1.78, -0.02, 0.3, cap ? 0.12 : 0.09, 0.32);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.12, 0.85, 0); const l = new THREE.Mesh(box, mat(pants)); l.scale.set(0.19, 0.85, 0.2); l.position.y = -0.42; l.castShadow = true; p.add(l); g.add(p); return p; });
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.33, 1.45, 0); const l = new THREE.Mesh(box, mat(shirt)); l.scale.set(0.14, 0.58, 0.16); l.position.y = -0.28; p.add(l); g.add(p); return p; });
  g.userData = { legs, arms, head };
  return g;
}
export function animateHuman(g, phase, amount) {
  const { legs, arms } = g.userData; const s = Math.sin(phase) * amount;
  legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.x = -s * 0.8; arms[1].rotation.x = s * 0.8;
}

export function spawnPed(i, j, d) {
  const side = rnd() < 0.5 ? 1 : -1, p = { x: 0, z: 0, h: 0, i, j, d, side, state: 'walk', t: 0, hp: 30, phase: rnd() * 6, speed: rr(1.1, 1.7), mesh: humanMesh(pick(SHIRTS), pick(['#34405a', '#59503c', '#2b2b2b', '#7a6a4f'])), kind: 'ped', fleeFrom: null };
  retarget(p, true); p.mesh.position.set(p.x, 0, p.z); W.scene.add(p.mesh); W.peds.push(p); return p;
}
const cornerPoint = (p) => { const rx = -DIRS[p.d][1], rz = DIRS[p.d][0]; return [p.i * S + rx * 10 * p.side, p.j * S + rz * 10 * p.side]; };
function retarget(p, init) {
  if (init) { const [tx, tz] = cornerPoint(p); p.x = tx - DIRS[p.d][0] * rr(0, S - 12); p.z = tz - DIRS[p.d][1] * rr(0, S - 12); p.x = clamp(p.x, -4, WORLD + 4); p.z = clamp(p.z, -4, WORLD + 4); }
  [p.tx, p.tz] = cornerPoint(p);
}
export function populatePeds(count = 46) { for (let k = 0; k < count; k++) { const d = Math.floor(rnd() * 4), i = d % 2 ? Math.floor(rnd() * (N + 1)) : Math.floor(rnd() * N) + (d === 0 ? 1 : 0), j = d % 2 ? Math.floor(rnd() * N) + (d === 1 ? 1 : 0) : Math.floor(rnd() * (N + 1)); spawnPed(clamp(i, 0, N), clamp(j, 0, N), d); } }

export function hurtPed(p, dmg, fromX, fromZ, byPlayer = true) {
  if (p.state === 'dead') return;
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.state = 'dead'; p.t = 0; p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.y = 0.2;
    if (byPlayer) { W.stats.kills++; emit('kill', p.x, p.z); crime(2.2, p.x, p.z); }
    dropPickup('cash', p.x, p.z, Math.floor(rr(20, 90)));
  } else { p.state = 'flee'; p.t = 7; p.fleeFrom = [fromX, fromZ]; if (byPlayer) crime(1.2, p.x, p.z); }
}

export function updatePeds(dt) {
  const P = W.player;
  for (const ev of W.events) if (ev.type === 'shot' || ev.type === 'boom' || ev.type === 'scream') for (const p of W.peds) if (p.state !== 'dead' && dist(p.x, p.z, ev.x, ev.z) < (ev.type === 'boom' ? 60 : 38)) { p.state = 'flee'; p.t = rr(5, 8); p.fleeFrom = [ev.x, ev.z]; }
  for (let k = W.peds.length - 1; k >= 0; k--) {
    const p = W.peds[k];
    if (p.state === 'dead') { p.t += dt; if (p.t > 25) { W.scene.remove(p.mesh); W.peds.splice(k, 1); const d = Math.floor(rnd() * 4); spawnPed(clamp(Math.floor(rnd() * N), 0, N), Math.floor(rnd() * N), d); } continue; }
    // vehicles speeding at us
    for (const c of W.cars) {
      const sp = Math.hypot(c.vx, c.vz); if (sp < 3 || c.wreck) continue;
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d < 1.7 && sp > 3.5) {   // run over
        hurtPed(p, sp * 4, c.x, c.z, c.driver === 'player'); p.mesh.rotation.x = -Math.PI / 2; if (p.state === 'dead') { emit('thud', p.x, p.z); if (c.driver === 'player') { W.stats.kills++; } } continue;
      }
      if (d < 14 && sp > 8 && (dx * c.vx + dz * c.vz) < 0 && p.state !== 'flee') { p.state = 'flee'; p.t = 4; p.fleeFrom = [c.x - c.vx, c.z - c.vz]; }
    }
    if (p.state === 'dead') continue;
    let vx = 0, vz = 0, spd = p.speed;
    if (p.state === 'flee') {
      p.t -= dt; spd = 5.2; const [fx, fz] = p.fleeFrom, dx = p.x - fx, dz = p.z - fz, d = Math.hypot(dx, dz) || 1;
      vx = dx / d; vz = dz / d;
      if (p.t <= 0) { p.state = 'walk'; p.i = clamp(Math.round(p.x / S), 0, N); p.j = clamp(Math.round(p.z / S), 0, N); p.d = Math.floor(rnd() * 4); retarget(p); }
    } else {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 1.5) { const nd = chooseDir(p.i, p.j, p.d); p.d = nd; p.i = clamp(p.i + DIRS[nd][0], 0, N); p.j = clamp(p.j + DIRS[nd][1], 0, N); if (rnd() < 0.2) p.side *= -1; retarget(p); }
      else { vx = dx / d; vz = dz / d; }
    }
    p.x += vx * spd * dt; p.z += vz * spd * dt;
    resolveCircle(p, 0.4); p.x = clamp(p.x, -LIMIT, WORLD + LIMIT); p.z = clamp(p.z, -LIMIT, WORLD + LIMIT);
    if (vx || vz) p.h = Math.atan2(vx, vz);
    p.phase += spd * dt * 2.4;
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.h; animateHuman(p.mesh, p.phase, p.state === 'flee' ? 0.9 : 0.5);
  }
  void P;
}
