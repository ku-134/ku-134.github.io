import CONFIG from '../../config.js';
import { rayHitRect } from '../../core/math.js';

// 基础冲刺【冲刺】：全职业通用主动机动
// 长按瞄准 → 松开向目标方向冲刺（2倍速度，无伤害），5s冷却
// 效果 id 用 dash_base（与兵团的 dash 独立，互不干扰）
export default {
  id: 'base_dash',
  name: '基础冲刺',
  type: 'active',
  skillName: '冲刺',
  desc: '基础机动【冲刺】(冷却5秒)：长按瞄准方向（实时追踪敌球方向），松开向该方向以2倍速度冲刺，撞到任何东西即停；无伤害，纯机动。全职业通用。',
  color: '#1f1a17',
  active: {
    cooldown: CONFIG.BASE_DASH.cooldown,
    onRelease(owner, inst, ctx) {
      const hit = rayHitRect(owner.x, owner.y, inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
      owner.setAngle(Math.atan2(hit.y - owner.y, hit.x - owner.x));
      ctx.events.emit('fx:line', { ball: owner, hit });
      ctx.effects.apply(owner, 'dash_base', { damage: 0 });
    }
  },
  effects: [{
    id: 'dash_base',
    onApply(b) { b.dashing = true; b.speed = CONFIG.BALL.speed * CONFIG.BASE_DASH.dashMul; },
    onCollision(b, other, st, ctx) {
      // 无伤害，撞球/撞墙即停
      ctx.effects.remove(b, 'dash_base');
    },
    onRemove(b) {
      b.dashing = false;
      // 若兵团冲锋效果还在（极端叠加），不抢着恢复速度
      if (!b.effects.has('dash')) b.speed = b.baseSpeed;
    }
  }]
};
