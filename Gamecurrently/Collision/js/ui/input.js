// 输入适配：手机触控按钮 / 电脑键盘按键

export function isTouchDevice() {
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}

// 统一按住-松开交互（瞄准预览 → 释放技能）
// ★ 双保险：键盘永远监听（电脑/外接键盘），触屏按钮存在即绑定（手机/触屏笔记本）
// 两者互不排斥，杜绝"id 不匹配导致按钮绑定不到"的无反应 bug
// 防卡：键盘分支跟踪按下状态，窗口失焦自动释放（keyup 丢失不会卡瞄准）
export function bindHold({ el, isTouch, key, onPress, onRelease }) {
  const unbinds = [];
  // 1) 键盘：始终监听（不依赖 isTouch）
  let pressed = false;
  const down = e => { if (e.code === key && !pressed) { pressed = true; e.preventDefault(); onPress(); } };
  const up = e => { if (e.code === key && pressed) { pressed = false; e.preventDefault(); onRelease(); } };
  const onBlur = () => { if (pressed) { pressed = false; onRelease(); } };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', onBlur);
  unbinds.push(() => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', onBlur);
  });
  // 2) 触屏按钮：元素存在即绑定（手机/触屏设备）
  if (el) {
    const start = e => { e.preventDefault(); onPress(); };
    const end = e => { e.preventDefault(); onRelease(); };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    unbinds.push(() => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    });
  }
  return () => unbinds.forEach(fn => fn());
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
