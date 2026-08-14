// 输入适配：手机触控按钮 / 电脑键盘按键

export function isTouchDevice() {
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}

// 统一按住-松开交互（瞄准预览 → 释放技能）
// 防卡：键盘分支跟踪按下状态，窗口失焦自动释放（防止 keyup 丢失导致瞄准/冷却卡死）
export function bindHold({ el, isTouch, key, onPress, onRelease }) {
  if (isTouch && el) {
    const start = e => { e.preventDefault(); onPress(); };
    const end = e => { e.preventDefault(); onRelease(); };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }
  let pressed = false;
  const down = e => { if (e.code === key && !pressed) { pressed = true; e.preventDefault(); onPress(); } };
  const up = e => { if (e.code === key && pressed) { pressed = false; e.preventDefault(); onRelease(); } };
  const onBlur = () => { if (pressed) { pressed = false; onRelease(); } };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', onBlur);
  };
}

// 点击绑定：只用 click（pointerdown 会在按下瞬间弹窗，
// 松手时误触弹出层按钮；去掉全屏后 click 已足够可靠）
export function bindTap(el, fn) {
  if (!el) return () => {};
  const handler = e => {
    try { fn(e); } catch (err) { console.error('[bindTap]', err); }
  };
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}
