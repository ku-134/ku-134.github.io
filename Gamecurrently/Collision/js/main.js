import CONFIG from './config.js';
import { bus } from './core/eventBus.js';
import { EffectSystem } from './entities/effectSystem.js';
import { getSkillDefs, createSkill } from './skills/skillRegistry.js';
import { Ball } from './entities/ball.js';
import { GameLoop } from './core/gameLoop.js';
import { move, collideWalls, collideBalls } from './core/physics.js';
import { Renderer } from './rendering/renderer.js';
import { UIManager } from './ui/uiManager.js';
import { SingleMode } from './mode/singleMode.js';

// ---- 全局上下文：物理与技能共享的依赖注入 ----
const effects = new EffectSystem();
const ctx = {
  events: bus,
  effects,
  balls: [],
  getEnemy(ball) { return this.balls.find(b => b !== ball && !b.dead) || this.balls.find(b => b !== ball); },
};

const ui = new UIManager();
const single = new SingleMode(ctx, {
  canvas: document.getElementById('gameCanvas'),
  onBack: () => ui.show('home'),
});

// ---- 自动全屏（浏览器要求用户手势触发） ----
document.addEventListener('click', () => {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement && !document.webkitFullscreenElement) req.call(el).catch(() => {});
});

// ---- 首页背景：模拟对战局（赛博斗蛐蛐氛围） ----
const bg = new Renderer(document.getElementById('bgCanvas'), { autoResize: false });
const bgBalls = [
  new Ball({ x: CONFIG.FIELD.w * 0.3, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.9, color: '#ef5350', name: '巨人' }),
  new Ball({ x: CONFIG.FIELD.w * 0.7, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.1, color: '#42a5f5', name: '兵团' }),
];
bgBalls[0].skill = createSkill('giant', bgBalls[0], ctx);
bgBalls[1].skill = createSkill('legion', bgBalls[1], ctx);
const bgCtx = { ...ctx, balls: bgBalls };
const bgLoop = new GameLoop(dt => {
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

// ---- 卡片渲染（图鉴与选球共用） ----
function renderCards(listEl, defs, { selectedId, onPick } = {}) {
  listEl.innerHTML = '';
  for (const d of defs) {
    const card = document.createElement('div');
    card.className = 'card' + (d.id === selectedId ? ' selected' : '');
    card.innerHTML = `<div class="orb" style="background:radial-gradient(circle at 35% 30%, #ffffff88, ${d.color})"></div><div class="cname">${d.name}</div><div class="cskill">【${d.skillName}】${d.type === 'passive' ? '被动' : d.type === 'active' ? '主动' : '被动+主动'}</div>`;
    card.addEventListener('click', () => onPick?.(d, card));
    listEl.appendChild(card);
  }
}

// ---- 图鉴 ----
const bestiaryList = document.getElementById('bestiary-list');
const bestiaryDetail = document.getElementById('bestiary-detail');
renderCards(bestiaryList, getSkillDefs(), {
  onPick: d => {
    bestiaryDetail.classList.remove('hidden');
    bestiaryDetail.innerHTML = `<h3 style="color:${d.color}">${d.name} · ${d.skillName}</h3><p>${d.desc}</p>`;
  },
});

// ---- 选球 ----
let selectedSkill = 'giant';
const selectList = document.getElementById('select-list');
renderCards(selectList, getSkillDefs(), {
  selectedId: selectedSkill,
  onPick: (d, card) => {
    selectedSkill = d.id;
    selectList.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
  },
});
document.getElementById('btn-select-confirm').addEventListener('click', () => {
  ui.show('game');
  single.start(selectedSkill);
});

// ---- 导航 ----
document.getElementById('btn-start').addEventListener('click', () => ui.show('start'));
document.getElementById('btn-bestiary').addEventListener('click', () => ui.show('bestiary'));
document.getElementById('btn-settings').addEventListener('click', () => ui.show('settings'));
document.getElementById('btn-single').addEventListener('click', () => ui.show('select'));

// ---- 联机（M2 开发中占位） ----
document.getElementById('btn-online').addEventListener('click', () => {
  ui.show('online');
  document.getElementById('room-msg').textContent = '联机模式开发中（M2），敬请期待～';
});
document.getElementById('btn-create-room').addEventListener('click', () => {
  document.getElementById('room-msg').textContent = '联机模式开发中（M2），敬请期待～';
});
document.getElementById('btn-join-room').addEventListener('click', () => {
  document.getElementById('room-msg').textContent = '联机模式开发中（M2），敬请期待～';
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
