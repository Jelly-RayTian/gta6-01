// The story: five missions played in order, driven by a small stage engine
// (steal / goto / pickup / deliver / kill / escape) with timers, markers, rewards and fail states.
import * as THREE from 'three';
import { W, note, banner, emit } from './world.js';
import { S, dist } from './config.js';
import { LANDMARKS } from './city.js';
import { spawnCar, removeCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';
import { setStars, clearWanted } from './police.js';

const G = LANDMARKS.garage, DOCK = LANDMARKS.docks, VILLA = LANDMARKS.villa;
const around = (c, list, dx = 0, dz = 0) => list.map(([a, b]) => [c[0] + a + dx, c[1] + b + dz]);
const garageStart = [G[0] - 8, G[1] + 12];

export const MISSIONS = [
  { id: 'wheels', title: 'Fresh Wheels', giver: 'Rita Vance', start: [4.5 * S + 22, 4.5 * S + 6], reward: 500,
    intro: 'Rita: Welcome to Solmar Bay, Danny. Prove yourself. A red Corsa GT is parked on 5th. Bring it to my garage.',
    stages: [{ t: 'steal', type: 'sports', color: '#d92b2b', at: [5 * S + 6.8, 4 * S + 55, Math.PI], txt: 'Steal the red Corsa GT' },
      { t: 'deliver', at: G, r: 9, txt: 'Deliver the car to Vance Auto' }] },
  { id: 'fare', title: 'Late Fare', giver: 'Rita Vance', start: garageStart, reward: 800,
    intro: 'Rita: Mickey Voss owes me, and he needs to be at the harbor terminal fast. Pick him up on Palm Beach. He is on the clock, and so are you.',
    stages: [{ t: 'pickup', at: [7 * S, 2 * S + 4], r: 9, txt: 'Pick up Mickey at Palm Beach (get in any car)' },
      { t: 'deliver', at: [4 * S, 7 * S], r: 11, time: 85, anyCar: true, txt: 'Drive Mickey to the harbor terminal' }] },
  { id: 'heat', title: 'Heat Wave', giver: 'Rita Vance', start: garageStart, reward: 1200,
    intro: 'Rita: Gold Coast Jewelers. Walk in, grab the case, walk out. The cops will be on you in seconds. Lose them and come home.',
    stages: [{ t: 'goto', at: [350, 241], r: 4, onFoot: true, txt: 'Grab the case at Gold Coast Jewelers' },
      { t: 'escape', stars: 3, txt: 'Lose the cops' },
      { t: 'deliver', at: G, r: 11, anyCar: true, onFootOk: true, txt: 'Return to Vance Auto' }] },
  { id: 'harbor', title: 'Harbor Business', giver: 'Rita Vance', start: garageStart, reward: 1500,
    intro: 'Rita: The Harbor Kings are squeezing my shipments at Dock 9. Go there and clear out the crew. Use cover, watch your ammo.',
    stages: [{ t: 'goto', at: [DOCK[0], DOCK[1] - 36], r: 24, txt: 'Head to Harbor 9 Docks' },
      { t: 'kill', n: 6, spots: around(DOCK, [[-4, 6], [10, 12], [18, 4], [-10, 18], [6, 26], [20, 20]]), txt: 'Take out the Harbor Kings' }] },
  { id: 'finale', title: 'Last Ride', giver: 'Rita Vance', start: garageStart, reward: 5000,
    intro: 'Rita: Victor Hale runs the Kings from his villa on the coast. End it, Danny. Then get out of town alive.',
    stages: [{ t: 'goto', at: [VILLA[0], VILLA[1] - 42], r: 26, txt: 'Drive to Hale Villa' },
      { t: 'kill', n: 7, boss: true, spots: around(VILLA, [[-6, 6], [10, 10], [18, 16], [-8, 18], [4, 26], [20, 2], [12, 4]]), txt: 'Eliminate Victor Hale and his guards' },
      { t: 'escape', stars: 4, txt: 'Escape the police' },
      { t: 'deliver', at: G, r: 11, anyCar: true, onFootOk: true, txt: 'Make it back to Vance Auto' }] },
];

let marker, startMarker;
export function initMarkers(scene) {
  const mk = (color) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
    ring.position.y = 0.4;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 30; g.add(ring, beam); g.visible = false; scene.add(g); return g;
  };
  marker = mk(0x38e1ff); startMarker = mk(0xffd24a);
}
export const nextMission = () => MISSIONS[W.done.length] ?? null;

