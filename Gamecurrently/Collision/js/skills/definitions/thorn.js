import CONFIG from '../../config.js';

// 荆棘【荆棘盾】：防御反击（承受50% + 伤害80%返还敌球）
// 盾期碰撞造成12点基础伤害：保证荆棘永远有主动攻击手段（同职业对战不死局）
// 平衡：克爆发型；被巨人（攒怒节奏）克制；冷却在4s盾结束后才开始
export default {
  id: 'thorn',
  name: '荆棘',
  type: 'active',
  skillName: '荆棘盾',
  desc: '主动【荆棘盾】(冷却10秒，盾结束后开始计算)：开启后4秒内受到的伤害减半、将80%返还敌球，且盾期碰撞对敌球造成12点基础伤害。专治高爆发，同职业对拼也不虚。',
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
    // 盾期碰撞基础伤（受0.4s碰撞防抖限制）
    onCollision(b, other, st, ctx) {
      if (other) other.takeDamage(CONFIG.SHIELD.collideDamage, ctx, b);
    },
    onRemove() {}
  }]
};
