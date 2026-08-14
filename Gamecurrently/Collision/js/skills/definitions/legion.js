import CONFIG from '../../config.js';
import { rayHitRect } from '../../core/math.js';

// 兵团【冲锋】：主动瞄准引导线 → 冲刺（45伤高爆发）
// 升级：兵团的【基础冲刺】也带45伤（createDashSkill 变体），两个冲刺独立冷却
// 效果 id dash 与基础冲刺 dash_base 独立，移除时互不抢速度；duration 兜底防卡
export default {
  id: 'legion',
  name: '兵团',
  type: 'active',
  skillName: '冲锋',
  desc: '主动【冲锋】(冷却8秒)：长按瞄准键，瞄准线帧追踪最近的敌球方向；松开释放，球以2倍速度沿引导线冲刺，途中首次碰到敌球造成45点伤害并停止。兵团专属：你的【基础冲刺】同样附带45点伤害（独立冷却5秒），双冲刺压制！',
  color: '#3a86ff',
  active: {
    cooldown: CONFIG.LEGION.cooldown,
    onRelease(owner, inst, ctx) {
      const hit = rayHitRect(owner.x, owner.y, inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
      owner.setAngle(Math.atan2(hit.y - owner.y, hit.x - owner.x));
      ctx.events.emit('fx:line', { ball: owner, hit });
      ctx.effects.apply(owner, 'dash', { damage: CONFIG.LEGION.damage, duration: CONFIG.BASE_DASH.maxDuration });
    }
  },
  effects: [{
    id: 'dash',
    onApply(b, p, ctx) { b.dashing = true; b.speed = CONFIG.BALL.speed * CONFIG.LEGION.dashMul; },
    onCollision(b, other, st, ctx) {
      if (other && !other.dead) other.takeDamage(st.params.damage, ctx);
      ctx.effects.remove(b, 'dash');
    },
    onRemove(b) {
      b.dashing = false;
      // 若基础冲刺还在（极端叠加），不抢着恢复速度
      if (!b.effects.has('dash_base')) b.speed = b.baseSpeed;
    }
  }]
};
