// Third-person camera: mouse orbit, auto-follow behind cars, shoulder aim, speed FOV, shake, wall pull-in.
import * as THREE from 'three';
import { W } from './world.js';
import { clamp, lerp, angDiff } from './config.js';
import { segBlocked } from './city.js';

const look = new THREE.Vector3(), want = new THREE.Vector3();
export function updateCamera(dt, inp, snap = false) {
  const P = W.player, C = W.cam, cam = W.camera, car = P.car;
  C.yaw -= inp.mdx * 0.0026; C.pitch = clamp(C.pitch + inp.mdy * 0.0022, -0.35, 1.0);
  if (inp.mdx || inp.mdy) C.idle = 0; else C.idle += dt;
  if (car && C.idle > 1.2 && Math.abs(car.sp) > 3) { const target = car.sp > 0 ? car.h : car.h + Math.PI; C.yaw += angDiff(target, C.yaw) * Math.min(1, dt * (1.6 + Math.abs(car.sp) * 0.05)); C.pitch += (0.2 - C.pitch) * dt; }
  const tx = car ? car.x : P.x, tz = car ? car.z : P.z, ty = car ? 1.6 : 1.55;
  const aim = !car && (inp.aim || P.fireT > 0);
  const dist = car ? 8.6 + Math.min(4, Math.abs(car.sp) * 0.07) : aim ? 3.6 : 5.4;
  const shoulder = !car && aim ? 0.9 : 0;
  const cp = Math.cos(C.pitch), sy = Math.sin(C.yaw), cy = Math.cos(C.yaw);
  want.set(tx - sy * cp * dist + cy * shoulder, ty + 0.6 + Math.sin(C.pitch) * dist, tz - cy * cp * dist - sy * shoulder);
  // pull in when a building is between target and camera
  if (segBlocked(tx, tz, want.x, want.z, 0, want.y)) { for (let f = 0.85; f > 0.15; f -= 0.1) { const px = tx + (want.x - tx) * f, pz = tz + (want.z - tz) * f; if (!segBlocked(tx, tz, px, pz, 0, want.y)) { want.x = px; want.z = pz; break; } } }
  want.y = Math.max(0.6, want.y);
  if (snap) cam.position.copy(want); else cam.position.lerp(want, Math.min(1, dt * (car ? 9 : 14)));
  look.set(tx + sy * (aim ? 6 : 0), ty + (car ? 0.2 : 0.1), tz + cy * (aim ? 6 : 0));
  cam.position.x += (Math.random() - 0.5) * W.shake * 0.5; cam.position.y += (Math.random() - 0.5) * W.shake * 0.4;
  cam.lookAt(look);
  const fov = car ? 66 + Math.min(18, Math.abs(car.sp) * 0.42) : aim ? 55 : 64;
  C.fov = lerp(C.fov, fov, Math.min(1, dt * 4)); if (Math.abs(cam.fov - C.fov) > 0.05) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
}
