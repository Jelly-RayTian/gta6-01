// Progress saved to localStorage: money, completed missions, stats and last position.
import { W } from './world.js';
const KEY = 'solmar-bay-heatwave-v1';
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function saveGame() {
  try { localStorage.setItem(KEY, JSON.stringify({ money: W.money, done: W.done, stats: W.stats, pos: [W.player.x, W.player.z], ammo: W.player.reserve, at: Date.now() })); return true; } catch { return false; }
}
export function loadGame() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (!d) return null; return d; } catch { return null; }
}
export function applySave(d) {
  W.money = d.money | 0; W.done = Array.isArray(d.done) ? d.done : []; Object.assign(W.stats, d.stats ?? {});
  if (d.ammo) W.player.reserve = d.ammo;
}
export function wipeSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
