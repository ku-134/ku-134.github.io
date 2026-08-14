import { SkillInstance } from './skillSystem.js';
import giant from './definitions/giant.js';
import legion from './definitions/legion.js';
import poison from './definitions/poison.js';
import thorn from './definitions/thorn.js';
import magnet from './definitions/magnet.js';
import puppet from './definitions/puppet.js';
import phantom from './definitions/phantom.js';

const defs = [giant, legion, poison, thorn, magnet, puppet, phantom];
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
