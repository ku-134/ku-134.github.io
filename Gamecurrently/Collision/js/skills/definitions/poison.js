import CONFIG from '../../config.js';

// 毒液【腐蚀】：被动 dot 持续消耗
// 平衡：21伤/次（3.5s内），碰撞即挂上，必中收益；被荆棘盾减半
export default {
  id: 'poison',
  name: '毒液',
  type: 'passive',
  skillName: '腐蚀',
  desc: '被动【腐蚀】：与敌球碰撞时为其附加腐蚀状态：3.5秒内每0.5秒造成3点伤害（共21点）；重复碰撞刷新持续时间，不叠加层数。持续软磨对手的血量。',
  color: '#6a994e',
  passive: {
    onCollision(owner, other, inst, ctx) {
      if (!other) return;
      const existing = other.effects.get('poison');
      if (existing) existing.t = 0;
      else ctx.effects.apply(other, 'poison', { duration: CONFIG.POISON.duration });
      ctx.events.emit('fx:poison', { ball: other });
    }
  },
  effects: [{
    id: 'poison',
    onUpdate(b, dt, st, ctx) {
      st._t = (st._t || 0) + dt;
      if (st._t >= CONFIG.POISON.tick) {
        st._t -= CONFIG.POISON.tick;
        b.takeDamage(CONFIG.POISON.tickDamage, ctx, null);
      }
    }
  }]
};
