import CONFIG from '../config.js';
import { rand, normAngle } from '../core/math.js';

let uid = 0;

export class Ball {
  constructor({ x, y, angle, color = '#4caf50', name = '', hp = CONFIG.MAX_HP, skill = null, radius = null }) {
    this.id = ++uid;
    this.x = x; this.y = y;
    this.angle = angle;
    this.baseSpeed = CONFIG.BALL.speed;
    this.speed = this.baseSpeed;
    this.radius = radius ?? CONFIG.BALL.radius;   // 魔王等大体积球可传 radius
    this.hp = hp; this.maxHp = hp;
    this.color = color;
    this.name = name;
    this.skill = skill;
    this.scale = 1; this.scaleTarget = 1;
    this.flash = 0;         // 受击闪白
    this.healFlash = 0;     // 加血闪绿
    this.turnTimer = rand(...CONFIG.TURN_INTERVAL);
    this.lastCollide = 0;
    this.effects = new Map();
    this.dashing = false;
    this.dead = false;
    this.isPlayer = false;
    this.crystal = 0;   // 土星【凝固】冰晶积累（自主积累≤50，吃冰晶块可超）
    this.gas = 0;       // 金星【温室】气体积累（满25红温）
    this.redHot = false; // 金星红温状态
    this.mercuryInner = false;  // 水星轨道（false=外轨冰寒 / true=内轨灼热）
    this._sonicT = 0;   // 海王星超音速剩余时长
  }
  get vx() { return Math.cos(this.angle) * this.speed; }
  get vy() { return Math.sin(this.angle) * this.speed; }
  get radiusScaled() { return this.radius * this.scale; }
  // 受击：荆棘盾期间承受50%伤害，并将伤害的80%返回敌球（无需来源）
  // noReflect 防止双方盾互相反弹形成死循环
  takeDamage(dmg, ctx, source = null, noReflect = false, noIce = false) {
    if (this.dead) return;
    let final = dmg;
    // ★ 土星【冰晶光环】：每5点冰晶抵挡1点伤害（保留余数、减伤不超过受伤量）——
    //   触发时从受伤位置随机方向飞出一块冰晶块（菱形弹幕）；受伤音效被碎冰音效覆盖
    //   noIce=true（黑名单：狂暴等机制伤害）不触发冰晶减伤/不吐块
    let iceAbsorbed = false;
    if (this.skill?.def?.id === 'saturn' && this.crystal > 0 && !noIce) {
      // ★ 减伤触发 CD（shieldCd 0.5s）：CD 期间不触发减伤、不吐块（防高频伤害瞬间耗光冰晶）
      const now = ctx?.sim?.time ?? 0;
      if (now - (this._iceCdT ?? -Infinity) >= CONFIG.SATURN.shieldCd) {
        const absorb = Math.min(Math.floor(this.crystal / CONFIG.SATURN.shieldPer), dmg);
        if (absorb > 0) {
          this._iceCdT = now;
          this.crystal -= absorb * CONFIG.SATURN.shieldPer;
          final -= absorb;
          iceAbsorbed = true;
          if (ctx?.phantoms) {
            const a = Math.random() * Math.PI * 2;
            ctx.phantoms.push({
              isPhantom: true, isIceShard: true,
              x: this.x, y: this.y, angle: a,
              speed: CONFIG.SATURN.shardSpeed, fly: CONFIG.SATURN.shardFly,
              t: 0, owner: this, radius: 9, noise: Math.floor(Math.random() * 100),
            });
          }
        }
      }
    }
    const shield = this.effects.get('shield');
    if (shield && !noReflect) {
      final = Math.floor(dmg * CONFIG.SHIELD.mitigation);
      const reflected = Math.floor(dmg * CONFIG.SHIELD.reflect);
      if (reflected > 0) {
        const enemy = ctx.getEnemy(this);
        if (enemy) enemy.takeDamage(reflected, ctx, this, true);
      }
    }
    this.hp = Math.max(0, this.hp - final);
    // ★ 金星【温室】：每受 1 点实际伤害积累 1 点气体（上限 gasMax；未满无效果）；满 25 立即启动红温
    if (this.skill?.def?.id === 'venus' && final > 0 && !this.dead) {
      this.gas = Math.min(CONFIG.VENUS.gasMax, (this.gas || 0) + Math.round(final));
      if (this.gas >= CONFIG.VENUS.gasMax) this.redHot = true;
    }
    this.flash = 1;
    // 受伤数字（受击球头顶弹出，持续0.5s）
    if (final > 0) {
      ctx.events.emit('fx:damage', { x: this.x, y: this.y - this.radiusScaled - 10, amount: final });
      // 通用命中音效（150ms 全局节流，防磁铁电疗等高频刷屏）；土星减伤时覆盖为碎冰音效
      if (!iceAbsorbed) ctx.events.emit('sfx:play', { name: 'hit', throttle: 150 });
    }
    if (iceAbsorbed) ctx.events.emit('sfx:play', { name: 'icebreak' });
    ctx.events.emit('ball:hp', { ball: this });
    if (this.hp <= 0) { this.dead = true; ctx.events.emit('ball:die', { ball: this }); }
  }
  // 治疗：恢复血量（不可突破上限）→ 闪绿 + 绿色加血数字
  heal(amount, ctx) {
    if (this.dead || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const actual = +(this.hp - before).toFixed(1);
    if (actual > 0) {
      this.healFlash = 1;
      ctx.events.emit('fx:heal', { x: this.x, y: this.y - this.radiusScaled - 10, amount: actual });
      ctx.events.emit('sfx:play', { name: 'heal' });
    }
    return actual;
  }
  // 自主随机转向（观战的球自己乱窜，像斗蛐蛐）+ 体积平滑过渡
  // 惊滞（stun）期间不转向
  update(dt) {
    if (this.dashing) return;
    this.scale += (this.scaleTarget - this.scale) * Math.min(1, dt * 4);
    this.healFlash = Math.max(0, (this.healFlash || 0) - dt * 2.5);
    if (this.effects.has('stun') || this.effects.has('uranus_frozen')) return;   // 天王星冻结：完全定身（不移动不转向）
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = rand(...CONFIG.TURN_INTERVAL);
      this.angle = normAngle(this.angle + rand(-CONFIG.TURN_ANGLE, CONFIG.TURN_ANGLE));
    }
  }
  setAngle(a) { this.angle = normAngle(a); }
}

// 幻影实体：幻影职业的分身（不吃伤害、不触发被动、独立移动反弹）
// 支持自定义发射角度与出生距离（多分身随机方向）
export class Phantom {
  constructor(owner, angle = owner.angle, dist = 36) {
    this.x = owner.x + Math.cos(angle) * dist;
    this.y = owner.y + Math.sin(angle) * dist;
    this.angle = angle;
    this.speed = CONFIG.BALL.speed * CONFIG.PHANTOM.speedMul;
    this.radius = CONFIG.BALL.radius;
    this.color = owner.color;
    this.isPhantom = true;
  }
}