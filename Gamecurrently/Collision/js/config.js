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
  // 巨人【暴怒】：战场干扰球（第三方，不可选择），只保留愤怒机制
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
  // 傀儡【傀儡术】：主动5s冷却，无需瞄准——操控战场干扰球向敌球方向基础冲刺（突进撞25伤）
  PUPPET: { cooldown: 5, dash: { duration: 0.5, speed: 560, damage: 25 } },
  // 骑士【斩击】：每4s自动向敌球方向扇形斩击（范围90，命中40伤）
  KNIGHT: { cooldown: 4, range: 90, damage: 40 },
  // 法师【奥术飞弹】：8s循环 = 效果6s（前5s每秒蓄能1颗五角星，第5s集齐5颗展示1s
  // 第6s（fireTime）向敌球方向±20°（共40°）散射发射）+ 空窗2s
  // 每颗命中敌球7伤（全吃满35伤）；撞球/撞墙即消失
  MAGE: { cooldown: 2, effectDuration: 6, chargeTime: 5, fireTime: 6, spread: Math.PI / 180 * 40, orbit: 46, missileSpeed: 420, missileDamage: 7 },
  // 牧师【治疗术】：主动14s冷却，发动后给自己加10~25血（不可突破上限）
  PRIEST: { cooldown: 14, healMin: 10, healMax: 25 },
  // 纳西妲（德鲁伊）【草木逢生】：主动8s冷却，发射生命火种（780速高速小弹=奥术飞弹1.5倍）
  // 命中施加缠绕4s：定身+锁方向 + 每0.5s 4伤（8跳=32伤），结束恢复速度（方向不变）
  NAHIDA: { cooldown: 8, seedSpeed: 780, seedRadius: 9, wrapDuration: 4, wrapTick: 0.5, wrapDamage: 4, maxTicks: 8 },
  // 死灵术士【亡者复苏】：被动每10秒召唤一个50血的死灵球（常驻可叠加）
  // 本体生命上限仅75；狂暴同样对死灵球生效；总血条=分段小管（当前球段+各从者段）
  NECRO: { color: '#B3001B', hp: 75, minionHp: 50, summonInterval: 10 },
  // 魔王【召唤魔族】：战场干扰球（剑与魔法分类，不可选择）
  // 体型恒为基础球1.5倍；每5~8秒召唤一只魔族眷属
  DEMON: { scale: 1.5, summonInterval: [5, 8] },
  // 魔族：魔王眷属，只能由魔王召唤；游走1~4s后瞄准场上球冲刺撞击（10伤）
  MINION: { radius: 14, wanderSpeed: 60, dashSpeed: 480, life: [1, 4], damage: 10 },
  // 方孔大圆场：圆扩大至初始的1.7倍（357）——场地开阔，由摄像机缩放+追踪展示
  RINGHOLE: { radius: 357, holeSize: 96, spin: 0.5 },
  // 战场干扰球（巨人）：hp 高到不会死
  WILD: { hp: 9999 },
  // AI
  AI: { thinkInterval: [2, 5], skillChance: 0.4, aimJitter: 0.3 },
  KEY_ACTIVE: 'KeyJ',
};
export default CONFIG;
