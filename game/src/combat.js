// Combat: the player's pistol and fists, gunmen (rival crew and police officers) with cover-taking AI,
// damage to the player, and pickups (cash, ammo, health).
import * as THREE from 'three';
import { W, emit, note } from './world.js';
import { rnd, rr, pick, clamp, dist, DT, angDiff, LIMIT, WORLD } from './config.js';
import { segBlocked, resolveCircle } from './city.js';
import { humanMesh, animateHuman, hurtPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { flash, tracer, sparks, shake, hurtFlash, smoke } from './fx.js';
import { crime } from './police.js';

// ---- pickups -----------------------------------------------------------------------------------
const PK = { cash: ['#3ddc84', 0.5], ammo: ['#ffb02e', 0.55], health: ['#ff4d6d', 0.6] };
export function dropPickup(type, x, z, val) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(PK[type][1], PK[type][1] * (type === 'cash' ? 0.25 : 0.8), PK[type][1] * 0.7), new THREE.MeshLambertMaterial({ color: PK[type][0], emissive: PK[type][0], emissiveIntensity: 0.35 }));
  m.position.set(x, 0.7, z); W.scene.add(m);
  W.pickups.push({ type, x, z, val, mesh: m, ttl: type === 'cash' && val < 100 ? 60 : 1e9 });
}
export function placePickups(spots) { for (const [t, x, z] of spots) dropPickup(t, x, z, t === 'cash' ? 150 : t === 'ammo' ? 24 : 50); }
export function updatePickups(dt) {
  const P = W.player, reach = P.car ? 3.2 : 1.7;
  for (let k = W.pickups.length - 1; k >= 0; k--) {
    const p = W.pickups[k]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.7 + Math.sin(W.time * 3 + k) * 0.12; p.ttl -= dt;
    if (p.ttl <= 0 || (dist(p.x, p.z, P.x, P.z) < reach && !(p.type === 'health' && P.hp >= 100))) {
      if (p.ttl > 0) {
        if (p.type === 'cash') { W.money += p.val; note(`+$${p.val}`, 1.5); } else if (p.type === 'ammo') { P.reserve = Math.min(240, P.reserve + p.val); note(`+${p.val} ammo`, 1.5); } else { P.hp = Math.min(100, P.hp + p.val); note('+health', 1.5); }
        emit('pickup', p.x, p.z);
      }
      W.scene.remove(p.mesh); W.pickups.splice(k, 1);
    }
  }
}

// ---- damage to the player ------------------------------------------------------------------------
export function damagePlayer(dmg, fx = 0, fz = 0) {
  const P = W.player; if (P.hp <= 0) return;
  P.hp -= dmg; hurtFlash(0.35 + dmg / 30); shake(0.25 + dmg / 40); emit('hurt', P.x, P.z);
  if (fx || fz) { P.vx += fx; P.vz += fz; }
}

// ---- gunmen --------------------------------------------------------------------------------------
export function spawnEnemy(x, z, boss = false) {
  const e = { kind: 'enemy', x, z, h: 0, hp: boss ? 170 : 55, maxHp: boss ? 170 : 55, boss, state: 'peek', t: rr(0.5, 2), fire: rr(0.4, 1.2), phase: 0, mesh: humanMesh(boss ? '#ffffff' : '#7a1f2b', '#202020', undefined, boss ? '#d4af37' : '#111'), aggro: false, hit: 0 };
  if (boss) e.mesh.scale.setScalar(1.12);
  e.mesh.position.set(x, 0, z); W.scene.add(e.mesh); W.enemies.push(e); return e;
}
export function spawnOfficer(x, z) {
  const e = { kind: 'cop', x, z, h: 0, hp: 50, maxHp: 50, state: 'peek', t: 0, fire: rr(0.6, 1.4), phase: 0, mesh: humanMesh('#27408b', '#1b2a52', undefined, '#10193a'), aggro: true, hit: 0 };
  e.mesh.position.set(x, 0, z); W.scene.add(e.mesh); W.cops.push(e); return e;
}
export function clearGunmen() { for (const list of [W.enemies, W.cops]) { for (const e of list) W.scene.remove(e.mesh); list.length = 0; } }

export function hurtGunner(e, dmg, byPlayer = true) {
  if (e.state === 'dead') return;
  e.hp -= dmg * (e.state === 'duck' ? 0.6 : 1); e.aggro = true; e.hit = 0.15;
  if (e.hp > 0) { if (byPlayer && e.kind === 'cop') crime(1, e.x, e.z, true); return; }
  e.state = 'dead'; e.t = 0; e.mesh.rotation.x = -Math.PI / 2; e.mesh.position.y = 0.25; e.mesh.scale.y = 1;
  if (byPlayer) { W.stats.kills++; emit('kill', e.x, e.z); }
  if (e.kind === 'cop') crime(3.5, e.x, e.z, true);
  dropPickup(rnd() < 0.5 ? 'ammo' : 'cash', e.x, e.z, rnd() < 0.5 ? 12 : Math.floor(rr(40, 140)));
}

