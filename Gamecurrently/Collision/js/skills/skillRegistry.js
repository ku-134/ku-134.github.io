import CONFIG from '../config.js';
import { SkillInstance } from './skillSystem.js';
import giant from './definitions/giant.js';
import legion from './definitions/legion.js';
import poison from './definitions/poison.js';
import thorn from './definitions/thorn.js';
import magnet from './definitions/magnet.js';
import puppet from './definitions/puppet.js';
import phantom from './definitions/phantom.js';
import demon from './definitions/demon.js';
import knight from './definitions/knight.js';
import mage from './definitions/mage.js';
import priest from './definitions/priest.js';
import nahida from './definitions/nahida.js';
import berserker from './definitions/berserker.js';
import necromancer from './definitions/necromancer.js';
import earth from './definitions/earth.js';
import baseDash from './definitions/baseDash.js';

// 职业分类（图鉴/选球顶部切换）
export const CATEGORIES = ['基础', '剑与魔法', '星球'];

// 全部职业定义（图鉴展示用，含战场球：巨人=基础第1位、魔王=剑与魔法第1位）
// ★ experimental（测试角色）：仅作技术力展示——图鉴标注、联机禁选、随机不命中（未来当新模式BOSS）
const defs = [
  { ...giant, category: '基础' },
  { ...legion, category: '基础' },
  { ...poison, category: '基础' },
  { ...thorn, category: '基础' },
  { ...magnet, category: '基础' },
  { ...puppet, category: '基础' },
  { ...phantom, category: '基础' },
  demon,    // 剑与魔法分类第1位（战场球）
  knight,   // 剑与魔法：骑士
  mage,     // 剑与魔法：法师
  priest,   // 剑与魔法：牧师
  nahida,   // 剑与魔法：纳西妲（德鲁伊）
  berserker,  // 剑与魔法：狂战士
  { ...necromancer, experimental: true },  // 剑与魔法：死灵术士（测试角色）
  earth,    // 星球：地球
];
// 可选职业（选球/联机选球用）：战场球（巨人/魔王）剔除；死灵保留（单机手动可玩，联机/随机由 excludeExperimental 过滤）
const selectableDefs = defs.filter(d => d.id !== 'giant' && d.id !== 'demon');
// 全部定义（含基础冲刺：可创建但不展示在列表）
const byId = Object.fromEntries(defs.map(d => [d.id, d]));
byId[baseDash.id] = baseDash;

export const getSkillDefs = () => defs;                    // 图鉴（全部，含战场球）
export const getSelectableDefs = (opts = {}) => {          // 选球（不含战场球；excludeExperimental=排除测试角色）
  const list = selectableDefs;
  return opts.excludeExperimental ? list.filter(d => !d.experimental) : list;
};
export const getSkillDef = id => byId[id];
// 分类：可选项是否含战场球由 selectable 控制；excludeExperimental 排除测试角色（联机禁选/随机不命中）
export const getDefsByCategory = (cat, { selectable = false, excludeExperimental = false } = {}) => {
  let pool = selectable ? selectableDefs : defs;
  if (excludeExperimental) pool = pool.filter(d => !d.experimental);
  return pool.filter(d => d.category === cat);
};

// 创建技能实例：注册该职业所需效果 + 绑定被动；params 可传变体参数
export function createSkill(id, owner, ctx, params = {}) {
  const def = byId[id];
  if (!def) return null;
  def.effects?.forEach(e => ctx.effects.register(e));
  return new SkillInstance(def, owner, ctx, params);
}

// 基础冲刺（全职业通用机动）：兵团职业带30伤变体，其他无伤
// 用法：createDashSkill(ball, ctx, classId)
export function createDashSkill(owner, ctx, classId) {
  const dmg = classId === 'legion' ? (CONFIG.LEGION.dashDamage ?? 0) : 0;
  return createSkill('base_dash', owner, ctx, { damage: dmg });
}
