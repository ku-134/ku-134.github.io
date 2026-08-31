import CONFIG from '../../config.js';

// 金星【温室红温】：每受1点伤害积累1点温室气体（上限25，未满无效果）；
//   满25自动启动红温——每1秒消耗2点气体对全场（除自己）造成5伤，气体耗尽结束
// 特性·高压大气：免疫减速类效果
// 逻辑：气体积累在 Ball.takeDamage 钩子；红温循环在 MatchSim._updateVenus
export default {
  id: 'venus',
  name: '金星',
  category: '星球',
  type: 'passive',
  skillName: '温室红温',
  desc: '被动【温室红温】：每受1点伤害积累1点温室气体（上限25，未满无效果）。满25自动启动红温：每1秒消耗2点气体对全场（除自己外）造成5伤，气体耗尽结束。特性【高压大气】：免疫减速类效果。',
  color: '#E8B84B',
  effects: []
};