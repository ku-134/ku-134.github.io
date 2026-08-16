import CONFIG from '../../config.js';

// 死灵术士【亡者复苏】：被动（每10秒召唤一个50血的死灵球，常驻可叠加）
// 生命上限仅 75——永恒的代价是虚弱的身体
// 意识转移：场上所有死灵球共享阵营；当前球（ctx.necros[0]）阵亡后控制移交给下一个活着的死灵球
// ★ 只有当前球能触发召唤（守卫判断），转移后新当前球继承召唤职责 → 线性增长不爆炸
// ★ 总血条 = 分段小管（HUD 渲染：各球血量/上限），最前段 = 当前球
// 尸斑装饰：渲染器 drawBallDeco 绘制（球内深红斑块，不超出球体）
export default {
  id: 'necromancer',
  name: '死灵术士',
  category: '剑与魔法',
  type: 'passive',
  skillName: '亡者复苏',
  desc: '被动【亡者复苏】(每10秒)：生命上限仅75，但每10秒召唤一个50血的死灵球常驻战场（可叠加、狂暴同样受伤害）；意识转移：当前球阵亡后控制自动移交给下一个死灵球，总血条由各球分段小管组成。不死不灭，代价是虚弱的身体。',
  color: CONFIG.NECRO.color,
  passive: {
    cooldown: CONFIG.NECRO.summonInterval,
    onTrigger(owner, inst, ctx) {
      // 只有阵营当前球（首领）能召唤；转移后新首领继承召唤职责
      if ((ctx.necros && ctx.necros[0] !== owner) || owner.dead) return;
      ctx.sim?.summonNecro(owner);
    }
  },
  effects: []
};
