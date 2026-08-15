import CONFIG from '../../config.js';
import { rayHitRect } from '../../core/math.js';

// 基础冲刺【冲刺】：全职业通用主动机动（与兵团冲锋同模组：帧追踪瞄准 + 冲刺）
// 无伤害版默认；兵团职业经 createDashSkill 传入 damage:45 变体
// 效果 id dash_base 与兵团 dash 独立；duration 兜底防止碰撞事件丢失卡冲刺
// 技能与机动各自独立计算冷却
// 冲刺音效：松开瞄准释放瞬间播放（fx:sound 事件 → 全局管理器）
export default {
  id: 'base_dash',
  name: '基础冲刺',
  type: 'active',
  skillName: '冲刺',
  desc: '基础机动【冲刺】(冷却5秒)：长按瞄准（帧追踪最近敌球方向），松开向该方向以2倍速度冲刺，撞到任何东西即停；普通职业无伤害，兵团职业的冲刺附带45点伤害。与职业技能独立冷却。',
  color: '#1f1a17',
  active: {
    cooldown: CONFIG.BASE_DASH.cooldown,
    onRelease(owner, inst, ctx) {
      const hit = rayHitRect(owner.x, owner.y, inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
      owner.setAngle(Math.atan2(hit.y - owner.y, hit.x - owner.x));
      ctx.events.emit('fx:line', { ball: owner, hit });
      ctx.events.emit('sfx:play', { name: 'dash' });
      ctx.effects.apply(owner, 'dash_base', {
        damage: inst.params?.damage || 0,
        duration: CONFIG.BASE_DASH.maxDuration,   // 兜底：3s 未碰撞也强制结束
      });
    }
  },
  effects: [{
    id: 'dash_base',
    onApply(b, p) { b.dashing = true; b.speed = CONFIG.BALL.speed * CONFIG.BASE_DASH.dashMul; },
    onCollision(b, other, st, ctx) {
      // 兵团变体：碰撞造成45伤；普通版无伤。撞球/撞墙即停
      if (other && !other.dead && (st.params.damage || 0) > 0) other.takeDamage(st.params.damage, ctx, b);
      ctx.effects.remove(b, 'dash_base');
    },
    onRemove(b) {
      b.dashing = false;
      // 若兵团冲锋效果还在（极端叠加），不抢着恢复速度
      if (!b.effects.has('dash')) b.speed = b.baseSpeed;
    }
  }]
};
