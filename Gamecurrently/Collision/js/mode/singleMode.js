import CONFIG from '../config.js';
import { Ball } from '../entities/ball.js';
import { GameLoop } from '../core/gameLoop.js';
import { move, collideWalls, collideBalls } from '../core/physics.js';
import { createSkill } from '../skills/skillRegistry.js';
import { AIController } from '../ai/aiController.js';
import { Renderer } from '../rendering/renderer.js';
import { Hud } from '../ui/hud.js';
import { isTouchDevice, bindHold } from '../ui/input.js';

// 单机模式：玩家选球 vs AI，321 倒计时，观战 + 主动干涉
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
    this.curSkillId = 'giant';
    this.balls = [];
    this.loop = new GameLoop(dt => this.update(dt), () => this.render());
    this.unsubs = [];
    this.unbindInput = null;
  }
  start(playerSkillId) {
    this.curSkillId = playerSkillId;
    const { w, h } = CONFIG.FIELD;
    const p1 = new Ball({ x: w * 0.3, y: h / 2, angle: Math.PI * 0.9, color: '#7ef0c8', name: '你' });
    const p2 = new Ball({ x: w * 0.7, y: h / 2, angle: Math.PI * 0.1, color: '#ff8a65', name: 'AI' });
    p1.skill = createSkill(playerSkillId, p1, this.ctx);
    p2.skill = createSkill(Math.random() < 0.5 ? 'giant' : 'legion', p2, this.ctx);
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
      this.renderer.particles.spawn(ball.x, ball.y, { color: '#ffd93d', count: 20, speed: 150 });
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
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownShown = -1;
    this.matchTime = 0;
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
    this.renderer.update(dt);
    this.hud.tick();
    if (this.matchTime >= CONFIG.MATCH_TIME || this.balls.some(b => b.dead)) this.endMatch();
  }
  render() { this.renderer.render(this.balls, this.loop.time); }
  endMatch() {
    if (this.phase === 'end') return;
    this.phase = 'end';
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
    this.unsubs.forEach(fn => fn());
    this.unsubs = [];
    this.unbindInput?.();
    this.unbindInput = null;
  }
}
