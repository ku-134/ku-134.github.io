import CONFIG from '../../config.js';
import { rayHitRect } from '../../core/math.js';

// 兵团【冲锋】：主动瞄准引导线 → 冲刺
// 平衡：冷却8s；50伤高爆发但撞墙即停、可被巨大化巨人反制
export default {
  id: 'legion',
  name: '兵团',
  type: 'active',
  skillName: '冲锋',
  desc: '主动【冲锋】(冷却8秒)：朝最近的敌球方向射出引导线（仅命中边框）；线命中后球立即转向冲刺点，以2倍速度冲去；途中碰到敌球造成50点伤害，任意碰撞即停。长按瞄准，松开释放。',
  color: '#3a86ff',
  active: {
    cooldown: CONFIG.LEGION.cooldown,
    onRelease(owner, inst, ctx) {
      const hit = rayHitRect(owner.x, owner.y, inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
      owner.setAngle(Math.atan2(hit.y - owner.y, hit.x - owner.x));
      ctx.events.emit('fx:line', { ball: owner, hit });
      ctx.effects.apply(owner, 'dash', { damage: CONFIG.LEGION.damage });
    }
  },
  effects: [{
    id: 'dash',
    onApply(b, p, ctx) { b.dashing = true; b.speed = CONFIG.BALL.speed * CONFIG.LEGION.dashMul; },
    onCollision(b, other, st, ctx) {
      if (other && !other.dead) other.takeDamage(st.params.damage, ctx);
      ctx.effects.remove(b, 'dash');
    },
    onRemove(b) { b.dashing = false; b.speed = b.baseSpeed; }
  }]
};
