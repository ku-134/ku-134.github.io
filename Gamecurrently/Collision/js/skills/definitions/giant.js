import CONFIG from '../../config.js';

// 巨人【暴怒】：被动积累愤怒 → 巨大化
// 平衡：8次碰撞约20~40s一轮；巨大化期间体积变大更易被兵团命中（克制关系）
export default {
  id: 'giant',
  name: '巨人',
  type: 'passive',
  skillName: '暴怒',
  desc: '被动【暴怒】：每次碰撞（边界或敌球）积攒1点愤怒；积满8点进入【巨大化】：1秒内体积增大至2倍，持续10秒，期间与敌球碰撞造成30点伤害，且不再积攒愤怒。',
  color: '#ef5350',
  passive: {
    onCollision(owner, other, inst, ctx) {
      if (ctx.effects.has(owner, 'giant_form')) return;
      inst.state.anger = (inst.state.anger ?? 0) + 1;
      if (inst.state.anger >= CONFIG.GIANT.angerMax) {
        inst.state.anger = 0;
        ctx.effects.apply(owner, 'giant_form', {});
        ctx.events.emit('fx:transform', { ball: owner });
      }
      ctx.events.emit('hud:passive', { ball: owner, value: inst.state.anger, max: CONFIG.GIANT.angerMax });
    }
  },
  effects: [{
    id: 'giant_form',
    onApply(b) { b.scaleTarget = CONFIG.GIANT.scale; },
    onUpdate(b, dt, st) { b.scale += (b.scaleTarget - b.scale) * Math.min(1, dt * 3); },
    onCollision(b, other, st, ctx) { if (other) other.takeDamage(CONFIG.GIANT.damage, ctx); },
    onRemove(b) { b.scaleTarget = 1; b.scale = 1; }
  }]
};
