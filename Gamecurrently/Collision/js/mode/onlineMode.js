import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { CATEGORIES, getSelectableDefs, createSkill, createDashSkill, getSkillDef, getDefsByCategory } from '../skills/skillRegistry.js';
import { getBattleField, pickSpawns, BATTLE_FIELDS } from '../maps/index.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold, bindTap } from '../ui/input.js';
import { renderCards } from '../ui/cards.js';
import { ballIconDataURL } from '../ui/ballIcon.js';
import { Signal } from '../net/signal.js';
import { Host } from '../net/host.js';
import { Guest, makeHudSkill } from '../net/guest.js';
import { MSG, isValidRoomCode } from '../net/protocol.js';
import { makeWildBall } from './singleMode.js';

// 联机模式：创建/加入房间（5位纯数字 + PeerJS）
// 房间内分两个独立阶段界面（互不干扰）：
//   阶段1 场地选择：房主选场地→确认（BATTLE 广播）；客人只读查看，房主确认后才可确认下一步
//   阶段2 选球：右=我的分类列表（可随机），左=对方球展示；准备后进入战场
// 对战：主机权威，STATE 广播（phantoms 含斩击扇形/飞弹/魔族——两端渲染一致）
// ★ 客人端 HP 升降本地监测数字（伤害/加血）；_onData 必须处理 MSG.CMD（老bug）
export class OnlineMode {
  constructor(ctx, { canvas, onBack }) {
    this.ctx = ctx;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud('online-');
    this.onBack = onBack;
    this.isTouch = isTouchDevice();
    this.signal = null;
    this.host = null;
    this.guest = null;
    this.balls = [];
    this.phantoms = [];
    this.wilds = [];
    this.battleId = 'arena';
    this.battleMap = getBattleField('arena');
    this.battleSelected = false;   // 房主已确认场地（客人=已收到 BATTLE）
    this.stage = 'battle';         // 'battle' | 'pick'
    this.isHost = false;
    this.myClass = null;
    this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false;
    this.enemyPicked = false;
    this.ready = false;
    this.enemyReady = false;
    this.randomPick = false;       // 玩家选了随机（准备时随机决定）
    this.phase = 'idle';
    this.countdown = 0;
    this.countdownShown = -1;
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unbindDash = null;
    this.unbindActive = null;
    this._unsubs = [];
    this.dashAim = null;
    this.skillAim = null;
    this.pickCat = CATEGORIES[0];
    this._roulette = null;
    this.els = {
      lobby: document.getElementById('online-lobby'),
      wait: document.getElementById('online-wait'),
      code: document.getElementById('room-code'),
      status: document.getElementById('room-status'),
      stageBattle: document.getElementById('stage-battle'),
      stagePick: document.getElementById('stage-pick'),
      battleCards: document.getElementById('stage-battle-cards'),
      battleInfo: document.getElementById('stage-battle-info'),
      btnBattleConfirm: document.getElementById('btn-battle-confirm-online'),
      pick: document.getElementById('online-pick'),
      pickTabs: document.getElementById('cat-tabs-online'),
      enemyBall: document.getElementById('online-enemy-ball'),
      enemy: document.getElementById('online-enemy'),
      msg: document.getElementById('room-msg'),
      input: document.getElementById('room-input'),
      btnReady: document.getElementById('btn-ready'),
      dashBtn: document.getElementById('online-dash-btn'),
      activeBtn: document.getElementById('online-active-btn'),
    };
    bindTap(this.els.btnReady, () => this._ready());
    bindTap(this.els.btnBattleConfirm, () => this._confirmBattle());
  }
  get myName() { return (localStorage.getItem('collision.nick') || '玩家').slice(0, 8); }
  // 进入联机大厅：清空上次房间号残留
  enter() {
    this.leave();
    this.els.lobby.classList.remove('hidden');
    this.els.wait.classList.add('hidden');
    this.els.msg.textContent = '';
    this.els.input.value = '';
  }
  leave() {
    this._cleanupMatch();
    this.signal?.close();
    this.signal = null;
    this.isHost = false;
    this.myClass = null; this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false; this.enemyPicked = false;
    this.ready = false; this.enemyReady = false;
    this.randomPick = false;
    this.battleId = 'arena'; this.battleSelected = false;
    this.stage = 'battle';
    this._resetReadyBtn();
    this.phase = 'idle';
  }
  createRoom() {
    this.leave();
    this.els.input.value = '';
    this.isHost = true;
    this._enterWait('正在连接信令服务器…');
    this.signal = new Signal({
      onOpen: id => {
        this.els.code.textContent = id;
        this.els.status.textContent = '等待对方加入…（房主先选场地）';
        this._renderStageBattle();
      },
      onConnect: () => { this.els.status.textContent = '对方已加入！请选择场地'; },
      onData: m => this._onData(m),
      onDisconnect: () => this._onDisconnect(),
      onError: err => this._onError(err),
    });
    this.signal.createRoom();
  }
  joinRoom(code) {
    code = (code || '').trim();
    if (!isValidRoomCode(code)) { this.els.msg.textContent = '请输入5位数字房间号'; return; }
    this.leave();
    this.isHost = false;
    this._enterWait('正在连接房间 ' + code + ' …');
    this.signal = new Signal({
      onConnect: () => {
        this.els.status.textContent = '已连接！等待房主选择场地…';
        this._renderStageBattle();
      },
      onData: m => this._onData(m),
      onDisconnect: () => this._onDisconnect(),
      onError: err => this._onError(err),
    });
    this.signal.joinRoom(code);
  }
  _enterWait(status) {
    this.els.lobby.classList.add('hidden');
    this.els.wait.classList.remove('hidden');
    this.els.status.textContent = status;
    this.stage = 'battle';
    this.els.stageBattle.classList.remove('hidden');
    this.els.stagePick.classList.add('hidden');
    this.els.battleInfo.textContent = this.isHost ? '请选择场地' : '等待房主选择场地…';
    this.els.btnBattleConfirm.classList.add('hidden');
    this.els.battleCards.innerHTML = '';
    this.els.enemy.classList.add('hidden');
    this.els.enemyBall.style.background = 'none';
    this.els.enemyBall.textContent = '？';
    this.els.pick.classList.add('hidden');
    this.els.pickTabs.classList.add('hidden');
    this.els.pick.innerHTML = '';
    this.els.msg.textContent = '';
    this._resetReadyBtn();
  }
  // ---- 阶段1：场地选择 ----
  _renderStageBattle() {
    this.els.battleCards.innerHTML = '';
    const cards = [];
    for (const map of BATTLE_FIELDS) {
      const card = document.createElement('div');
      card.className = 'battle-card stage-battle-card' + (map.id === this.battleId ? ' selected' : '');
      const cv = document.createElement('canvas');
      const name = document.createElement('div'); name.className = 'cname'; name.textContent = map.name;
      const desc = document.createElement('div'); desc.className = 'cskill'; desc.textContent = map.desc;
      card.appendChild(cv); card.appendChild(name); card.appendChild(desc);
      this._drawBattlePreview(map, cv, 260, 100);
      card.addEventListener('click', () => {
        if (!this.isHost || this.stage !== 'battle') return;   // 客人只读
        this.battleId = map.id;
        cards.forEach(c => c.classList.toggle('selected', c === card));
        this.els.battleInfo.textContent = '已选：' + map.name + '，点击确认下一步';
      });
      this.els.battleCards.appendChild(card);
      cards.push(card);
    }
    if (this.isHost) {
      this.els.btnBattleConfirm.classList.remove('hidden');
      this.els.battleInfo.textContent = '请选择场地';
    } else {
      this.els.btnBattleConfirm.classList.add('hidden');
      this.els.battleInfo.textContent = this.battleSelected
        ? '房主已选：' + getBattleField(this.battleId).name + '，点击确认下一步'
        : '等待房主选择场地…';
      if (this.battleSelected) this.els.btnBattleConfirm.classList.remove('hidden');
    }
  }
  _drawBattlePreview(map, canvas, w2 = 260, h2 = 100) {
    const g = canvas.getContext('2d');
    const { w, h } = CONFIG.FIELD;
    canvas.width = w2; canvas.height = h2;
    g.setTransform(w2 / w, 0, 0, h2 / h, 0, 0);
    g.fillStyle = '#f7edd8';
    g.fillRect(0, 0, w, h);
    map.draw(g, 8, w, h);
  }
  _confirmBattle() {
    if (this.stage !== 'battle') return;
    if (this.isHost) {
      // 房主：广播场地 → 进入选球
      this.battleSelected = true;
      this.signal.send(MSG.BATTLE, { battleId: this.battleId });
      this._toPick();
    } else {
      // 客人：房主已确认后才能确认下一步
      if (!this.battleSelected) {
        this.els.battleInfo.textContent = '房主还没选好场地，请稍候…';
        return;
      }
      this._toPick();
    }
  }
  _toPick() {
    this.stage = 'pick';
    this.els.stageBattle.classList.add('hidden');
    this.els.stagePick.classList.remove('hidden');
    this.els.status.textContent = '请选择你的球，然后点击准备';
    this._renderPick();
  }
  // ---- 阶段2：选球（双列：左=对方球展示，右=我的分类列表） ----
  _renderPick() {
    this.els.pickTabs.classList.remove('hidden');
    this.els.pick.classList.remove('hidden');
    this._renderPickCat(this.pickCat);
  }
  _renderPickCat(cat) {
    this._stopRoulette();
    this.pickCat = cat;
    const cats = [...CATEGORIES, '随机'];
    this.els.pickTabs.innerHTML = '';
    for (const c of cats) {
      const tab = document.createElement('button');
      tab.className = 'cat-tab' + (c === cat ? ' active' : '');
      tab.textContent = c;
      tab.addEventListener('click', () => this._renderPickCat(c));
      this.els.pickTabs.appendChild(tab);
    }
    if (cat === '随机') {
      this.randomPick = true;
      const defs = getSelectableDefs();
      if (!defs.length) return;
      this.els.pick.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card roulette-card selected';
      card.innerHTML = `<div class="orb roulette-orb"></div><div class="cname"></div><div class="cskill">?</div>`;
      this.els.pick.appendChild(card);
      const orb = card.querySelector('.orb');
      const name = card.querySelector('.cname');
      const skill = card.querySelector('.cskill');
      let idx = 0;
      const show = () => {
        const d = defs[idx];
        orb.style.background = `url('${ballIconDataURL(d, 140)}') center / cover no-repeat`;
        name.textContent = d.name;
        skill.textContent = d.skillName;
      };
      show();
      this._roulette = setInterval(() => { idx = (idx + 1) % defs.length; show(); }, 150);
      return;
    }
    this.randomPick = false;
    renderCards(this.els.pick, getDefsByCategory(cat, { selectable: true }), {
      onPick: d => this._pick(d.id),
    });
  }
  _stopRoulette() { if (this._roulette) { clearInterval(this._roulette); this._roulette = null; } }
  _pick(classId) {
    this.myClass = classId;
    this.picked = true;
    this.els.status.textContent = `你已选择【${getSkillDef(classId).name}】，点击下方【准备】`;
    this.els.btnReady.classList.remove('hidden');
    this.signal.send(MSG.PICK, { classId, name: this.myName });
  }
  // ---- 准备 ----
  _ready() {
    if (this.stage !== 'pick' || this.ready) return;
    if (!this.picked) {
      if (this.randomPick) {
        const defs = getSelectableDefs();
        const d = defs[Math.floor(Math.random() * defs.length)];
        this._pick(d.id);
      } else {
        this.els.status.textContent = '请先选择你的球';
        return;
      }
    }
    this.ready = true;
    this.signal.send(MSG.READY, {});
    this.els.btnReady.textContent = '已准备 ✓';
    this.els.btnReady.disabled = true;
    this.els.btnReady.classList.add('on-cd');
    this.els.status.textContent = this.enemyReady ? '双方已准备，即将开始…' : '已准备，等待对方准备…';
    this._tryStart();
  }
  _resetReadyBtn() {
    this.els.btnReady.classList.add('hidden');
    this.els.btnReady.textContent = '准备';
    this.els.btnReady.disabled = false;
    this.els.btnReady.classList.remove('on-cd');
  }
  // ---- 消息处理 ----
  _onData(m) {
    if (m.t === MSG.PICK) {
      this.enemyClass = m.d.classId;
      this.enemyName = m.d.name || '对手';
      this.enemyPicked = true;
      const def = getSkillDef(m.d.classId);
      this.els.enemyBall.style.background = `url('${ballIconDataURL(def, 100)}') center / cover no-repeat`;
      this.els.enemyBall.textContent = '';
      this.els.enemy.textContent = `${this.enemyName}（${def.name}）`;
      this.els.enemy.classList.remove('hidden');
      this.els.status.textContent = this.picked
        ? (this.ready ? '对方已选球，点击准备开始' : `对方已选，你已选【${getSkillDef(this.myClass)?.name}】，点击准备`)
        : '对方已选，请选择你的球';
      this._tryStart();
    } else if (m.t === MSG.BATTLE) {
      // 房主确认场地：客人更新 + 可确认下一步
      this.battleId = m.d.battleId || 'arena';
      this.battleSelected = true;
      if (this.stage === 'battle') {
        this._renderStageBattle();   // 高亮房主所选 + 显示确认按钮
        this.els.status.textContent = '房主已选场地，请点击确认下一步';
      }
    } else if (m.t === MSG.READY) {
      this.enemyReady = true;
      this.els.status.textContent = this.ready
        ? '双方已准备，即将开始…'
        : `对方已准备，请点击【准备】`;
      this._tryStart();
    } else if (m.t === MSG.START) {
      this._startMatch(m.d);
    } else if (m.t === MSG.STATE) {
      this.guest?.applyState(m.d);
    } else if (m.t === MSG.CMD) {
      if (this.isHost) this.host?.handleCmd(m.d);
    } else if (m.t === MSG.RESULT) {
      this._showResult(m.d);
    } else if (m.t === MSG.REMATCH) {
      if (this.isHost) this._begin();
    }
  }
  _tryStart() {
    if (!this.isHost || !this.picked || !this.enemyPicked || !this.ready || !this.enemyReady) return;
    if (!this.battleSelected) return;
    this._begin();
  }
  _begin() {
    const wildId = Math.random() < 0.5 ? 'giant' : 'demon';
    this.signal.send(MSG.START, { hostClass: this.myClass, guestClass: this.enemyClass, hostName: this.myName, guestName: this.enemyName, wildId, battleId: this.battleId });
    this._startMatch({ hostClass: this.myClass, guestClass: this.enemyClass, hostName: this.myName, guestName: this.enemyName, wildId, battleId: this.battleId });
  }
  _startMatch(d) {
    this.ctx.events.emit('bg:run', false);
    this.myClass = d.hostClass;
    this.enemyClass = d.guestClass;
    this.enemyName = (this.isHost ? d.guestName : d.hostName) || '对手';
    this.battleId = d.battleId || 'arena';
    this.battleMap = getBattleField(this.battleId);
    this.ctx.battleMap = this.battleMap;
    this.hud.hideResult();
    this.hud.hideMatchTimer();
    this.ctx.phantoms = [];
    const { w, h } = CONFIG.FIELD;
    const [s1, s2, sw] = pickSpawns(this.battleMap, 3);
    const b1 = new Ball({ x: s1.x, y: s1.y, angle: Math.PI * 0.9, name: '你' });
    const b2 = new Ball({ x: s2.x, y: s2.y, angle: Math.PI * 0.1, name: '对方' });
    const wildId = d.wildId || 'giant';
    if (this.isHost) {
      b1.skill = createSkill(d.hostClass, b1, this.ctx);
      b2.skill = createSkill(d.guestClass, b2, this.ctx);
      b1.dashSkill = createDashSkill(b1, this.ctx, d.hostClass);
      b2.dashSkill = createDashSkill(b2, this.ctx, d.guestClass);
      this.wilds = [makeWildBall(wildId, this.ctx, w, h)];
      this.wilds[0].x = sw.x; this.wilds[0].y = sw.y;
      this.host = new Host({ signal: this.signal, ctx: this.ctx, balls: [b1, b2], wilds: this.wilds, onResult: r => this._showResult(r) });
      b1.isPlayer = true;
      this._bindFx();
    } else {
      b1.skill = makeHudSkill(getSkillDef(d.hostClass));
      b2.skill = makeHudSkill(getSkillDef(d.guestClass));
      b1.dashSkill = makeHudSkill(getSkillDef('base_dash'));
      b2.dashSkill = makeHudSkill(getSkillDef('base_dash'));
      this.wilds = [makeWildBall(wildId, this.ctx, w, h)];
      this.wilds[0].skill = makeHudSkill(getSkillDef(wildId));
      this.wilds[0].color = getSkillDef(wildId).color;
      this.wilds[0].x = sw.x; this.wilds[0].y = sw.y;
      this.guest = new Guest({
        signal: this.signal,
        onResult: () => {},
        onLocalDamage: (x, y, amount) => this.renderer.addDmgNum(x, y, amount),
        onLocalHeal: (x, y, amount) => this.renderer.addHealNum(x, y, amount),
      });
      this.guest.setRenderBalls([b1, b2, ...this.wilds]);
      b2.isPlayer = true;
      this.dashAim = { owner: b2, aimDir: 0 };
      this.skillAim = { owner: b2, aimDir: 0 };
    }
    b1.color = getSkillDef(d.hostClass).color;
    b2.color = getSkillDef(d.guestClass).color;
    this.balls = [b1, b2, ...this.wilds];
    this.ctx.balls = [b1, b2];
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownShown = -1;
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.hud.bind(this.balls, { isTouch: this.isTouch, key, myIndex: this.isHost ? 0 : 1 });
    const hostName = this.isHost ? '你' : this.enemyName;
    const guestName = this.isHost ? this.enemyName : '你';
    this.hud.setNames(`${hostName} · ${getSkillDef(d.hostClass).name}`, `${guestName} · ${getSkillDef(d.guestClass).name}`);
    this._bindInput(key);
    const online = document.getElementById('screen-online');
    const game = document.getElementById('screen-game-online');
    online.classList.remove('active'); online.classList.add('hidden');
    game.classList.remove('hidden'); game.classList.add('active');
    this.loop.start();
  }
  _aimUpdate(inst) {
    const enemy = this.ctx.getEnemy(inst.owner);
    if (enemy) inst.aimDir = Math.atan2(enemy.y - inst.owner.y, enemy.x - inst.owner.x);
  }
  _bindInput(key) {
    this.unbindDash?.();
    this.unbindActive?.();
    this.unbindDash = bindHold({
      el: this.els.dashBtn,
      isTouch: this.isTouch,
      key: 'Space',
      onPress: () => {
        if (this.isHost) this.balls[0].dashSkill?.startAim();
        else { this._aimUpdate(this.dashAim); this.renderer.setAim(this.dashAim, true); this.guest.sendCmd({ type: 'aim', slot: 'dash' }); }
      },
      onRelease: () => {
        if (this.isHost) this.balls[0].dashSkill?.releaseAim();
        else { this.renderer.setAim(this.dashAim, false); this.guest.sendCmd({ type: 'release', slot: 'dash' }); }
      },
    });
    this.unbindActive = bindHold({
      el: this.els.activeBtn,
      isTouch: this.isTouch,
      key,
      onPress: () => {
        if (this.isHost) this.balls[0].skill?.startAim();
        else { this._aimUpdate(this.skillAim); this.renderer.setAim(this.skillAim, true); this.guest.sendCmd({ type: 'aim', slot: 'skill' }); }
      },
      onRelease: () => {
        if (this.isHost) this.balls[0].skill?.releaseAim();
        else { this.renderer.setAim(this.skillAim, false); this.guest.sendCmd({ type: 'release', slot: 'skill' }); }
      },
    });
  }
  _bindFx() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this._unsubs.push(this.ctx.events.on('collision', e => {
      this.renderer.particles.spawn(e.ball.x, e.ball.y, { color: e.ball.color, count: e.other ? 10 : 5, speed: 90 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:line', ({ ball, hit }) => this.renderer.addLineFx(ball, hit)));
    this._unsubs.push(this.ctx.events.on('fx:transform', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#ffb703', count: 20, speed: 150 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:shield', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#b8a24a', count: 12, speed: 100 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:field', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#5f27cd', count: 14, speed: 90 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:swap', ({ a, b }) => this.renderer.addSwapFx(a, b)));
    this._unsubs.push(this.ctx.events.on('fx:phantomHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color, count: 18, speed: 160, size: 4 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:poison', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#6a994e', count: 8, speed: 60 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:damage', ({ x, y, amount }) => {
      this.renderer.addDmgNum(x, y, amount);
    }));
    this._unsubs.push(this.ctx.events.on('fx:heal', ({ x, y, amount }) => {
      this.renderer.addHealNum(x, y, amount);
    }));
    this._unsubs.push(this.ctx.events.on('fx:charge', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#b89fea', count: 6, speed: 50 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:fire', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#b89fea', count: 16, speed: 140 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:missileHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color: color || '#b89fea', count: 10, speed: 130, size: 3 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:summon', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#6d4a7e', count: 14, speed: 90 });
    }));
    this._unsubs.push(this.ctx.events.on('fx:minionHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color, count: 16, speed: 150, size: 4 });
    }));
    this._unsubs.push(this.ctx.events.on('skill:aim', ({ inst, on }) => this.renderer.setAim(inst, on)));
    this._unsubs.push(this.ctx.events.on('ball:die', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#fff', count: 30, speed: 200, size: 4 });
    }));
  }
  update(dt) {
    if (this.phase === 'countdown') {
      const n = Math.ceil(this.countdown);
      if (n !== this.countdownShown) {
        this.countdownShown = n;
        this.hud.showCountdown(n);
        if (n > 0) this.ctx.events.emit('sfx:play', { name: 'count' });
      }
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.hud.showCountdown(0);
        setTimeout(() => this.hud.hideCountdown(), 600);
        if (this.isHost) this.host.start();
      }
      return;
    }
    if (this.phase !== 'playing') return;
    if (this.isHost) {
      this.host.update(dt);
      this.hud.showMatchTimer(this.host.berserkLeft, this.host.berserk);
      this.phantoms = this.ctx.phantoms || [];
    } else {
      this.hud.showMatchTimer(this.guest.berserk.left, this.guest.berserk.active);
      this.phantoms = this.guest.phantoms;
      this._aimUpdate(this.dashAim);
      this._aimUpdate(this.skillAim);
    }
    this.renderer.update(dt);
    this.hud.tick();
  }
  render() { this.renderer.render(this.balls, this.loop.time, this.phantoms, this.battleMap); }
  _showResult(d) {
    this.phase = 'ended';
    this.hud.hideMatchTimer();
    const isWin = d.win === 'draw' ? false : this.isHost ? d.win === 'host' : d.win === 'guest';
    this.hud.showResult(isWin);
    this.ctx.events.emit('sfx:play', { name: isWin ? 'win' : 'lose' });
    document.getElementById('online-btn-again').onclick = () => {
      this.hud.hideResult();
      if (this.isHost) this._begin();
      else this.signal.send(MSG.REMATCH, {});
    };
    document.getElementById('online-btn-home2').onclick = () => {
      this.hud.hideResult();
      this._backToOnline();
    };
  }
  _backToOnline() {
    const game = document.getElementById('screen-game-online');
    const online = document.getElementById('screen-online');
    game.classList.remove('active'); game.classList.add('hidden');
    online.classList.remove('hidden'); online.classList.add('active');
    this.leave();
    this.enter();
  }
  _onDisconnect() {
    if (typeof window.showAlert === 'function') window.showAlert('对方已离开，对局结束');
    this._backToOnline();
  }
  _onError(err) {
    const type = err?.type;
    const msg = type === 'unavailable-id' ? '房间号已被占用，请重试'
      : type === 'peer-unavailable' ? '房间不存在或已满'
      : type === 'network' ? '网络不可达，请检查网络'
      : (err?.message || '连接出错，请重试');
    this.els.msg.textContent = msg;
    this.leave();
    this.els.lobby.classList.remove('hidden');
    this.els.wait.classList.add('hidden');
  }
  _cleanupMatch() {
    this._stopRoulette();
    this.loop.stop();
    this.unbindDash?.(); this.unbindDash = null;
    this.unbindActive?.(); this.unbindActive = null;
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this.host = null; this.guest = null;
    this.balls = []; this.phantoms = [];
    this.wilds = [];
    this.ctx.phantoms = [];
    this.dashAim = null; this.skillAim = null;
    this.hud.hideMatchTimer();
    this.hud.hideResult();
    this.ctx.events.emit('bg:run', true);
  }
}
