import CONFIG from '../config.js';
import { move, collideWalls, collideBalls } from './physics.js';

// 公共对战模拟：单机模式与联机主机共用（保证逻辑一致）
// 负责：球更新、碰撞、技能、狂暴倒计时与全场伤害、胜负判定
// ★ 必须同时更新 skill（职业技能）与 dashSkill（基础冲刺）：
//   否则冲刺冷却永不递减（用完卡死）、瞄准帧追踪失效
// ★ wild：战场干扰球（巨人，第三方）：参与物理/碰撞/愤怒机制，但不在 balls 内（
//   不影响 getEnemy 与胜负判定），hp 极高不会死，无 dashSkill（不触发机动冲刺）
export class MatchSim {
  constructor(ctx, balls, wild = null) {
    this.ctx = ctx;
    this.balls = balls;
    this.wild = wild;
    this.time = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this._seq = 0;
  }
  step(dt) {
    const all = this.wild ? [...this.balls, this.wild] : this.balls;
    for (const b of all) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      move(b, dt);
      collideWalls(b, this.ctx, this.time);
      b.skill?.update(dt);      // 职业技能：冷却递减/瞄准帧追踪
      b.dashSkill?.update(dt);  // 基础冲刺：冷却递减/瞄准帧追踪（★勿漏）
    }
    // 两两碰撞（玩家vs玩家 + 玩家vs战场球 + 战场球撞墙已在上方处理）
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        collideBalls(all[i], all[j], this.ctx, this.time);
      }
    }
    this.time += dt;
    // 狂暴：30s 后每秒全场 10 伤（只对玩家球；战场球不死无需）
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
