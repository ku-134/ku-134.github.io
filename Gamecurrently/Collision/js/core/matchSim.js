import CONFIG from '../config.js';
import { move, collideWalls, collideBalls } from './physics.js';

// 公共对战模拟：单机模式与联机主机共用（保证逻辑一致）
// 负责：球更新、碰撞、技能、狂暴倒计时与全场伤害、胜负判定
// ★ 必须同时更新 skill（职业技能）与 dashSkill（基础冲刺）：
//   否则冲刺冷却永不递减（用完卡死）、瞄准帧追踪失效
// ★ wilds：战场干扰球数组（巨人=基础分类 / 魔王=剑与魔法分类，第三方）：
//   参与物理/碰撞，但不在 balls 内（不影响 getEnemy 与胜负判定），
//   hp 极高不会死，无 dashSkill（不触发机动冲刺）
// ★ 魔王专属：召唤魔族（每5~8s一只）→ 魔族游走1~4s后瞄准场上球冲刺撞击（10伤）
// ★ 狂暴降临瞬间发 berserk 音效（sfx:play 事件 → 全局管理器）
export class MatchSim {
  constructor(ctx, balls, wilds = []) {
    this.ctx = ctx;
    this.balls = balls;
    this.wilds = Array.isArray(wilds) ? wilds : (wilds ? [wilds] : []);
    this.time = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this._demonTimer = CONFIG.DEMON.summonInterval[0];
    this._seq = 0;
  }
  step(dt) {
    const all = [...this.balls, ...this.wilds];
    for (const b of all) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      move(b, dt);
      collideWalls(b, this.ctx, this.time);
      b.skill?.update(dt);      // 职业技能：冷却递减/瞄准帧追踪
      b.dashSkill?.update(dt);  // 基础冲刺：冷却递减/瞄准帧追踪（★勿漏）
    }
    // 两两碰撞（玩家vs玩家 + 玩家vs战场球 + 战场球之间）
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        collideBalls(all[i], all[j], this.ctx, this.time);
      }
    }
    this._updateDemon(dt, all);
    this.time += dt;
    // 狂暴：30s 后每秒全场 10 伤（只对玩家球；战场球不死无需）
    if (!this.berserk) {
      if (this.time >= CONFIG.BERSERK.delay) {
        this.berserk = true; this.berserkTime = 0; this.berserkTick = 0;
        this.ctx.events.emit('sfx:play', { name: 'berserk' });
      }
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
  // 魔王：召唤魔族 + 魔族生命周期（游走 → 瞄准冲刺 → 撞击消失）
  _updateDemon(dt, all) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    // 1) 召唤：每 5~8 秒随机一只
    for (const w of this.wilds) {
      if (w.skill?.def?.id !== 'demon' || w.dead) continue;
      this._demonTimer -= dt;
      if (this._demonTimer <= 0) {
        this._demonTimer = CONFIG.DEMON.summonInterval[0]
          + Math.random() * (CONFIG.DEMON.summonInterval[1] - CONFIG.DEMON.summonInterval[0]);
        const a = Math.random() * Math.PI * 2;
        ph.push({
          x: w.x + Math.cos(a) * 55, y: w.y + Math.sin(a) * 55,
          angle: a, color: '#6d4a7e', radius: CONFIG.MINION.radius,
          isPhantom: true, isMinion: true, speed: 0,
          t: 0,
          life: CONFIG.MINION.life[0] + Math.random() * (CONFIG.MINION.life[1] - CONFIG.MINION.life[0]),
          dashing: false, dashAngle: 0, damage: CONFIG.MINION.damage,
        });
        this.ctx.events.emit('fx:summon', { x: ph[ph.length - 1].x, y: ph[ph.length - 1].y });
      }
    }
    // 2) 魔族更新
    for (let i = ph.length - 1; i >= 0; i--) {
      const m = ph[i];
      if (!m.isMinion) continue;
      m.t += dt;
      if (!m.dashing) {
        // 游走（慢速随机转向，不离开场地）
        m.angle += (Math.random() - 0.5) * 0.25;
        m.x += Math.cos(m.angle) * CONFIG.MINION.wanderSpeed * dt;
        m.y += Math.sin(m.angle) * CONFIG.MINION.wanderSpeed * dt;
        m.x = Math.max(24, Math.min(CONFIG.FIELD.w - 24, m.x));
        m.y = Math.max(24, Math.min(CONFIG.FIELD.h - 24, m.y));
        // 游走 1~4s 后：瞄准场上的球（玩家球 + 战场球，不含魔王主人）发起冲刺
        if (m.t >= m.life) {
          m.dashing = true; m.t = 0;
          const targets = all.filter(b => b.skill?.def?.id !== 'demon' && !b.dead);
          const tg = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
          m.dashAngle = tg ? Math.atan2(tg.y - m.y, tg.x - m.x) : m.angle;
        }
      } else {
        // 冲刺（兵团模组：高速直线，撞到球/墙消失）
        m.x += Math.cos(m.dashAngle) * CONFIG.MINION.dashSpeed * dt;
        m.y += Math.sin(m.dashAngle) * CONFIG.MINION.dashSpeed * dt;
        if (m.x < 15 || m.x > CONFIG.FIELD.w - 15 || m.y < 15 || m.y > CONFIG.FIELD.h - 15) {
          ph.splice(i, 1);
          continue;
        }
        let hit = false;
        for (const b of all) {
          if (b.skill?.def?.id === 'demon' || b.dead) continue;
          if (Math.hypot(b.x - m.x, b.y - m.y) <= b.radiusScaled + m.radius) {
            b.takeDamage(m.damage, this.ctx, null, true);
            this.ctx.events.emit('fx:minionHit', { x: m.x, y: m.y, color: m.color });
            hit = true;
            break;
          }
        }
        if (hit) ph.splice(i, 1);
      }
    }
  }
  // 顶部倒计时剩余秒数（普通=距狂暴，狂暴=距结束）
  berserkLeft() {
    return Math.max(0, Math.ceil(this.berserk ? CONFIG.BERSERK.duration - this.berserkTime : CONFIG.BERSERK.delay - this.time));
  }
}
