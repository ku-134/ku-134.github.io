import CONFIG from '../config.js';
import { normAngle } from '../core/math.js';

// ★ 专属职业 AI（高难度单机开关开启时启用）——大幅削弱自主移动权
// 球的日常移动完全遵循基础模式（自主游走 + 边界反弹），AI 绝不干预走位方向（防抽搐/死角卡死）；
// AI 只拥有与玩家同步的操作模组特权：在适当时机、以优化方向释放主动技能与基础冲刺
// - act(s, ai, dt)：冷却就绪 + 职业条件满足时 forceUse（时机与方向由 AI 判断）
// ★ 死灵术士不启用专属 AI（由 singleMode 回退到通用 AIController）
export class ProAI {
  constructor(ball, ctx) {
    this.ball = ball;
    this.ctx = ctx;
  }
  setBall(ball) { this.ball = ball; }
  perceive() {
    const b = this.ball;
    const enemy = this.ctx.getEnemy(b);
    const ph = this.ctx.phantoms || [];
    return {
      hp: b.hp, maxHp: b.maxHp, crystal: b.crystal || 0, rage: b.rage || 0,
      skillReady: !!b.skill?.canUse?.(), dashReady: !!b.dashSkill?.canUse?.(),
      shieldActive: !!b.skill?.passiveActive, tetherActive: !!b.effects.has('tether'),
      enemy: enemy ? {
        hp: enemy.hp, x: enemy.x, y: enemy.y,
        vx: enemy.vx, vy: enemy.vy,
        dist: Math.hypot(enemy.x - b.x, enemy.y - b.y),
        dir: Math.atan2(enemy.y - b.y, enemy.x - b.x),
      } : null,
      myStorm: ph.find(p => p.isDustStorm && p.owner === b),
      storms: ph.filter(p => p.isDustStorm && p.owner !== b),
      shards: ph.filter(p => p.isIceShard && p.owner === b && p.t >= p.fly),
      threats: ph.filter(p => (p.isMinion && p.dashing) || p.isSmallMeteor),
      berserk: !!this.ctx.sim?.berserk,
      time: this.ctx.sim?.time ?? 0,
    };
  }
  update(dt) {
    const b = this.ball;
    if (!b || b.dead) return;
    const strat = STRATEGIES[b.skill?.def?.id] || STRATEGIES._default;
    strat.act(this.perceive(), this, dt);
  }
}

// 朝敌球预测点（lead 秒后位置）瞄准
function aimAtPredict(ai, s, lead) {
  if (!s.enemy) return ai.ball.angle;
  return Math.atan2(
    s.enemy.y + s.enemy.vy * lead - ai.ball.y,
    s.enemy.x + s.enemy.vx * lead - ai.ball.x
  );
}

// ═══════════════════ 职业策略表（只含操作时机 act，无移动干预） ═══════════════════
const STRATEGIES = {
  // 兜底（死灵等未启用专属策略时）：技能好了就放
  _default: {
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 450) ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.3));
    },
  },

  // ── 基础 ──
  // 兵团：冲刺就绪且距离合适 → 预判直线冲刺 30 伤
  legion: {
    act(s, ai) {
      if (s.dashReady && s.enemy && s.enemy.dist > 90 && s.enemy.dist < 640) {
        ai.ball.dashSkill.forceUse(aimAtPredict(ai, s, 0.25));
      }
    },
  },
  // 毒液：被动腐蚀，无操作
  poison: { act() {} },
  // 荆棘：被动反伤盾，无操作
  thorn: { act() {} },
  // 磁铁：敌球进 280 范围 → 释放引力场
  magnet: {
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 300) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },
  // 傀儡：干扰球靠近敌球 → 操控突进
  puppet: {
    act(s, ai) {
      if (!s.skillReady || !s.enemy) return;
      const wilds = ai.ctx.wilds || [];
      const w = wilds.find(x => !x.dead) || wilds[0];
      if (w && Math.hypot(w.x - s.enemy.x, w.y - s.enemy.y) < 160) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },
  // 幻影：分身冷却好 → 朝敌球方向放（封走位）
  phantom: {
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 380) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },

  // ── 剑与魔法 ──
  // 骑士：被动斩击，无操作
  knight: { act() {} },
  // 法师：发射预判 0.3s（保持射程由基础游走负责）
  mage: {
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 620) ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.3));
    },
  },
  // 牧师：血少自奶；被贴脸且血不健康 → 冲刺垂直切向掠过（完美错过交换位置）
  priest: {
    act(s, ai) {
      if (s.skillReady && s.hp < s.maxHp * 0.55) ai.ball.skill.forceUse(ai.ball.angle);
      if (s.dashReady && s.enemy && s.enemy.dist < 170 && s.hp < s.maxHp * 0.75) {
        ai.ball.dashSkill.forceUse(normAngle(s.enemy.dir + Math.PI / 2));
      }
    },
  },
  // 纳西妲：火种 780 速——必中距离（≤340）发射，预判 0.35s
  nahida: {
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist <= 340) {
        ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.35));
      }
    },
  },
  // 狂战士：冷却好即开疯狂冲撞（贴脸由基础游走+冲刺完成）
  berserker: {
    act(s, ai) {
      if (s.skillReady && s.enemy) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },

  // ── 星球（被动职业，无主动操作）──
  earth: { act() {} },
  mars: { act() {} },
  saturn: { act() {} },
};