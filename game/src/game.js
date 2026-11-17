// The simulation: resets the world and advances every system one fixed step, handling death and arrest.
import { W, note, banner, emit } from './world.js';
import { seedRng, clamp, DT, rnd } from './config.js';
import { LANDMARKS } from './city.js';
import { removeCar } from './vehicles.js';
import { populateTraffic, spawnTrafficCar, updateTraffic } from './traffic.js';
import { populatePeds, updatePeds } from './pedestrians.js';
import { updatePolice, clearWanted } from './police.js';
import { updateGunmen, updateWeapon, updatePickups, placePickups, clearGunmen } from './combat.js';
import { createPlayer, updatePlayer, leaveCar } from './player.js';
import { collideCars } from './vehicles.js';
import { updateMissions, updateMarkers, failMission, cleanupMission } from './missions.js';
import { updateCamera } from './camera.js';
import { updateFx } from './fx.js';
import { setGolden, updateLighting } from './lighting.js';

export const START = [394, 420];

/** Remove every dynamic entity and build a fresh, seeded world with traffic, pedestrians and pickups. */
export function resetWorld(seed = 1) {
  for (const c of [...W.cars]) removeCar(c);
  for (const p of W.peds) W.scene.remove(p.mesh);
  for (const k of W.pickups) W.scene.remove(k.mesh);
  W.peds.length = 0; W.pickups.length = 0; clearGunmen();
  if (W.player) W.scene.remove(W.player.mesh);
  cleanupMission(); W.mission = null; W.toast = W.banner = null; W.events.length = 0;
  Object.assign(W.wanted, { heat: 0, stars: 0, unseen: 0, arrest: 0, spawnT: 0, blockT: 6, flash: 0, seen: false });
  seedRng(seed); W.time = 0; W.clock = 14.3; W.shake = W.hurt = 0; W.state = 'play';
  createPlayer(START[0], START[1]);
  populateTraffic(26, 16); populatePeds(46);
  for (let k = 0; k < 3; k++) { const c = spawnTrafficCar('police', Math.floor(rnd() * 8), Math.floor(rnd() * 9), 0, { driver: 'cop' }); c.driver = 'cop'; }
  placePickups([['health', 398, 440], ['ammo', 415, 384], ['cash', 430, 425], ['ammo', 600, 662], ['health', 612, 664], ['ammo', 700, 392], ['health', 700, 396], ['health', 165, 125], ['cash', 275, 276], ['ammo', 540, 215]]);
  updateLighting(W.player); setGolden(0.1);
  W.camera.position.set(START[0] - 4, 4, START[1] - 8);
}

function respawn(kind) {
  const P = W.player, L = LANDMARKS;
  if (P.car) leaveCar();
  if (kind === 'busted') { W.stats.arrests++; const fee = Math.floor(W.money * 0.1); W.money -= fee; P.x = L.police[0] + 10; P.z = L.police[1] - 14; clearGunmen(); }
  else { W.stats.deaths++; W.money = Math.max(0, W.money - 250); P.x = L.hospital[0] + 12; P.z = L.hospital[1]; }
  P.hp = 100; P.vx = P.vz = 0; P.mesh.rotation.set(0, P.h, 0); P.mesh.visible = true; P.y = 0; P.reloadT = 0;
  clearWanted(); W.wanted.arrest = 0; P.ammo = 12; P.reserve = Math.max(P.reserve, 36); W.state = 'play'; W.deadT = 0;
}

export function stepGame(dt, inp) {
  const P = W.player;
  W.time += dt; W.stats.playtime += dt;
  W.clock += dt / 3 / 60;
  if (W.clock > 19.6) W.clock = 12;
  if (Math.floor(W.time * 2) !== Math.floor((W.time - dt) * 2)) setGolden(clamp((W.clock - 15) / 4.5, 0, 0.9));
  const alive = W.state === 'play';
  updatePlayer(dt, alive ? inp : { ...inp, fwd: false, back: false, left: false, right: false, jump: false, enter: false, hb: false, fire: false });
  if (alive) updateWeapon(dt, inp);
  if (inp.horn && P.car && !P.car.hornT) { emit('honk', P.x, P.z, 1); P.car.hornT = 0.4; }
  if (P.car?.hornT) P.car.hornT = Math.max(0, P.car.hornT - dt);
  updateTraffic(dt); updatePolice(dt); updateGunmen(dt); updatePeds(dt); updatePickups(dt); collideCars();
  if (alive) updateMissions(dt);
  if (alive && P.hp <= 0) {
    W.state = 'wasted'; W.deadT = 3.2; if (P.car) leaveCar(); P.mesh.rotation.x = -Math.PI / 2; P.mesh.position.y = 0.2; emit('fail', 0, 0);
    if (W.mission) failMission('Wasted');
  } else if (alive && W.wanted.arrest >= 2.2) {
    W.state = 'busted'; W.deadT = 3.2; emit('fail', 0, 0); if (W.mission) failMission('Busted');
    if (P.car) { const c = P.car; leaveCar(); removeCar(c); }
  }
  if (W.state === 'wasted' || W.state === 'busted') { W.deadT -= dt; if (W.deadT <= 0) respawn(W.state); }
  updateFx(dt); updateMarkers(dt);
}
export function frameCamera(dt, inp, snap = false) { updateCamera(dt, inp, snap); updateLighting(W.player); }
export function titleCamera(t) {
  const [cx, cz] = LANDMARKS.plaza, a = -1.25 + t * 0.015, cam = W.camera;
  cam.position.set(cx + Math.sin(a) * 190, 92, cz + Math.cos(a) * 190); cam.lookAt(cx + 60, 6, cz - 10); cam.fov = 52; cam.updateProjectionMatrix();
  updateLighting({ x: cx, z: cz });
}
void DT; void note; void banner;
