// HUD and menu screens (DOM): money, health, stars, weapon, objective, speed, prompts, toasts, banners, screens.
import { W } from './world.js';
import { MISSIONS, nextMission } from './missions.js';
import { drawMinimap } from './minimap.js';
import { dist } from './config.js';
import { nearestCar } from './player.js';
import { carName } from './vehicles.js';

const $ = (id) => document.getElementById(id);
const cache = {};
const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
const setHtml = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).innerHTML = v; } };
const show = (id, on) => { const e = $(id); if (e.hidden === on) e.hidden = !on; };
const SCREENS = ['title', 'pause', 'missions', 'over'];

/** Show one overlay screen (title, pause, missions, over) or none (null); the HUD shows except on the title. */
export function showScreen(name, extra) {
  for (const s of SCREENS) show(s, s === name);
  show('hud', name !== 'title');
  if (name === 'over') { $('over').className = `screen ${extra.kind}`; $('overTitle').textContent = extra.title; $('overSub').textContent = extra.sub; }
  if (name === 'missions') renderMissionList();
}
export function renderMissionList() {
  const n = nextMission();
  $('mlist').innerHTML = MISSIONS.map((m, i) => {
    const done = W.done.includes(m.id), next = n === m;
    return `<div class="mrow ${done ? 'done' : next ? 'next' : 'locked'}"><span>${i + 1}. ${m.title}</span><span>${done ? 'COMPLETE' : next ? 'AVAILABLE · $' + m.reward : 'LOCKED'}</span></div>`;
  }).join('');
  const s = W.stats;
  $('mstats').innerHTML = `<span>Cash $${W.money}</span><span>Kills ${s.kills}</span><span>Cars stolen ${s.stolen}</span><span>Wrecks ${s.wrecks}</span><span>Busted ${s.arrests}</span><span>Wasted ${s.deaths}</span><span>Distance ${(s.distance / 1000).toFixed(1)} km</span><span>Play time ${Math.floor(s.playtime / 60)} min</span>`;
}
function zoneName(x, z) {
  if (x > 620) return 'Palm Beach';
  if (z > 540) return 'Harbor District';
  if (x < 160 && z < 260) return 'Old Quarter';
  if (x < 120) return 'Westside';
  if (x > 190 && x < 520 && z > 190 && z < 520) return 'Downtown';
  return 'Coral Heights';
}

export function updateHud(dt, target) {
  const P = W.player, w = W.wanted;
  setText('money', '$' + W.money.toLocaleString('en-US'));
  $('hp').style.width = Math.max(0, P.hp) + '%';
  setText('weapon', P.car ? carName(P.car) : `PISTOL  ${P.ammo} / ${P.reserve}${P.reloadT > 0 ? '  reloading' : ''}`);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += `<span class="${i < w.stars ? 'on' : ''}">★</span>`;
  setHtml('stars', stars); $('stars').classList.toggle('flash', w.stars > 0 && !w.seen);
  const hh = Math.floor(W.clock) % 24, mm = Math.floor((W.clock % 1) * 60);
  setText('clock', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  setText('zone', zoneName(P.x, P.z));
  const m = W.mission, n = nextMission();
  show('objective', !!(m || n));
  if (m) {
    setText('objTitle', m.def.title); setText('objText', m.obj);
    const d = m.target ? Math.round(dist(P.x, P.z, m.target[0], m.target[1])) : null;
    setText('objMeta', [d != null ? `${d} m` : '', m.timer != null ? `⏱ ${Math.ceil(m.timer)} s` : ''].filter(Boolean).join('   '));
  } else if (n) {
    setText('objTitle', 'Next mission'); setText('objText', `${n.title}: go to the yellow marker`);
    setText('objMeta', `${Math.round(dist(P.x, P.z, n.start[0], n.start[1]))} m`);
  }
  show('speed', !!P.car); setHtml('speed', `${P.car ? Math.round(Math.abs(P.car.sp) * 3.6) : 0}<small>KM/H</small>`);
  show('cross', !P.car);
  let prompt = '';
  if (!P.car) { const c = nearestCar(P); if (c) prompt = `Press E to ${c.driver ? 'take' : 'enter'} ${carName(c)}`; }
  setText('prompt', prompt); show('prompt', !!prompt);
  if (W.toast) { W.toast.t -= dt; if (W.toast.t <= 0) W.toast = null; }
  setText('toast', W.toast?.text ?? ''); show('toast', !!W.toast);
  if (W.banner) { W.banner.t -= dt; if (W.banner.t <= 0) W.banner = null; }
  setHtml('banner', W.banner ? `${W.banner.text}<small>${W.banner.sub}</small>` : ''); show('banner', !!W.banner);
  $('vignette').style.opacity = String(Math.min(0.9, W.hurt + (P.hp < 30 ? 0.25 : 0)));
  drawMinimap($('minimap'), target);
}
export const bindButtons = (map) => { for (const [id, fn] of Object.entries(map)) $(id).addEventListener('click', fn); };
export const setPauseMsg = (t) => { $('pauseMsg').textContent = t; };
export const setContinueEnabled = (on) => { $('btnCont').disabled = !on; };
