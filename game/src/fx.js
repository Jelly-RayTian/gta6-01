// Visual effects: particle pool (smoke, sparks, flashes), bullet tracers, screen shake and damage flash.
import * as THREE from 'three';
import { W } from './world.js';
import { rnd, rr } from './config.js';

const MAX = 500;
const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX);
const parts = Array.from({ length: MAX }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, grow: 0, s: 1, c: [1, 1, 1], a: 1 }));
let cursor = 0, points, tracers = [];

export function initFx(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { scale: { value: 600 } },
    vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; gl_FragColor=vec4(vC.rgb, vC.a*(1.-d*d)); }',
  });
  points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);
  for (let i = 0; i < 12; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true })); l.visible = false; l.frustumCulled = false; l.life = 0; scene.add(l); tracers.push(l); }
  size.fill(0);
  return mat;
}
export function puff(x, y, z, o = {}) {
  const p = parts[cursor++ % MAX];
  p.life = p.max = o.life ?? 1; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0; p.g = o.g ?? 0; p.grow = o.grow ?? 0; p.s = o.s ?? 1; p.c = o.c ?? [0.8, 0.8, 0.8]; p.a = o.a ?? 0.6;
  const k = (cursor - 1) % MAX; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; p.k = k;
}
export const smoke = (x, y, z, dark = 0.7, n = 1) => { for (let i = 0; i < n; i++) puff(x + rr(-.3, .3), y, z + rr(-.3, .3), { life: rr(0.8, 1.5), vy: rr(0.8, 1.6), vx: rr(-.4, .4), vz: rr(-.4, .4), grow: 2.4, s: 1.4, c: [dark, dark, dark], a: 0.55 }); };
export const sparks = (x, y, z, n = 8) => { for (let i = 0; i < n; i++) puff(x, y, z, { life: rr(0.25, 0.6), vx: rr(-5, 5), vy: rr(1, 5), vz: rr(-5, 5), g: 14, s: 0.35, c: [1, 0.8, 0.3], a: 1 }); };
export const flash = (x, y, z) => { puff(x, y, z, { life: 0.07, s: 1.8, c: [1, 0.85, 0.4], a: 1 }); puff(x, y, z, { life: 0.1, s: 0.9, c: [1, 1, 0.9], a: 1 }); };
export const explosion = (x, y, z) => { for (let i = 0; i < 26; i++) puff(x, y, z, { life: rr(0.5, 1.4), vx: rr(-6, 6), vy: rr(1, 8), vz: rr(-6, 6), grow: 3, s: rr(1.5, 3), c: i % 3 ? [1, 0.55, 0.15] : [0.2, 0.2, 0.2], a: 0.8 }); sparks(x, y, z, 24); };
export function tracer(a, b) {
  const t = tracers.find((q) => !q.visible) ?? tracers[0];
  const p = t.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.visible = true; t.life = 0.07;
}
export const shake = (v) => { W.shake = Math.min(1.2, Math.max(W.shake, v)); };
export const hurtFlash = (v = 0.6) => { W.hurt = Math.min(1, W.hurt + v); };

export function updateFx(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt; const k = p.k;
    if (p.life <= 0) { size[k] = 0; continue; }
    p.vy -= p.g * dt; pos[k * 3] += p.vx * dt; pos[k * 3 + 1] = Math.max(0.05, pos[k * 3 + 1] + p.vy * dt); pos[k * 3 + 2] += p.vz * dt;
    const f = p.life / p.max; p.s += p.grow * dt;
    size[k] = p.s; col[k * 4] = p.c[0]; col[k * 4 + 1] = p.c[1]; col[k * 4 + 2] = p.c[2]; col[k * 4 + 3] = p.a * f;
  }
  for (const t of tracers) if (t.visible) { t.life -= dt; if (t.life <= 0) t.visible = false; }
  points.geometry.attributes.position.needsUpdate = points.geometry.attributes.color.needsUpdate = points.geometry.attributes.size.needsUpdate = true;
  W.shake = Math.max(0, W.shake - dt * 2.2); W.hurt = Math.max(0, W.hurt - dt * 1.4);
}
void rnd;
