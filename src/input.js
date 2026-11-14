// Auvalanche! — input (pointer + teclado)
import { CFG } from './config.js';

export function createInput(canvas) {
  const state = { targetX: 0, firing: false };
  const maxX = CFG.cannon.maxX;
  const keys = { left: false, right: false, space: false };
  let enabled = true;
  let activeId = null;
  let lastClientX = 0;
  let superCb = null;

  const clamp = (v) => (v < -maxX ? -maxX : v > maxX ? maxX : v);

  function onDown(e) {
    if (!enabled || activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activeId = e.pointerId;
    lastClientX = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    state.firing = true;
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId !== activeId) return;
    const w = canvas.clientWidth || (canvas.getBoundingClientRect && canvas.getBoundingClientRect().width) || window.innerWidth || 1;
    const dx = e.clientX - lastClientX;
    lastClientX = e.clientX;
    state.targetX = clamp(state.targetX + dx * ((2 * maxX) / w) * 1.25);
    e.preventDefault();
  }
  function release(e) {
    if (e && e.pointerId !== activeId) return;
    if (e) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    activeId = null;
    state.firing = !!(enabled && keys.space);
  }
  function onBlur() {
    activeId = null;
    keys.left = keys.right = keys.space = false;
    state.firing = false;
  }

  function keyOf(e) {
    switch (e.code) {
      case 'KeyA': case 'ArrowLeft': return 'left';
      case 'KeyD': case 'ArrowRight': return 'right';
      case 'Space': return 'space';
      default: return null;
    }
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyOf(e);
    if (k) {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      keys[k] = true;
      if (k === 'space' && enabled) state.firing = true;
      return;
    }
    if (e.code === 'KeyE' && !e.repeat && enabled && superCb) superCb();
  }
  function onKeyUp(e) {
    const k = keyOf(e);
    if (!k) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    keys[k] = false;
    if (k === 'space') state.firing = !!(enabled && activeId !== null);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', onBlur);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    state,
    update(dt) {
      if (!enabled) return;
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) state.targetX = clamp(state.targetX + dir * CFG.cannon.keyboardSpeed * dt);
    },
    onSuper(cb) { superCb = cb; },
    setEnabled(b) {
      enabled = !!b;
      if (!enabled) {
        state.firing = false;
        activeId = null;
      } else if (keys.space) {
        state.firing = true;
      }
    },
    reset() { state.targetX = 0; },
  };
}
