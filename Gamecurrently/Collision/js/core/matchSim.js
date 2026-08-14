import CONFIG from '../config.js';
import { move, collideWalls, collideBalls } from './physics.js';

// 公共对战模拟：单机模式与联机主机共用（保证逻辑一致）
// 负责：球更新、碰撞、技能、狂暴倒计时与全场伤害、胜负判定
export class MatchSim {
  constructor(ctx, balls) {
    this.ctx = ctx;
    this.balls = balls;
    this.time = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this._seq = 0;
  }
  step(dt) {
    for (const b of this.balls) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      move(b, dt);
      collideWalls(b, this.ctx, this.time);
      b.skill?.update(dt);
    }
    collideBalls(this.balls[0], this.balls[1], this.ctx, this.time);
    this.time += dt;
    // 狂暴：30s 后每秒全场 10 伤
    if (!this.berserk) {
      if (this.time >= CONFIG.BERSERK.delay) { this.berserk = true; this.berserkTime = 0; this.berserkTick = 0; }
    } else {
      this.berserkTime += dt;
      this.berserkTick += dt;
      if (this.berserkTick >= 1) {
        this.berserkTick -= 1;
        for (const b of this.balls) if (!b.dead) b.takeDamage(CONFIG.BERSERK.dps, this.ctx, null, true);
      }
    }
    return {
      over: this.balls.some(b => b.dead) || (this.berserk && this.berserkTime >= CONFIG.BERSERK.duration),
    };
  }
  // 顶部倒计时剩余秒数（普通=距狂暴，狂暴=距结束）
  berserkLeft() {
    return Math.max(0, Math.ceil(this.berserk ? CONFIG.BERSERK.duration - this.berserkTime : CONFIG.BERSERK.delay - this.time));
  }
}
