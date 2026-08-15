// 技能实例：管理冷却、被动事件绑定、主动瞄准/释放
// 职业定义: { id, name, type, skillName, desc, color, passive?, active?, effects? }
// active.cooldownStartsAfter: 效果持续时长（冷却在效果结束后才开始）
// active.noAim: 无需瞄准（如牧师治疗），不显示瞄准线
// passive.cooldown: 冷却型被动（如荆棘）：生效中不计时，效果结束后开始下一轮冷却
// params：创建时的附加参数（如基础冲刺的 damage 变体），效果回调经 st.params 读取
// ★ 基础机动与职业技能允许叠加发动（冲刺中可放技能/技能中可冲刺），各自独立冷却
export class SkillInstance {
  constructor(def, owner, ctx, params = {}) {
    this.def = def;
    this.owner = owner;
    this.ctx = ctx;
    this.params = params;
    this.state = {};          // 被动状态（如愤怒值）
    this.cooldownLeft = 0;
    this.aiming = false;
    this.aimDir = 0;
    this._unbind = [];
    this._passiveTimer = 0;   // 冷却型被动计时（0=开局立即触发）
    if (def.passive) this._bindPassive();
  }
  get cd() { return this.def.active?.cooldown ?? 0; }
  get cdRatio() { return this.cd <= 0 ? 0 : Math.min(1, this.cooldownLeft / this.cd); }
  // 冷却型被动：当前是否处于生效中
  get passiveActive() {
    const p = this.def.passive;
    return !!(p && p.effectId && this.owner.effects.has(p.effectId));
  }
  // 冷却型被动：距离下次触发的剩余时间
  get passiveTimer() {
    const p = this.def.passive;
    return this._passiveTimer ?? p?.cooldown ?? 0;
  }
  update(dt) {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    // 长按瞄准中：实时追踪最近敌球（绳索方向时刻更新，帧追踪）
    if (this.aiming) {
      const enemy = this.ctx.getEnemy(this.owner);
      if (enemy) this.aimDir = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
    }
    // 冷却型被动循环：生效中不计时，效果结束后开始倒计时
    const p = this.def.passive;
    if (p && p.cooldown) {
      if (!this.passiveActive) {
        this._passiveTimer -= dt;
        if (this._passiveTimer <= 0) {
          if (p.onTrigger) p.onTrigger(this.owner, this, this.ctx);
          this._passiveTimer = p.cooldown;
        }
      }
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
    // 允许在冲刺/其他技能发动期间使用（基础机动与主动技能不冲突，独立冷却）
    return this.def.active && this.cooldownLeft <= 0 && !this.owner.dead;
  }
  // 释放后开始冷却：若技能有持续效果（cooldownStartsAfter），冷却从效果结束后才计时
  _startCooldown() {
    const wait = this.def.active?.cooldownStartsAfter || 0;
    this.cooldownLeft = this.cd + wait;
  }
  // 长按瞄准（触屏/键盘按下）：noAim 技能不显示瞄准线
  startAim() {
    if (!this.canUse() || this.aiming) return false;
    this.aiming = true;
    const enemy = this.ctx.getEnemy(this.owner);
    this.aimDir = enemy ? Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x) : this.owner.angle;
    if (!this.def.active?.noAim) this.ctx.events.emit('skill:aim', { inst: this, on: true });
    return true;
  }
  // 松开释放
  releaseAim() {
    if (!this.aiming) return false;
    this.aiming = false;
    if (!this.def.active?.noAim) this.ctx.events.emit('skill:aim', { inst: this, on: false });
    if (this.def.active.onRelease) this.def.active.onRelease(this.owner, this, this.ctx);
    this._startCooldown();
    this.ctx.events.emit('skill:used', { inst: this });
    return true;
  }
  // AI 直接释放
  forceUse(aimDir) {
    if (!this.canUse()) return false;
    this.aimDir = aimDir;
    if (this.def.active.onRelease) this.def.active.onRelease(this.owner, this, this.ctx);
    this._startCooldown();
    this.ctx.events.emit('skill:used', { inst: this });
    return true;
  }
}
