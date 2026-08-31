import CONFIG from '../../config.js';

// 海王星【风暴弹球】：发射深蓝风暴球（420速）——撞边界反弹、6秒满场弹跳不消失；碰敌球12伤（0.3s防抖）
// ★ 感染扩散：本体被持续状态附着（毒液/灼烧/冰寒/冻结）时，弹球携带这些状态——命中敌球传染（时长×2/3）
// 释放同时本体3秒超音速（×1.5）；弹球不可击碎
// 逻辑：弹球 phantom（isStormBall）在 MatchSim._updateNeptune；本体超音速在 step 覆盖 speed
export default {
  id: 'neptune',
  name: '海王星',
  category: '星球',
  type: 'active',
  skillName: '风暴弹球',
  desc: '主动【风暴弹球】：发射一颗会边界反弹的风暴弹球（420速，6秒满场弹跳不消失），碰到12伤（可多次命中）；若本体被持续状态附着（毒液/灼烧/冰寒/冻结），弹球携带并传染（时长×2/3）；释放同时本体3秒超音速。冷却8秒。',
  color: '#1B4F8A',
  active: {
    cooldown: CONFIG.NEPTUNE.cooldown,
    onRelease(owner, inst, ctx) {
      ctx.phantoms = ctx.phantoms || [];
      // ★ 感染扩散：本体被持续状态附着（毒液腐蚀/太阳灼烧/天王星冰寒与冻结）时，
      //   风暴球携带这些状态——命中敌球传染（持续时长 = 原状态的 2/3）
      const INFECTABLE = ['poison', 'sun_burn', 'uranus_slow', 'uranus_frozen'];
      const INFECT_DUR = {
        poison: CONFIG.POISON.duration,
        sun_burn: CONFIG.SUN.burnDuration,
        uranus_slow: CONFIG.URANUS.slowDur,
        uranus_frozen: CONFIG.URANUS.freezeDur,
      };
      const infections = [];
      for (const id of INFECTABLE) {
        if (owner.effects.has(id)) infections.push({ id, dur: +(INFECT_DUR[id] * 2 / 3).toFixed(2) });
      }
      ctx.phantoms.push({
        isPhantom: true, isStormBall: true,
        x: owner.x, y: owner.y, angle: inst.aimDir,
        speed: CONFIG.NEPTUNE.ballSpeed, radius: 12,
        t: 0, life: CONFIG.NEPTUNE.ballLife, owner,
        infections,
      });
      owner._sonicT = CONFIG.NEPTUNE.sonicDur;   // 本体超音速
      ctx.events.emit('fx:neptuneLaunch', { x: owner.x, y: owner.y });
    },
  },
  effects: []
};