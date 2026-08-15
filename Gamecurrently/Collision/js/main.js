import CONFIG from './config.js';
import { bus } from './core/eventBus.js';
import { EffectSystem } from './entities/effectSystem.js';
import { CATEGORIES, getSkillDefs, getDefsByCategory, getSelectableDefs, createSkill } from './skills/skillRegistry.js';
import { Ball } from './entities/ball.js';
import { GameLoop } from './core/gameLoop.js';
import { move, collideWalls, collideBalls } from './core/physics.js';
import { Renderer } from './rendering/renderer.js';
import { UIManager } from './ui/uiManager.js';
import { SingleMode } from './mode/singleMode.js';
import { OnlineMode } from './mode/onlineMode.js';
import { bindTap } from './ui/input.js';
import { renderCards } from './ui/cards.js';
import { playSfx, unlockSfx, setSfxToggle, getSfxToggle } from './audio/sfx.js';
import { ballIconDataURL } from './ui/ballIcon.js';
import { BATTLE_FIELDS } from './maps/index.js';

// ---- 专属提示弹窗（替代浏览器 alert，手绘风格） ----
const gameAlert = document.getElementById('game-alert');
const alertMsg = document.getElementById('alert-msg');
function showAlert(msg) {
  alertMsg.textContent = msg;
  gameAlert.classList.remove('hidden');
}
bindTap(document.getElementById('alert-ok'), () => gameAlert.classList.add('hidden'));
window.showAlert = showAlert;

// ---- 音效事件接线：任何模块 emit('sfx:play', { name, throttle }) 即播放（受分类开关控制） ----
// 首次用户交互解锁播放权（浏览器自动播放策略）
window.addEventListener('pointerdown', unlockSfx, { once: true });
window.addEventListener('keydown', unlockSfx, { once: true });
bus.on('sfx:play', ({ name, throttle }) => playSfx(name, { throttle }));

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

// ---- 首页背景：随机两个可选职业打一场（手绘涂鸦氛围，不运行技能=静音） ----
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
      // ★ 背景不打技能：技能 update 跳过 → 无技能音效/特效穿透（静音）
    }
    collideBalls(bgBalls[0], bgBalls[1], bgCtx, bgLoop.time);
    bg.update(dt);
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
  detailOrb.style.background = `url('${ballIconDataURL(d, 150)}') center / cover no-repeat`;
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

