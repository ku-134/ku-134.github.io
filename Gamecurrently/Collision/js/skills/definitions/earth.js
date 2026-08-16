import CONFIG from '../../config.js';

// 地球【文明】：被动（每5秒随机触发四种事件之一）——生存游走
// 1) 生态修复：回复 10~20 血（文明的自愈力）
// 2) 战争破坏：自损 10~15 血（文明的双刃剑）
// 3) 对外开拓：发射追踪探测器（17~25伤，飞行中每帧偏转角度追踪敌球——发射后仍主动追踪）
// 4) 流浪地球：随机方向执行一次基础冲刺（复用 dashSkill 冲刺模组，冷却中则跳过）
// ★ 每次触发在球旁文字提示效果名（fx:earthLabel → renderer.addLabel，与加减血数字同款描边样式）
// ★ 球体：海洋色打底 + 绿色板块（renderer drawBallDeco 绘制，像大陆）
export default {
  id: 'earth',
  name: '地球',
  category: '星球',
  type: 'passive',
  skillName: '文明',
  desc: '被动【文明】(每5秒)：随机触发四种事件之一——生态修复（回复10~20血）、战争破坏（自损10~15血）、对外开拓（发射追踪探测器，命中17~25伤，飞行中持续追踪敌球）、流浪地球（随机方向基础冲刺）。文明不可预知。',
  color: '#2E86C1',
  passive: {
    cooldown: CONFIG.EARTH.interval,
    onTrigger(owner, inst, ctx) {
      const roll = Math.floor(Math.random() * 4);
      const label = (text) => ctx.events.emit('fx:earthLabel', {
        x: owner.x, y: owner.y - owner.radiusScaled - 26, text,
      });
      if (roll === 0) {
        // 生态修复：回血
        const amount = CONFIG.EARTH.healMin
          + Math.floor(Math.random() * (CONFIG.EARTH.healMax - CONFIG.EARTH.healMin + 1));
        owner.heal(amount, ctx);
        label('生态修复');
      } else if (roll === 1) {
        // 战争破坏：自损（noReflect 防荆棘反射死循环）
        const amount = CONFIG.EARTH.damageMin
          + Math.floor(Math.random() * (CONFIG.EARTH.damageMax - CONFIG.EARTH.damageMin + 1));
        owner.takeDamage(amount, ctx, null, true);
        label('战争破坏');
      } else if (roll === 2) {
        // 对外开拓：发射追踪探测器（帧追踪敌球）
        const enemy = ctx.getEnemy(owner);
        const dir = enemy && !enemy.dead ? Math.atan2(enemy.y - owner.y, enemy.x - owner.x) : owner.angle;
        const damage = CONFIG.EARTH.probeMin
          + Math.floor(Math.random() * (CONFIG.EARTH.probeMax - CONFIG.EARTH.probeMin + 1));
        ctx.phantoms = ctx.phantoms || [];
        ctx.phantoms.push({
          x: owner.x, y: owner.y, angle: dir,
          speed: CONFIG.EARTH.probeSpeed, radius: 9, color: '#7CB342',
          isPhantom: true, isEarthProbe: true, owner, damage, t: 0,
        });
        label('对外开拓');
      } else {
        // 流浪地球：随机方向基础冲刺（复用冲刺模组；冷却中则跳过）
        owner.dashSkill?.forceUse(Math.random() * Math.PI * 2);
        label('流浪地球');
      }
    }
  },
  effects: []
};