function gunnerShoot(e, tx, tz, acc) {
  const P = W.player, d = dist(e.x, e.z, tx, tz), mx = e.x + Math.sin(e.h) * 0.6, mz = e.z + Math.cos(e.h) * 0.6;
  flash(mx, 1.4, mz); emit('shot', e.x, e.z, 0.5); emit('gunfire', e.x, e.z, 0.4);
  const hit = rnd() < clamp(acc - d / 90, 0.08, 0.9);
  const tgt = { x: tx + (hit ? 0 : rr(-2, 2)), y: 1.1 + (hit ? 0 : rr(-0.5, 0.5)), z: tz + (hit ? 0 : rr(-2, 2)) };
  tracer({ x: mx, y: 1.4, z: mz }, tgt);
  if (hit) { if (P.car) { damageCar(P.car, 3.5); sparks(P.car.x, 1, P.car.z, 3); } else damagePlayer(e.kind === 'cop' ? 5 : 6.5, 0, 0); }
}
export function updateGunmen(dt) {
  const P = W.player, tx = P.x, tz = P.z;
  for (const list of [W.enemies, W.cops]) for (let k = list.length - 1; k >= 0; k--) {
    const e = list[k];
    e.hit = Math.max(0, e.hit - dt);
    if (e.state === 'dead') { e.t += dt; if (e.t > 18) { W.scene.remove(e.mesh); list.splice(k, 1); } continue; }
    const d = dist(e.x, e.z, tx, tz), los = d < 60 && !segBlocked(e.x, e.z, tx, tz);
    if (!e.aggro && d < 38 && los) e.aggro = true;
    let vx = 0, vz = 0, spd = 0;
    if (e.aggro) {
      e.h = Math.atan2(tx - e.x, tz - e.z);
      const side = Math.cos(W.time * 0.7 + k) > 0 ? 1 : -1;
      if (e.kind === 'enemy') {
        e.t -= dt;
        if (e.t <= 0) { e.state = e.state === 'peek' ? 'duck' : 'peek'; e.t = e.state === 'peek' ? rr(1.6, 2.6) : rr(1.1, 2); }
        if (e.state === 'peek') { if (d > 24) { spd = 3.2; vx = Math.sin(e.h); vz = Math.cos(e.h); } else if (d < 9) { spd = 2.4; vx = -Math.sin(e.h); vz = -Math.cos(e.h); } else { spd = 1.4; vx = Math.cos(e.h) * side; vz = -Math.sin(e.h) * side; } }
        e.mesh.scale.y = e.state === 'duck' ? 0.6 : (e.boss ? 1.12 : 1);
      } else if (d > 11 || !los) { spd = 4.2; vx = Math.sin(e.h); vz = Math.cos(e.h); } else if (d < 5 && !W.wanted.arrest) { spd = 0; }
      e.fire -= dt;
      if (e.fire <= 0 && los && d < 55 && e.state !== 'duck') { e.fire = e.kind === 'cop' ? rr(1.0, 1.7) : rr(0.7, 1.3); gunnerShoot(e, tx, tz, e.kind === 'cop' ? 0.55 : 0.6); }
    } else if (e.kind === 'enemy') e.mesh.scale.y = e.boss ? 1.12 : 1;
    e.x += vx * spd * dt; e.z += vz * spd * dt; resolveCircle(e, 0.45); e.x = clamp(e.x, -LIMIT, WORLD + LIMIT); e.z = clamp(e.z, -LIMIT, WORLD + LIMIT);
    e.phase += spd * dt * 2.2; e.mesh.position.set(e.x, 0, e.z); e.mesh.rotation.y = e.h; animateHuman(e.mesh, e.phase, spd ? 0.7 : 0);
    e.mesh.children[0].material.emissive?.setScalar(e.hit > 0 ? 0.6 : 0);
  }
}

// ---- the player's weapon -------------------------------------------------------------------------
const targets = () => [...W.enemies.filter((e) => e.state !== 'dead'), ...W.cops.filter((e) => e.state !== 'dead'), ...W.peds.filter((p) => p.state !== 'dead')];
export function startReload() { const P = W.player; if (P.reloadT > 0 || P.ammo >= 12 || P.reserve <= 0) return; P.reloadT = 1.3; emit('reload', P.x, P.z); }

