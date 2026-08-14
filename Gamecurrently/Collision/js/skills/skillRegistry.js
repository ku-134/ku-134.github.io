import CONFIG from '../config.js';
import { SkillInstance } from './skillSystem.js';
import giant from './definitions/giant.js';
import legion from './definitions/legion.js';
import poison from './definitions/poison.js';
import thorn from './definitions/thorn.js';
import magnet from './definitions/magnet.js';
import puppet from './definitions/puppet.js';
import phantom from './definitions/phantom.js';
import baseDash from './definitions/baseDash.js';

// 全部职业定义（图鉴展示用，含巨人=战场干扰球说明）
const defs = [giant, legion, poison, thorn, magnet, puppet, phantom];
// 可选职业（选球/联机选球用）：巨人已转战场干扰球，剔除
const selectableDefs = defs.filter(d => d.id !== 'giant');
// 全部定义（含基础冲刺：可创建但不展示在列表）
const byId = Object.fromEntries(defs.map(d => [d.id, d]));
byId[baseDash.id] = baseDash;

export const getSkillDefs = () => defs;                    // 图鉴（全部）
export const getSelectableDefs = () => selectableDefs;     // 选球（不含巨人）
export const getSkillDef = id => byId[id];

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
