// 技能实例：管理冷却、被动事件绑定、主动瞄准/释放
// 职业定义: { id, name, type, skillName, desc, color, passive?, active?, effects? }
export class SkillInstance {
  constructor(def, owner, ctx) {
    this.def = def;
    this.owner = owner;
    this.ctx = ctx;
    this.state = {};          // 被动状态（如愤怒值）
    this.cooldownLeft = 0;
    this.aiming = false;
    this.aimDir = 0;
    this._unbind = [];
    if (def.passive) this._bindPassive();
  }
  get cd() { return this.def.active?.cooldown ?? 0; }
  get cdRatio() { return this.cd <= 0 ? 0 : this.cooldownLeft / this.cd; }
  update(dt) {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    // 长按瞄准中：实时追踪最近敌球（绳索方向时刻更新）
    if (this.aiming) {
      const enemy = this.ctx.getEnemy(this.owner);
      if (enemy) this.aimDir = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
    }
  }
  _bindPassive() {
    const p = this.def.passive;
    if (p.onCollision) this._unbind.push(this.ctx.events.on('collision', e => {
      if (e.ball === this.owner && !this.owner.dead) p.onCollision(this.owner, e.other, this, this.ctx);
    }));
    if (p.onTick) this._unbind.push(this.ctx.events.on('tick', e => {
      if (e.ball === this.owner) p.onTick(this.owner, e.dt, this, this.ctx);
    }));
  }
  destroy() { this._unbind.forEach(fn => fn()); this._unbind = []; }
  canUse() {
    return this.def.active && this.cooldownLeft <= 0 && !this.owner.dashing && !this.owner.dead;
  }
  // 长按瞄准（触屏/键盘按下）
  startAim() {
    if (!this.canUse() || this.aiming) return false;
    this.aiming = true;
    const enemy = this.ctx.getEnemy(this.owner);
    this.aimDir = enemy ? Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x) : this.owner.angle;
    this.ctx.events.emit('skill:aim', { inst: this, on: true });
    return true;
  }
  // 松开释放
  releaseAim() {
    if (!this.aiming) return false;
    this.aiming = false;
    this.ctx.events.emit('skill:aim', { inst: this, on: false });
    if (this.def.active.onRelease) this.def.active.onRelease(this.owner, this, this.ctx);
    this.cooldownLeft = this.cd;
    this.ctx.events.emit('skill:used', { inst: this });
    return true;
  }
  // AI 直接释放
  forceUse(aimDir) {
    if (!this.canUse()) return false;
    this.aimDir = aimDir;
    if (this.def.active.onRelease) this.def.active.onRelease(this.owner, this, this.ctx);
    this.cooldownLeft = this.cd;
    this.ctx.events.emit('skill:used', { inst: this });
    return true;
  }
}