/** Fire the pistol along the camera ray (or at `aimAt`), with a little aim assist toward the nearest person. */
export function playerFire(aimAt) {
  const P = W.player, cam = W.camera;
  const mx = P.x + Math.sin(P.h) * 0.7, mz = P.z + Math.cos(P.h) * 0.7, my = 1.4;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  if (aimAt) dir.set(aimAt.x - mx, 1.1 - my, aimAt.z - mz).normalize();
  const org = new THREE.Vector3(mx, my, mz);
  let best = null, bestScore = 0.1;
  for (const t of targets()) {                 // aim assist: nearest target inside a cone around the ray
    const v = new THREE.Vector3(t.x - mx, 1.1 - my, t.z - mz), l = v.length(); if (l < 1) continue;
    const ang = Math.acos(clamp(v.normalize().dot(dir), -1, 1));
    if (ang < bestScore && !segBlocked(mx, mz, t.x, t.z)) { bestScore = ang; best = t; }
  }
  if (best) dir.set(best.x - mx, 1.1 - my, best.z - mz).normalize();
  dir.x += rr(-0.012, 0.012); dir.z += rr(-0.012, 0.012); dir.normalize();
  let hitT = 70, victim = best, car = null;
  for (const c of W.cars) { if (c.wreck || c === P.car) continue; const v = new THREE.Vector3(c.x - mx, 0.9 - my, c.z - mz), t = v.dot(dir); if (t > 0 && t < hitT && v.addScaledVector(dir, -t).length() < 1.7) { hitT = t; car = c; victim = null; } }
  if (best) { const t = Math.hypot(best.x - mx, best.z - mz); if (t < hitT) { hitT = t; car = null; victim = best; } }
  const end = org.clone().addScaledVector(dir, hitT);
  for (let s = 1; s * 2 < hitT; s++) { const px = mx + dir.x * s * 2, pz = mz + dir.z * s * 2; if (segBlocked(mx, mz, px, pz) || (dir.y < 0 && my + dir.y * s * 2 < 0)) { hitT = s * 2; end.copy(org).addScaledVector(dir, hitT); victim = null; car = null; sparks(end.x, Math.max(0.2, end.y), end.z, 4); break; } }
  tracer(org, end); flash(mx, my, mz); shake(0.12); emit('shot', P.x, P.z, 1); W.stats.shots++;
  crime(0.12, P.x, P.z);
  if (victim) {
    if (victim.kind === 'ped') hurtPed(victim, 22, P.x, P.z); else { hurtGunner(victim, 22); victim.aggro = true; }
    sparks(victim.x, 1.2, victim.z, 5);
  } else if (car) { damageCar(car, 9, true); sparks(end.x, end.y, end.z, 5); car.ai?.mode === 'traffic' && (car.ai.ignore = 3); if (car.driver === 'ai' || car.driver === 'cop') crime(0.6, car.x, car.z); }
}
export function updateWeapon(dt, inp) {
  const P = W.player; P.cool = Math.max(0, P.cool - dt);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { const n = Math.min(12 - P.ammo, P.reserve); P.ammo += n; P.reserve -= n; } }
  if (P.car || P.hp <= 0) return;
  if (inp.reload) startReload();
  if (inp.fire && P.cool <= 0 && P.reloadT <= 0) {
    if (P.ammo > 0) { P.ammo--; P.cool = 0.2; P.h = inp.aimAt ? Math.atan2(inp.aimAt.x - P.x, inp.aimAt.z - P.z) : W.cam.yaw; P.fireT = 0.25; playerFire(inp.aimAt); if (P.ammo === 0) startReload(); }
    else { P.cool = 0.4; emit('click', P.x, P.z); startReload(); }
  }
  P.fireT = Math.max(0, (P.fireT ?? 0) - dt);
  // melee
  P.punchCool = Math.max(0, (P.punchCool ?? 0) - dt); P.punchT = Math.max(0, (P.punchT ?? 0) - dt);
  if (inp.melee && P.punchCool <= 0) {
    P.punchCool = 0.5; P.punchT = 0.25; emit('punch', P.x, P.z);
    const fx = Math.sin(P.h), fz = Math.cos(P.h);
    for (const t of targets()) { const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz); if (d < 2.3 && (dx * fx + dz * fz) / (d || 1) > 0.3) { if (t.kind === 'ped') { hurtPed(t, 15, P.x, P.z); t.x += fx * 1.2; t.z += fz * 1.2; } else { hurtGunner(t, 18); t.x += fx * 1.2; t.z += fz * 1.2; } sparks(t.x, 1.3, t.z, 3); shake(0.15); } }
  }
}
void pick; void smoke; void angDiff; void DT;
