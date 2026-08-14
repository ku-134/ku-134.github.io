import CONFIG from '../../config.js';

// 荆棘【荆棘盾】：防御反击（承受50% + 伤害的80%返回敌球）
// 平衡：克爆发型；被巨人（攒怒节奏）克制；冷却在4s盾结束后才开始
export default {
  id: 'thorn',
  name: '荆棘',
  type: 'active',
  skillName: '荆棘盾',
  desc: '主动【荆棘盾】(冷却10秒，盾结束后开始计算)：开启后4秒内受到的伤害减半，并将该伤害的80%返还给敌球。预判对手爆发时开启，专治各种高伤害。',
  color: '#9aa5b1',
  active: {
    cooldown: CONFIG.SHIELD.cooldown,
    cooldownStartsAfter: CONFIG.SHIELD.duration,
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
