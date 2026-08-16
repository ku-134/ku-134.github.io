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
// 房间内分三个阶段独立界面（互不挤占）：
//   阶段0 连接确认：房间号独占一屏，连接成功后双方点【确认连接】才继续
//   阶段1 场地选择：房主选→确认（BATTLE 广播）；客人端只读——中央一张未选卡片，房主选择后填充
//   阶段2 选球：三栏布局（左=对方球展示，右=我的分类列表，底部=准备）
// 对战：主机权威，STATE 广播（phantoms 含斩击扇形/飞弹/魔族/地球探测器/太阳激光——两端渲染一致）
// 战场干扰球：巨人 | 魔王 | 太阳 三选一
// 再来一局：双方各自点【再来一局】确认，双方都确认后房主才重开（REMATCH）
// ★ 死灵术士（experimental 测试角色）：联机禁选——分类列表不显示 + 随机不命中（未来当新模式BOSS）
// ★ 意识转移（双侧）：房主侧 balls[0] 跟随 sim.necrosA[0]、balls[1] 跟随 sim.necrosB[0]；客人侧按 _necroSide 跟随
// ★ 客人端 HP 升降本地监测数字；_onData 必须处理 MSG.CMD（老bug）；STATE/CMD 处理加 try-catch 防异常卡死
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
    this.necros = [];
    this.battleId = 'arena';
    this.battleMap = getBattleField('arena');
    this.battleSelected = false;
    this.stage = 'conn';   // 'conn' | 'battle' | 'pick'
    this.connected = false;
    this.isHost = false;
    this.myClass = null;
    this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false;
    this.enemyPicked = false;
    this.ready = false;
    this.enemyReady = false;
    this.randomPick = false;
    this.rematch = false;
    this.enemyRematch = false;
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
      stageConn: document.getElementById('stage-conn'),
      stageBattle: document.getElementById('stage-battle'),
      stagePick: document.getElementById('stage-pick'),
      code: document.getElementById('room-code'),
      connStatus: document.getElementById('room-conn-status'),
      btnConnConfirm: document.getElementById('btn-conn-confirm'),
      battleCards: document.getElementById('stage-battle-cards'),
      battleInfo: document.getElementById('stage-battle-info'),
      btnBattleConfirm: document.getElementById('btn-battle-confirm-online'),
      pick: document.getElementById('online-pick'),
      pickTabs: document.getElementById('cat-tabs-online'),
      enemyBall: document.getElementById('online-enemy-ball'),
      enemy: document.getElementById('online-enemy'),
      enemyWait: document.getElementById('online-enemy-wait'),
      msg: document.getElementById('room-msg'),
      input: document.getElementById('room-input'),
      btnReady: document.getElementById('btn-ready'),
      dashBtn: document.getElementById('online-dash-btn'),
      activeBtn: document.getElementById('online-active-btn'),
    };
    bindTap(this.els.btnReady, () => this._ready());
    bindTap(this.els.btnBattleConfirm, () => this._confirmBattle());
    bindTap(this.els.btnConnConfirm, () => this._confirmConn());
  }
  get myName() { return (localStorage.getItem('collision.nick') || '玩家').slice(0, 8); }
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
    this.connected = false;
    this.myClass = null; this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false; this.enemyPicked = false;
    this.ready = false; this.enemyReady = false;
    this.randomPick = false;
    this.rematch = false; this.enemyRematch = false;
    this.battleId = 'arena'; this.battleSelected = false;
    this.stage = 'conn';
    this._resetReadyBtn();
    this.phase = 'idle';
  }
  createRoom() {
    this.leave();
    this.els.input.value = '';
    this.isHost = true;
    this._enterWait('正在连接信令服务器…', '连接中…');
    this.signal = new Signal({
      onOpen: id => {
        this.els.code.textContent = id;
        this.els.connStatus.textContent = '等待对方加入…';
      },
      onConnect: () => {
        this.connected = true;
        this.els.connStatus.textContent = '对方已加入！点击确认连接';
        this.els.btnConnConfirm.classList.remove('hidden');
      },
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
    this.els.code.textContent = code;
    this._enterWait('正在连接房间 ' + code + ' …', '正在连接房间 ' + code + ' …');
    this.signal = new Signal({
      onConnect: () => {
        this.connected = true;
        this.els.connStatus.textContent = '连接成功！点击确认连接';
        this.els.btnConnConfirm.classList.remove('hidden');
      },
      onData: m => this._onData(m),
      onDisconnect: () => this._onDisconnect(),
      onError: err => this._onError(err),
    });
    this.signal.joinRoom(code);
  }
  _enterWait(status, connText) {
    this.els.lobby.classList.add('hidden');
    this.els.wait.classList.remove('hidden');
    this.els.status = status;
    this.stage = 'conn';
    this.els.stageConn.classList.remove('hidden');
    this.els.stageBattle.classList.add('hidden');
    this.els.stagePick.classList.add('hidden');
    this.els.connStatus.textContent = connText || status;
    this.els.btnConnConfirm.classList.add('hidden');
    this.els.battleCards.innerHTML = '';
    this.els.enemy.classList.add('hidden');
    this.els.enemyWait.classList.remove('hidden');
    this.els.enemyBall.style.background = 'none';
    this.els.enemyBall.textContent = '？';
    this.els.pick.classList.add('hidden');
    this.els.pickTabs.classList.add('hidden');
    this.els.pick.innerHTML = '';
    this.els.msg.textContent = '';
    this._resetReadyBtn();
  }
  // ---- 阶段0：连接确认 → 进入场地选择 ----
  _confirmConn() {
    if (!this.connected || this.stage !== 'conn') return;
    this.stage = 'battle';
    this.els.stageConn.classList.add('hidden');
    this.els.stageBattle.classList.remove('hidden');
    this.els.status = this.isHost ? '请选择场地' : '等待房主选择场地…';
    this._renderStageBattle();
  }
  // ---- 阶段1：场地选择（房主滑动选；客人中央单卡片，房主选择后填充） ----
  _renderStageBattle() {
    this.els.battleCards.innerHTML = '';
    if (!this.isHost) {
      // 客人端：只渲染中央一张卡片（未选=❓等待，房主选择后=填充预览）
      const card = document.createElement('div');
      card.className = 'battle-card rnd stage-battle-card' + (this.battleSelected ? ' selected' : '');
      if (this.battleSelected) {
        const map = getBattleField(this.battleId);
        const cv = document.createElement('canvas');
        const name = document.createElement('div'); name.className = 'cname'; name.textContent = map.name;
        const desc = document.createElement('div'); desc.className = 'cskill'; desc.textContent = map.desc;
        card.appendChild(cv); card.appendChild(name); card.appendChild(desc);
        this._drawBattlePreview(map, cv, 260, 100);
      } else {
        const pv = document.createElement('div'); pv.className = 'battle-preview'; pv.textContent = '❓';
        const name = document.createElement('div'); name.className = 'cname'; name.textContent = '等待房主选择…';
        card.appendChild(pv); card.appendChild(name);
      }
      this.els.battleCards.appendChild(card);
      this.els.battleInfo.textContent = this.battleSelected
        ? '房主已选：' + getBattleField(this.battleId).name + '，点击确认下一步'
        : '等待房主选择场地…';
      if (this.battleSelected) this.els.btnBattleConfirm.classList.remove('hidden');
      else this.els.btnBattleConfirm.classList.add('hidden');
      return;
    }
    // 房主端：全部场地滑动选择
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
        if (!this.isHost || this.stage !== 'battle') return;
        this.battleId = map.id;
        cards.forEach(c => c.classList.toggle('selected', c === card));
        this.els.battleInfo.textContent = '已选：' + map.name + '，点击确认下一步';
      });
      this.els.battleCards.appendChild(card);
      cards.push(card);
    }
    this.els.btnBattleConfirm.classList.remove('hidden');
    this.els.battleInfo.textContent = '请选择场地';
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
      this.battleSelected = true;
      this.signal.send(MSG.BATTLE, { battleId: this.battleId });
      this._toPick();
    } else {
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
    this.els.status = '请选择你的球，然后点击准备';
    if (this.enemyPicked) this.els.enemyWait.classList.add('hidden');
    this._renderPick();
  }
  // ---- 阶段2：选球（三栏布局） ----
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
      // 随机=确认时随机定球：准备按钮直接可用（否则按钮不出现，无法下一步）
      this.els.btnReady.classList.remove('hidden');
      const defs = getSelectableDefs({ excludeExperimental: true });
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
    // 非随机分类：没选球时隐藏准备按钮（选了才出现）；★联机禁选死灵（excludeExperimental）
    if (!this.picked) this.els.btnReady.classList.add('hidden');
    renderCards(this.els.pick, getDefsByCategory(cat, { selectable: true, excludeExperimental: true }), {
      onPick: d => this._pick(d.id),
    });
  }
  _stopRoulette() { if (this._roulette) { clearInterval(this._roulette); this._roulette = null; } }
  _pick(classId) {
    this.myClass = classId;
    this.picked = true;
    this.els.status = `你已选择【${getSkillDef(classId).name}】，点击下方【准备】`;
    this.els.btnReady.classList.remove('hidden');
    this.signal.send(MSG.PICK, { classId, name: this.myName });
  }
  _ready() {
    if (this.stage !== 'pick' || this.ready) return;
    if (!this.picked) {
      if (this.randomPick) {
        // 随机定球：排除测试角色死灵术士
        const defs = getSelectableDefs({ excludeExperimental: true });
        const d = defs[Math.floor(Math.random() * defs.length)];
        this._pick(d.id);
      } else {
        this.els.status = '请先选择你的球';
        return;
      }
    }
    this.ready = true;
    this.signal.send(MSG.READY, {});
    this.els.btnReady.textContent = '已准备 ✓';
    this.els.btnReady.disabled = true;
    this.els.btnReady.classList.add('on-cd');
    this.els.status = this.enemyReady ? '双方已准备，即将开始…' : '已准备，等待对方准备…';
    this._tryStart();
  }
  _resetReadyBtn() {
    this.els.btnReady.classList.add('hidden');
    this.els.btnReady.textContent = '准备';
    this.els.btnReady.disabled = false;
    this.els.btnReady.classList.remove('on-cd');
  }
  _onData(m) {
    if (m.t === MSG.PICK) {
      this.enemyClass = m.d.classId;
      this.enemyName = m.d.name || '对手';
      this.enemyPicked = true;
      const def = getSkillDef(m.d.classId);
      this.els.enemyBall.style.background = `url('${ballIconDataURL(def, 150)}') center / cover no-repeat`;
      this.els.enemyBall.textContent = '';
      this.els.enemyWait.classList.add('hidden');
      this.els.enemy.textContent = `${this.enemyName}（${def.name}）`;
      this.els.enemy.classList.remove('hidden');
      this.els.status = this.picked
        ? (this.ready ? '对方已选球，点击准备开始' : `对方已选，你已选【${getSkillDef(this.myClass)?.name}】，点击准备`)
        : '对方已选，请选择你的球';
      this._tryStart();
    } else if (m.t === MSG.BATTLE) {
      this.battleId = m.d.battleId || 'arena';
      this.battleSelected = true;
      if (this.stage === 'battle') {
        this._renderStageBattle();
        this.els.status = '房主已选场地，请点击确认下一步';
      }
    } else if (m.t === MSG.READY) {
      this.enemyReady = true;
      this.els.status = this.ready
        ? '双方已准备，即将开始…'
        : `对方已准备，请点击【准备】`;
      this._tryStart();
    } else if (m.t === MSG.START) {
      this._startMatch(m.d);
    } else if (m.t === MSG.STATE) {
      // try-catch：单次 STATE 异常不中断后续（否则画面静止卡死）
      try { this.guest?.applyState(m.d); } catch (e) { console.error('[online] STATE err', e); }
    } else if (m.t === MSG.CMD) {
      if (this.isHost) { try { this.host?.handleCmd(m.d); } catch (e) { console.error('[online] CMD err', e); } }
    } else if (m.t === MSG.RESULT) {
      this._showResult(m.d);
    } else if (m.t === MSG.REMATCH) {
      // 双方确认再来一局：房主收到且自己也确认过才重开
      this.enemyRematch = true;
      if (this.isHost && this.rematch) this._begin();
    }
  }
  _tryStart() {
    if (!this.isHost || !this.picked || !this.enemyPicked || !this.ready || !this.enemyReady) return;
    if (!this.battleSelected) return;
    this._begin();
  }
  _begin() {
    const wildId = ['giant', 'demon', 'sun'][Math.floor(Math.random() * 3)];
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
    this.rematch = false;
    this.enemyRematch = false;
    this.hud.hideResult();
    this.hud.hideMatchTimer();
    this.ctx.phantoms = [];
    this.necros = [];
    const { w, h } = CONFIG.FIELD;
    const [s1, s2, sw] = pickSpawns(this.battleMap, 3);
    const b1 = new Ball({ x: s1.x, y: s1.y, angle: Math.PI * 0.9, name: '你', hp: d.hostClass === 'necromancer' ? CONFIG.NECRO.hp : CONFIG.MAX_HP });
    const b2 = new Ball({ x: s2.x, y: s2.y, angle: Math.PI * 0.1, name: '对方', hp: d.guestClass === 'necromancer' ? CONFIG.NECRO.hp : CONFIG.MAX_HP });
    const wildId = d.wildId || 'giant';
    if (this.isHost) {
      b1.skill = createSkill(d.hostClass, b1, this.ctx);
      b2.skill = createSkill(d.guestClass, b2, this.ctx);
      b1.dashSkill = createDashSkill(b1, this.ctx, d.hostClass);
      b2.dashSkill = createDashSkill(b2, this.ctx, d.guestClass);
      this.wilds = [makeWildBall(wildId, this.ctx, w, h)];
      this.wilds[0].x = sw.x; this.wilds[0].y = sw.y;
      // 死灵阵营（联机已禁选，此处保留兼容防御）
      if (d.hostClass === 'necromancer') { b1._necroSide = 0; this.necros.push(b1); }
      if (d.guestClass === 'necromancer') { b2._necroSide = 1; this.necros.push(b2); }
      this.host = new Host({ signal: this.signal, ctx: this.ctx, balls: [b1, b2], wilds: this.wilds, necros: this.necros, onResult: r => this._showResult(r) });
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
      this.guest.setRenderBalls([b1, b2]);
      b2.isPlayer = true;
      this.dashAim = { owner: b2, aimDir: 0 };
      this.skillAim = { owner: b2, aimDir: 0 };
    }
    b1.color = getSkillDef(d.hostClass).color;
    b2.color = getSkillDef(d.guestClass).color;
    this.balls = [b1, b2];
    this.ctx.balls = this.balls;
    this.ctx.wilds = this.wilds;   // 暴露给技能（傀儡术操控干扰球）
    this.ctx.necros = this.necros;
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownShown = -1;
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.hud.bind(this.balls, { isTouch: this.isTouch, key, myIndex: this.isHost ? 0 : 1, ctx: this.ctx });
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
        if (this.isHost) this.balls[0]?.dashSkill?.startAim();
        else { this._aimUpdate(this.dashAim); this.renderer.setAim(this.dashAim, true); this.guest.sendCmd({ type: 'aim', slot: 'dash' }); }
      },
      onRelease: () => {
        if (this.isHost) this.balls[0]?.dashSkill?.releaseAim();
        else { this.renderer.setAim(this.dashAim, false); this.guest.sendCmd({ type: 'release', slot: 'dash' }); }
      },
    });
    this.unbindActive = bindHold({
      el: this.els.activeBtn,
      isTouch: this.isTouch,
      key,
      onPress: () => {
        if (this.isHost) this.balls[0]?.skill?.startAim();
        else { this._aimUpdate(this.skillAim); this.renderer.setAim(this.skillAim, true); this.guest.sendCmd({ type: 'aim', slot: 'skill' }); }
      },
      onRelease: () => {
        if (this.isHost) this.balls[0]?.skill?.releaseAim();
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
      // 死灵意识转移（双侧）：各侧当前球跟随 sim 分组（房主侧=necrosA / 客人侧=necrosB）
      const sim = this.host?.sim;
      if (sim) {
        this.necros = sim.necros;
        this.ctx.necros = sim.necros;
        this.ctx.necrosA = sim.necrosA;
        this.ctx.necrosB = sim.necrosB;
        if (sim.necrosA.length && this.balls[0] !== sim.necrosA[0]) this.balls[0] = sim.necrosA[0];
        if (sim.necrosB.length && this.balls[1] !== sim.necrosB[0]) this.balls[1] = sim.necrosB[0];
      }
    } else {
      // 防御：guest 未就绪时跳过，避免 undefined 抛错导致渲染循环中断（卡死）
      if (!this.guest) return;
      // 客人端：同步死灵渲染列表 → ctx.necros（HUD/瞄准）+ 自己侧当前球（按 myClass 判定）
      const gN = this.guest.necros || [];
      if (gN !== this.necros) { this.necros = gN; this.ctx.necros = gN; }
      // 自己侧（客人=side1）当前球 + 对方（房主=side0）当前球跟随（双侧）
      const mine = this.necros.find(n => n._necroSide === 1);
      const theirs = this.necros.find(n => n._necroSide === 0);
      if (mine && this.balls[1] !== mine) this.balls[1] = mine;
      if (theirs && this.balls[0] !== theirs) this.balls[0] = theirs;
      const bs = this.guest.berserk || { left: 0, active: false };
      this.hud.showMatchTimer(bs.left, bs.active);
      this.phantoms = this.guest.phantoms || [];
      this._aimUpdate(this.dashAim);
      this._aimUpdate(this.skillAim);
    }
    this.renderer.update(dt);
    this.hud.tick();
  }
  render() {
    // 渲染列表：对方球 + 战场球 + 全部死灵球（避免当前球重复）
    const others = this.balls.filter(b => !this.necros.includes(b));
    this.renderer.render([...others, ...this.wilds, ...this.necros], this.loop.time, this.phantoms || [], this.battleMap);
  }
  _showResult(d) {
    this.phase = 'ended';
    this.hud.hideMatchTimer();
    const isWin = d.win === 'draw' ? false : this.isHost ? d.win === 'host' : d.win === 'guest';
    this.hud.showResult(isWin);
    this.ctx.events.emit('sfx:play', { name: isWin ? 'win' : 'lose' });
    const btnAgain = document.getElementById('online-btn-again');
    btnAgain.textContent = '再来一局';
    btnAgain.disabled = false;
    btnAgain.onclick = () => {
      if (this.rematch) return;
      this.rematch = true;
      btnAgain.textContent = '等待对方…';
      btnAgain.disabled = true;
      this.signal.send(MSG.REMATCH, {});
      if (this.isHost && this.enemyRematch) this._begin();
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
    this.wilds = []; this.necros = [];
    this.ctx.phantoms = [];
    this.dashAim = null; this.skillAim = null;
    this.hud.hideMatchTimer();
    this.hud.hideResult();
    this.ctx.events.emit('bg:run', true);
  }
}
