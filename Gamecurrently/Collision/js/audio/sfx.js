// 全局音效管理器 v2：分类开关 + 自动播放策略解锁 + 预加载 + 事件驱动播放
// 用法：任何模块 ctx.events.emit('sfx:play', { name, throttle }) 或直接 import playSfx
// 分类开关（设置面板可调，localStorage 持久化）：
//   master 全局 / ui 按钮交互 / hit 受击 / dash 冲刺 / skill 技能 / match 对局（倒计时/狂暴/结算）
// 音频文件放 audio/ 目录（.ogg），不存在时播放静默失败（不报错）
// ★ 自动播放策略：首次用户手势（pointerdown/keydown）后调用 unlockSfx() 授予播放权
// 音效 → 分类映射（开关粒度）
const CATEGORY = {
  ui_click: 'ui',
  dash: 'dash',
  slash: 'skill',
  hit: 'hit',
  heal: 'skill',
  count: 'match',
  berserk: 'match',
  win: 'match',
  lose: 'match',
};

const DEFAULT_TOGGLES = { master: true, ui: true, hit: true, dash: true, skill: true, match: true };
const toggles = { ...DEFAULT_TOGGLES };
// 从 localStorage 恢复开关（Node 环境无 localStorage → 跳过）
function loadToggles() {
  try {
    if (typeof localStorage === 'undefined') return;
    for (const k of Object.keys(DEFAULT_TOGGLES)) {
      const v = localStorage.getItem('collision.sfx.' + k);
      if (v !== null) toggles[k] = v === '1';
    }
  } catch { /* 隐私模式等 */ }
}
loadToggles();
export function setSfxToggle(key, on) {
  toggles[key] = !!on;
  try { localStorage.setItem('collision.sfx.' + key, toggles[key] ? '1' : '0'); } catch {}
}
export function getSfxToggle(key) { return toggles[key] ?? true; }
// ★ 背景静音（battleMuted）：对局未开始（首页背景演示对战）期间，强制静音战斗音效（受击/冲刺/技能）；
//   不干扰设置项——对局开始后恢复，设置项照常生效
let battleMuted = false;
export function setBattleMuted(m) { battleMuted = !!m; }
export function isSfxEnabled(name) {
  if (!toggles.master) return false;
  const cat = CATEGORY[name];
  return !cat || toggles[cat];
}
const SFX_DEFS = {
  ui_click: ['audio/ui_click.ogg'],          // 按钮点击（所有 bindTap 按钮）
  dash: ['audio/dash.ogg'],                  // 基础冲刺释放（松开瞄准瞬间）
  slash: ['audio/slash1.ogg', 'audio/slash2.ogg'],  // 骑士斩击（挥剑即响）
  hit: ['audio/hit.ogg'],                    // 通用伤害命中（150ms 节流防高频刷屏）
  heal: ['audio/heal.ogg'],                  // 治疗术发动
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
// 播放音效：受开关控制（master + 分类）；随机取一个实例，未加载/被拦截时静默
// throttle>0：全局节流（毫秒），防高频技能（磁铁电疗等）刷爆音效
export function playSfx(name, { throttle = 0 } = {}) {
  if (!isSfxEnabled(name)) return;
  // 背景静音：对战音效（受击/冲刺/技能）在背景演示期间不播放（UI/对局音效不受影响）
  if (battleMuted) {
    const cat = CATEGORY[name];
    if (cat === 'hit' || cat === 'dash' || cat === 'skill') return;
  }
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