// ---- 选球（单机）：左=设置AI的对战球，右=设置玩家自己的球 ----
const SELECT_CATS = [...CATEGORIES, '随机'];
let selectedSkill = 'legion';      // null = 随机（确认时决定）
let selectedAISkill = 'legion';
const selectList = document.getElementById('select-list');
const selectTabs = document.getElementById('cat-tabs-select');
const aiList = document.getElementById('select-list-ai');
const aiTabs = document.getElementById('cat-tabs-ai');
let selectCat = CATEGORIES[0];
let aiCat = CATEGORIES[0];
// 随机轮播：只展示一个球（带装饰图标），每150ms切换职业（纯预览，不可点击选择）
function makeRoulette(listEl) {
  let timer = null;
  let defs = [];
  let idx = 0;
  return {
    start(defList) {
      this.stop();
      defs = defList;
      if (!defs.length) return;
      listEl.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card roulette-card selected';
      card.innerHTML = `<div class="orb roulette-orb"></div><div class="cname"></div><div class="cskill">?</div>`;
      listEl.appendChild(card);
      const orb = card.querySelector('.orb');
      const name = card.querySelector('.cname');
      const skill = card.querySelector('.cskill');
      idx = 0;
      const show = () => {
        const d = defs[idx];
        orb.style.background = `url('${ballIconDataURL(d, 140)}') center / cover no-repeat`;
        name.textContent = d.name;
        skill.textContent = d.skillName;
      };
      show();
      timer = setInterval(() => { idx = (idx + 1) % defs.length; show(); }, 150);
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } },
  };
}
const aiRoulette = makeRoulette(aiList);
const selectRoulette = makeRoulette(selectList);
function renderSelect(cat) {
  selectCat = cat;
  renderCatTabs(selectTabs, SELECT_CATS, cat, renderSelect);
  if (cat === '随机') {
    selectedSkill = null;          // 随机：确认时从可选职业随机决定
    selectRoulette.start(getSelectableDefs());
    return;
  }
  selectRoulette.stop();
  const defs = getDefsByCategory(cat, { selectable: true });
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
  renderCatTabs(aiTabs, SELECT_CATS, cat, renderAI);
  if (cat === '随机') {
    selectedAISkill = null;
    aiRoulette.start(getSelectableDefs());
    return;
  }
  aiRoulette.stop();
  const defs = getDefsByCategory(cat, { selectable: true });
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

// ---- 战场选择（单机）：左右滑动选战场（小型渲染图 + 文案）+ 随机战场 ----
let selectedBattle = null;
const battleList = document.getElementById('battle-list');
function renderBattlePreview(map, canvas, t = 8) {
  const g = canvas.getContext('2d');
  const { w, h } = CONFIG.FIELD;
  canvas.width = 260; canvas.height = 146;
  g.setTransform(260 / w, 0, 0, 146 / h, 0, 0);
  g.fillStyle = map.color || '#f7edd8';
  g.fillRect(0, 0, w, h);
  map.draw(g, t, w, h);   // t=8：方孔转个角度，预览更生动
}
function renderBattles() {
  battleList.innerHTML = '';
  const cards = [];
  const rnd = document.createElement('div');
  rnd.className = 'battle-card rnd' + (selectedBattle == null ? ' selected' : '');
  rnd.innerHTML = `<div class="battle-preview rnd-preview">🎲</div><div class="cname">随机战场</div><div class="cskill">每局从所有战场中随机一个</div>`;
  rnd.addEventListener('click', () => {
    selectedBattle = null;
    cards.forEach(c => c.el.classList.toggle('selected', c.match(selectedBattle)));
  });
  battleList.appendChild(rnd);
  cards.push({ el: rnd, match: b => b == null });
  for (const map of BATTLE_FIELDS) {
    const card = document.createElement('div');
    card.className = 'battle-card' + (selectedBattle === map.id ? ' selected' : '');
    const cv = document.createElement('canvas');
    const name = document.createElement('div'); name.className = 'cname'; name.textContent = map.name;
    const desc = document.createElement('div'); desc.className = 'cskill'; desc.textContent = map.desc;
    card.appendChild(cv); card.appendChild(name); card.appendChild(desc);
    renderBattlePreview(map, cv);
    card.addEventListener('click', () => {
      selectedBattle = map.id;
      cards.forEach(c => c.el.classList.toggle('selected', c.match(selectedBattle)));
    });
    battleList.appendChild(card);
    cards.push({ el: card, match: b => b === map.id });
  }
}
renderBattles();

// ---- 导航（bindTap：click） ----
bindTap(document.getElementById('btn-start'), () => ui.show('start'));
bindTap(document.getElementById('btn-bestiary'), () => ui.show('bestiary'));
bindTap(document.getElementById('btn-settings'), () => ui.show('settings'));
bindTap(document.getElementById('btn-sfx'), () => ui.show('sfx'));
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

// ---- 设置：音效开关（分类独立，localStorage 持久化） ----
document.querySelectorAll('.sfx-toggle').forEach(cb => {
  const key = cb.id.replace('sfx-', '');
  cb.checked = getSfxToggle(key);
  cb.addEventListener('change', () => setSfxToggle(key, cb.checked));
});

// ---- 设置：皮肤上传（v1 占位，联机同步 M2） ----
document.getElementById('skin-upload').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) alert('已选择皮肤：' + f.name + '（自定义皮肤同步功能开发中）');
});
