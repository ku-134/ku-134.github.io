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

// 兼容性点击：pointerdown 优先 + click 兜底（去重），
// 避免全屏切换等场景吞掉 click 事件
let _tapSeq = 0;
export function bindTap(el, fn) {
  if (!el) return () => {};
  const seq = ++_tapSeq;
  let last = 0;
  const run = () => {
    const now = Date.now();
    if (now - last < 400) return;  // 防抖：pointerdown+click 只触发一次
    last = now;
    try { fn(); } catch (e) { console.error('[bindTap]', seq, e); }
  };
  el.addEventListener('pointerdown', run);
  el.addEventListener('click', run);
  return () => {
    el.removeEventListener('pointerdown', run);
    el.removeEventListener('click', run);
  };
}
