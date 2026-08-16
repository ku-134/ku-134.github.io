import CONFIG from '../../config.js';

// 太阳【日耀】：星球分类的战场干扰球（第三方，不可选择）
// 体型恒为基础球3倍（r=60）、移动速度仅基础球1/4（60）
// 触碰：任何球碰到它都会被附着【燃烧】4秒（每秒5~15伤，橙红火焰特效，区别于毒液绿泡）
// 主动攻击：每10~15秒向随机球发射一条激光（±15：50%补充能量+15血 / 50%毁灭-15血）
// 逻辑由 MatchSim._updateSun 管理（战场球不走技能系统）；渲染：橙色大球 + 八道光芒 + 日珥斑
export default {
  id: 'sun',
  name: '太阳',
  type: 'wild',
  category: '星球',
  skillName: '日耀',
  desc: '战场干扰球【太阳】：体型恒为基础球3倍、移动速度仅1/4。触碰它的球会被附着燃烧4秒（每秒5~15伤）；每10~15秒向随机球发射激光（命中±15：补充能量+15血 或 毁灭-15血）。',
  color: '#FFA500',
  // 无被动/主动：激光与燃烧由 MatchSim 直接管理
  wild: {
    scale: CONFIG.SUN.scale,
    speedMul: CONFIG.SUN.speedMul,
    laserInterval: CONFIG.SUN.laserInterval,
  },
  effects: [{
    // 燃烧：每秒一跳 5~15 随机伤，持续 4 秒（橙红火焰特效由渲染器绘制）
    id: 'sun_burn',
    onApply(b, p, ctx) { p.tickT = 0; },
    onUpdate(b, dt, st, ctx) {
      const p = st.params;
      p.tickT += dt;
      while (p.tickT >= 1) {
        p.tickT -= 1;
        const dmg = CONFIG.SUN.burnMin
          + Math.floor(Math.random() * (CONFIG.SUN.burnMax - CONFIG.SUN.burnMin + 1));
        b.takeDamage(dmg, ctx, null, true);
        ctx.events.emit('fx:sunBurn', { x: b.x, y: b.y });
      }
      if (st.t >= CONFIG.SUN.burnDuration) ctx.effects.remove(b, 'sun_burn');
    },
    onRemove() {},
  }],
};
