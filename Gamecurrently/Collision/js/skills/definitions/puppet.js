import CONFIG from '../../config.js';

// 傀儡【傀儡术】：主动技能（冷却5秒）——操控战场干扰球！
// 施放：无需玩家瞄准（自动锁定敌球方向），命令战场干扰球立即执行一次
// 基础冲刺（高速直线突进）：撞到敌球造成25伤；撞到自己主人只停不伤；撞墙/超时停止
// 与基础冲刺同模组手感；干扰球移动随联机 STATE 广播同步，两端一致
// 平衡：借力打力——用第三方干扰球输出，操作简单直接
export default {
  id: 'puppet',
  name: '傀儡',
  type: 'active',
  skillName: '傀儡术',
  desc: '主动【傀儡术】(冷却5秒)：点按即施放、无需瞄准——命令战场干扰球立即向敌球方向执行一次基础冲刺（高速突进），撞到敌球造成25点伤害；撞到自己只停不伤；撞墙或冲刺结束即停。操控战场之力，借刀杀人！',
  color: '#8e44ad',
  active: {
    cooldown: CONFIG.PUPPET.cooldown,
    onRelease(owner, inst, ctx) {
      // 锁定战场干扰球（第三方，不参与胜负）
      const wild = (ctx.wilds && ctx.wilds[0]) || ctx.balls.find(b => b.isWild);
      if (!wild || wild.dead) return;
      // 方向自动指向敌球（不瞄准自己，无需玩家瞄准）
      const enemy = ctx.getEnemy(owner);
      if (!enemy || enemy.dead) return;
      const dir = Math.atan2(enemy.y - wild.y, enemy.x - wild.x);
      wild.setAngle(dir);
      wild.dash = {
        dir,
        t: 0,
        duration: CONFIG.PUPPET.dash.duration,
        speed: CONFIG.PUPPET.dash.speed,
        damage: CONFIG.PUPPET.dash.damage,
        owner,
        hit: false,
      };
      ctx.events.emit('sfx:play', { name: 'dash' });
      ctx.events.emit('fx:line', {
        ball: wild,
        hit: { x: wild.x + Math.cos(dir) * 320, y: wild.y + Math.sin(dir) * 320 },
      });
      ctx.events.emit('fx:charge', { x: wild.x, y: wild.y });
    }
  },
  effects: []
};
