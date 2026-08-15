import CONFIG from './config.js';
import { bus } from './core/eventBus.js';
import { EffectSystem } from './entities/effectSystem.js';
import { CATEGORIES, getSkillDefs, getDefsByCategory, createSkill } from './skills/skillRegistry.js';
import { Ball } from './entities/ball.js';
import { GameLoop } from './core/gameLoop.js';
import { move, collideWalls, collideBalls } from './core/physics.js';
import { Renderer } from './rendering/renderer.js';
import { UIManager } from './ui/uiManager.js';
import { SingleMode } from './mode/singleMode.js';
import { OnlineMode } from './mode/onlineMode.js';
import { bindTap } from './ui/input.js';
import { renderCards } from './ui/cards.js';

// ---- 音效：全局管理器（修复命中无音效） ----
// 浏览器自动播放策略：Audio.play() 必须发生在用户手势（点击/按键）之后才允许出声。
// 之前 knight.js 在技能触发（rAF 循环内）时才 new Audio().play()，首次必被拦截。
// 方案：1) 首次用户交互时预加载音频 + 静音播放解锁；2) 命中事件复用已解锁实例播放。
const SLASH_SFX = ['audio/slash1.ogg', 'audio/slash2.ogg'];
let slashAudios = null;
function ensureSlashAudios() {
  if (slashAudios) return;
  slashAudios = SLASH_SFX.map(src => {
    const a = new Audio(src);
    a.preload = 'auto';
    a.load();
    return a;
  });
}
function playSlashSfx() {
  try {
    ensureSlashAudios();
    const a = slashAudios[Math.random() < 0.5 ? 0 : 1];
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch { }
}
// 首次用户手势：预加载 + 静音播放一次（授予播放权，之后命中即可出声）
let sfxUnlocked = false;
function unlockSfx() {
  if (sfxUnlocked) return;
  sfxUnlocked = true;
  try {
    ensureSlashAudios();
    slashAudios.forEach(a => {
      a.muted = true;
      a.play().catch(() => {});
      setTimeout(() => { a.muted = false; }, 200);
    });
  } catch { }
}
window.addEventListener('pointerdown', unlockSfx, { once: true });
window.addEventListener('keydown', unlockSfx, { once: true });
bus.on('fx:slashHit', playSlashSfx);

// ---- 全局上下文：物理与技能共享的依赖注入 ----
const effects = new EffectSystem();
const ctx = {
  events: bus,
  effects,
  balls: [],
  getEnemy(ball) { return this.balls.find(b => b !== ball && !b.dead) || this.balls.find(b => b !== ball); },
};
effects.setCtx(ctx);

const ui = new UIManager();
const single = new SingleMode(ctx, {
  canvas: document.getElementById('gameCanvas'),
  onBack: () => ui.show('home'),
});
const online = new OnlineMode(ctx, {
  canvas: document.getElementById('gameCanvasOnline'),
  onBack: () => ui.show('home'),
});

// ---- 首页背景：随机两个可选职业打一场（手绘涂鸦氛围） ----
// 背景与正式对战共用事件总线：正式对局开始必须暂停背景（bg:run 事件），
// 否则背景技能的 fx:damage / collision 等特效会穿透到上层战场（老bug根因）
const BG_CLASSES = ['legion', 'poison', 'thorn', 'magnet', 'puppet', 'phantom', 'knight'];
function randBgClasses() {
  const a = BG_CLASSES[Math.floor(Math.random() * BG_CLASSES.length)];
  let b = a;
  while (b === a) b = BG_CLASSES[Math.floor(Math.random() * BG_CLASSES.length)];
  return [a, b];
}
const bg = new Renderer(document.getElementById('bgCanvas'), { autoResize: false });
let bgBalls = [];
let bgCtx = null;
let bgLoop = null;
function setupBg() {
  const [c1, c2] = randBgClasses();
  const d1 = getSkillDefs().find(d => d.id === c1);
  const d2 = getSkillDefs().find(d => d.id === c2);
  bgBalls = [
    new Ball({ x: CONFIG.FIELD.w * 0.3, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.9, color: d1.color, name: d1.name }),
    new Ball({ x: CONFIG.FIELD.w * 0.7, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.1, color: d2.color, name: d2.name }),
  ];
  bgBalls[0].skill = createSkill(c1, bgBalls[0], ctx);
  bgBalls[1].skill = createSkill(c2, bgBalls[1], ctx);
  bgCtx = { ...ctx, balls: bgBalls };
  if (bgLoop) bgLoop.stop();
  bgLoop = new GameLoop(dt => {
    for (const b of bgBalls) {
      b.update(dt);
      effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      move(b, dt);
      collideWalls(b, bgCtx, bgLoop.time);
      b.skill?.update(dt);
    }
    collideBalls(bgBalls[0], bgBalls[1], bgCtx, bgLoop.time);
    bg.update(dt);
    if (bgBalls[1].skill?.canUse() && Math.random() < 0.003) {
      const enemy = bgCtx.getEnemy(bgBalls[1]);
      bgBalls[1].skill.forceUse(Math.atan2(enemy.y - bgBalls[1].y, enemy.x - bgBalls[1].x));
    }
  }, () => bg.render(bgBalls, bgLoop.time));
  bgLoop.start();
}
setupBg();
// 背景开关：正式对局（单机/联机）暂停，返回首页/大厅恢复
let bgRunning = true;
bus.on('bg:run', run => {
  bgRunning = !!run;
  if (bgRunning && bgLoop) { bgLoop.start(); bgLoop.time = 0; }
  else bgLoop?.stop();
});

// ---- 分类标签渲染（图鉴/选球/联机共用） ----
function renderCatTabs(container, cats, current, onSwitch) {
  container.innerHTML = '';
  for (const cat of cats) {
    const tab = document.createElement('button');
    tab.className = 'cat-tab' + (cat === current ? ' active' : '');
    tab.textContent = cat;
    tab.addEventListener('click', () => onSwitch?.(cat));
    container.appendChild(tab);
  }
}

// ---- 图鉴：分类切换 + 左列表 + 右详情（含战场球：巨人/魔王说明） ----
const bestiaryList = document.getElementById('bestiary-list');
const bestiaryTabs = document.getElementById('cat-tabs-bestiary');
const detailOrb = document.getElementById('detail-orb');
const detailName = document.getElementById('detail-name');
const detailDesc = document.getElementById('detail-desc');
function showBestiaryDetail(d) {
  detailOrb.style.background = d.color;
  detailName.textContent = `${d.name} · ${d.skillName}`;
  detailDesc.textContent = d.desc;
  document.getElementById('bestiary-detail').scrollTop = 0;
}
function renderBestiary(cat) {
  const defs = getDefsByCategory(cat);
  renderCatTabs(bestiaryTabs, CATEGORIES, cat, c => {
    renderBestiary(c);
    showBestiaryDetail(getDefsByCategory(c)[0]);
  });
  renderCards(bestiaryList, defs, {
    selectedId: defs[0]?.id,
    onPick: (d, card) => {
      bestiaryList.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      showBestiaryDetail(d);
    },
  });
  if (defs[0]) showBestiaryDetail(defs[0]);
}
renderBestiary(CATEGORIES[0]);

// ---- 选球（单机）：左=设置AI的对战球，右=设置玩家自己的球（各自分类切换） ----
let selectedSkill = 'legion';
let selectedAISkill = 'legion';
const selectList = document.getElementById('select-list');
const selectTabs = document.getElementById('cat-tabs-select');
const aiList = document.getElementById('select-list-ai');
const aiTabs = document.getElementById('cat-tabs-ai');
let selectCat = CATEGORIES[0];
let aiCat = CATEGORIES[0];
function renderSelect(cat) {
  selectCat = cat;
  const defs = getDefsByCategory(cat, { selectable: true });
  renderCatTabs(selectTabs, CATEGORIES, cat, renderSelect);
  renderCards(selectList, defs, {
    selectedId: selectedSkill,
    onPick: (d, card) => {
      selectedSkill = d.id;
      selectList.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    },
  });
}
function renderAI(cat) {
  aiCat = cat;
  const defs = getDefsByCategory(cat, { selectable: true });
  renderCatTabs(aiTabs, CATEGORIES, cat, renderAI);
  renderCards(aiList, defs, {
    selectedId: selectedAISkill,
    onPick: (d, card) => {
      selectedAISkill = d.id;
      aiList.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    },
  });
}
renderSelect(CATEGORIES[0]);
renderAI(CATEGORIES[0]);

// ---- 战场选择（单机）：确认出战前选战场，为后续新战场留位 ----
const BATTLE_FIELDS = [
  { id: 'arena', name: '经典角斗场', desc: '800x450 手绘角斗场。战场干扰球每局随机：巨人（基础）或魔王（剑与魔法）。', color: '#f7edd8' },
];
let selectedBattle = BATTLE_FIELDS[0].id;
const battleList = document.getElementById('battle-list');
function renderBattles() {
  battleList.innerHTML = '';
  BATTLE_FIELDS.forEach(f => {
    const card = document.createElement('div');
    card.className = 'card battle-card' + (f.id === selectedBattle ? ' selected' : '');
    card.innerHTML = `<div class="orb" style="background:${f.color}"></div><div class="cname">${f.name}</div><div class="cskill">${f.desc}</div>`;
    card.addEventListener('click', () => {
      selectedBattle = f.id;
      battleList.querySelectorAll('.battle-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    battleList.appendChild(card);
  });
}
renderBattles();

// ---- 导航（bindTap：click） ----
bindTap(document.getElementById('btn-start'), () => ui.show('start'));
bindTap(document.getElementById('btn-bestiary'), () => ui.show('bestiary'));
bindTap(document.getElementById('btn-settings'), () => ui.show('settings'));
bindTap(document.getElementById('btn-single'), () => ui.show('select'));
bindTap(document.getElementById('btn-select-confirm'), () => ui.show('battle'));
bindTap(document.getElementById('btn-battle-confirm'), () => {
  ui.show('game');
  single.start(selectedSkill, selectedAISkill, selectedBattle);
});

// ---- 联机 ----
bindTap(document.getElementById('btn-online'), () => {
  ui.show('online');
  online.enter();
});
bindTap(document.getElementById('btn-create-room'), () => online.createRoom());
bindTap(document.getElementById('btn-join-room'), () => {
  online.joinRoom(document.getElementById('room-input').value);
});
bindTap(document.getElementById('btn-online-back'), () => online.leave());

// ---- 设置：联机昵称（本地保存，随 PICK 交换给对方） ----
const nickInput = document.getElementById('nick-input');
nickInput.value = localStorage.getItem('collision.nick') || '玩家';
nickInput.addEventListener('change', () => {
  const n = (nickInput.value || '玩家').trim().slice(0, 8);
  nickInput.value = n || '玩家';
  localStorage.setItem('collision.nick', n || '玩家');
});

// ---- 设置：主动技能按键（本地保存） ----
const keyInput = document.getElementById('key-active');
keyInput.value = localStorage.getItem('collision.key') || 'J';
keyInput.addEventListener('change', () => {
  const k = (keyInput.value.toUpperCase() || 'J').replace(/[^A-Z]/g, '');
  keyInput.value = k || 'J';
  localStorage.setItem('collision.key', k || 'J');
});

// ---- 设置：皮肤上传（v1 占位，联机同步 M2） ----
document.getElementById('skin-upload').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) alert('已选择皮肤：' + f.name + '（自定义皮肤同步功能开发中）');
});
