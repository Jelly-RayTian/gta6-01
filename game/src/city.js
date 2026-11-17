// The procedural city: road grid, ground texture (also the minimap image), buildings, palms, water,
// landmarks, plus collision queries (solid blocks, line of sight).
import * as THREE from 'three';
import { S, N, HALF, SIDEW, WORLD, LIMIT, rnd, rr, pick } from './config.js';
import { W } from './world.js';

export const GROUND_MIN = -100, GROUND_SIZE = WORLD + 200, GROUND_PX = 2048;
export const groundCanvas = document.createElement('canvas');
const blocks = [];          // blocks[i][j] = { kind, solids:[{x0,z0,x1,z1,h}] }
export const blockKind = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 'edge' : blocks[i][j].kind);

const PASTEL = ['#f4a6a0', '#7fd1c7', '#f6d58e', '#f2e8d5', '#e98f6f', '#9bb8e8', '#f0b9d4', '#c9e4a7', '#e8d0b0'];
const DOWNTOWN = ['#9fb4c7', '#cfd8dc', '#8aa6b8', '#e3d9c6', '#b9a9c9'];
const KINDS = { '1,1': 'garage', '4,4': 'plaza', '2,5': 'park', '5,2': 'park', '6,7': 'docks', '7,4': 'villa', '0,5': 'hospital', '1,6': 'police', '3,2': 'jeweler', '7,7': 'docks2' };

export const LANDMARKS = {
  garage: [152, 124], plaza: [4.5 * S, 4.5 * S], docks: [6.5 * S, 7.5 * S], villa: [7.5 * S, 4.5 * S],
  jeweler: [3.5 * S, 2.5 * S], hospital: [0, 5.5 * S + 0], police: [1 * S, 6 * S],
};

function drawGround() {
  const c = groundCanvas; c.width = c.height = GROUND_PX;
  const g = c.getContext('2d'), k = GROUND_PX / GROUND_SIZE;
  const X = (x) => (x - GROUND_MIN) * k;
  g.fillStyle = '#8fb069'; g.fillRect(0, 0, GROUND_PX, GROUND_PX);
  g.fillStyle = '#e8d3a0'; g.fillRect(X(WORLD + LIMIT + 4), 0, GROUND_PX, GROUND_PX); // east sand
  g.fillRect(0, X(WORLD + LIMIT + 4), GROUND_PX, GROUND_PX);                            // south sand
  g.fillStyle = '#d9c18a'; g.fillRect(X(WORLD + 30), 0, GROUND_PX, GROUND_PX);
  g.fillRect(0, X(WORLD + 30), GROUND_PX, GROUND_PX);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x0 = i * S + HALF, z0 = j * S + HALF, w = S - 2 * HALF, b = blocks[i][j];
    g.fillStyle = '#cfc8b8'; g.fillRect(X(x0), X(z0), w * k, w * k);          // sidewalk
    g.fillStyle = b.kind === 'park' ? '#7cb85a' : b.kind === 'plaza' ? '#e6cfa6' : b.kind === 'docks' || b.kind === 'docks2' ? '#8d8a85' : '#b9b19f';
    g.fillRect(X(x0 + SIDEW), X(z0 + SIDEW), (w - 2 * SIDEW) * k, (w - 2 * SIDEW) * k);
    if (b.kind === 'plaza') { g.fillStyle = '#d7b98b'; for (let a = 0; a < 6; a++) for (let c2 = 0; c2 < 6; c2++) if ((a + c2) % 2) g.fillRect(X(x0 + 8 + a * 9), X(z0 + 8 + c2 * 9), 9 * k, 9 * k); }
  }
  g.fillStyle = '#3b3e45';
  for (let r = 0; r <= N; r++) { g.fillRect(X(r * S - HALF), X(-HALF), 2 * HALF * k, (WORLD + 2 * HALF) * k); g.fillRect(X(-HALF), X(r * S - HALF), (WORLD + 2 * HALF) * k, 2 * HALF * k); }
  g.lineWidth = 1.4; g.strokeStyle = '#e9c545';
  for (let r = 0; r <= N; r++) for (let s = 0; s < N; s++) {
    g.beginPath(); g.moveTo(X(r * S - 0.5), X(s * S + HALF + 3)); g.lineTo(X(r * S - 0.5), X((s + 1) * S - HALF - 3)); g.moveTo(X(r * S + 0.5), X(s * S + HALF + 3)); g.lineTo(X(r * S + 0.5), X((s + 1) * S - HALF - 3));
    g.moveTo(X(s * S + HALF + 3), X(r * S - 0.5)); g.lineTo(X((s + 1) * S - HALF - 3), X(r * S - 0.5)); g.moveTo(X(s * S + HALF + 3), X(r * S + 0.5)); g.lineTo(X((s + 1) * S - HALF - 3), X(r * S + 0.5)); g.stroke();
  }
  g.fillStyle = '#e8e8e8';   // crosswalks
  for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) for (let t = -6; t <= 6; t += 3) {
    g.fillRect(X(a * S + t - 0.6), X(b * S - HALF - 3.5), 1.2 * k, 3 * k); g.fillRect(X(a * S + t - 0.6), X(b * S + HALF + 0.5), 1.2 * k, 3 * k);
    g.fillRect(X(a * S - HALF - 3.5), X(b * S + t - 0.6), 3 * k, 1.2 * k); g.fillRect(X(a * S + HALF + 0.5), X(b * S + t - 0.6), 3 * k, 1.2 * k);
  }
}

