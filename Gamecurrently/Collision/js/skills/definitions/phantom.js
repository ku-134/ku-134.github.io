import CONFIG from '../../config.js';
import { Phantom } from '../../entities/ball.js';

// 幻影【分身】：生成幻影球干扰（15伤/次，6s存在，不触发被动）
// 平衡：8s冷却（唯一攻击手段）；克站桩巨人；被荆棘反弹
export default {
  id: 'phantom',
  name: '幻影',
  type: 'active',
  skillName: '分身',
  desc: '主动【分身】(冷却8秒，幻影消散后开始计算)：在身旁生成一个幻影球（速度80%，存在6秒）。幻影撞墙反弹，撞到敌球造成15点伤害并消失；幻影不触发任何被动、不吃伤害。',
  color: '#00b4d8',
  active: {
    cooldown: CONFIG.PHANTOM.cooldown,
    cooldownStartsAfter: CONFIG.PHANTOM.duration,
    onRelease(owner, inst, ctx) {
      ctx.effects.apply(owner, 'phantom_aura', {
        duration: CONFIG.PHANTOM.duration,
        phantom: new Phantom(owner),
      });
    }
  },
  effects: [{
    id: 'phantom_aura',
    onApply(b, p, ctx) {
      ctx.phantoms = ctx.phantoms || [];
      ctx.phantoms.push(p.phantom);
    },
    onUpdate(b, dt, st, ctx) {
      const ph = st.params.phantom;
      if (!ph) return;
      ph.x += Math.cos(ph.angle) * ph.speed * dt;
      ph.y += Math.sin(ph.angle) * ph.speed * dt;
      // 撞墙反弹
      const { w, h } = CONFIG.FIELD;
      if (ph.x < ph.radius) { ph.x = ph.radius; ph.angle = Math.PI - ph.angle; }
      else if (ph.x > w - ph.radius) { ph.x = w - ph.radius; ph.angle = Math.PI - ph.angle; }
      if (ph.y < ph.radius) { ph.y = ph.radius; ph.angle = -ph.angle; }
      else if (ph.y > h - ph.radius) { ph.y = h - ph.radius; ph.angle = -ph.angle; }
      // 与敌球碰撞 → 15伤 + 幻影销毁
      const enemy = ctx.getEnemy(b);
      if (enemy && !enemy.dead) {
        const d = Math.hypot(enemy.x - ph.x, enemy.y - ph.y);
        if (d < ph.radius + enemy.radiusScaled) {
          enemy.takeDamage(CONFIG.PHANTOM.damage, ctx, b);
          ctx.events.emit('fx:phantomHit', { x: ph.x, y: ph.y, color: ph.color });
          ctx.effects.remove(b, 'phantom_aura');
        }
      }
    },
    onRemove(b, p, ctx) {
      ctx.phantoms = (ctx.phantoms || []).filter(x => x !== p.phantom);
    }
  }]
};
