import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { MatchSim } from '../core/matchSim.js';
import { createSkill, createDashSkill, getSelectableDefs } from '../skills/skillRegistry.js';
import { BATTLE_FIELDS, getBattleField, pickSpawns } from '../maps/index.js';
import { AIController } from '../ai/aiController.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold } from '../ui/input.js';

// 单机模式：玩家选球 vs 玩家指定的 AI 职业，321 倒计时，观战 + 主动干涉
// 双技能通道：基础冲刺（Space/左下按钮，全职业；兵团带30伤）+ 职业技能（J键/右下按钮，主动职业）
// 战场：由场地文件（js/maps/*）控制出生点/绘制/边界；battleId=null → 随机场地
// 战场干扰球：每局随机一个（巨人 | 魔王），均为第三方，不参与胜负
// 死灵术士：双侧阵营都支持（玩家侧=necrosA / AI侧=necrosB）——双方都选死灵时各自召唤/转移/分段血条
// ★ 随机选球：start 收到 null = 从可选职业随机（不含战场球）；再来一局时重新随机
// ★ 对局开始暂停首页背景（bg:run false），返回时恢复（背景无技能音效）
const WILD_IDS = ['giant', 'demon'];

// 随机职业池：全部可选职业（自动跟随注册表，不含战场球）
const randomPool = () => getSelectableDefs().map(d => d.id);
const pickRandom = () => {
  const pool = randomPool();
  return pool[Math.floor(Math.random() * pool.length)];
};

// 创建战场干扰球（巨人 r=20 红色暴怒 / 魔王 r=30 紫色召唤）
export function makeWildBall(id, ctx, w, h) {
  const isDemon = id === 'demon';
  const b = new Ball({
    x: w * 0.5, y: isDemon ? h * 0.65 : h * 0.35,
    angle: Math.random() * Math.PI * 2,
    hp: CONFIG.WILD.hp,
    radius: isDemon ? CONFIG.BALL.radius * CONFIG.DEMON.scale : undefined,
    name: isDemon ? '战场魔王' : '战场巨人',
  });
  b.skill = createSkill(id, b, ctx);
  b.color = b.skill.def.color;
  return b;
}

