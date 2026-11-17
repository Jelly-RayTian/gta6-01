// Keyboard + mouse -> one `inp` object per simulation step (edges are cleared after each read).
const keys = new Set(), edges = new Set();
const mouse = { dx: 0, dy: 0, left: false, right: false, leftEdge: false };
let locked = false, onUi = () => {};
export const isLocked = () => locked;

export function bindInput(canvas, handlers) {
  onUi = handlers.onKey ?? onUi;
  addEventListener('keydown', (e) => { if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); if (!e.repeat) { keys.add(e.code); edges.add(e.code); onUi(e.code); } });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.left = true; mouse.leftEdge = true; } if (e.button === 2) mouse.right = true; handlers.onClick?.(); if (!locked && handlers.canLock?.()) canvas.requestPointerLock?.(); });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked) handlers.onUnlock?.(); });
  addEventListener('mousemove', (e) => { if (locked || mouse.left || mouse.right) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
}
export function releaseKeys() { keys.clear(); edges.clear(); mouse.left = mouse.right = false; mouse.dx = mouse.dy = 0; }
export function readInput() {
  const k = (c) => keys.has(c), e = (c) => edges.has(c);
  const inp = {
    fwd: k('KeyW') || k('ArrowUp'), back: k('KeyS') || k('ArrowDown'), left: k('KeyA') || k('ArrowLeft'), right: k('KeyD') || k('ArrowRight'),
    sprint: k('ShiftLeft') || k('ShiftRight'), jump: e('Space'), hb: k('Space'), enter: e('KeyE'), reload: e('KeyR'), melee: e('KeyF') || e('KeyQ'),
    horn: k('KeyH'), fire: mouse.left, aim: mouse.right, mdx: mouse.dx, mdy: mouse.dy,
  };
  mouse.dx = mouse.dy = 0; edges.clear(); mouse.leftEdge = false;
  return inp;
}
export const emptyInput = () => ({ fwd: false, back: false, left: false, right: false, sprint: false, jump: false, hb: false, enter: false, reload: false, melee: false, horn: false, fire: false, aim: false, mdx: 0, mdy: 0 });
