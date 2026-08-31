import CONFIG from '../../config.js';

// 水星【公转双轨】：移动模式重构——不自主游走，绕场地中心椭圆轨道公转（速度1.7x，碰撞10伤不被打断）
// 主动·轨道跃迁：内轨（碰撞18伤，每秒自伤3）/ 外轨（每秒回血2），冷却5s
// 逻辑：轨道定位/自伤回血由 MatchSim._updateMercury 管理；碰撞伤害在 collideBalls 钩子
export default {
  id: 'mercury',
  name: '水星',
  category: '星球',
  type: 'active',
  skillName: '轨道跃迁',
  desc: '特性【公转】：不自主游走，绕场地中心椭圆轨道公转（速度1.7倍），碰撞10伤且不被打断。主动【轨道跃迁】：内轨（碰撞18伤，每秒自伤3点太阳辐射）/ 外轨（每秒回血2点），冷却5秒。',
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