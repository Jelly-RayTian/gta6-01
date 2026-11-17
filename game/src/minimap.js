// Live rotating minimap drawn on a canvas from the city's ground image: roads, player arrow, mission marker, police, cars.
import { W } from './world.js';
import { groundCanvas, GROUND_MIN, GROUND_PX, GROUND_SIZE } from './city.js';
import { angDiff } from './config.js';

const SIZE = 220, R = SIZE / 2, SCALE = 0.95;      // pixels per metre
export function drawMinimap(canvas, target) {
  const g = canvas.getContext('2d'), P = W.player, k = GROUND_PX / GROUND_SIZE, yaw = W.cam.yaw, th = yaw - Math.PI;
  const c = Math.cos(th), s = Math.sin(th);
  g.clearRect(0, 0, SIZE, SIZE); g.save();
  g.translate(R, R); g.rotate(th); g.scale(SCALE / k, SCALE / k); g.translate(-(P.x - GROUND_MIN) * k, -(P.z - GROUND_MIN) * k);
  g.imageSmoothingEnabled = true; g.drawImage(groundCanvas, 0, 0); g.restore();
  const pt = (x, z) => { const dx = x - P.x, dz = z - P.z; return [R + (dx * c - dz * s) * SCALE, R + (dx * s + dz * c) * SCALE]; };
  const dot = (x, z, col, r, clamp = false) => {
    let [mx, my] = pt(x, z); const dx = mx - R, dy = my - R, d = Math.hypot(dx, dy);
    if (d > R - 8) { if (!clamp) return; mx = R + dx / d * (R - 9); my = R + dy / d * (R - 9); }
    g.fillStyle = col; g.strokeStyle = '#000b'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill(); g.stroke();
  };
  for (const car of W.cars) if (!car.wreck && car !== P.car) {
    if (car.type === 'police') { const on = Math.floor(W.time * 5) % 2; if (car.ai) dot(car.x, car.z, on ? '#ff3b3b' : '#3b6bff', 5); } else dot(car.x, car.z, '#556', 2.4);
  }
  for (const o of W.cops) if (o.state !== 'dead') dot(o.x, o.z, '#4d7bff', 3);
  for (const e of W.enemies) if (e.state !== 'dead') dot(e.x, e.z, '#ff4d4d', 4);
  for (const p of W.pickups) if (p.type !== 'cash' || p.val > 100) dot(p.x, p.z, p.type === 'health' ? '#ff6b8b' : p.type === 'ammo' ? '#ffb02e' : '#4fe08a', 3);
  if (target) {
    const [mx, my] = pt(target[0], target[1]), d = Math.hypot(mx - R, my - R), edge = d > R - 12;
    const x = edge ? R + (mx - R) / d * (R - 12) : mx, y = edge ? R + (my - R) / d * (R - 12) : my;
    g.fillStyle = W.mission ? '#38e1ff' : '#ffd24a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath();
    if (edge) { const a = Math.atan2(y - R, x - R); g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.lineTo(x + Math.cos(a + 2.3) * 8, y + Math.sin(a + 2.3) * 8); g.lineTo(x + Math.cos(a - 2.3) * 8, y + Math.sin(a - 2.3) * 8); }
    else g.arc(x, y, 8, 0, 7);
    g.fill(); g.stroke();
    if (!edge) { g.fillStyle = '#000'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(W.mission ? '!' : 'M', x, y + 1); }
  }
  // player arrow
  const a = angDiff(yaw, P.h); g.save(); g.translate(R, R); g.rotate(a); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
}
