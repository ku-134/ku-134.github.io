import { MSG } from './protocol.js';

// 为 HUD 构造轻量技能对象（只读字段，由状态快照驱动）
// 保持与 SkillInstance 相同的读取接口：cd/cdRatio/cooldownLeft/passiveActive/passiveTimer
export function makeHudSkill(def) {
  return {
    def,
    state: {},
    cooldownLeft: 0,
    passiveActive: false,
    passiveTimer: 0,
    get cd() { return this.def.active?.cooldown ?? 0; },
    get cdRatio() { return this.cd <= 0 ? 0 : Math.min(1, this.cooldownLeft / this.cd); },
  };
}

// 客户端：接收主机状态 → 更新渲染对象（球/幻影/HUD状态） → 转发输入指令
export class Guest {
  constructor({ signal, onResult }) {
    this.signal = signal;
    this.onResult = onResult;
    this.balls = null;
    this.phantoms = [];
    this.berserk = { active: false, left: 0 };
  }
  setRenderBalls(balls) { this.balls = balls; }
  applyState(d) {
    if (!this.balls) return;
    this.berserk = d.berserk;
    d.balls.forEach((s, i) => {
      const b = this.balls[i];
      if (!b) return;
      b.x = s.x; b.y = s.y; b.angle = s.angle;
      b.hp = s.hp; b.scale = s.scale;
      b.dashing = s.dashing; b.flash = s.flash ? 1 : 0;
      // 效果重建（渲染用：护盾锯齿/磁铁圈/腐蚀泡/巨大化描边）
      b.effects.clear();
      for (const e of s.effects) {
        b.effects.set(e.id, { def: { id: e.id }, duration: Math.max(0.01, e.left), t: 0, params: {}, alive: true });
      }
      // HUD 冷却/被动状态（冲刺 + 职业技能）
      if (b.dashSkill) b.dashSkill.cooldownLeft = s.cd.dash ?? 0;
      if (b.skill) {
        b.skill.cooldownLeft = s.cd.left;
        b.skill.passiveActive = s.cd.passiveActive;
        b.skill.passiveTimer = s.cd.passiveTimer;
      }
    });
    this.phantoms = d.phantoms.map(p => ({ ...p, radius: 20, isPhantom: true, speed: 0 }));
  }
  sendCmd(cmd) { this.signal.send(MSG.CMD, cmd); }
}
