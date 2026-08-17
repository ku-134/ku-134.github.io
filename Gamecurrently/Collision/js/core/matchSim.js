import CONFIG from '../config.js';
import { move, collideWalls, collideBalls } from './physics.js';
import { Ball } from '../entities/ball.js';
import { createSkill, getSkillDef } from '../skills/skillRegistry.js';

// 公共对战模拟：单机模式与联机主机共用（保证逻辑一致）
// 负责：球更新、碰撞、技能、狂暴倒计时与全场伤害、胜负判定
// ★ 必须同时更新 skill（职业技能）与 dashSkill（基础冲刺）：
//   否则冲刺冷却永不递减（用完卡死）、瞄准帧追踪失效
// ★ wilds：战场干扰球数组（巨人=基础分类 / 魔王=剑与魔法分类，第三方）：
//   参与物理/碰撞，但不在 balls 内（不影响 getEnemy 与胜负判定），hp 极高不会死
// ★ necros（死灵术士）：双侧阵营多球（0=balls[0]侧 / 1=balls[1]侧，可同时存在）：
//   - 按 _necroSide 分组 necrosA/necrosB；每侧 necros[0] = 该侧当前意识球
//   - 全部并入 all 参与移动/碰撞/技能命中/狂暴（★all 必须去重：死灵球同时在 balls 与 necros，
//     不去重会双倍更新 → 速度×2 / 召唤冷却×2（10s 变 5s）/ 转向×2——必须用 Set 去重）
//   - 召唤：仅每侧当前球触发（按侧守卫）；开局先进入 10s 冷却（第一次不召唤）；从者轻量 skill
//   - 意识转移：每侧独立（当前球死 → 移交该侧下一个活着的；dead 从者随时清理）
//   - 胜负：任意一侧全灭（含其 balls 主球）即结束；死灵侧当前球死不算败（先转移）
// ★ 狂暴：30s 后进入，从 0 开始正数计时（无上限），每秒全场 5 伤——直到一方倒下才结束；
//   ★ hp ≤30 的球豁免狂暴扣血（残血极限拉扯）
// ★ 狂战士【疯狂冲撞】：b.rage>0 期间强制 2.5x 速度（无可阻挡，无视缠绕/减速），
//   碰撞循环内每次有效撞击对敌球 22 伤（0.4s 防抖；撞墙/撞球不打断，5s 固定时长）
// ★ 太阳：触碰附着燃烧4s（每秒5~15伤，sun_burn effect）；每10~15s向随机球发射激光（±15）
// ★ 有限太空：激光边界触碰5伤（0.5s防抖）；小陨石每秒3~4颗（≤10、高速横穿、撞玩家20伤）；
//   大陨石3~4颗缓慢游荡（边界反弹、球撞被弹走）——_updateSpace
// ★ 火星【周期风暴】：铁锈沙尘暴周期出现（游走4~9s → 渐影消失5s → 再现），
//   范围基础球3~4倍、每0.5s对范围内球造成5×(1+加成)伤（本体免疫；生命越低加成越高最多+150%）——_updateMars
// ★ 地球探测器（对外开拓）：isEarthProbe phantom 帧追踪敌球（每帧偏转角度），命中 17~25 伤
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
    // 双侧死灵分组：按 _necroSide（0=balls[0]侧 / 1=balls[1]侧），未标记的按归属推断
    this.necrosA = [];
    this.necrosB = [];
    for (const n of this.necros) {
      if (n._necroSide === undefined) n._necroSide = n === balls[0] ? 0 : 1;
      (n._necroSide === 0 ? this.necrosA : this.necrosB).push(n);
    }
    this.necroSides = [0, 1].filter(s => (s === 0 ? this.necrosA : this.necrosB).length);
    ctx.necros = this.necros;
    ctx.necrosA = this.necrosA;
    ctx.necrosB = this.necrosB;
    ctx.sim = this;
    this.time = 0;
    this.berserk = false;
    this.berserkTime = 0;
    this.berserkTick = 0;
    this._demonTimer = CONFIG.DEMON.summonInterval[0];
    this._sunLaserTimer = CONFIG.SUN.laserInterval[0];
    this._smallMeteorT = 0.5;
    // 有限太空：初始化 3~4 颗大陨石（phantom 实体，两端同步）
    if (ctx.battleMap?.id === 'finiteSpace') {
      ctx.phantoms = ctx.phantoms || [];
      const { w: FW, h: FH } = ctx.battleMap.size;
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        ctx.phantoms.push({
          isPhantom: true, isBigMeteor: true,
          x: 200 + Math.random() * (FW - 400),
          y: 200 + Math.random() * (FH - 400),
          angle: Math.random() * Math.PI * 2,
          speed: 30 + Math.random() * 40,
          radius: 42 + Math.random() * 22,
          noise: Math.floor(Math.random() * 100),
          t: 0,
        });
      }
    }
    this._seq = 0;
  }
  // 阵营归属：-1 无 / 0 仅0侧 / 1 仅1侧 / 2 双侧（兼容旧调用方）
  get necroSideIdx() {
    if (this.necrosA.length && this.necrosB.length) return 2;
    if (this.necrosA.length) return 0;
    if (this.necrosB.length) return 1;
    return -1;
  }
  // 去重合并：死灵球同时在 balls 与 necros，必须只更新一次
  _all() {
    const seen = new Set();
    const all = [];
    for (const b of [...this.balls, ...this.wilds, ...this.necros]) {
      if (!seen.has(b)) { seen.add(b); all.push(b); }
    }
    return all;
  }
  step(dt) {
    const all = this._all();
    for (const b of all) {
      b.update(dt);
      this.ctx.effects.update(b, dt);
      // ★ 狂战士【疯狂冲撞】：疯狂期间 2.5x 速度且无可阻挡（在效果系统之后强制覆盖，无视缠绕定身/减速）；
      //   撞墙/撞球不打断（5s 固定时长，碰撞反弹照常但不终止疯狂）
      if (b.rage > 0) {
        b.rage -= dt;
        b.speed = b.baseSpeed * CONFIG.BERSERKER.speedMul;
        if (b.rage <= 0) { b.rage = 0; b.speed = b.baseSpeed; }
      }
      b.flash = Math.max(0, b.flash - dt * 3);
      // 傀儡术冲刺期间：位移交给 _updateWildDash（避免与自主移动叠加）
      if (!b.dash) move(b, dt);
      const wallHit = collideWalls(b, this.ctx, this.time);
      // ★ 有限太空：激光边界——每次触碰边界 5 伤（0.5s 防抖；战场球不受伤）
      if (wallHit && this.ctx.battleMap?.id === 'finiteSpace' && !this.wilds.includes(b)
          && this.time - (b._laserHitT ?? -Infinity) >= 0.5) {
        b._laserHitT = this.time;
        b.takeDamage(5, this.ctx, null, true);
        this.ctx.events.emit('fx:laserHit', { x: b.x, y: b.y });
      }
      b.skill?.update(dt);      // 职业技能/被动：冷却递减/瞄准帧追踪/被动召唤（★勿漏）
      b.dashSkill?.update(dt);  // 基础冲刺：冷却递减/瞄准帧追踪（★勿漏）
    }
    // 两两碰撞（玩家vs玩家 + 玩家vs战场球 + 死灵球之间 + 战场球之间）
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const hit = collideBalls(all[i], all[j], this.ctx, this.time);
        // ★ 太阳燃烧：任何球碰到太阳 → 附着燃烧4秒（每秒5~15伤）
        if (hit) {
          const A = all[i], B = all[j];
          if (A.skill?.def?.id === 'sun' && !B.dead) this.ctx.effects.apply(B, 'sun_burn', {});
          if (B.skill?.def?.id === 'sun' && !A.dead) this.ctx.effects.apply(A, 'sun_burn', {});
        }
        // ★ 狂战士疯狂撞击：每次有效撞击（0.4s 防抖）对敌球造成 22 伤（撞战场球/死灵从者同样生效）
        if (hit) {
          const a = all[i], b = all[j];
          if (a.rage > 0 && !b.dead && this.time - (a._rageHitT ?? -Infinity) >= CONFIG.COLLIDE_COOLDOWN) {
            a._rageHitT = this.time; b.takeDamage(CONFIG.BERSERKER.hitDamage, this.ctx, a);
            this.ctx.events.emit('fx:phantomHit', { x: b.x, y: b.y, color: '#B89FEA' });
          }
          if (b.rage > 0 && !a.dead && this.time - (b._rageHitT ?? -Infinity) >= CONFIG.COLLIDE_COOLDOWN) {
            b._rageHitT = this.time; a.takeDamage(CONFIG.BERSERKER.hitDamage, this.ctx, b);
            this.ctx.events.emit('fx:phantomHit', { x: a.x, y: a.y, color: '#B89FEA' });
          }
        }
      }
    }
    this._updateWildDash(dt);
    this._updateDemon(dt, all);
    this._updateArcane(dt, all);
    this._updateSeed(dt, all);
    this._updateProbe(dt, all);
    this._updateSun(dt, all);
    this._updateSpace(dt, all);
    this._updateMars(dt, all);
    this._updateFx(dt);
    this.time += dt;
    // 狂暴：30s 后进入，从 0 正数计时（无上限），每秒全场 5 伤（玩家球 + 死灵球；战场球不死无需）
    // ★ 豁免：hp ≤30 的球不再受狂暴扣血
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
        const targets = [...new Set([...this.balls, ...this.necros])];
        for (const b of targets) if (!b.dead && b.hp > CONFIG.BERSERK.exemptHp) b.takeDamage(CONFIG.BERSERK.dps, this.ctx, null, true);
      }
    }
    // 意识转移（双侧独立）：当前球阵亡 → 移交该侧下一个活着的；dead 从者随时清理
    this._updateNecroTransfer();
    return {
      over: this._isOver(),
      winner: this._winner(),
    };
  }
  // 死灵阵营所属侧（构造时定死，转移不变）
  necroSide() { return this.necroSideIdx; }
  // 意识转移：每侧独立——当前球（index 0）阵亡 → 移交该侧下一个活着的；
  // 非当前球的 dead 从者也会被清理（列表始终只含存活球）
  _updateNecroTransfer() {
    for (const side of [0, 1]) {
      const list = side === 0 ? this.necrosA : this.necrosB;
      if (!list.length) continue;
      const alive = list.filter(n => !n.dead);
      if (alive.length !== list.length) {
        list.length = 0;
        list.push(...alive);
      }
    }
    this.necros = [...this.necrosA, ...this.necrosB];
  }
  // 召唤一个 50 血死灵球（由当前球触发；开局第一次进入冷却不召唤；按侧归组）
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
    // 轻量 skill：只有 def 供渲染（尸斑装饰），无被动空转（避免从者重复召唤/计时混乱）
    nb.skill = { def: getSkillDef('necromancer'), update() {}, state: {}, cooldownLeft: 0 };
    nb.isNecro = true;
    nb._necroSide = owner._necroSide ?? 0;
    (nb._necroSide === 0 ? this.necrosA : this.necrosB).push(nb);
    this.necros = [...this.necrosA, ...this.necrosB];
    this.ctx.events.emit('fx:summon', { x: nb.x, y: nb.y });
    return nb;
  }
  // 胜负：任意一侧全灭（含其 balls 主球）即结束——狂暴无上限，直到一方倒下
  _isOver() {
    const aSide = [this.balls[0], ...this.necrosA];
    const bSide = [this.balls[1], ...this.necrosB];
    return !aSide.some(x => !x.dead) || !bSide.some(x => !x.dead);
  }
  _winner() {
    const aSide = [this.balls[0], ...this.necrosA];
    const bSide = [this.balls[1], ...this.necrosB];
    const aAlive = aSide.filter(x => !x.dead);
    const bAlive = bSide.filter(x => !x.dead);
    if (!aAlive.length && !bAlive.length) return -1;
    if (!aAlive.length) return 1;
    if (!bAlive.length) return 0;
    // 双方同时倒（罕见）：比总血量
    const aHp = aAlive.reduce((s, x) => s + Math.max(0, x.hp), 0);
    const bHp = bAlive.reduce((s, x) => s + Math.max(0, x.hp), 0);
    return aHp >= bHp ? 0 : 1;
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
  // 地球探测器（对外开拓）：帧追踪敌球（每帧偏转角度朝敌球——发射后仍主动追踪）
  // 命中玩家球（非发射者=敌球）→ 伤害；战场球/死灵从者只挡弹；撞墙消失
  _updateProbe(dt, all) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    for (let i = ph.length - 1; i >= 0; i--) {
      const m = ph[i];
      if (!m.isEarthProbe) continue;
      // 帧追踪：角度持续指向敌球（getEnemy 兼容死灵阵营）
      const enemy = m.owner ? this.ctx.getEnemy(m.owner) : null;
      if (enemy && !enemy.dead) {
        m.angle = Math.atan2(enemy.y - m.y, enemy.x - m.x);
      }
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
      // 命中玩家球（非发射者=敌球）→ 伤害；战场球/死灵从者只挡弹
      for (const b of all) {
        if (b === m.owner || b.dead) continue;
        if (this.wilds.includes(b) || this.necros.includes(b)) continue;
        if (Math.hypot(b.x - m.x, b.y - m.y) <= b.radiusScaled + m.radius) {
          b.takeDamage(m.damage, this.ctx, m.owner);
          this.ctx.events.emit('fx:missileHit', { x: m.x, y: m.y, color: m.color });
          ph.splice(i, 1);
          break;
        }
      }
    }
  }
  // 太阳：每10~15秒向随机球发射激光（±15：补充能量+15 / 毁灭-15）
  // 激光以 isSunLaser phantom 广播（两端渲染一致）；燃烧由 sun_burn effect 管理（碰撞触发）
  _updateSun(dt, all) {
    for (const w of this.wilds) {
      if (w.skill?.def?.id !== 'sun' || w.dead) continue;
      this._sunLaserTimer -= dt;
      if (this._sunLaserTimer <= 0) {
        this._sunLaserTimer = CONFIG.SUN.laserInterval[0]
          + Math.random() * (CONFIG.SUN.laserInterval[1] - CONFIG.SUN.laserInterval[0]);
        const targets = all.filter(b => b !== w && !b.dead);
        if (!targets.length) return;
        const t = targets[Math.floor(Math.random() * targets.length)];
        const positive = Math.random() < 0.5;   // 50% 补充能量 / 50% 毁灭
        if (positive) t.heal(CONFIG.SUN.laserDamage, this.ctx);
        else t.takeDamage(CONFIG.SUN.laserDamage, this.ctx, w, true);
        this.ctx.phantoms = this.ctx.phantoms || [];
        this.ctx.phantoms.push({
          isSunLaser: true, isPhantom: true,
          x: w.x, y: w.y, tx: t.x, ty: t.y, positive, t: 0,
        });
        this.ctx.events.emit('sfx:play', { name: 'slash' });
      }
    }
  }
  // 有限太空：小陨石群（每秒3~4颗、场上≤10、高速横穿、撞玩家20伤）+ 大陨石群（缓慢游荡、边界反弹、球撞被弹走）
  _updateSpace(dt, all) {
    const map = this.ctx.battleMap;
    if (map?.id !== 'finiteSpace') return;
    const { w: FW, h: FH } = map.size;
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    // --- 小陨石：生成（每秒 3~4 颗，场上 ≤10）---
    this._smallMeteorT -= dt;
    const smallCount = ph.filter(m => m.isSmallMeteor).length;
    if (this._smallMeteorT <= 0 && smallCount < 10) {
      this._smallMeteorT = 1 / (3 + Math.random());
      const margin = 60;
      const edge = Math.floor(Math.random() * 4);
      let x, y, angle;
      if (edge === 0) {          // 上边 → 向下斜穿
        x = -margin + Math.random() * (FW + margin * 2); y = -margin;
        angle = 0.35 + Math.random() * (Math.PI - 0.7);
      } else if (edge === 1) {   // 下边 → 向上斜穿
        x = -margin + Math.random() * (FW + margin * 2); y = FH + margin;
        angle = Math.PI + 0.35 + Math.random() * (Math.PI - 0.7);
      } else if (edge === 2) {   // 左边 → 向右斜穿
        x = -margin; y = -margin + Math.random() * (FH + margin * 2);
        angle = -Math.PI / 2 + 0.35 + Math.random() * (Math.PI - 0.7);
      } else {                   // 右边 → 向左斜穿
        x = FW + margin; y = -margin + Math.random() * (FH + margin * 2);
        angle = Math.PI / 2 + 0.35 + Math.random() * (Math.PI - 0.7);
      }
      ph.push({
        isPhantom: true, isSmallMeteor: true,
        x, y, angle,
        speed: 700 + Math.random() * 300,
        radius: 12 + Math.random() * 8,
        noise: Math.floor(Math.random() * 100),
        t: 0, life: 2.5 + Math.random() * 0.5,
      });
    }
    // --- 小陨石：移动 / 越界或超时移除 / 撞玩家球 20 伤 ---
    for (let i = ph.length - 1; i >= 0; i--) {
      const m = ph[i];
      if (!m.isSmallMeteor) continue;
      m.t += dt;
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.y += Math.sin(m.angle) * m.speed * dt;
      if (m.t > m.life || m.x < -80 || m.x > FW + 80 || m.y < -80 || m.y > FH + 80) {
        ph.splice(i, 1);
        continue;
      }
      let hitBall = null;
      for (const b of all) {
        if (this.wilds.includes(b) || b.dead) continue;   // 战场球不算；玩家球/死灵从者都算
        if (Math.hypot(b.x - m.x, b.y - m.y) <= b.radiusScaled + m.radius) { hitBall = b; break; }
      }
      if (hitBall) {
        hitBall.takeDamage(20, this.ctx, null, true);
        this.ctx.events.emit('fx:meteorHit', { x: m.x, y: m.y });
        ph.splice(i, 1);
      }
    }
    // --- 大陨石：缓慢游荡 + 边界反弹 + 球撞被弹走（陨石不动）---
    for (const m of ph) {
      if (!m.isBigMeteor) continue;
      m.angle += (Math.random() - 0.5) * 0.3;
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.y += Math.sin(m.angle) * m.speed * dt;
      if (m.x < m.radius) { m.x = m.radius; m.angle = Math.PI - m.angle; }
      else if (m.x > FW - m.radius) { m.x = FW - m.radius; m.angle = Math.PI - m.angle; }
      if (m.y < m.radius) { m.y = m.radius; m.angle = -m.angle; }
      else if (m.y > FH - m.radius) { m.y = FH - m.radius; m.angle = -m.angle; }
      for (const b of all) {
        if (b.dead) continue;
        const dx = b.x - m.x, dy = b.y - m.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const minD = b.radiusScaled + m.radius;
        if (d < minD) {
          const nx = dx / d, ny = dy / d;
          b.x = m.x + nx * minD;
          b.y = m.y + ny * minD;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) b.setAngle(Math.atan2(b.vy - vn * ny * 2, b.vx - vn * nx * 2));
          if (this.time - (b._meteorBounceT ?? -Infinity) >= 0.3) {
            b._meteorBounceT = this.time;
            this.ctx.events.emit('fx:meteorBounce', { x: b.x, y: b.y });
          }
        }
      }
    }
  }
  // 火星【周期风暴】：铁锈沙尘暴周期出现（游走4~9s → 渐影消失5s → 再现）
  // 特性·奥林匹斯之巅：伤害随本体血量反比加成（最多+150%）；风暴本体免疫；范围内球每0.5s受击
  _updateMars(dt, all) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    // 找火星本体（风暴随本体存在；无本体则残留风暴自然消失）
    let owner = null;
    for (const b of all) {
      if (b.skill?.def?.id === 'mars' && !b.dead) { owner = b; break; }
    }
    if (!owner) return;
    const { w: FW, h: FH } = CONFIG.FIELD;
    let storm = ph.find(m => m.isDustStorm && m.owner === owner);
    if (!storm) {
      // 周期再现：随机位置新风暴
      storm = {
        isPhantom: true, isDustStorm: true,
        owner,
        x: 100 + Math.random() * (FW - 200),
        y: 100 + Math.random() * (FH - 200),
        angle: Math.random() * Math.PI * 2,
        speed: 70 + Math.random() * 40,
        radius: CONFIG.BALL.radius * (CONFIG.MARS.stormScaleMin + Math.random() * (CONFIG.MARS.stormScaleMax - CONFIG.MARS.stormScaleMin)),
        noise: Math.floor(Math.random() * 100),
        t: 0, tickT: 0,
        appearLeft: CONFIG.MARS.appearMin + Math.random() * (CONFIG.MARS.appearMax - CONFIG.MARS.appearMin),
        hiding: false, hideT: 0,
      };
      ph.push(storm);
    }
    if (!storm.hiding) {
      // 游走阶段：随机转向缓慢移动 + 边界反弹
      storm.t += dt;
      storm.angle += (Math.random() - 0.5) * 0.4;
      storm.x += Math.cos(storm.angle) * storm.speed * dt;
      storm.y += Math.sin(storm.angle) * storm.speed * dt;
      if (storm.x < storm.radius) { storm.x = storm.radius; storm.angle = Math.PI - storm.angle; }
      else if (storm.x > FW - storm.radius) { storm.x = FW - storm.radius; storm.angle = Math.PI - storm.angle; }
      if (storm.y < storm.radius) { storm.y = storm.radius; storm.angle = -storm.angle; }
      else if (storm.y > FH - storm.radius) { storm.y = FH - storm.radius; storm.angle = -storm.angle; }
      // 游走时间到 → 渐影消失阶段（5s）
      if (storm.t >= storm.appearLeft) { storm.hiding = true; storm.hideT = 0; }
      // 领域伤害：每 0.5s 对范围内球造成 5×(1+加成) 基础伤害（本体免疫；战场球不受）
      storm.tickT += dt;
      if (storm.tickT >= CONFIG.MARS.tick) {
        storm.tickT -= CONFIG.MARS.tick;
        const ratio = Math.max(0, Math.min(1, owner.hp / owner.maxHp));
        const boost = (1 - ratio) * CONFIG.MARS.boostMax;
        const dmg = CONFIG.MARS.baseDamage * (1 + boost);
        for (const b of all) {
          if (b === owner || b.dead || this.wilds.includes(b)) continue;
          if (Math.hypot(b.x - storm.x, b.y - storm.y) <= storm.radius + b.radiusScaled) {
            b.takeDamage(dmg, this.ctx, owner);
            this.ctx.events.emit('fx:dustTick', { x: b.x, y: b.y });
          }
        }
      }
    } else {
      // 渐影消失 5s → 移除（下一周期再现）
      storm.hideT += dt;
      if (storm.hideT >= CONFIG.MARS.hideDuration) {
        const idx = ph.indexOf(storm);
        if (idx >= 0) ph.splice(idx, 1);
      }
    }
  }
  // 斩击扇形（isSlashFx）生命周期：0.35s 后移除（随 phantoms 同步两端）
  _updateFx(dt) {
    const ph = this.ctx.phantoms = this.ctx.phantoms || [];
    for (let i = ph.length - 1; i >= 0; i--) {
      const fx = ph[i];
      if (!fx.isSlashFx && !fx.isSunLaser) continue;
      fx.t += dt;
      if (fx.t > (fx.isSunLaser ? 0.4 : 0.35)) ph.splice(i, 1);
    }
  }
  // 顶部计时：普通=距狂暴剩余秒；狂暴=从0正数计时（无上限）
  berserkLeft() {
    return this.berserk ? Math.floor(this.berserkTime) : Math.max(0, Math.ceil(CONFIG.BERSERK.delay - this.time));
  }
}
