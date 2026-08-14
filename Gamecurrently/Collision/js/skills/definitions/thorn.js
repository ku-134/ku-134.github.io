import CONFIG from '../../config.js';

// 荆棘【荆棘盾】：防御反击（减伤50% + 反弹50%给来源）
// 平衡：克爆发型；被巨人（攒怒节奏）克制；无直接伤害
export default {
  id: 'thorn',
  name: '荆棘',
  type: 'active',
  skillName: '荆棘盾',
  desc: '主动【荆棘盾】(冷却10秒)：开启后4秒内受到的技能伤害减半，并将50%伤害反弹给伤害来源。预判对手爆发时开启，专治各种高伤害。',
  color: '#9aa5b1',
  active: {
    cooldown: CONFIG.SHIELD.cooldown,
    onRelease(owner, inst, ctx) {
      ctx.effects.apply(owner, 'shield', { duration: CONFIG.SHIELD.duration });
      ctx.events.emit('fx:shield', { ball: owner });
    }
  },
  effects: [{
    id: 'shield',
    onApply() {},
    onUpdate() {},
    onRemove() {}
  }]
};
