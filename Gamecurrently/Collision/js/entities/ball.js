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
  }
  get vx() { return Math.cos(this.angle) * this.speed; }
  get vy() { return Math.sin(this.angle) * this.speed; }
  get radiusScaled() { return this.radius * this.scale; }
  takeDamage(dmg, ctx) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 1;
    ctx.events.emit('ball:hp', { ball: this });
    if (this.hp <= 0) { this.dead = true; ctx.events.emit('ball:die', { ball: this }); }
  }
  // 自主随机转向（观战的球自己乱窜，像斗蛐蛐）+ 体积平滑过渡（巨大化/复原）
  update(dt) {
    if (this.dashing) return;
    this.scale += (this.scaleTarget - this.scale) * Math.min(1, dt * 4);
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = rand(...CONFIG.TURN_INTERVAL);
      this.angle = normAngle(this.angle + rand(-CONFIG.TURN_ANGLE, CONFIG.TURN_ANGLE));
    }
  }
  setAngle(a) { this.angle = normAngle(a); }
}
