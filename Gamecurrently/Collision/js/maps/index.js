// 战场注册表：所有场地在这里登记（图鉴战场选择/对局引用）
// 场地文件职责：id/name/desc/spawnPoints（出生点）+ draw（绘制）+ collide（物理边界）
import arena from './arena.js';
import ringHole from './ringHole.js';

export const BATTLE_FIELDS = [arena, ringHole];

// 按 id 取场地（默认角斗场）
export const getBattleField = id => BATTLE_FIELDS.find(f => f.id === id) || arena;

// 从场地出生点随机取 count 个不重复点位
// 返回数组（可作玩家/战场球出生位置）
export function pickSpawns(map, count) {
  const pts = [...map.spawnPoints];
  const out = [];
  while (out.length < count && pts.length) {
    out.push(pts.splice(Math.floor(Math.random() * pts.length), 1)[0]);
  }
  return out;
}
