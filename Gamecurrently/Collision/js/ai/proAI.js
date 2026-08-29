import CONFIG from '../config.js';
import { normAngle } from '../core/math.js';

// ★ 专属职业 AI（高难度单机开关开启时启用）
// 每帧：感知 → 职业策略决定移动方向 + 技能/冲刺时机（forceUse 直接释放）
// - move(s, ai, dt) 返回目标方向（弧度）；返回 null 表示不干预移动（球自主游走）
// - act(s, ai, dt) 在适当时机 forceUse 技能/冲刺
// - 控制移动时抑制自主随机转向（ball.turnTimer 拉长）
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
      // 我方已停住的冰晶块（可绕圈形成雷区），按距离排序取最近
      shards: ph.filter(p => p.isIceShard && p.owner === b && p.t >= p.fly)
        .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y)),
      threats: ph.filter(p => (p.isMinion && p.dashing) || p.isSmallMeteor),
      berserk: !!this.ctx.sim?.berserk,
      time: this.ctx.sim?.time ?? 0,
    };
  }
  update(dt) {
    const b = this.ball;
    if (!b || b.dead) return;
    const strat = STRATEGIES[b.skill?.def?.id] || STRATEGIES._default;
    const s = this.perceive();
    const dir = strat.move(s, this, dt);   // 策略签名 (s, ai, dt)
    if (typeof dir === 'number') {
      b.setAngle(normAngle(dir));
      b.turnTimer = 9999;          // 抑制自主随机转向（AI 接管走位）
    }
    strat.act(s, this, dt);   // 策略签名 (s, ai, dt)
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
// 绕某点转圈（垂直切线方向）
const orbit = (b, px, py) => Math.atan2(py - b.y, px - b.x) + Math.PI / 2;

// ═══════════════════ 职业策略表 ═══════════════════
const STRATEGIES = {
  // 兜底（死灵等未启用专属策略时）：朝敌球 + 技能好了就放
  _default: {
    move(s) { return s.enemy ? s.enemy.dir : null; },
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 450) ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.3));
    },
  },

  // ── 基础 ──
  // 兵团：找直线冲刺 30 伤；冲刺冷却快好就拉开蓄力
  legion: {
    move(s, ai) {
      if (!s.enemy) return null;
      const cd = ai.ball.dashSkill?.cooldownLeft ?? 0;
      return cd < 1.6 ? normAngle(s.enemy.dir + Math.PI) : s.enemy.dir;
    },
    act(s, ai) {
      if (s.dashReady && s.enemy && s.enemy.dist > 90 && s.enemy.dist < 640) {
        ai.ball.dashSkill.forceUse(aimAtPredict(ai, s, 0.25));
      }
    },
  },
  // 毒液：贴脸蹭腐蚀（碰撞保持接触，被动持续烧血）
  poison: {
    move(s) { return s.enemy ? s.enemy.dir : null; },
    act() {},
  },
  // 荆棘：盾生效中主动找打（反伤80%是主要输出）；盾没了拉开等8s
  thorn: {
    move(s, ai) {
      if (!s.enemy) return null;
      return s.shieldActive ? s.enemy.dir : normAngle(s.enemy.dir + Math.PI);
    },
    act() {},
  },
  // 磁铁：把敌球赶进 280 范围；范围内贴身绕圈防脱离；冷却中拉开
  magnet: {
    move(s, ai) {
      if (!s.enemy) return null;
      if (s.tetherActive) return orbit(ai.ball, s.enemy.x, s.enemy.y);   // 范围生效中绕敌球
      return s.enemy.dist > 250 ? s.enemy.dir : normAngle(s.enemy.dir + Math.PI);
    },
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 300) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },
  // 傀儡：保持距离，等干扰球靠近敌球再操控突进
  puppet: {
    move(s) {
      if (!s.enemy) return null;
      return s.enemy.dist < 200 ? normAngle(s.enemy.dir + Math.PI) : s.enemy.dir;
    },
    act(s, ai) {
      if (!s.skillReady || !s.enemy) return;
      const wilds = ai.ctx.wilds || [];
      const w = wilds.find(x => !x.dead) || wilds[0];
      if (w && Math.hypot(w.x - s.enemy.x, w.y - s.enemy.y) < 160) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },
  // 幻影：本体不硬拼，分身冷却好往敌球方向放（封走位蹭15伤）
  phantom: {
    move(s) {
      if (!s.enemy) return null;
      return s.enemy.dist < 220 ? normAngle(s.enemy.dir + Math.PI) : s.enemy.dir;
    },
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 380) ai.ball.skill.forceUse(s.enemy.dir);
    },
  },

  // ── 剑与魔法 ──
  // 骑士：保持 100~150 射程贴住（每4s白嫖40伤斩击）
  knight: {
    move(s, ai) {
      if (!s.enemy) return null;
      if (s.enemy.dist > 160) return s.enemy.dir;
      if (s.enemy.dist < 100) return normAngle(s.enemy.dir + Math.PI);
      return orbit(ai.ball, s.enemy.x, s.enemy.y);   // 射程内：绕敌球转圈保持
    },
    act() {},
  },
  // 法师：放风筝（保持 380+ 距离），发射预判 0.3s
  mage: {
    move(s) {
      if (!s.enemy) return null;
      return s.enemy.dist < 420 ? normAngle(s.enemy.dir + Math.PI) : s.enemy.dir;
    },
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist < 620) ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.3));
    },
  },
  // 牧师：无攻击手段 → 躲避游走（始终远离）；血少自奶；冲刺垂直掠过（完美错过交换位置）
  priest: {
    move(s) {
      if (!s.enemy) return null;
      return normAngle(s.enemy.dir + Math.PI);   // 永远远离
    },
    act(s, ai) {
      if (s.skillReady && s.hp < s.maxHp * 0.55) ai.ball.skill.forceUse(ai.ball.angle);
      // 被追（敌球过近）且血不健康：冲刺垂直切向掠过——不会撞到对方交换位置，完美错过
      if (s.dashReady && s.enemy && s.enemy.dist < 170 && s.hp < s.maxHp * 0.75) {
        ai.ball.dashSkill.forceUse(normAngle(s.enemy.dir + Math.PI / 2));
      }
    },
  },
  // 纳西妲：火种 780 速——在必中距离（≤320）发射，预判 0.35s；平时保持中距追/绕
  nahida: {
    move(s, ai) {
      if (!s.enemy) return null;
      if (s.enemy.dist > 330) return s.enemy.dir;
      if (s.enemy.dist < 190) return normAngle(s.enemy.dir + Math.PI);
      return orbit(ai.ball, s.enemy.x, s.enemy.y);   // 必中距离内：绕敌球保持（等 CD 转好即射）
    },
    act(s, ai) {
      if (s.skillReady && s.enemy && s.enemy.dist <= 340) {
        ai.ball.skill.forceUse(aimAtPredict(ai, s, 0.35));   // 火种 780 速，0.35s 预判覆盖 84px 敌球位移
      }
    },
  },
  // 狂战士：疯狂中贴脸缠斗（2.5x 速度撞22伤）；疯狂结束立刻拉开等7s
  berserker: {
    move(s, ai) {
      if (!s.enemy) return null;
      return ai.ball.rage > 0 ? s.enemy.dir : normAngle(s.enemy.dir + Math.PI);
    },
    act(s, ai) {
      if (s.skillReady && s.enemy) ai.ball.skill.forceUse(s.enemy.dir);   // 开启疯狂冲撞
    },
  },

  // ── 星球 ──
  // 地球：随机事件不可控，只优化位置——血高压迫贴脸 / 血低游走等生态修复
  earth: {
    move(s) {
      if (!s.enemy) return null;
      return s.hp > s.maxHp * 0.6 ? s.enemy.dir : normAngle(s.enemy.dir + Math.PI);
    },
    act() {},
  },
  // 火星：卡风暴——绕自己风暴切向转圈，把敌球往风暴里赶；敌球在风暴内则贴风暴外缘守株待兔
  mars: {
    move(s, ai) {
      if (!s.enemy) return null;
      const b = ai.ball;
      if (s.myStorm && !s.myStorm.hiding) {
        const st = s.myStorm;
        // 敌球在风暴内：贴风暴外缘（朝风暴中心方向到半径边缘）
        if (Math.hypot(s.enemy.x - st.x, s.enemy.y - st.y) < st.radius) {
          return Math.atan2(st.y - b.y, st.x - b.x);   // 靠向风暴边缘（风暴护体，自己不受伤）
        }
        // 敌球在风暴外：绕风暴转圈，把敌球夹在风暴与我之间（往风暴里赶）
        const angToStorm = Math.atan2(st.y - b.y, st.x - b.x);
        const side = Math.sin(s.enemy.dir - angToStorm) >= 0 ? 1 : -1;
        return normAngle(angToStorm + side * Math.PI / 2);
      }
      // 风暴渐影/消失：追敌球（逼进下一轮风暴）
      return s.enemy.dir;
    },
    act() {},
  },
  // 土星：盾反流——前期游走攒晶；冰晶30+主动引战吃伤害吐块；有停住的冰晶块就绕块转圈（雷区）
  saturn: {
    move(s, ai) {
      if (!s.enemy) return null;
      const b = ai.ball;
      if (s.shards.length) return orbit(b, s.shards[0].x, s.shards[0].y);   // 绕最近的冰晶块
      if (s.crystal < 30) return normAngle(s.enemy.dir + Math.PI);          // 攒晶期远离
      if (s.enemy.dist < 110) return normAngle(s.enemy.dir + Math.PI);      // 引战但不贴脸
      return s.enemy.dir;                                                    // 接近触发减伤吐块
    },
    act() {},
  },
};