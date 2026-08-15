// 全局音效管理器：自动播放策略解锁 + 预加载 + 事件驱动播放
// 用法：任何模块 ctx.events.emit('sfx:play', { name, throttle }) 或直接 import playSfx
// 音频文件放 audio/ 目录（.ogg），不存在时播放静默失败（不报错）
// ★ 自动播放策略：首次用户手势（pointerdown/keydown）后调用 unlockSfx() 授予播放权
const SFX_DEFS = {
  ui_click: ['audio/ui_click.ogg'],          // 按钮点击（所有 bindTap 按钮）
  dash: ['audio/dash.ogg'],                  // 基础冲刺释放（松开瞄准瞬间）
  slash: ['audio/slash1.ogg', 'audio/slash2.ogg'],  // 骑士斩击（挥剑即响，提前于命中）
  hit: ['audio/hit.ogg'],                    // 通用伤害命中（150ms 节流防高频刷屏）
  heal: ['audio/heal.ogg'],                  // 治疗术发动（闪绿+数字同步）
  count: ['audio/count.ogg'],                // 321 倒计时每声
  berserk: ['audio/berserk.ogg'],            // 狂暴降临瞬间
  win: ['audio/win.ogg'],                    // 胜利结算
  lose: ['audio/lose.ogg'],                  // 失败结算
};

let audios = null;
let unlocked = false;
let lastHitAt = 0;

function ensure() {
  if (audios) return;
  audios = {};
  for (const [name, srcs] of Object.entries(SFX_DEFS)) {
    audios[name] = srcs.map(src => {
      try {
        const a = new Audio(src);
        a.preload = 'auto';
        a.load();
        return a;
      } catch { return null; }
    }).filter(Boolean);
  }
}

// 播放音效：随机取一个实例，未加载/被拦截时静默
// throttle>0：全局节流（毫秒），防高频技能（磁铁电疗等）刷爆音效
export function playSfx(name, { throttle = 0 } = {}) {
  try {
    ensure();
    const arr = audios[name];
    if (!arr || !arr.length) return;
    if (throttle > 0) {
      const now = performance.now();
      if (now - lastHitAt < throttle) return;
      lastHitAt = now;
    }
    const a = arr[Math.floor(Math.random() * arr.length)];
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch { /* 无音频环境 */ }
}

// 首次用户手势调用：预加载全部 + 静音播放一次解锁（之后 play 才允许出声）
export function unlockSfx() {
  if (unlocked) return;
  unlocked = true;
  try {
    ensure();
    for (const arr of Object.values(audios)) {
      arr.forEach(a => {
        a.muted = true;
        a.play().catch(() => {});
        setTimeout(() => { a.muted = false; }, 300);
      });
    }
  } catch {}
}
