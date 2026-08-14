// 全局数值配置：平衡性调整集中在这里
const CONFIG = {
  FIELD: { w: 800, h: 450 },
  BALL: { radius: 20, speed: 240 },
  MAX_HP: 200,                // 基础血量（延长对局）
  MATCH_TIME: 180,            // 兜底对局时长（正常由狂暴机制结束）
  COLLIDE_COOLDOWN: 0.4,      // 碰撞事件防抖（秒）
  TURN_INTERVAL: [1.2, 3.0],  // 球自主随机转向间隔（秒）
  TURN_ANGLE: 0.35,           // 单次随机转向最大弧度
  CAMERA: { amp: 8, freq: [0.5, 1.2] },
  // 狂暴机制：30s后进入狂暴，每秒全场10伤，20s=200血必分胜负
  BERSERK: { delay: 30, duration: 20, dps: 10 },
  // 基础冲刺：全职业通用主动机动（瞄准冲刺；兵团职业带30伤）
  BASE_DASH: { cooldown: 5, dashMul: 2, maxDuration: 3 },
  // 巨人【暴怒】
  GIANT: { angerMax: 8, duration: 10, scale: 2, damage: 30, growTime: 1 },
  // 兵团【冲锋】：机动性是职业特色；技能与基础冲刺都30伤，独立冷却
  LEGION: { cooldown: 8, dashMul: 2, damage: 30, dashDamage: 30 },
  // 荆棘【荆棘盾】被动：8s冷却循环 + 5s生效，承受50% + 返还80% + 盾期碰撞12伤
  SHIELD: { cooldown: 8, duration: 5, mitigation: 0.5, reflect: 0.8, collideDamage: 12 },
  // 磁铁【引力场】：范围280，场内每0.1s造成1.5伤（等效dps15）
  MAGNET: { cooldown: 9, duration: 3, range: 280, turnSpeed: 0.35, tick: 0.1, tickDamage: 1.5 },
  // 幻影【分身】：一次3个分身（随机方向），冷却8s
  PHANTOM: { cooldown: 8, duration: 6, damage: 15, speedMul: 0.8, count: 3 },
  // 毒液【腐蚀】
  POISON: { duration: 3.5, tick: 0.5, tickDamage: 3 },
  // 傀儡【置换】：末影珍珠弹道，命中触发换位+18伤+0.6s惊滞
  PUPPET: { cooldown: 10, damage: 18, stunDuration: 0.6, pearlSpeedMul: 1.6 },
  // AI
  AI: { thinkInterval: [2, 5], skillChance: 0.4, aimJitter: 0.3 },
  KEY_ACTIVE: 'KeyJ',
};
export default CONFIG;
