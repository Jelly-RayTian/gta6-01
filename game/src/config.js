// Shared constants, the seeded random generator and small math helpers.
export const S = 90;          // distance between road centres
export const N = 8;           // blocks per side (roads 0..N)
export const HALF = 8;        // half road width
export const SIDEW = 4;       // sidewalk width
export const WORLD = N * S;
export const DT = 1 / 60;
export const LIMIT = 14;      // playable margin beyond the road grid

let state = 1;
export function seedRng(seed) { state = (seed >>> 0) || 1; }
export function rnd() {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + (b - a) * rnd();
export const pick = (list) => list[Math.floor(rnd() * list.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function angDiff(target, from) {
  let d = (target - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/** Road direction vectors: 0 east, 1 south(+z), 2 west, 3 north. */
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const nodePos = (i, j) => [i * S, j * S];
