import CONFIG from '../../config.js';

// 巨人【暴怒】：战场干扰球（第三方）——不再作为可选职业，独立运行干扰战场
// 只保留愤怒机制：碰撞攒怒 → 巨大化（2倍体积 + 30伤碰撞），10s后恢复
// 不受任何玩家控制、不触发机动冲刺；hp 极高不会死
export default {
  id: 'giant',
  name: '巨人',
  type: 'passive',
  skillName: '暴怒',
  desc: '战场干扰球（第三方，不可选择）：红色巨人会在每场对局中独立游走，撞到任何东西都会积攒愤怒；积满8点进入【巨大化】：体积增大至2倍、持续10秒，期间碰撞造成30点伤害。它不属于任何玩家——小心别撞上发怒的它！',
  color: '#e63946',
  passive: {
    progressKey: 'anger',
    progressMax: 8,
    onCollision(owner, other, inst, ctx) {
      if (ctx.effects.has(owner, 'giant_form')) return;
      inst.state.anger = (inst.state.anger ?? 0) + 1;
      if (inst.state.anger >= CONFIG.GIANT.angerMax) {
        inst.state.anger = 0;
        ctx.effects.apply(owner, 'giant_form', { duration: CONFIG.GIANT.duration });
        ctx.events.emit('fx:transform', { ball: owner });
      }
      ctx.events.emit('hud:passive', { ball: owner, value: inst.state.anger, max: CONFIG.GIANT.angerMax });
    }
  },
  effects: [{
    id: 'giant_form',
    onApply(b) { b.scaleTarget = CONFIG.GIANT.scale; },
    onCollision(b, other, st, ctx) { if (other) other.takeDamage(CONFIG.GIANT.damage, ctx, b); },
    onRemove(b) { b.scaleTarget = 1; }
  }]
};
