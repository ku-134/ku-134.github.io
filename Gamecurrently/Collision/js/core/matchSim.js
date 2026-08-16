import CONFIG from '../config.js';
import { move, collideWalls, collideBalls } from './physics.js';
import { Ball } from '../entities/ball.js';
import { createSkill } from '../skills/skillRegistry.js';

// 公共对战模拟：单机模式与联机主机共用（保证逻辑一致）
// 负责：球更新、碰撞、技能、狂暴倒计时与全场伤害、胜负判定
// ★ 必须同时更新 skill（职业技能）与 dashSkill（基础冲刺）：
//   否则冲刺冷却永不递减（用完卡死）、瞄准帧追踪失效
// ★ wilds：战场干扰球数组（巨人=基础分类 / 魔王=剑与魔法分类，第三方）：
//   参与物理/碰撞，但不在 balls 内（不影响 getEnemy 与胜负判定），hp 极高不会死
// ★ necros（死灵术士）：场上所有死灵球（阵营多球，常驻可叠加）：
//   - 并入 all 参与移动/碰撞/技能命中/狂暴；necros[0] = 当前意识球（转移后自动切换）
//   - 召唤：仅当前球触发（necromancer 被动守卫），每10s 一个 50 血死灵球
//   - 胜负：对方球死 或 死灵阵营全灭；狂暴结束比总血量
// ★ wild.dash（傀儡术）：干扰球被操控执行基础冲刺——dash 期间跳过自主移动，
//   由 _updateWildDash 驱动高速位移 + 撞击伤害（撞敌球25伤/撞主人只停不伤/撞墙或超时结束）
// ★ 生命火种（纳西妲）：isSeed phantom 高速飞行，命中敌球施加缠绕效果（定身+持续伤害）
// ★ 魔王：召唤魔族；法师：奥术飞弹飞行；骑士：斩击扇形（isSlashFx 实体随 phantoms 同步）
// ★ 狂暴降临瞬间发 berserk 音效（sfx:play 事件 → 全局管理器）
export class MatchSim {
  constructor(ctx, balls, wilds = [], necros = []) {
    this.ctx = ctx;
    this.balls = balls;
    this.wilds = Array.isArray(wilds) ? wilds : (wilds ? [wilds] : []);
    this.necros = Array.isArray(necros) ? necros : (necros ? [necros] : []);
    ctx.necros = this.necros;
    ctx.sim = this;
    this.time = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this._demonTimer = CONFIG.DEMON.summonInterval[0];
    this._seq = 0;
  }
  step(dt) {
    const all = [...this.balls, ...this.wilds, ...this.necros];
    for (const b of all) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      b.flash = Math.max(0, b.flash - dt * 3);
      // 傀儡术冲刺期间：位移交给 _updateWildDash（避免与自主移动叠加）
      if (!b.dash) move(b, dt);
      collideWalls(b, this.ctx, this.time);
      b.skill?.update(dt);      // 职业技能/被动：冷却递减/瞄准帧追踪/被动召唤（★勿漏）
      b.dashSkill?.update(dt);  // 基础冲刺：冷却递减/瞄准帧追踪（★勿漏）
    }
    // 两两碰撞（玩家vs玩家 + 玩家vs战场球 + 死灵球之间 + 战场球之间）
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        collideBalls(all[i], all[j], this.ctx, this.time);
      }
    }
    this._updateWildDash(dt);
    this._updateDemon(dt, all);
    this._updateArcane(dt, all);
    this._updateSeed(dt, all);
    this._updateFx(dt);
    this.time += dt;
    // 狂暴：30s 后每秒全场 10 伤（玩家球 + 死灵球；战场球不死无需）
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
        const targets = [...this.balls, ...this.necros];
        for (const b of targets) if (!b.dead) b.takeDamage(CONFIG.BERSERK.dps, this.ctx, null, true);
      }
    }
    // 意识转移：当前死灵球阵亡 → 移交给下一个活着的
    this._updateNecroTransfer();
    return {
      over: this._isOver(),
      winner: this._winner(),
    };
  }
  // 死灵阵营所属侧（0=balls[0]侧 / 1=balls[1]侧）；无死灵返回 -1
  necroSide() {
    if (!this.necros.length) return -1;
    return this.necros.includes(this.balls[0]) ? 0 : 1;
  }
  // 意识转移：当前球（index 0）阵亡 → 移到下一个活着的；全灭则清空
  _updateNecroTransfer() {
    if (!this.necros.length) return;
    if (!this.necros[0].dead) return;
    const alive = this.necros.filter(n => !n.dead);
    if (alive.length) {
      this.necros = [alive[0], ...alive.slice(1)];
    } else {
      this.necros = [];
    }
  }
  // 召唤一个 50 血死灵球（由当前球触发；转移后新当前球继承召唤职责）
  summonNecro(owner) {
    const { w, h } = CONFIG.FIELD;
    const a = Math.random() * Math.PI * 2;
    const d = 55;
    const x = Math.max(30, Math.min(w - 30, owner.x + Math.cos(a) * d));
    const y = Math.max(30, Math.min(h - 30, owner.y + Math.sin(a) * d));
    const nb = new Ball({
      x, y,
      angle: Math.random() * Math.PI * 2,
      hp: CONFIG.NECRO.minionHp,
      color: CONFIG.NECRO.color,
      name: '死灵·从者',
    });
    nb.skill = createSkill('necromancer', nb, this.ctx);  // 被动守卫：非当前球不召唤
    nb.isNecro = true;
    this.necros.push(nb);
    this.ctx.events.emit('fx:summon', { x: nb.x, y: nb.y });
    return nb;
  }
  // 胜负：对方球死 / 死灵阵营全灭 / 狂暴结束比总血量
  _isOver() {
    if (this.balls.some(b => b.dead)) return true;
    if (this.necros.length && this.necros.every(n => n.dead)) return true;
    return this.berserk && this.berserkTime >= CONFIG.BERSERK.duration;
  }
  _winner() {
    const [a, b] = this.balls;
    const side = this.necroSide();
    // 非死灵对局：a=balls[0]侧，b=balls[1]侧
    if (side === -1) return a.dead && b.dead ? -1 : a.dead ? 1 : 0;
    const isSide0 = side === 0;
    const enemy = isSide0 ? b : a;
    const myAlive = this.necros.filter(n => !n.dead);
    if (enemy.dead) return isSide0 ? 0 : 1;
    if (!myAlive.length) return isSide0 ? 1 : 0;
    // 狂暴结束：死灵总血量 vs 对方血量
    const myHp = myAlive.reduce((s, n) => s + Math.max(0, n.hp), 0);
    const better = myHp >= Math.max(0, enemy.hp);
    return isSide0 ? (better ? 0 : 1) : (better ? 1 : 0);
  }
  // 傀儡术：干扰球基础冲刺（高速直线突进 → 撞敌球伤害 / 撞主人只停不伤 / 撞墙或超时结束）
  _updateWildDash(dt) {
    for (const w of this.wilds) {
      if (!w.dash || w.dead) continue;
      const d = w.dash;
      d.t += dt;
      w.x += Math.cos(d.dir) * d.speed * dt;
      w.y += Math.sin(d.dir) * d.speed * dt;
      // 撞玩家球：敌球受伤；主人只停不伤（方向已锁定敌球，路径保护）
      if (!d.hit) {
        for (const b of this.balls) {
          if (b.dead) continue;
          if (Math.hypot(b.x - w.x, b.y - w.y) <= b.radiusScaled + w.radiusScaled) {
            d.hit = true;
            if (b !== d.owner) {
              b.takeDamage(d.damage, this.ctx, d.owner);
              this.ctx.events.emit('fx:phantomHit', { x: w.x, y: w.y, color: w.color });
            }
            break;
          }
        }
      }
      // 撞墙即停（默认矩形边界；ringHole 用外圆边界）
      if (!d.hit) {
        const { w: W, h: H } = CONFIG.FIELD;
        const map = this.ctx.battleMap;
        if (map?.id === 'ringHole') {
          const cx = W / 2, cy = H / 2;
          if (Math.hypot(w.x - cx, w.y - cy) > map.radius - w.radiusScaled) d.hit = true;
        } else if (w.x < w.radiusScaled || w.x > W - w.radiusScaled || w.y < w.radiusScaled || w.y > H - w.radiusScaled) {
          d.hit = true;
        }
      }
      if (d.hit || d.t >= d.duration) delete w.dash;
    }
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
        // 游走 1~4s 后：瞄准场上的球（玩家球 + 战场球 + 死灵球，不含魔王主人）发起冲刺
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
  // 法师：奥术飞弹飞行阶段（蓄能弹由技能 effect 管理；飞行弹撞球/撞墙即消失）
  _updateArcane(dt, all) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    for (let i = ph.length - 1; i >= 0; i--) {
      const m = ph[i];
      if (!m.isMissile || m.charging) continue;
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.y += Math.sin(m.angle) * m.speed * dt;
      // 撞边界即消失（矩形默认；ringHole 用外圆边界）
      const map = this.ctx.battleMap;
      if (map?.id === 'ringHole') {
        const cx = CONFIG.FIELD.w / 2, cy = CONFIG.FIELD.h / 2;
        if (Math.hypot(m.x - cx, m.y - cy) > map.radius - m.radius) { ph.splice(i, 1); continue; }
      } else if (m.x < m.radius || m.x > CONFIG.FIELD.w - m.radius || m.y < m.radius || m.y > CONFIG.FIELD.h - m.radius) {
        ph.splice(i, 1);
        continue;
      }
      // 命中球（非主人）即消失；玩家球受伤5点，战场球/死灵从者只挡弹
      for (const b of all) {
        if (b === m.owner || b.dead) continue;
        if (Math.hypot(b.x - m.x, b.y - m.y) <= b.radiusScaled + m.radius) {
          if (!this.wilds.includes(b) && !this.necros.includes(b)) b.takeDamage(m.damage, this.ctx, null, true);
          this.ctx.events.emit('fx:missileHit', { x: m.x, y: m.y, color: m.color });
          ph.splice(i, 1);
          break;
        }
      }
    }
  }
  // 纳西妲：生命火种飞行（高速小弹；命中敌球 → 施加缠绕 effect；战场球/死灵从者只挡弹；撞墙消失）
  _updateSeed(dt, all) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    for (let i = ph.length - 1; i >= 0; i--) {
      const m = ph[i];
      if (!m.isSeed) continue;
      m.t += dt;
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.y += Math.sin(m.angle) * m.speed * dt;
      // 撞边界即消失
      const map = this.ctx.battleMap;
      if (map?.id === 'ringHole') {
        const cx = CONFIG.FIELD.w / 2, cy = CONFIG.FIELD.h / 2;
        if (Math.hypot(m.x - cx, m.y - cy) > map.radius - m.radius) { ph.splice(i, 1); continue; }
      } else if (m.x < m.radius || m.x > CONFIG.FIELD.w - m.radius || m.y < m.radius || m.y > CONFIG.FIELD.h - m.radius) {
        ph.splice(i, 1);
        continue;
      }
      // 命中玩家球（非发射者=敌球）→ 施加缠绕；战场球/死灵从者只挡弹（this.wilds/this.necros 判定）
      for (const b of all) {
        if (b === m.owner || b.dead) continue;
        if (this.wilds.includes(b) || this.necros.includes(b)) continue;
        if (Math.hypot(b.x - m.x, b.y - m.y) <= b.radiusScaled + m.radius) {
          this.ctx.effects.apply(b, 'vine_wrap', { source: m.owner });
          this.ctx.events.emit('fx:seedHit', { x: m.x, y: m.y, color: m.color });
          ph.splice(i, 1);
          break;
        }
      }
    }
  }
  // 斩击扇形（isSlashFx）生命周期：0.35s 后移除（随 phantoms 同步两端）
  _updateFx(dt) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    for (let i = ph.length - 1; i >= 0; i--) {
      const fx = ph[i];
      if (!fx.isSlashFx) continue;
      fx.t += dt;
      if (fx.t > 0.35) ph.splice(i, 1);
    }
  }
  // 顶部倒计时剩余秒数（普通=距狂暴，狂暴=距结束）
  berserkLeft() {
    return Math.max(0, Math.ceil(this.berserk ? CONFIG.BERSERK.duration - this.berserkTime : CONFIG.BERSERK.delay - this.time));
  }
}