function enterStage(m) {
  const st = m.def.stages[m.stage];
  m.target = st.at ?? null; m.kills = 0; m.timer = st.time ?? null; m.obj = st.txt;
  if (st.t === 'steal') { m.car = spawnCar(st.type, st.at[0], st.at[1], st.at[2], { color: st.color }); m.car.mission = true; }
  if (st.t === 'kill') { m.enemies = st.spots.slice(0, st.n).map((p, k) => spawnEnemy(p[0], p[1], !!st.boss && k === 0)); m.target = st.spots[0]; }
  if (st.t === 'escape') { setStars(st.stars); m.target = null; }
}
/** Jump the running mission to a stage (used by screenshot staging and tests). */
export function jumpToStage(i) { W.mission.stage = i; enterStage(W.mission); }
export function startMission(i) {
  const def = MISSIONS[i]; if (!def) return;
  W.mission = { def, stage: 0, car: null, enemies: [], target: null, timer: null, obj: '', passenger: false };
  banner(def.title.toUpperCase(), def.giver, 1.6); note(def.intro, 9); emit('chime', 0, 0); enterStage(W.mission);
}
export function cleanupMission() {
  const m = W.mission; if (!m) return;
  if (m.car && W.cars.includes(m.car) && W.player.car !== m.car) removeCar(m.car);
  for (const e of m.enemies) if (e.state !== 'dead') { W.scene.remove(e.mesh); const k = W.enemies.indexOf(e); if (k >= 0) W.enemies.splice(k, 1); }
}
export function failMission(why) {
  if (!W.mission) return;
  banner('MISSION FAILED', why, 4); emit('fail', 0, 0); cleanupMission(); W.mission = null;
  if (W.wanted.stars) clearWanted();
}
function passMission() {
  const def = W.mission.def; W.money += def.reward; W.done.push(def.id); cleanupMission(); W.mission = null;
  banner('MISSION PASSED', `${def.title}  +$${def.reward}`, 5); emit('chime', 0, 0); emit('save', 0, 0);
  const n = nextMission(); note(n ? `New mission available: ${n.title}` : 'Story complete! Solmar Bay is yours, Danny. Free roam continues.', 6);
}

export function updateMissions(dt) {
  const P = W.player, m = W.mission;
  if (!m) {
    const n = nextMission();
    if (n && P.hp > 0 && !P.car && dist(P.x, P.z, n.start[0], n.start[1]) < 4.2) startMission(W.done.length);
    return;
  }
  const st = m.def.stages[m.stage], px = P.x, pz = P.z;
  if (m.timer != null) { m.timer -= dt; if (m.timer <= 0) return failMission('Out of time'); }
  let done = false;
  switch (st.t) {
    case 'steal':
      if (m.car.wreck) return failMission('The car was destroyed');
      done = P.car === m.car; m.target = P.car === m.car ? null : [m.car.x, m.car.z]; break;
    case 'goto':
      done = dist(px, pz, st.at[0], st.at[1]) < st.r && (!st.onFoot || !P.car);
      if (done && st.onFoot) note('Case secured. Cops incoming!', 3);
      break;
    case 'pickup':
      if (P.car && dist(px, pz, st.at[0], st.at[1]) < st.r) { done = true; m.passenger = true; note('Mickey: Go go go! Harbor terminal!', 4); }
      break;
    case 'deliver': {
      if (m.car) {
        if (m.car.wreck) return failMission('The car was destroyed');
        m.obj = P.car === m.car ? st.txt : 'Get back in the red Corsa GT';
        m.target = P.car === m.car ? st.at : [m.car.x, m.car.z];
      }
      if (m.passenger) { if (P.car?.wreck) return failMission('Mickey did not make it'); m.obj = P.car ? st.txt : 'Mickey is waiting. Get back in a car!'; }
      const ok = st.anyCar ? (!!P.car || !!st.onFootOk) : P.car === m.car;
      done = dist(px, pz, st.at[0], st.at[1]) < st.r && ok && W.wanted.stars === 0;
      break;
    }
    case 'kill': {
      m.kills = m.enemies.filter((e) => e.state === 'dead').length; m.obj = `${st.txt}  (${m.kills}/${st.n})`;
      const alive = m.enemies.find((e) => e.state !== 'dead'); m.target = alive ? [alive.x, alive.z] : null;
      for (const e of m.enemies) if (e.state !== 'dead' && !e.aggro && dist(e.x, e.z, px, pz) < 45) e.aggro = true;
      done = m.kills >= st.n; break;
    }
    case 'escape':
      done = W.wanted.stars === 0; m.obj = `${st.txt}  ${'★'.repeat(W.wanted.stars)}`; break;
  }
  if (done) { m.stage++; if (m.stage >= m.def.stages.length) passMission(); else { emit('chime', 0, 0); enterStage(m); } }
}
export function updateMarkers(dt) {
  const t = W.mission ? W.mission.target : nextMission()?.start ?? null;
  const set = (g, on) => { g.visible = on && !!t; if (g.visible) { g.position.set(t[0], 0, t[1]); g.rotation.y += dt; } };
  set(marker, !!W.mission); set(startMarker, !W.mission);
}
export const missionTargetFor = () => (W.mission ? W.mission.target : nextMission()?.start ?? null);
