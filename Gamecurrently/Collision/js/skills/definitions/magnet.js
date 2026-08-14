import CONFIG from '../../config.js';
import { normAngle } from '../../core/math.js';

// 磁铁【引力场】：空间控制（牵引敌球方向 + 每秒伤害，范围280）
// 平衡：双刃剑——拉近对手也把自己送进缠斗区；冷却在3s场结束后才开始
export default {
  id: 'magnet',
  name: '磁铁',
  type: 'active',
  skillName: '引力场',
  desc: '主动【引力场】(冷却9秒，场结束后开始计算)：展开引力场3秒，大范围内的敌球被持续牵引（方向朝自己偏转），并每秒受到6点伤害。注意：把对手拉近也可能引狼入室。',
  color: '#5f27cd',
  active: {
    cooldown: CONFIG.MAGNET.cooldown,
    cooldownStartsAfter: CONFIG.MAGNET.duration,
    onRelease(owner, inst, ctx) {
      ctx.effects.apply(owner, 'tether', { duration: CONFIG.MAGNET.duration });
      ctx.events.emit('fx:field', { ball: owner });
    }
  },
  effects: [{
    id: 'tether',
    onUpdate(b, dt, st, ctx) {
      const enemy = ctx.getEnemy(b);
      if (!enemy) return;
      const d = Math.hypot(enemy.x - b.x, enemy.y - b.y);
      if (d > CONFIG.MAGNET.range || d < 1) return;
      // 牵引：把敌球方向朝自己掰（每秒 turnSpeed 弧度）
      const target = Math.atan2(b.y - enemy.y, b.x - enemy.x);
      const diff = normAngle(target - enemy.angle);
      const maxTurn = CONFIG.MAGNET.turnSpeed * dt;
      enemy.setAngle(enemy.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
      // 每秒伤害
      st._t = (st._t || 0) + dt;
      if (st._t >= 1) { st._t -= 1; enemy.takeDamage(CONFIG.MAGNET.dps, ctx, b); }
    }
  }]
};
