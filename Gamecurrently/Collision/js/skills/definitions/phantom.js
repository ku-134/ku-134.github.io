import CONFIG from '../../config.js';
import { normAngle } from '../../core/math.js';
import { Phantom } from '../../entities/ball.js';

// 幻影【分身】：一次召唤3个幻影球（不同随机方向，互不重叠），各自独立撞敌15伤
// 平衡：8s冷却（唯一攻击手段）；克站桩巨人；被荆棘反弹
export default {
  id: 'phantom',
  name: '幻影',
  type: 'active',
  skillName: '分身',
  desc: '主动【分身】(冷却8秒，分身全部消散后开始计算)：朝周围随机方向一次召唤3个幻影球（速度80%，存在6秒）。幻影撞墙反弹、撞到敌球各造成15点伤害后消失；幻影不会触发任何被动效果、也不吃伤害。三路齐发，包围打击！',
  color: '#00b4d8',
  active: {
    cooldown: CONFIG.PHANTOM.cooldown,
    cooldownStartsAfter: CONFIG.PHANTOM.duration,
    onRelease(owner, inst, ctx) {
      const angles = [];
      // 三个互不相同（最小间隔约40°）的随机方向
      let guard = 0;
      while (angles.length < CONFIG.PHANTOM.count && guard++ < 60) {
        const a = normAngle(inst.aimDir + (Math.random() - 0.5) * Math.PI * 2);
        if (angles.every(x => Math.abs(normAngle(x - a)) > 0.7)) angles.push(a);
      }
      while (angles.length < CONFIG.PHANTOM.count) {
        angles.push(normAngle(inst.aimDir + angles.length * 2.1));
      }
      ctx.effects.apply(owner, 'phantom_aura', {
        duration: CONFIG.PHANTOM.duration,
        phantoms: angles.map(a => new Phantom(owner, a)),
      });
    }
  },
  effects: [{
    id: 'phantom_aura',
    onApply(b, p, ctx) {
      ctx.phantoms = ctx.phantoms || [];
      p.phantoms.forEach(ph => ctx.phantoms.push(ph));
    },
    onUpdate(b, dt, st, ctx) {
      const phs = st.params.phantoms;
      if (!phs || phs.length === 0) return;
      const enemy = ctx.getEnemy(b);
      for (let i = phs.length - 1; i >= 0; i--) {
        const ph = phs[i];
        ph.x += Math.cos(ph.angle) * ph.speed * dt;
        ph.y += Math.sin(ph.angle) * ph.speed * dt;
        // 撞墙反弹
        const { w, h } = CONFIG.FIELD;
        if (ph.x < ph.radius) { ph.x = ph.radius; ph.angle = Math.PI - ph.angle; }
        else if (ph.x > w - ph.radius) { ph.x = w - ph.radius; ph.angle = Math.PI - ph.angle; }
        if (ph.y < ph.radius) { ph.y = ph.radius; ph.angle = -ph.angle; }
        else if (ph.y > h - ph.radius) { ph.y = h - ph.radius; ph.angle = -ph.angle; }
        // 撞到敌球 → 15伤 + 该分身消失（其他分身继续）
        if (enemy && !enemy.dead) {
          const d = Math.hypot(enemy.x - ph.x, enemy.y - ph.y);
          if (d < ph.radius + enemy.radiusScaled) {
            enemy.takeDamage(CONFIG.PHANTOM.damage, ctx, b);
            ctx.events.emit('fx:phantomHit', { x: ph.x, y: ph.y, color: ph.color });
            ctx.phantoms = (ctx.phantoms || []).filter(x => x !== ph);
            phs.splice(i, 1);
          }
        }
      }
      // 全部分身消散 → 技能结束（冷却开始）
      if (phs.length === 0) ctx.effects.remove(b, 'phantom_aura');
    },
    onRemove(b, p, ctx) {
      const phs = p.phantoms || [];
      ctx.phantoms = (ctx.phantoms || []).filter(x => !phs.includes(x));
    }
  }]
};
