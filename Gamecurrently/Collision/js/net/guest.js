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

// 客户端：接收主机状态 → 更新渲染对象（球/幻影/死灵球/HUD状态） → 转发输入指令
// 本地监测：HP 下降 → 红色伤害数字；HP 上升 → 绿色加血数字（均不占用信道）
// necros：死灵术士双侧阵营渲染占位（side=0房主侧 / 1客人侧；isPlayer=该侧当前意识球），随 STATE 重建
export class Guest {
  constructor({ signal, onResult, onLocalDamage, onLocalHeal }) {
    this.signal = signal;
    this.onResult = onResult;
    this.onLocalDamage = onLocalDamage;   // (x, y, amount) 本地渲染伤害数字
    this.onLocalHeal = onLocalHeal;       // (x, y, amount) 本地渲染加血数字
    this.balls = null;
    this.necros = [];                     // 死灵渲染占位列表（双侧合并）
    this.phantoms = [];
    this.berserk = { active: false, left: 0 };
    this._hpInited = false;               // 首帧只记录 HP，不生成数字（避免初始差值误报）
  }
  setRenderBalls(balls) { this.balls = balls; }
  applyState(d) {
    if (!this.balls) return;
    this.berserk = d.berserk;
    d.balls.forEach((s, i) => {
      const b = this.balls[i];
      if (!b) return;
      const prevHp = b.hp;
      b.x = s.x; b.y = s.y; b.angle = s.angle;
      b.hp = s.hp; b.scale = s.scale;
      b.dashing = s.dashing; b.flash = s.flash ? 1 : 0;
      // 本地监测 HP 变化 → 数字（首帧跳过）
      if (this._hpInited) {
        if (prevHp > s.hp && this.onLocalDamage) {
          this.onLocalDamage(b.x, b.y - b.radiusScaled - 10, +(prevHp - s.hp).toFixed(1));
        } else if (prevHp < s.hp && this.onLocalHeal) {
          this.onLocalHeal(b.x, b.y - b.radiusScaled - 10, +(s.hp - prevHp).toFixed(1));
        }
      }
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
    // 死灵术士双侧阵营：渲染占位重建（side=0房主侧 / 1客人侧；isPlayer=该侧当前意识球）
    if (Array.isArray(d.necros)) {
      while (this.necros.length < d.necros.length) {
        this.necros.push(this._makeNecroPlaceholder());
      }
      while (this.necros.length > d.necros.length) this.necros.pop();
      d.necros.forEach((s, i) => {
        const b = this.necros[i];
        b.x = s.x; b.y = s.y;
        b.hp = s.hp; b.maxHp = s.maxHp;
        b.dead = s.hp <= 0;
        b._necroSide = s.side ?? 0;   // 阵营：0=房主侧 / 1=客人侧
        b.isPlayer = !!s.isPlayer;    // 该侧当前意识球（顶部三角标记）
      });
    }
    this._hpInited = true;
    // 幻影/飞弹/斩击扇形：保留类型字段，两端渲染一致
    this.phantoms = d.phantoms.map(p => ({
      ...p,
      radius: p.radius || (p.isMinion ? 14 : 20),
      isPhantom: true,
      speed: 0,
    }));
  }
  // 死灵渲染占位（供 drawBall：尸斑装饰/三角标记/分段血条数据）
  _makeNecroPlaceholder() {
    return {
      x: 0, y: 0, angle: 0,
      hp: 50, maxHp: 50,
      color: '#B3001B',
      radiusScaled: 20,
      scale: 1,
      dead: false,
      isPlayer: false,
      isNecro: true,
      _necroSide: 0,
      flash: 0,
      healFlash: 0,
      dashing: false,
      effects: new Map(),
      skill: { def: { id: 'necromancer', name: '死灵术士' } },
    };
  }
  sendCmd(cmd) { this.signal.send(MSG.CMD, cmd); }
}
