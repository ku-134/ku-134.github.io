import CONFIG from '../../config.js';

// 水星【公转双轨】：战场干扰球（不可选择）——绕战场中心椭圆轨道公转（速度1.7x，碰撞10伤不被打断）
// 轨道随场地自适应（有限太空大轨道）；冲刺期间轨道暂停；每3~6s自动冲刺/轨道跃迁
// 逻辑：轨道定位/自伤回血由 MatchSim._updateMercury 管理；碰撞伤害在 collideBalls 钩子
export default {
  id: 'mercury',
  name: '水星',
  category: '星球',
  type: 'active',
  skillName: '轨道跃迁',
  desc: '战场干扰球·星球分类：2倍体型，绕战场中心椭圆轨道公转（速度1.7倍），碰撞10伤且不被打断；轨道随场地自适应（有限太空大轨道）。会周期性自动冲刺/切换轨道（内轨碰撞18伤自伤3 / 外轨回血2）。',
  color: '#8B6F55',
  active: {
    cooldown: CONFIG.MERCURY.switchCd,
    onRelease(owner, inst, ctx) {
      owner.mercuryInner = !owner.mercuryInner;   // 切换轨道
      ctx.events.emit('fx:mercuryOrbit', { ball: owner });
    },
  },
  effects: []
};