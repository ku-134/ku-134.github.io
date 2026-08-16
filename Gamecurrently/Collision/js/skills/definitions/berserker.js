import CONFIG from '../../config.js';

// 狂战士【疯狂冲撞】：主动技能（冷却7秒）
// 释放：进入 5 秒疯狂冲刺——2.5倍速度、无可阻挡（无视缠绕定身/减速）、撞墙撞球不打断；
//   疯狂期间每次撞击敌球造成22伤害（碰撞防抖0.4s，撞战场球/死灵从者同样生效）
// 循环：疯狂5s → 冷却7s → 疯狂5s（cooldownStartsAfter=5：冷却在疯狂结束后才开始计时）
// 腹肌装饰：渲染器 drawBallDeco 绘制（球中央偏下 6 块腹肌，颜色比球体更深）
export default {
  id: 'berserker',
  name: '狂战士',
  category: '剑与魔法',
  type: 'active',
  skillName: '疯狂冲撞',
  desc: '主动【疯狂冲撞】(冷却7秒)：发动后进入5秒疯狂冲刺（速度×2.5，撞墙或撞球不会打断），疯狂期间每次撞击敌球造成22点伤害；疯狂结束后进入7秒冷却，循环：疯狂5秒→冷却7秒→疯狂5秒。',
  color: '#090909',
  active: {
    cooldown: CONFIG.BERSERKER.cooldown,
    cooldownStartsAfter: CONFIG.BERSERKER.duration,   // 疯狂5s结束后才开始7s冷却（释放后12s可再次发动）
    noAim: true,
    onRelease(owner, inst, ctx) {
      // 进入疯狂冲刺：5s 无可阻挡 2.5x 速度（速度由 matchSim 每帧强制覆盖，缠绕/减速无效）
      owner.rage = CONFIG.BERSERKER.duration;
      owner.speed = owner.baseSpeed * CONFIG.BERSERKER.speedMul;
      ctx.events.emit('fx:charge', { x: owner.x, y: owner.y });
      ctx.events.emit('sfx:play', { name: 'dash' });
    }
  },
  effects: []
};