export class SingleMode {
  constructor(ctx, { canvas, onBack }) {
    this.ctx = ctx;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.onBack = onBack;
    this.isTouch = isTouchDevice();
    this.phase = 'idle';
    this.countdown = 0;
    this.countdownShown = -1;
    this.curSkillId = 'legion';
    this.curAISkillId = 'legion';
    this.curPlayerRandom = false;   // 本局玩家是否随机选球
    this.curAIRandom = false;       // 本局 AI 是否随机选球
    this.curBattleId = 'arena';
    this.curBattleRandom = false;   // 本局是否随机场地
    this.battleMap = null;
    this.balls = [];
    this.wilds = [];
    this.necros = [];
    this.necrosA = [];
    this.necrosB = [];
    this.sim = null;
    this.lastWinner = -1;
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unsubs = [];
    this.unbindDash = null;
    this.unbindActive = null;
  }
  start(playerSkillId, aiSkillId = 'legion', battleId = 'arena') {
    // 随机选球：null = 此刻随机决定（再来一局重新随机）
    this.curPlayerRandom = playerSkillId == null;
    this.curAIRandom = aiSkillId == null;
    const pId = playerSkillId ?? pickRandom();
    const aId = aiSkillId ?? pickRandom();
    this.curSkillId = pId;
    this.curAISkillId = aId;
    // 随机场地：battleId=null → 随机（再来一局重新随机）；否则固定
    this.curBattleRandom = battleId == null;
    this.curBattleId = battleId ?? BATTLE_FIELDS[Math.floor(Math.random() * BATTLE_FIELDS.length)].id;
    this.battleMap = getBattleField(this.curBattleId);
    this.ctx.battleMap = this.battleMap;
    // 正式对局：暂停首页背景（防特效/伤害穿透 + 静音）
    this.ctx.events.emit('bg:run', false);
    this.ctx.phantoms = [];
    const { w, h } = CONFIG.FIELD;
    // 出生点：场地文件控制（玩家2球 + 战场球从 4 个对称点随机取 3 个）
    const [s1, s2, sw] = pickSpawns(this.battleMap, 3);
    const p1 = new Ball({ x: s1.x, y: s1.y, angle: Math.PI * 0.9, name: '你', hp: pId === 'necromancer' ? CONFIG.NECRO.hp : CONFIG.MAX_HP });
    const p2 = new Ball({ x: s2.x, y: s2.y, angle: Math.PI * 0.1, name: 'AI', hp: aId === 'necromancer' ? CONFIG.NECRO.hp : CONFIG.MAX_HP });
    p1.skill = createSkill(pId, p1, this.ctx);
    p2.skill = createSkill(aId, p2, this.ctx);
    // 基础冲刺（全职业通用；兵团职业自动带30伤变体）
    p1.dashSkill = createDashSkill(p1, this.ctx, pId);
    p2.dashSkill = createDashSkill(p2, this.ctx, aId);
    // 球色 = 职业色；自己的球带倒三角标记
    p1.color = p1.skill.def.color;
    p2.color = p2.skill.def.color;
    p1.isPlayer = true;
    // 战场干扰球：每局随机一个（巨人 | 魔王），出生自场地点位
    const wild = makeWildBall(WILD_IDS[Math.floor(Math.random() * WILD_IDS.length)], this.ctx, w, h);
    wild.x = sw.x; wild.y = sw.y;
    this.wilds = [wild];
    this.balls = [p1, p2];
    this.ctx.balls = this.balls;
    this.ctx.wilds = this.wilds;   // 暴露给技能（傀儡术操控干扰球）
    // 死灵术士：双侧阵营（玩家侧=0 / AI侧=1），双方都选死灵也各自独立运作
    this.necros = [];
    this.necrosA = [];
    this.necrosB = [];
    if (p1.skill?.def.id === 'necromancer') { p1._necroSide = 0; this.necrosA.push(p1); this.necros.push(p1); }
    if (p2.skill?.def.id === 'necromancer') { p2._necroSide = 1; this.necrosB.push(p2); this.necros.push(p2); }
    this.ctx.necros = this.necros;
    this.ctx.necrosA = this.necrosA;
    this.ctx.necrosB = this.necrosB;
    this.sim = new MatchSim(this.ctx, this.balls, this.wilds, this.necros);
    this.ai = new AIController(p2, this.ctx);
    this.unsubs.forEach(fn => fn());
    this.unsubs = [];
    this.unsubs.push(this.ctx.events.on('collision', e => {
      this.renderer.particles.spawn(e.ball.x, e.ball.y, { color: e.ball.color, count: e.other ? 10 : 5, speed: 90 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:line', ({ ball, hit }) => this.renderer.addLineFx(ball, hit)));
    this.unsubs.push(this.ctx.events.on('fx:transform', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#ffb703', count: 20, speed: 150 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:shield', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#b8a24a', count: 12, speed: 100 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:field', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#5f27cd', count: 14, speed: 90 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:swap', ({ a, b }) => this.renderer.addSwapFx(a, b)));
    this.unsubs.push(this.ctx.events.on('fx:phantomHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color, count: 18, speed: 160, size: 4 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:poison', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#6a994e', count: 8, speed: 60 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:damage', ({ x, y, amount }) => {
      this.renderer.addDmgNum(x, y, amount);
    }));
    this.unsubs.push(this.ctx.events.on('fx:heal', ({ x, y, amount }) => {
      this.renderer.addHealNum(x, y, amount);
    }));
    this.unsubs.push(this.ctx.events.on('fx:slash', ({ x, y, dir, r, hit }) => {
      this.renderer.addSlashFx(x, y, dir, r, hit);
    }));
    this.unsubs.push(this.ctx.events.on('fx:charge', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#b89fea', count: 6, speed: 50 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:fire', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#b89fea', count: 16, speed: 140 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:missileHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color: color || '#b89fea', count: 10, speed: 130, size: 3 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:summon', ({ x, y }) => {
      this.renderer.particles.spawn(x, y, { color: '#6d4a7e', count: 14, speed: 90 });
    }));
    this.unsubs.push(this.ctx.events.on('fx:minionHit', ({ x, y, color }) => {
      this.renderer.particles.spawn(x, y, { color, count: 16, speed: 150, size: 4 });
    }));
    this.unsubs.push(this.ctx.events.on('skill:aim', ({ inst, on }) => this.renderer.setAim(inst, on)));
    this.unsubs.push(this.ctx.events.on('ball:die', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#fff', count: 30, speed: 200, size: 4 });
    }));
    // 双技能通道输入：冲刺（Space/左下按钮）+ 职业技能（J键/右下按钮）
    // ★ 输入始终操作 balls[0]（玩家侧死灵意识转移后自动跟随当前球）
    this.unbindDash?.();
    this.unbindActive?.();
    this.unbindDash = bindHold({
      el: document.getElementById('dash-btn'),
      isTouch: this.isTouch,
      key: 'Space',
      onPress: () => this.balls[0]?.dashSkill?.startAim(),
      onRelease: () => this.balls[0]?.dashSkill?.releaseAim(),
    });
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.unbindActive = bindHold({
      el: document.getElementById('active-btn'),
      isTouch: this.isTouch,
      key,
      onPress: () => this.balls[0]?.skill?.startAim(),
      onRelease: () => this.balls[0]?.skill?.releaseAim(),
    });
    this.hud.bind(this.balls, { isTouch: this.isTouch, key, ctx: this.ctx });
    this.hud.hideResult();
    this.hud.hideMatchTimer();
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownShown = -1;
    this.loop.start();
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
        this.phase = 'fight';
        this.hud.showCountdown(0);
        setTimeout(() => this.hud.hideCountdown(), 600);
      }
      return;
    }
    if (this.phase === 'end') return;
    const res = this.sim.step(dt);
    // 死灵意识转移（双侧）：同步引用 + 各侧当前球跟随（阵营归属固定 _necroSide）
    if (this.sim?.necros) {
      this.necros = this.sim.necros;
      this.necrosA = this.sim.necrosA;
      this.necrosB = this.sim.necrosB;
      this.ctx.necros = this.necros;
      this.ctx.necrosA = this.necrosA;
      this.ctx.necrosB = this.necrosB;
      // 玩家侧（side0）当前球 → balls[0]；AI侧（side1）当前球 → balls[1] + AI 控制目标
      if (this.necrosA.length && this.balls[0] !== this.necrosA[0]) this.balls[0] = this.necrosA[0];
      if (this.necrosB.length && this.balls[1] !== this.necrosB[0]) {
        this.balls[1] = this.necrosB[0];
        this.ai?.setBall(this.balls[1]);
      }
    }
    this.ai?.update(dt);
    this.hud.showMatchTimer(this.sim.berserkLeft(), this.sim.berserk);
    this.renderer.update(dt);
    this.hud.tick();
    if (res.over) { this.lastWinner = res.winner; this.endMatch(); }
  }
  render() {
    // 渲染列表：对方球 + 战场球 + 全部死灵球（避免当前球重复）
    const others = this.balls.filter(b => !this.necros.includes(b));
    const all = [...others, ...this.wilds, ...this.necros];
    this.renderer.render(all, this.loop.time, this.ctx.phantoms || [], this.battleMap);
  }
  endMatch() {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.hud.hideMatchTimer();
    // winner：0=玩家侧赢 / 1=AI侧赢 / -1=平局兜底比血
    let win;
    if (this.lastWinner === 0) win = true;
    else if (this.lastWinner === 1) win = false;
    else win = this.balls[0].hp >= this.balls[1].hp;
    this.hud.showResult(win);
    this.ctx.events.emit('sfx:play', { name: win ? 'win' : 'lose' });
    const again = document.getElementById('btn-again');
    const home = document.getElementById('btn-home2');
    // 再来一局：随机选球/随机场地的重新随机（null 触发）
    again.onclick = () => {
      this.hud.hideResult();
      this.start(
        this.curPlayerRandom ? null : this.curSkillId,
        this.curAIRandom ? null : this.curAISkillId,
        this.curBattleRandom ? null : this.curBattleId
      );
    };
    home.onclick = () => { this.hud.hideResult(); this.stop(); this.onBack(); };
  }
  stop() {
    this.loop.stop();
    this.ctx.phantoms = [];
    this.hud.hideMatchTimer();
    this.unsubs.forEach(fn => fn());
    this.unsubs = [];
    this.unbindDash?.(); this.unbindDash = null;
    this.unbindActive?.(); this.unbindActive = null;
    // 返回首页：恢复背景
    this.ctx.events.emit('bg:run', true);
  }
}
