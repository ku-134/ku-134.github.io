import CONFIG from '../config.js';
import { rand, normAngle } from '../core/math.js';

let uid = 0;

export class Ball {
  constructor({ x, y, angle, color = '#4caf50', name = '', hp = CONFIG.MAX_HP, skill = null }) {
    this.id = ++uid;
    this.x = x; this.y = y;
    this.angle = angle;
    this.baseSpeed = CONFIG.BALL.speed;
    this.speed = this.baseSpeed;
    this.radius = CONFIG.BALL.radius;
    this.hp = hp; this.maxHp = hp;
    this.color = color;
    this.name = name;
    this.skill = skill;
    this.scale = 1; this.scaleTarget = 1;
    this.flash = 0;
    this.turnTimer = rand(...CONFIG.TURN_INTERVAL);
    this.lastCollide = 0;
    this.effects = new Map();
    this.dashing = false;
    this.dead = false;
    this.isPlayer = false;
  }
  get vx() { return Math.cos(this.angle) * this.speed; }
  get vy() { return Math.sin(this.angle) * this.speed; }
  get radiusScaled() { return this.radius * this.scale; }
  // 受击：荆棘盾期间承受50%伤害，并将伤害的80%返回敌球（无需来源）
  // noReflect 防止双方盾互相反弹形成死循环
  takeDamage(dmg, ctx, source = null, noReflect = false) {
    if (this.dead) return;
    let final = dmg;
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
    this.flash = 1;
    // 受伤数字（受击球头顶弹出，持续0.5s）
    if (final > 0) {
      ctx.events.emit('fx:damage', { x: this.x, y: this.y - this.radiusScaled - 10, amount: final });
    }
    ctx.events.emit('ball:hp', { ball: this });
    if (this.hp <= 0) { this.dead = true; ctx.events.emit('ball:die', { ball: this }); }
  }
  // 自主随机转向（观战的球自己乱窜，像斗蛐蛐）+ 体积平滑过渡
  // 惊滞（stun）期间不转向
  update(dt) {
    if (this.dashing) return;
    this.scale += (this.scaleTarget - this.scale) * Math.min(1, dt * 4);
    if (this.effects.has('stun')) return;
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = rand(...CONFIG.TURN_INTERVAL);
      this.angle = normAngle(this.angle + rand(-CONFIG.TURN_ANGLE, CONFIG.TURN_ANGLE));
    }
  }
  setAngle(a) { this.angle = normAngle(a); }
}

// 幻影实体：幻影职业的分身（不吃伤害、不触发被动、独立移动反弹）
export class Phantom {
  constructor(owner) {
    this.x = owner.x + 36;
    this.y = owner.y;
    this.angle = owner.angle;
    this.speed = CONFIG.BALL.speed * CONFIG.PHANTOM.speedMul;
    this.radius = CONFIG.BALL.radius;
    this.color = owner.color;
    this.isPhantom = true;
  }
}
