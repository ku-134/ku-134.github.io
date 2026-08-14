import CONFIG from '../../config.js';

// 荆棘【荆棘盾】：被动循环（5s生效 / 8s冷却），减伤50% + 返还80% + 盾期碰撞12伤
// 平衡：开局立即开盾；生效期间不开始冷却（效果结束后才倒计时），保证覆盖率稳定
// 克爆发型；盾期碰撞12伤保证永远有攻击手段（同职业对战不死局）
export default {
  id: 'thorn',
  name: '荆棘',
  type: 'passive',
  skillName: '荆棘盾',
  desc: '被动【荆棘盾】（循环：生效5秒→冷却8秒，开局立即开启）：无需操作自动生效，生效期间受到的伤害减半、并将80%返还敌球；盾期碰撞对敌球造成12点基础伤害。专治高爆发，同职业对拼也不虚。',
  color: '#9aa5b1',
  passive: {
    cooldown: CONFIG.SHIELD.cooldown,
    effectId: 'shield',
    onTrigger(owner, inst, ctx) {
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