// --- merged box geometry with window UVs --------------------------------------------------------
const windowTexture = () => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#7c93a8'; g.fillRect(14, 14, 36, 34); g.fillStyle = '#b8d2e6'; g.fillRect(14, 14, 36, 8);
  g.fillStyle = '#e8e2d6'; g.fillRect(12, 48, 40, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
function boxInto(b, x, y, z, w, h, d, color, windows = true) {
  const col = new THREE.Color(color), hx = w / 2, hz = d / 2;
  const quad = (p, n, u) => { const i = b.pos.length / 3; for (const q of p) { b.pos.push(...q); b.nor.push(...n); b.col.push(col.r, col.g, col.b); } for (const q of u) b.uv.push(...q); b.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const walls = [ // [corner a, corner b, normal, length]
    [[x + hx, z + hz], [x + hx, z - hz], [1, 0, 0], d], [[x - hx, z - hz], [x - hx, z + hz], [-1, 0, 0], d],
    [[x - hx, z + hz], [x + hx, z + hz], [0, 0, 1], w], [[x + hx, z - hz], [x - hx, z - hz], [0, 0, -1], w]];
  for (const [a, c, n, len] of walls) {
    const u1 = windows ? Math.max(1, Math.round(len / 5)) : 0.02, v1 = windows ? Math.max(1, Math.round(h / 4)) : 0.02;
    quad([[a[0], y, a[1]], [c[0], y, c[1]], [c[0], y + h, c[1]], [a[0], y + h, a[1]]], n, [[0, 0], [u1, 0], [u1, v1], [0, v1]]);
  }
  quad([[x - hx, y + h, z + hz], [x + hx, y + h, z + hz], [x + hx, y + h, z - hz], [x - hx, y + h, z - hz]], [0, 1, 0], [[.02, .02], [.04, .02], [.04, .04], [.02, .04]]);
}
const newBatch = () => ({ pos: [], nor: [], col: [], uv: [], idx: [] });
function batchMesh(b, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex(b.idx); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
export function label(scene, text, x, y, z, color = '#ffd24a', scale = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(15,20,35,.78)'; g.fillRect(0, 0, 512, 96); g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, 506, 90);
  g.fillStyle = color; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(16 * scale, 3 * scale, 1); s.position.set(x, y, z); scene.add(s);
}

export function buildCity(scene) {
  for (let i = 0; i < N; i++) { blocks[i] = []; for (let j = 0; j < N; j++) blocks[i][j] = { kind: KINDS[`${i},${j}`] ?? 'normal', solids: [] }; }
  drawGround();
  const tex = new THREE.CanvasTexture(groundCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(GROUND_MIN + GROUND_SIZE / 2, 0, GROUND_MIN + GROUND_SIZE / 2); ground.receiveShadow = true; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({ color: 0x1fb5c9, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(WORLD + 2000, -0.6, WORLD * 0.5); scene.add(sea);
  const sea2 = sea.clone(); sea2.position.set(WORLD * 0.5, -0.6, WORLD + 2000); scene.add(sea2);
  const win = windowTexture(), batch = newBatch();
  const solidBox = (bk, x0, z0, x1, z1, h) => bk.solids.push({ x0, z0, x1, z1, h });
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const bk = blocks[i][j], x0 = i * S + HALF + SIDEW, z0 = j * S + HALF + SIDEW, w = S - 2 * (HALF + SIDEW), cx = x0 + w / 2, cz = z0 + w / 2;
    const down = i >= 2 && i <= 5 && j >= 2 && j <= 5, beach = i === 7, k = bk.kind;
    if (k === 'normal' || k === 'jeweler' || k === 'hospital' || k === 'police') {
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        const lx = x0 + a * (w / 2) + 1, lz = z0 + c * (w / 2) + 1, lw = w / 2 - 2;
        let h = down ? rr(30, 100) : beach ? rr(10, 22) : rr(7, 24);
        let col = down ? pick(DOWNTOWN) : pick(PASTEL);
        if (k === 'hospital') { col = '#f4f4f0'; h = a === 0 && c === 0 ? 34 : 18; }
        if (k === 'police') col = '#7b94b8';
        if (k === 'jeweler' && a === 1 && c === 1) { col = '#e8c46a'; h = 12; }
        boxInto(batch, lx + lw / 2, 0, lz + lw / 2, lw, h, lw, col);
        if (down && h > 50) boxInto(batch, lx + lw / 2, h, lz + lw / 2, lw * 0.6, 8, lw * 0.6, '#d0d6dc', false);
        boxInto(batch, lx + lw * 0.3, h, lz + lw * 0.3, 4, 1.6, 4, '#8b8f94', false);
        solidBox(bk, lx, lz, lx + lw, lz + lw, h);
      }
    } else if (k === 'garage') {
      boxInto(batch, cx - 14, 0, cz - 14, 30, 7, 30, '#e9743f'); solidBox(bk, cx - 29, cz - 29, cx + 1, cz + 1, 7);
      boxInto(batch, cx + 14, 0, cz + 20, 28, 5, 14, '#d8d2c4'); solidBox(bk, cx, cz + 13, cx + 28, cz + 27, 5);
    } else if (k === 'docks' || k === 'docks2' || k === 'villa') {
      const wh = k === 'villa' ? '#f2ead8' : '#b8582f';
      boxInto(batch, cx - 14, 0, cz - 14, 32, k === 'villa' ? 12 : 11, 22, wh); solidBox(bk, cx - 30, cz - 25, cx + 2, cz - 3, 12);
      for (let n2 = 0; n2 < 7; n2++) { const px = cx + rr(-10, 24), pz = cz + rr(4, 26); const cr = { x0: px - 1.6, z0: pz - 1.6, x1: px + 1.6, z1: pz + 1.6, h: 3 }; boxInto(batch, px, 0, pz, 3.2, 3, 3.2, pick(['#2f7fb8', '#c0392b', '#d9a521']), false); bk.solids.push(cr); }
    } else if (k === 'plaza') {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 })); f.position.set(cx, 0.6, cz); scene.add(f);
      const wtr = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.3, 20), new THREE.MeshPhongMaterial({ color: 0x3bc9db })); wtr.position.set(cx, 0.65, cz); scene.add(wtr);
      bk.solids.push({ x0: cx - 5, z0: cz - 5, x1: cx + 5, z1: cz + 5, h: 1.2 });
    }
  }
  scene.add(batchMesh(batch, new THREE.MeshLambertMaterial({ map: win, vertexColors: true })));
  // landmark signs
  label(scene, 'VANCE AUTO', LANDMARKS.garage[0] - 14, 12, LANDMARKS.garage[1] - 14, '#ff9d5c');
  label(scene, 'SOLMAR GENERAL', 4 + 20, 40, 5.5 * S - 20, '#ff6b6b', 1.1);
  label(scene, 'SBPD', 1.5 * S - 10, 24, 6.5 * S - 10, '#7fb2ff');
  label(scene, 'GOLD COAST JEWELERS', 3.5 * S + 14, 16, 2.5 * S + 14, '#ffd24a', 1.1);
  label(scene, 'HARBOR 9 DOCKS', LANDMARKS.docks[0] - 14, 15, LANDMARKS.docks[1] - 14, '#9fd8ff');
  label(scene, 'HALE VILLA', LANDMARKS.villa[0] - 14, 16, LANDMARKS.villa[1] - 14, '#ffb3d9');
  label(scene, 'SUNSET PLAZA', LANDMARKS.plaza[0], 9, LANDMARKS.plaza[1] - 20, '#ffe08a');
  // palms and park trees (instanced)
  const spots = [];
  for (let r = 0; r <= N; r++) for (let s = 0; s < N; s++) for (const sd of [-1, 1]) { if (rnd() < 0.55) spots.push([r * S + sd * (HALF + 1.6), s * S + rr(20, 70)]); if (rnd() < 0.55) spots.push([s * S + rr(20, 70), r * S + sd * (HALF + 1.6)]); }
  for (const [i, j] of [[2, 5], [5, 2]]) for (let n2 = 0; n2 < 22; n2++) spots.push([i * S + rr(14, 76), j * S + rr(14, 76)]);
  for (let n2 = 0; n2 < 40; n2++) spots.push([WORLD + rr(18, 40), rr(0, WORLD)]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.35, 7, 6).translate(0, 3.5, 0), new THREE.MeshLambertMaterial({ color: 0x8a6240 }), spots.length);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 2.2, 7).translate(0, 7.6, 0), new THREE.MeshLambertMaterial({ color: 0x3f9d45 }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], n2) => { const sc = rr(0.8, 1.35); m.makeScale(sc, sc, sc).setPosition(x, 0, z); trunk.setMatrixAt(n2, m); crown.setMatrixAt(n2, m); });
  trunk.castShadow = crown.castShadow = true; scene.add(trunk, crown);
}

