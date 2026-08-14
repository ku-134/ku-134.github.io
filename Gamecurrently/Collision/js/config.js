// 全局数值配置：平衡性调整集中在这里
const CONFIG = {
  FIELD: { w: 800, h: 450 },
  BALL: { radius: 20, speed: 240 },
  MAX_HP: 100,
  MATCH_TIME: 180,
  COLLIDE_COOLDOWN: 0.4,      // 碰撞事件防抖（秒）
  TURN_INTERVAL: [1.2, 3.0],  // 球自主随机转向间隔（秒）
  TURN_ANGLE: 0.35,           // 单次随机转向最大弧度
  CAMERA: { amp: 8, freq: [0.5, 1.2] },
  // 巨人【暴怒】
  GIANT: { angerMax: 8, duration: 10, scale: 2, damage: 30, growTime: 1 },
  // 兵团【冲锋】
  LEGION: { cooldown: 8, dashMul: 2, damage: 50 },
  // 荆棘【荆棘盾】
  SHIELD: { cooldown: 10, duration: 4, mitigation: 0.5, reflect: 0.5 },
  // 磁铁【引力场】
  MAGNET: { cooldown: 9, duration: 3, range: 140, turnSpeed: 0.35, dps: 6 },
  // 幻影【分身】
  PHANTOM: { cooldown: 12, duration: 6, damage: 15, speedMul: 0.8 },
  // 毒液【腐蚀】
  POISON: { duration: 3.5, tick: 0.5, tickDamage: 3 },
  // 傀儡【置换】
  PUPPET: { cooldown: 10, damage: 18, stunDuration: 0.6 },
  // AI
  AI: { thinkInterval: [2, 5], skillChance: 0.4, aimJitter: 0.3 },
  KEY_ACTIVE: 'KeyJ',
};
export default CONFIG;
