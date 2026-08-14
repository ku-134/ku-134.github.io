import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { move, collideWalls, collideBalls } from '../core/physics.js';
import { createSkill } from '../skills/skillRegistry.js';
import { AIController } from '../ai/aiController.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold } from '../ui/input.js';

// AI 可选职业池
const AI_CLASSES = ['giant', 'legion', 'poison', 'thorn', 'magnet', 'puppet', 'phantom'];

// 单机模式：玩家选球 vs AI，321 倒计时，观战 + 主动干涉
// 狂暴机制：30s 倒计时结束后，每秒对全场所有球造成10点伤害（10s内必分胜负）
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
    this.matchTime = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this.curSkillId = 'giant';
    this.balls = [];
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unsubs = [];
    this.unbindInput = null;
  }
  start(playerSkillId) {
    this.curSkillId = playerSkillId;
    this.ctx.phantoms = [];
    const { w, h } = CONFIG.FIELD;
    const p1 = new Ball({ x: w * 0.3, y: h / 2, angle: Math.PI * 0.9, color: '#06d6a0', name: '你' });
    const p2 = new Ball({ x: w * 0.7, y: h / 2, angle: Math.PI * 0.1, color: '#ff9e00', name: 'AI' });
    p1.skill = createSkill(playerSkillId, p1, this.ctx);
    p2.skill = createSkill(AI_CLASSES[Math.floor(Math.random() * AI_CLASSES.length)], p2, this.ctx);
    this.balls = [p1, p2];
    this.ctx.balls = this.balls;
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
    this.unsubs.push(this.ctx.events.on('skill:aim', ({ inst, on }) => this.renderer.setAim(inst, on)));
    this.unsubs.push(this.ctx.events.on('ball:die', ({ ball }) => {
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#fff', count: 30, speed: 200, size: 4 });
    }));
    this.unbindInput?.();
    const key = 'Key' + (localStorage.getItem('collision.key') || 'J');
    this.unbindInput = bindHold({
      el: document.getElementById('skill-btn'),
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
    this.matchTime = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
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
    for (const b of this.balls) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      move(b, dt);
      collideWalls(b, this.ctx, this.loop.time);
      b.skill?.update(dt);
    }
    collideBalls(this.balls[0], this.balls[1], this.ctx, this.loop.time);
    this.ai?.update(dt);
    this.matchTime += dt;
    // 狂暴机制：30s 倒计时 → 每秒全场 10 伤
    if (!this.berserk) {
      const left = Math.max(0, CONFIG.BERSERK.delay - this.matchTime);
      this.hud.showMatchTimer(Math.ceil(left), false);
      if (left <= 0) {
        this.berserk = true;
        this.berserkTime = 0;
        this.berserkTick = 0;
        this.hud.showMatchTimer(CONFIG.BERSERK.duration, true);
      }
    } else {
      this.berserkTime += dt;
      this.berserkTick += dt;
      if (this.berserkTick >= 1) {
        this.berserkTick -= 1;
        for (const b of this.balls) {
          if (!b.dead) b.takeDamage(CONFIG.BERSERK.dps, this.ctx, null, true);
        }
      }
      const left = Math.max(0, CONFIG.BERSERK.duration - this.berserkTime);
      this.hud.showMatchTimer(Math.ceil(left), true);
      if (left <= 0) this.endMatch();
    }
    this.renderer.update(dt);
    this.hud.tick();
    if (this.balls.some(b => b.dead)) this.endMatch();
  }
  render() { this.renderer.render(this.balls, this.loop.time, this.ctx.phantoms || []); }
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
    this.unbindInput?.();
    this.unbindInput = null;
  }
}
