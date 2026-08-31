import CONFIG from '../../config.js';

// 木星【伽利略卫星】：3颗卫星持续绕本体公转（轨道55/80/105，转速不同步）——碰敌球8伤（0.5s防抖）护体蹭伤
// 主动·卫星弹射：弹射离瞄准方向最近的1颗卫星（500速直线，命中20伤），4s后重生
// 逻辑：卫星实体在 MatchSim._updateJupiter（phantom 广播 isSatellite）
export default {
  id: 'jupiter',
  name: '木星',
  category: '星球',
  type: 'active',
  skillName: '卫星弹射',
  desc: '特性【伽利略卫星】：3颗卫星环绕本体公转，碰到敌球8伤（卫星护体）。主动【卫星弹射】：弹射一颗卫星（命中20伤），4秒后重生，冷却6秒。',
  color: '#C98A4B',
  active: {
    cooldown: CONFIG.JUPITER.cooldown,
    onRelease(owner, inst, ctx) {
      owner._launchSat = inst.aimDir;   // 弹射请求（_updateJupiter 处理）
    },
  },
  effects: []
};