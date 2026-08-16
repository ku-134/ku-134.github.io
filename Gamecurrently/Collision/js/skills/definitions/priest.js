import CONFIG from '../../config.js';

// 牧师【治疗术】：主动躲避耐活——14秒冷却，发动后给自己加10~25血量（不可突破上限）
// 加血底层：Ball.heal() 触发绿色闪光（healFlash）+ 绿色加血数字（fx:heal 事件）
// noAim：治疗无需瞄准（不显示瞄准线，点按即用）
// 十字架装饰（木头色，球中央偏下固定）由 renderer 绘制（b.skill.def.id === 'priest'）
export default {
  id: 'priest',
  name: '牧师',
  type: 'active',
  category: '剑与魔法',
  skillName: '治疗术',
  desc: '主动【治疗术】(冷却14秒)：发动后为自己恢复10~25点生命（随机，不可突破上限）；治疗时身体闪绿光并跳出绿色加血数字。',
  color: '#F5D600',
  active: {
    cooldown: CONFIG.PRIEST.cooldown,
    noAim: true,   // 治疗不需要瞄准线
    onRelease(owner, inst, ctx) {
      const amount = CONFIG.PRIEST.healMin
        + Math.floor(Math.random() * (CONFIG.PRIEST.healMax - CONFIG.PRIEST.healMin + 1));  // 10~25
      owner.heal(amount, ctx);
    }
  }
};
