import CONFIG from '../../config.js';

// 傀儡【置换】：奇袭换位（交换坐标 + 伤害 + 惊滞）
// 平衡：18伤偏低但带0.6s控制与位移价值；克兵团/幻影，被磁铁/荆棘反制
export default {
  id: 'puppet',
  name: '傀儡',
  type: 'active',
  skillName: '置换',
  desc: '主动【置换】(冷却10秒)：与最近的敌球瞬间交换位置（双方各自保留原有速度方向），交换时对敌球造成18点空间撕裂伤害，并使敌球惊滞0.6秒（期间无法自主转向）。攻守兼备的奇袭技。',
  color: '#8e44ad',
  active: {
    cooldown: CONFIG.PUPPET.cooldown,
    onRelease(owner, inst, ctx) {
      const enemy = ctx.getEnemy(owner);
      if (!enemy) return;
      const tx = owner.x, ty = owner.y;
      owner.x = enemy.x; owner.y = enemy.y;
      enemy.x = tx; enemy.y = ty;
      enemy.takeDamage(CONFIG.PUPPET.damage, ctx, owner);
      ctx.effects.apply(enemy, 'stun', { duration: CONFIG.PUPPET.stunDuration });
      ctx.events.emit('fx:swap', { a: owner, b: enemy });
    }
  },
  effects: [{
    id: 'stun',
    onApply() {},
    onUpdate() {},
    onRemove() {}
  }]
};
