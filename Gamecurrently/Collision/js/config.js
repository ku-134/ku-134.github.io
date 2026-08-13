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
  // AI
  AI: { thinkInterval: [2, 5], skillChance: 0.4, aimJitter: 0.3 },
  KEY_ACTIVE: 'KeyJ',
};
export default CONFIG;
