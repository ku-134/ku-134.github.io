import { SkillInstance } from './skillSystem.js';
import giant from './definitions/giant.js';
import legion from './definitions/legion.js';

const defs = [giant, legion];
const byId = Object.fromEntries(defs.map(d => [d.id, d]));

export const getSkillDefs = () => defs;
export const getSkillDef = id => byId[id];

// 创建技能实例：注册该职业所需效果 + 绑定被动
export function createSkill(id, owner, ctx) {
  const def = byId[id];
  if (!def) return null;
  def.effects?.forEach(e => ctx.effects.register(e));
  return new SkillInstance(def, owner, ctx);
}
