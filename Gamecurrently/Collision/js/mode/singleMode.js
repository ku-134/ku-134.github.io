import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { MatchSim } from '../core/matchSim.js';
import { createSkill, createDashSkill } from '../skills/skillRegistry.js';
import { AIController } from '../ai/aiController.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold } from '../ui/input.js';

// AI 可选职业池（巨人已转战场干扰球，剔除）
const AI_CLASSES = ['legion', 'poison', 'thorn', 'magnet', 'puppet', 'phantom'];

// 单机模式：玩家选球 vs AI，321 倒计时，观战 + 主动干涉
// 双技能通道：基础冲刺（Space/左下按钮，全职业；兵团带30伤）+ 职业技能（J键/右下按钮，主动职业）
// 战场干扰球：巨人（第三方）独立游走，只保留愤怒机制（碰撞攒怒→巨大化30伤）
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
    this.balls = [];
    this.wild = null;
    this.sim = null;
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unsubs = [];
    this.unbindDash = null;
    this.unbindActive = null;
  }
  start(playerSkillId) {
    this.curSkillId = playerSkillId;
    this.ctx.phantoms = [];
    const { w, h } = CONFIG.FIELD;
    const p1 = new Ball({ x: w * 0.3, y: h / 2, angle: Math.PI * 0.9, name: '你' });
    const p2 = new Ball({ x: w * 0.7, y: h / 2, angle: Math.PI * 0.1, name: 'AI' });
    p1.skill = createSkill(playerSkillId, p1, this.ctx);
    p2.skill = createSkill(AI_CLASSES[Math.floor(Math.random() * AI_CLASSES.length)], p2, this.ctx);
    // 基础冲刺（全职业通用；兵团职业自动带30伤变体）
    p1.dashSkill = createDashSkill(p1, this.ctx, playerSkillId);
    p2.dashSkill = createDashSkill(p2, this.ctx, p2.skill.def.id);
    // 球色 = 职业色；自己的球带倒三角标记
    p1.color = p1.skill.def.color;
    p2.color = p2.skill.def.color;
    p1.isPlayer = true;
    // 战场干扰球（巨人）：hp 极高不死，只保留愤怒机制，无 dashSkill（不触发机动冲刺）
    this.wild = new Ball({ x: w * 0.5, y: h * 0.5, angle: Math.random() * Math.PI * 2, hp: CONFIG.WILD.hp, name: '战场巨人' });
    this.wild.skill = createSkill('giant', this.wild, this.ctx);
    this.wild.color = this.wild.skill.def.color;
    this.balls = [p1, p2];
    this.ctx.balls = this.balls;
    this.sim = new MatchSim(this.ctx, this.balls, this.wild);
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
    this.unsubs.push(this.ctx.events.on('skill:aim', ({ inst, on }) => this.renderer.setAim(inst, on)));
    this.unsubs.push(this.ctx.events.on('ball:die', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#fff', count: 30, speed: 200, size: 4 });
    }));
    // 双技能通道输入：冲刺（Space/左下按钮）+ 职业技能（J键/右下按钮）
    this.unbindDash?.();
    this.unbindActive?.();
    this.unbindDash = bindHold({
      el: document.getElementById('dash-btn'),
      isTouch: this.isTouch,
      key: 'Space',
      onPress: () => p1.dashSkill?.startAim(),
      onRelease: () => p1.dashSkill?.releaseAim(),
    });
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.unbindActive = bindHold({
      el: document.getElementById('active-btn'),
      isTouch: this.isTouch,
      key,
      onPress: () => p1.skill?.startAim(),
      onRelease: () => p1.skill?.releaseAim(),
    });
    this.hud.bind(this.balls, { isTouch: this.isTouch, key });
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
      if (n !== this.countdownShown) { this.countdownShown = n; this.hud.showCountdown(n); }
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
    this.ai?.update(dt);
    this.hud.showMatchTimer(this.sim.berserkLeft(), this.sim.berserk);
    this.renderer.update(dt);
    this.hud.tick();
    if (res.over) this.endMatch();
  }
  render() {
    const all = this.wild ? [...this.balls, this.wild] : this.balls;
    this.renderer.render(all, this.loop.time, this.ctx.phantoms || []);
  }
  endMatch() {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.hud.hideMatchTimer();
    const [p1, p2] = this.balls;
    let win;
    if (p1.dead && p2.dead) win = p1.hp >= p2.hp;
    else if (!p1.dead && p2.dead) win = true;
    else if (p1.dead && !p2.dead) win = false;
    else win = p1.hp >= p2.hp;
    this.hud.showResult(win);
    const again = document.getElementById('btn-again');
    const home = document.getElementById('btn-home2');
    again.onclick = () => { this.hud.hideResult(); this.start(this.curSkillId); };
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
  }
}
