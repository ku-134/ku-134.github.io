import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { createSkill, getSkillDef, getSkillDefs } from '../skills/skillRegistry.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold } from '../ui/input.js';
import { renderCards } from '../ui/cards.js';
import { Signal } from '../net/signal.js';
import { Host } from '../net/host.js';
import { Guest, makeHudSkill } from '../net/guest.js';
import { MSG, isValidRoomCode } from '../net/protocol.js';

// 联机模式：创建/加入房间（5位纯数字 + PeerJS）→ 双方选球 → 321 → 主机权威对战
// 独立战场 screen-game-online（HUD 前缀 online-），与单机互不干扰
// 对方昵称：设置里预设（localStorage collision.nick），随 PICK 交换
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
    this.isHost = false;
    this.myClass = null;
    this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false;
    this.enemyPicked = false;
    this.phase = 'idle';   // idle → countdown → playing → ended
    this.countdown = 0;
    this.countdownShown = -1;
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unbindInput = null;
    this._unsubs = [];
    this.els = {
      lobby: document.getElementById('online-lobby'),
      wait: document.getElementById('online-wait'),
      code: document.getElementById('room-code'),
      status: document.getElementById('room-status'),
      pick: document.getElementById('online-pick'),
      enemy: document.getElementById('online-enemy'),
      msg: document.getElementById('room-msg'),
      input: document.getElementById('room-input'),
    };
  }
  // 昵称（设置里预设）
  get myName() { return (localStorage.getItem('collision.nick') || '玩家').slice(0, 8); }
  // 进入联机大厅（main.js 点击【联机】时调用）
  enter() {
    this.leave();
    this.els.lobby.classList.remove('hidden');
    this.els.wait.classList.add('hidden');
    this.els.msg.textContent = '';
  }
  // 离开/断开（返回时调用）
  leave() {
    this._cleanupMatch();
    this.signal?.close();
    this.signal = null;
    this.isHost = false;
    this.myClass = null; this.enemyClass = null;
    this.enemyName = '对手';
    this.picked = false; this.enemyPicked = false;
    this.phase = 'idle';
  }
  // ---- 创建房间 ----
  createRoom() {
    this.leave();
    this.isHost = true;
    this._enterWait('正在连接信令服务器…');
    this.signal = new Signal({
      onOpen: id => {
        this.els.code.textContent = id;
        this.els.status.textContent = '等待对方加入…（可先选球）';
        this._renderPick();
      },
      onConnect: () => { this.els.status.textContent = '对方已加入！请选择你的球'; },
      onData: m => this._onData(m),
      onDisconnect: () => this._onDisconnect(),
      onError: err => this._onError(err),
    });
    this.signal.createRoom();
  }
  // ---- 加入房间 ----
  joinRoom(code) {
    code = (code || '').trim();
    if (!isValidRoomCode(code)) { this.els.msg.textContent = '请输入5位数字房间号'; return; }
    this.leave();
    this.isHost = false;
    this._enterWait('正在连接房间 ' + code + ' …');
    this.signal = new Signal({
      onConnect: () => { this.els.status.textContent = '已连接！请选择你的球'; this._renderPick(); },
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
    this.els.enemy.classList.add('hidden');
    this.els.pick.classList.add('hidden');
    this.els.pick.innerHTML = '';
    this.els.msg.textContent = '';
  }
  _renderPick() {
    this.els.pick.classList.remove('hidden');
    renderCards(this.els.pick, getSkillDefs(), {
      onPick: d => this._pick(d.id),
    });
  }
  _pick(classId) {
    this.myClass = classId;
    this.picked = true;
    this.els.status.textContent = `你已选择【${getSkillDef(classId).name}】，等待对方…`;
    this.signal.send(MSG.PICK, { classId, name: this.myName });
    this._tryStart();
  }
  // ---- 消息处理（核心：STATE 驱动客户端画面） ----
  _onData(m) {
    if (m.t === MSG.PICK) {
      this.enemyClass = m.d.classId;
      this.enemyName = m.d.name || '对手';
      this.enemyPicked = true;
      const def = getSkillDef(m.d.classId);
      this.els.enemy.textContent = `对方：${this.enemyName}（${def ? def.name : m.d.classId}）`;
      this.els.enemy.classList.remove('hidden');
      this.els.status.textContent = this.picked ? '双方就绪，即将开始…' : `对方已选，请选择你的球`;
      this._tryStart();
    } else if (m.t === MSG.START) {
      this._startMatch(m.d);
    } else if (m.t === MSG.STATE) {
      this.guest?.applyState(m.d);
    } else if (m.t === MSG.RESULT) {
      this._showResult(m.d);
    } else if (m.t === MSG.REMATCH) {
      if (this.isHost) this._begin();
    }
  }
  // 主机在双方就绪时广播开局
  _tryStart() {
    if (!this.isHost || !this.picked || !this.enemyPicked) return;
    this._begin();
  }
  _begin() {
    this.signal.send(MSG.START, { hostClass: this.myClass, guestClass: this.enemyClass, hostName: this.myName, guestName: this.enemyName });
    this._startMatch({ hostClass: this.myClass, guestClass: this.enemyClass, hostName: this.myName, guestName: this.enemyName });
  }
  _startMatch(d) {
    this.myClass = d.hostClass;
    this.enemyClass = d.guestClass;
    this.enemyName = (this.isHost ? d.guestName : d.hostName) || '对手';
    this.hud.hideResult();
    this.hud.hideMatchTimer();
    this.ctx.phantoms = [];
    const { w, h } = CONFIG.FIELD;
    const b1 = new Ball({ x: w * 0.3, y: h / 2, angle: Math.PI * 0.9, name: '你' });
    const b2 = new Ball({ x: w * 0.7, y: h / 2, angle: Math.PI * 0.1, name: '对方' });
    if (this.isHost) {
      b1.skill = createSkill(d.hostClass, b1, this.ctx);
      b2.skill = createSkill(d.guestClass, b2, this.ctx);
      this.host = new Host({ signal: this.signal, ctx: this.ctx, balls: [b1, b2], onResult: w => this._showResult({ win: w }) });
      b1.isPlayer = true;
      this._bindFx();
    } else {
      b1.skill = makeHudSkill(getSkillDef(d.hostClass));
      b2.skill = makeHudSkill(getSkillDef(d.guestClass));
      this.guest = new Guest({ signal: this.signal, onResult: w => this._showResult({ win: w }) });
      this.guest.setRenderBalls([b1, b2]);
      b2.isPlayer = true;
    }
    b1.color = getSkillDef(d.hostClass).color;
    b2.color = getSkillDef(d.guestClass).color;
    this.balls = [b1, b2];
    this.ctx.balls = this.balls;
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownShown = -1;
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.hud.bind(this.balls, { isTouch: this.isTouch, key });
    // 名字文案：右侧=主机侧，左侧=客人侧（对方昵称来自设置/交换）
    const hostName = this.isHost ? '你' : this.enemyName;
    const guestName = this.isHost ? this.enemyName : '你';
    this.hud.setNames(`${hostName} · ${getSkillDef(d.hostClass).name}`, `${guestName} · ${getSkillDef(d.guestClass).name}`);
    this._bindInput(key);
    // 切换到联机专用战场
    const online = document.getElementById('screen-online');
    const game = document.getElementById('screen-game-online');
    online.classList.remove('active'); online.classList.add('hidden');
    game.classList.remove('hidden'); game.classList.add('active');
    this.loop.start();
  }
  // 主机端特效/伤害数字/瞄准线订阅（与单机一致）
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
    this._unsubs.push(this.ctx.events.on('skill:aim', ({ inst, on }) => this.renderer.setAim(inst, on)));
    this._unsubs.push(this.ctx.events.on('ball:die', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#fff', count: 30, speed: 200, size: 4 });
    }));
  }
  _bindInput(key) {
    this.unbindInput?.();
    // 只控制自己的球：主机=本地 balls[0]，客人=发指令由主机执行
    this.unbindInput = bindHold({
      el: document.getElementById('skill-btn-online'),
      isTouch: this.isTouch,
      key,
      onPress: () => { if (this.isHost) this.balls[0].skill?.startAim(); else this.guest?.sendCmd({ type: 'aim' }); },
      onRelease: () => { if (this.isHost) this.balls[0].skill?.releaseAim(); else this.guest?.sendCmd({ type: 'release' }); },
    });
  }
  update(dt) {
    if (this.phase === 'countdown') {
      const n = Math.ceil(this.countdown);
      if (n !== this.countdownShown) { this.countdownShown = n; this.hud.showCountdown(n); }
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
    }
    this.renderer.update(dt);
    this.hud.tick();
  }
  render() { this.renderer.render(this.balls, this.loop.time, this.phantoms); }
  _showResult(d) {
    this.phase = 'ended';
    this.hud.hideMatchTimer();
    this.hud.showResult(d.win === 'you');
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
    alert('对方已离开，对局结束');
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
    this.loop.stop();
    this.unbindInput?.(); this.unbindInput = null;
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this.host = null; this.guest = null;
    this.balls = []; this.phantoms = [];
    this.ctx.phantoms = [];
    this.hud.hideMatchTimer();
    this.hud.hideResult();
  }
}
