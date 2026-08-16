import CONFIG from '../../config.js';

// 纳西妲（德鲁伊）【草木逢生】：主动技能（冷却8秒）
// 施放：向敌球方向发射一颗【生命火种】（绿色高速小弹，比奥术飞弹更快）
// 命中：为敌球施加【缠绕】4秒——定身无法动弹 + 每0.5秒4点伤害（至多32伤）
// 缠绕期间锁定方向（无法转向），结束后恢复速度（方向不变）
// 缠绕特效/四叶草装饰用 assets/*.svg（渲染器预加载绘制）
export default {
  id: 'nahida',
  name: '纳西妲',
  type: 'active',
  skillName: '草木逢生',
  desc: '主动【草木逢生】(冷却8秒)：点按即向敌球方向发射一颗【生命火种】（高速小弹）；命中后为敌球施加【缠绕】4秒——定身无法动弹、每0.5秒受到4点草木侵蚀（至多32伤），缠绕结束后恢复速度（方向始终不变）。游走控制生存！',
  color: '#32980A',
  active: {
    cooldown: CONFIG.NAHIDA.cooldown,
    onRelease(owner, inst, ctx) {
      // 方向：自动锁定敌球（无敌人时用瞄准方向兜底）
      const enemy = ctx.getEnemy(owner);
      const dir = enemy && !enemy.dead
        ? Math.atan2(enemy.y - owner.y, enemy.x - owner.x)
        : inst.aimDir;
      ctx.phantoms = ctx.phantoms || [];
      ctx.phantoms.push({
        x: owner.x, y: owner.y,
        angle: dir,
        speed: CONFIG.NAHIDA.seedSpeed,
        radius: CONFIG.NAHIDA.seedRadius,
        color: '#44A785',
        isPhantom: true, isSeed: true,
        owner,
        t: 0,
      });
      ctx.events.emit('sfx:play', { name: 'dash' });
      ctx.events.emit('fx:charge', { x: owner.x, y: owner.y });
    }
  },
  effects: [{
    // 缠绕：定身 + 锁方向 + 每0.5s 4伤（8次=32）
    id: 'vine_wrap',
    onApply(b, p, ctx) {
      ctx.effects.remove(b, 'dash_base');
      ctx.effects.remove(b, 'dash');
      b.speed = 0;
      p.lockAngle = b.angle;   // 锁定方向（缠绕期间无法转向）
      p.t = 0;
      p.tickT = 0;
      p.count = 0;
    },
    onUpdate(b, dt, st, ctx) {
      st.t += dt;
      st.tickT += dt;
      b.angle = st.lockAngle;  // 保持方向不变
      // 每 0.5s 一跳，最多 8 跳（4s × 2 = 32 伤，不缺段）
      while (st.tickT >= CONFIG.NAHIDA.wrapTick && st.count < CONFIG.NAHIDA.maxTicks) {
        st.tickT -= CONFIG.NAHIDA.wrapTick;
        st.count++;
        b.takeDamage(CONFIG.NAHIDA.wrapDamage, ctx, st.source);
        ctx.events.emit('fx:vineTick', { x: b.x, y: b.y });
      }
      // 到时或跳满 → 解除
      if (st.t >= CONFIG.NAHIDA.wrapDuration || st.count >= CONFIG.NAHIDA.maxTicks) {
        ctx.effects.remove(b, 'vine_wrap');
      }
    },
    onRemove(b, p, ctx) {
      // 结束恢复速度（方向保持锁定值不变）
      b.angle = p.lockAngle;
      if (!b.effects.has('dash_base') && !b.effects.has('dash')) b.speed = b.baseSpeed;
    }
  }]
};
