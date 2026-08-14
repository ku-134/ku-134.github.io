import CONFIG from '../../config.js';

// 傀儡【置换】：末影珍珠弹道——长按瞄准，松开射出珍珠，命中敌球触发置换
// 命中：交换位置 + 18伤 + 0.6s惊滞；撞墙未命中则珍珠消失
// 平衡：需要预判弹道，不再无脑点击即伤；弹幕可被躲开
export default {
  id: 'puppet',
  name: '傀儡',
  type: 'active',
  skillName: '置换',
  desc: '主动【置换】(冷却10秒)：长按瞄准（帧追踪敌球方向），松开朝瞄准方向射出【末影珍珠】弹幕；珍珠命中敌球瞬间触发置换：交换双方位置、造成18点空间撕裂伤害、并使敌球惊滞0.6秒。珍珠撞墙即消失（未命中），需要预判弹道。',
  color: '#8e44ad',
  active: {
    cooldown: CONFIG.PUPPET.cooldown,
    onRelease(owner, inst, ctx) {
      ctx.effects.apply(owner, 'pearl_shot', { aim: inst.aimDir });
    }
  },
  effects: [{
    id: 'pearl_shot',
    onApply(b, p, ctx) {
      ctx.phantoms = ctx.phantoms || [];
      ctx.phantoms.push({
        x: b.x, y: b.y, angle: p.aim,
        speed: CONFIG.BALL.speed * CONFIG.PUPPET.pearlSpeedMul,
        radius: 12, color: '#00b4d8', isPearl: true,
      });
    },
    onUpdate(b, dt, st, ctx) {
      const phs = ctx.phantoms || [];
      const pearl = phs.find(x => x.isPearl);
      if (!pearl) { ctx.effects.remove(b, 'pearl_shot'); return; }
      pearl.x += Math.cos(pearl.angle) * pearl.speed * dt;
      pearl.y += Math.sin(pearl.angle) * pearl.speed * dt;
      const { w, h } = CONFIG.FIELD;
      // 撞墙 → 未命中，珍珠消失
      if (pearl.x < pearl.radius || pearl.x > w - pearl.radius || pearl.y < pearl.radius || pearl.y > h - pearl.radius) {
        ctx.phantoms = (ctx.phantoms || []).filter(x => x !== pearl);
        ctx.effects.remove(b, 'pearl_shot');
        return;
      }
      // 命中敌球 → 触发置换
      const enemy = ctx.getEnemy(b);
      if (enemy && !enemy.dead) {
        const d = Math.hypot(enemy.x - pearl.x, enemy.y - pearl.y);
        if (d < pearl.radius + enemy.radiusScaled) {
          ctx.phantoms = (ctx.phantoms || []).filter(x => x !== pearl);
          const tx = b.x, ty = b.y;
          b.x = enemy.x; b.y = enemy.y;
          enemy.x = tx; enemy.y = ty;
          enemy.takeDamage(CONFIG.PUPPET.damage, ctx, b);
          ctx.effects.apply(enemy, 'stun', { duration: CONFIG.PUPPET.stunDuration });
          ctx.events.emit('fx:swap', { a: b, b: enemy });
          ctx.effects.remove(b, 'pearl_shot');
        }
      }
    },
    onRemove(b, p, ctx) {
      // 清理残留珍珠（保险）
      ctx.phantoms = (ctx.phantoms || []).filter(x => !x.isPearl);
    }
  }, {
    // 惊滞效果：命中后敌球无法自主转向
    id: 'stun',
    onApply() {},
    onUpdate() {},
    onRemove() {}
  }]
};
