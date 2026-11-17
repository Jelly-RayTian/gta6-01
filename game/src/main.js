// Boot and main loop: renderer, scene, screens (title / play / pause / missions), fixed-step simulation, audio, saving.
import * as THREE from 'three';
import { W, note } from './world.js';
import { DT } from './config.js';
import { buildCity, inSolid } from './city.js';
import { initLighting, setGolden } from './lighting.js';
import { initFx } from './fx.js';
import { initMarkers, missionTargetFor } from './missions.js';
import { resetWorld, stepGame, frameCamera, titleCamera, START } from './game.js';
import { bindInput, readInput, emptyInput, releaseKeys } from './input.js';
import { initAudio, updateAudio, playEvents, setMusic, duckMusic, sfx } from './audio.js';
import { hasSave, saveGame, loadGame, applySave, wipeSave } from './save.js';
import { showScreen, updateHud, bindButtons, setPauseMsg, setContinueEnabled, renderMissionList } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.3, 2400);
W.scene = scene; W.camera = camera;
buildCity(scene); initLighting(scene); initMarkers(scene);
const fxMat = initFx(scene);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function render() {
  fxMat.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  renderer.render(scene, camera);
}

let mode = 'title', paused = false, autosave = 0, titleT = 0, last = performance.now(), acc = 0;
const query = new URLSearchParams(location.search), shot = query.get('shot');

function setMode(m) {
  mode = m; paused = m === 'pause' || m === 'missions';
  showScreen(m === 'title' ? 'title' : m === 'pause' ? 'pause' : m === 'missions' ? 'missions' : null);
  duckMusic(paused || m === 'title');
  if (paused || m === 'title') { releaseKeys(); document.exitPointerLock?.(); }
}
function freshWorld(seed) {
  resetWorld(seed); W.money = 100; W.done = [];
  Object.assign(W.stats, { kills: 0, wrecks: 0, arrests: 0, deaths: 0, stolen: 0, distance: 0, playtime: 0, shots: 0 });
}
function newGame() {
  initAudio(); setMusic(true); wipeSave(); freshWorld((Date.now() & 0xffff) + 1); setMode('play');
  note('Danny: Rita said to meet her at the plaza... follow the yellow marker.', 7); sfx.click();
}
function continueGame() {
  const d = loadGame(); if (!d) return newGame();
  initAudio(); setMusic(true); freshWorld((Date.now() & 0xffff) + 1); applySave(d);
  if (d.pos && !inSolid(d.pos[0], d.pos[1], 1)) { W.player.x = d.pos[0]; W.player.z = d.pos[1]; } else { W.player.x = START[0]; W.player.z = START[1]; }
  setMode('play'); note(`Welcome back, Danny. $${W.money} in your pocket.`, 5); sfx.click();
}
function pause(on) { if (mode === 'play' || mode === 'pause' || mode === 'missions') setMode(on ? 'pause' : 'play'); }
function onKey(code) {
  if (mode === 'title') { if (code === 'Enter') (hasSave() ? continueGame : newGame)(); return; }
  if (code === 'Escape') { if (mode === 'play') pause(true); else if (mode === 'missions') setMode('pause'); else pause(false); }
  if (code === 'Tab') { if (mode === 'play') setMode('missions'); else if (mode === 'missions') setMode('play'); }
}
bindInput(canvas, { onKey, canLock: () => mode === 'play', onUnlock: () => { if (mode === 'play') pause(true); }, onClick: () => initAudio() });
bindButtons({
  btnNew: newGame, btnCont: continueGame, btnResume: () => pause(false),
  btnMissions: () => { setMode('missions'); renderMissionList(); }, btnMBack: () => setMode('pause'),
  btnSave: () => { saveGame(); setPauseMsg('Game saved.'); sfx.chime(); },
  btnQuit: () => { saveGame(); setContinueEnabled(hasSave()); setPauseMsg(''); freshWorld(3); setMode('title'); },
});
setContinueEnabled(hasSave());

function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'title') {
    titleT += real; setGolden(1); acc += real;
    while (acc >= DT) { acc -= DT; stepGame(DT, emptyInput()); W.events.length = 0; }
    titleCamera(titleT);
  } else if (!paused) {
    const inp = readInput(); acc += real; let first = true;
    while (acc >= DT) {
      acc -= DT; stepGame(DT, first ? inp : { ...inp, jump: false, enter: false, reload: false, melee: false, mdx: 0, mdy: 0 }); first = false;
      playEvents(W.events); if (W.events.some((e) => e.type === 'save')) saveGame(); W.events.length = 0;
    }
    frameCamera(real, inp);
    autosave += real; if (autosave > 30) { autosave = 0; saveGame(); }
    updateAudio(real); updateHud(real, missionTargetFor());
  }
  render(); requestAnimationFrame(frame);
}

if (shot) {
  mode = stageShot(shot, Number(query.get('seed')) || 1);
  showScreen(mode === 'title' ? 'title' : null);
  if (mode !== 'title') updateHud(0.016, missionTargetFor());
  render(); render(); window.__shotReady = true;
} else {
  freshWorld(3); showScreen('title'); requestAnimationFrame(frame);
}
window.__game = { W, get mode() { return mode; }, newGame, continueGame };
