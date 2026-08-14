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
import { OnlineMode } from './mode/onlineMode.js';
import { bindTap } from './ui/input.js';
import { renderCards } from './ui/cards.js';

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

// ---- 首页背景：模拟对战局（手绘涂鸦氛围） ----
const bg = new Renderer(document.getElementById('bgCanvas'), { autoResize: false });
const bgBalls = [
  new Ball({ x: CONFIG.FIELD.w * 0.3, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.9, color: '#e63946', name: '巨人' }),
  new Ball({ x: CONFIG.FIELD.w * 0.7, y: CONFIG.FIELD.h / 2, angle: Math.PI * 0.1, color: '#3a86ff', name: '兵团' }),
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

// ---- 图鉴：左列表 + 右详情 ----
const bestiaryList = document.getElementById('bestiary-list');
const detailOrb = document.getElementById('detail-orb');
const detailName = document.getElementById('detail-name');
const detailDesc = document.getElementById('detail-desc');
const bestiaryDefs = getSkillDefs();
function showBestiaryDetail(d) {
  detailOrb.style.background = d.color;
  detailName.textContent = `${d.name} · ${d.skillName}`;
  detailDesc.textContent = d.desc;
}
renderCards(bestiaryList, bestiaryDefs, {
  selectedId: bestiaryDefs[0].id,
  onPick: (d, card) => {
    bestiaryList.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    showBestiaryDetail(d);
  },
});
showBestiaryDetail(bestiaryDefs[0]);

// ---- 选球（单机） ----
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

// ---- 导航（bindTap：click） ----
bindTap(document.getElementById('btn-start'), () => ui.show('start'));
bindTap(document.getElementById('btn-bestiary'), () => ui.show('bestiary'));
bindTap(document.getElementById('btn-settings'), () => ui.show('settings'));
bindTap(document.getElementById('btn-single'), () => ui.show('select'));
bindTap(document.getElementById('btn-select-confirm'), () => {
  ui.show('game');
  single.start(selectedSkill);
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
