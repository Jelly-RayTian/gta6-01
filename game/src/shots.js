// Screenshot scenes behind ?shot=start|drive|chase|mission (&seed=N). Each plays the real game forward from a
// fresh seeded world, steered by a small autopilot (road-following driver, or a gunman that aims at the nearest rival),
// so the frame is what the game really looks like and the same seed gives the same frame.
import { W } from './world.js';
import { DT, DIRS, N, S, dist, clamp } from './config.js';
import { LANDMARKS } from './city.js';
import { emptyInput } from './input.js';
import { resetWorld, stepGame, frameCamera, titleCamera } from './game.js';
import { spawnTrafficCar, lanePoint, driveToward, obstacleAhead } from './traffic.js';
import { enterCar } from './player.js';
import { removeCar } from './vehicles.js';
import { startMission, jumpToStage, MISSIONS } from './missions.js';
import { spawnChaserNear } from './police.js';
import { setGolden } from './lighting.js';
import { updateLighting } from './lighting.js';

/** Put the player in a sports car on the road at (x, lane z) heading west, already moving. */
function sportsCarOnRoad(x, roadZ, speed) {
  const car = spawnTrafficCar('sports', 3, 4, 2, { color: '#d92b2b' }); car.x = x; car.z = roadZ - 4.2; car.h = -Math.PI / 2; car.vx = -speed; car.vz = 0;
  enterCar(car); W.wanted.heat = 0; W.player.h = car.h; W.cam.yaw = car.h;
  return car;
}

/** Autopilot: follow roads toward a target with a greedy node router, braking for anything ahead. */
function makePilot(car, target, cruise) {
  const st = { i: Math.round(car.x / S), j: Math.round(car.z / S), d: 2 };
  st.i = clamp(st.i, 0, N); st.j = clamp(st.j, 0, N);
  return () => {
    const [tx, tz] = lanePoint(st.i, st.j, st.d);
    if ((tx - car.x) * DIRS[st.d][0] + (tz - car.z) * DIRS[st.d][1] < 10) {
      let best = st.d, bd = 1e9;
      for (let k = 0; k < 4; k++) {
        if (k === (st.d + 2) % 4) continue; const ni = st.i + DIRS[k][0], nj = st.j + DIRS[k][1]; if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const dd = dist(ni * S, nj * S, target[0], target[1]); if (dd < bd) { bd = dd; best = k; }
      }
      st.d = best; st.i = clamp(st.i + DIRS[best][0], 0, N); st.j = clamp(st.j + DIRS[best][1], 0, N);
    }
    const [px, pz] = lanePoint(st.i, st.j, st.d);
    const { c } = driveToward(car, px, pz, cruise);
    const ob = obstacleAhead(car, 9 + car.sp * 0.5);
    if (ob.dist < 99 && ob.what !== null) c.thr = ob.dist < 6 + car.sp * 0.25 ? -1 : 0;
    return c;
  };
}

function run(seconds, make) {
  const inp = emptyInput();
  for (let k = 0; k < seconds / DT; k++) { make?.(inp, k); stepGame(DT, inp); W.events.length = 0; frameCamera(DT, { ...inp, mdx: 0, mdy: 0 }, k === 0); }
}

/** Gunman autopilot: face the nearest living rival, fire in bursts, reload when empty. */
function gunman(inp, k) {
  const P = W.player, foe = W.enemies.filter((e) => e.state !== 'dead').sort((a, b) => dist(a.x, a.z, P.x, P.z) - dist(b.x, b.z, P.x, P.z))[0];
  inp.fire = false; inp.reload = false; inp.aim = true; inp.aimAt = null; inp.fwd = false; inp.left = inp.right = false;
  if (!foe) return;
  inp.aimAt = { x: foe.x, z: foe.z }; W.cam.yaw = Math.atan2(foe.x - P.x, foe.z - P.z); W.cam.pitch = 0.18;
  const d = dist(foe.x, foe.z, P.x, P.z);
  if (P.ammo === 0 && P.reloadT <= 0) inp.reload = true;
  inp.fire = Math.floor(k / 14) % 3 !== 2 && d < 45;
  if (d > 30) inp.fwd = true; else if (Math.floor(k / 90) % 2) inp.right = true; else inp.left = true;
}

/** Stage the named scene and return which screen to draw ('title' or 'play'). */
export function stageShot(name, seed = 1) {
  resetWorld(seed);
  const P = W.player;
  if (name === 'drive') {
    W.money = 640; W.done = [];
    const car = sportsCarOnRoad(405, 360, 22);
    startMission(0); const m = W.mission; removeCar(m.car); m.car = car; jumpToStage(1);
    W.clock = 15.2; setGolden(0.15);
    const pilot = makePilot(car, LANDMARKS.garage, 24);
    run(11, (inp) => { inp.ctl = pilot(); });
    W.toast = null; return 'play';
  }
  if (name === 'chase') {
    W.money = 2140; W.done = ['wheels', 'fare'];
    const car = sportsCarOnRoad(300, 360, 26);
    startMission(2); jumpToStage(1); W.clock = 17.6; setGolden(0.6);
    spawnChaserNear(345, 360 - 4.2, -Math.PI / 2); spawnChaserNear(372, 360 - 4.2, -Math.PI / 2); spawnChaserNear(396, 360 - 3, -Math.PI / 2);
    const pilot = makePilot(car, LANDMARKS.garage, 26);
    run(5.5, (inp) => { inp.ctl = pilot(); });
    W.toast = null; return 'play';
  }
  if (name === 'mission') {
    W.money = 3640; W.done = MISSIONS.slice(0, 3).map((m) => m.id);
    const D = LANDMARKS.docks; P.x = D[0] + 22; P.z = D[1] - 14; P.h = 2.4; P.reserve = 60; W.clock = 16.4; setGolden(0.4);
    startMission(3); jumpToStage(1);
    run(9, gunman);
    let guard = 0; const inp = emptyInput(); // finish on a frame where the pistol has just fired
    while (!(P.fireT > 0.15) && guard++ < 400) { gunman(inp, 20 + guard % 40); stepGame(DT, inp); W.events.length = 0; frameCamera(DT, { ...inp, mdx: 0, mdy: 0 }); }
    W.toast = null; W.banner = null; return 'play';
  }
  // start: the title screen over the plaza at golden hour, traffic running
  W.clock = 18.3;
  for (let k = 0; k < 4 / DT; k++) { stepGame(DT, emptyInput()); W.events.length = 0; }
  setGolden(1); titleCamera(2); updateLighting({ x: LANDMARKS.plaza[0], z: LANDMARKS.plaza[1] });
  return 'title';
}
