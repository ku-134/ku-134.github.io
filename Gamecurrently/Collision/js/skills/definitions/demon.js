import CONFIG from '../../config.js';

// 魔王【召唤魔族】：剑与魔法分类的战场干扰球（第三方，不可选择）
// 体型恒为基础球1.5倍；每5~8秒召唤一只魔族眷属
// 魔族：只能由魔王召唤；游走1~4秒后瞄准场上球冲刺撞击（10伤）
// 召唤/魔族更新逻辑在 MatchSim._updateDemon（战场球不走技能系统）
// 渲染：紫色大球 + 头顶双角（renderer 按 def.id === 'demon' 绘制）
export default {
  id: 'demon',
  name: '魔王',
  type: 'wild',
  category: '剑与魔法',
  skillName: '召唤魔族',
  desc: '战场干扰球【魔王】：体型恒为基础球1.5倍，每5~8秒召唤一只魔族眷属。魔族游走1~4秒后瞄准场上球冲刺撞击（10伤）。只保留召唤机制，不触发冲刺、不影响胜负、狂暴不作用。',
  color: '#3d2645',
  // 无被动/主动：召唤逻辑由 MatchSim 直接管理（随机间隔 5~8s）
  wild: {
    scale: CONFIG.DEMON.scale,
    summonInterval: CONFIG.DEMON.summonInterval,
  },
};
