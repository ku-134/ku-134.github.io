import CONFIG from '../../config.js';

// 法师【奥术飞弹】：被动游走远程——8秒循环：
// 前5秒每秒在球周围五角星位置依次生成1颗蓄能飞弹（共5颗，跟随球转）
//   第5颗在第5秒集齐，完整展示1秒（chargeTime=5 生成完毕 → fireTime=6 才发射）
// 第6秒向敌球方向 ±20°（共40°）散射发射（带瞄准属性，命中率更高）
// 飞弹撞球/撞边界即消失，每颗命中敌球7伤（5颗全吃满35伤）
// 发射完后进入2秒空窗期，之后重新积累
// 蓄能与发射动作在 effect onUpdate（0~6s）完成；发射后的飞行/命中由 MatchSim._updateArcane 管理
// ★ effect 必须带 duration（6s）——否则效果永不结束、passiveActive 恒 true、循环卡死
// 八字胡装饰（球中央偏下固定）由 renderer 绘制（b.skill.def.id === 'mage'）
// 冷却型被动：effectId='arcane' → 蓄能期间 passiveActive，空窗期倒计时2s（8-6）
export default {
  id: 'mage',
  name: '法师',
  type: 'passive',
  category: '剑与魔法',
  skillName: '奥术飞弹',
  desc: '被动【奥术飞弹】(8秒循环)：前5秒每秒在球周围五角星位置生成1颗蓄能飞弹（第5秒集齐5颗并展示1秒），第6秒向敌球方向40°扇形内散射发射；每颗飞弹命中敌球造成7点伤害（全吃满35伤），撞球或边界即消失。发射完进入2秒空窗期后重新积累。',
  color: '#B89FEA',
  passive: {
    cooldown: CONFIG.MAGE.cooldown,
    effectId: 'arcane',
    onTrigger(owner, inst, ctx) {
      ctx.effects.apply(owner, 'arcane', {
        duration: CONFIG.MAGE.effectDuration,   // 6s：蓄能5s + 第6s发射
        t: 0, spawned: 0, fired: false,
      });
    }
  },
  effects: [{
    id: 'arcane',
    onApply(b, p, ctx) {
      p.t = 0; p.spawned = 0; p.fired = false;
    },
    onUpdate(b, dt, st, ctx) {
      const p = st.params;
      p.t += dt;
      const phs = ctx.phantoms = ctx.phantoms || [];
      // 1) 蓄能：前5秒每秒生成1颗（五角星，跟随球）——第5颗第5秒集齐，展示到第6秒才发射
      if (!p.fired) {
        const need = Math.min(5, Math.floor(p.t));
        while (p.spawned < need) {
          const idx = p.spawned;
          phs.push({
            x: b.x, y: b.y, angle: 0,
            radius: 7, color: '#b89fea',
            isPhantom: true, isArcane: true, isMissile: true,
            charging: true, idx, speed: 0, damage: CONFIG.MAGE.missileDamage, owner: b,
          });
          p.spawned++;
          ctx.events.emit('fx:charge', { x: b.x, y: b.y });
        }
        // 第6秒（fireTime）：向敌球方向 40° 扇形散射（±20°，带瞄准属性）
        if (p.t >= CONFIG.MAGE.fireTime) {
          p.fired = true;
          const enemy = ctx.getEnemy(b);
          const base = enemy && !enemy.dead ? Math.atan2(enemy.y - b.y, enemy.x - b.x) : b.angle;
          const half = CONFIG.MAGE.spread / 2;   // ±20°
          for (const m of phs) {
            if (m.isMissile && m.charging && m.owner === b) {
              m.charging = false;
              m.angle = base + (Math.random() * 2 - 1) * half;
              m.speed = CONFIG.MAGE.missileSpeed;
            }
          }
          ctx.events.emit('fx:fire', { x: b.x, y: b.y });
        }
      }
      // 2) 蓄能弹位置：绕球五角星（发射前始终跟随）
      for (const m of phs) {
        if (!m.isMissile || !m.charging || m.owner !== b) continue;
        const ang = -Math.PI / 2 + m.idx * (Math.PI * 2 / 5);
        m.x = b.x + Math.cos(ang) * CONFIG.MAGE.orbit;
        m.y = b.y + Math.sin(ang) * CONFIG.MAGE.orbit;
      }
    },
    onRemove(b, p, ctx) {
      // 只清理未发射的蓄能弹（飞行中的飞弹由 MatchSim 管理，继续飞）
      ctx.phantoms = (ctx.phantoms || []).filter(x => !(x.isMissile && x.charging && x.owner === b));
    }
  }]
};