// --- collision ------------------------------------------------------------------------------------
const solidsAt = (x, z) => { const i = Math.floor(x / S), j = Math.floor(z / S); return i < 0 || j < 0 || i >= N || j >= N ? [] : blocks[i][j].solids; };
/** Push a circle out of any solid block. Returns the push normal (or null when free). */
export function resolveCircle(p, r) {
  let hit = null;
  for (const s of solidsAt(p.x, p.z)) {
    const cx = Math.max(s.x0, Math.min(p.x, s.x1)), cz = Math.max(s.z0, Math.min(p.z, s.z1));
    let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-4) { // centre inside: exit through nearest face
      const l = p.x - s.x0, rt = s.x1 - p.x, t = p.z - s.z0, b = s.z1 - p.z, m = Math.min(l, rt, t, b);
      if (m === l) { dx = -1; dz = 0; p.x = s.x0 - r; } else if (m === rt) { dx = 1; dz = 0; p.x = s.x1 + r; } else if (m === t) { dx = 0; dz = -1; p.z = s.z0 - r; } else { dx = 0; dz = 1; p.z = s.z1 + r; }
      hit = { x: dx, z: dz }; continue;
    }
    p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; hit = { x: dx / d, z: dz / d };
  }
  return hit;
}
export function inSolid(x, z, margin = 0) { for (const s of solidsAt(x, z)) if (x > s.x0 - margin && x < s.x1 + margin && z > s.z0 - margin && z < s.z1 + margin) return s; return null; }
/** True when a building blocks the straight line between two points (sampled every 2 m). */
export function segBlocked(ax, az, bx, bz, minH = 0, y = 1.5) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 2);
  for (let k = 1; k < n; k++) { const t = k / n, s = inSolid(ax + (bx - ax) * t, az + (bz - az) * t); if (s && s.h > y && s.h > minH) return true; }
  return false;
}
