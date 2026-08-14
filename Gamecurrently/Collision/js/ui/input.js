// 输入适配：手机触控按钮 / 电脑键盘按键

export function isTouchDevice() {
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}

// 统一按住-松开交互（瞄准预览 → 释放技能）
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
  const down = e => { if (e.code === key) { e.preventDefault(); onPress(); } };
  const up = e => { if (e.code === key) { e.preventDefault(); onRelease(); } };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
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
