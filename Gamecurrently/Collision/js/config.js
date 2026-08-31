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
  // 狂暴机制：30s后进入狂暴，从0开始正数计时（无上限，直到一方倒下），每秒5伤
  // ★ 豁免：血量 ≤30 的球不再受狂暴每秒扣血影响（残血极限拉扯）
  BERSERK: { delay: 30, dps: 5, exemptHp: 30 },
  // 狂战士【疯狂冲撞】：主动7s冷却，发动后5s无可阻挡的2.5倍速度冲刺（撞墙/撞球不打断），
  //   疯狂期间每次撞击敌球22伤；循环：疯狂5s → 冷却7s → 疯狂5s（cooldownStartsAfter 使冷却在疯狂结束后才计时）
  BERSERKER: { cooldown: 7, duration: 5, speedMul: 2.5, hitDamage: 22 },
  // 地球【文明】：被动每5秒随机触发四种事件之一（每次触发球旁文字提示效果名）——
  //   生态修复(+10~20血) / 战争破坏(-10~15血) / 对外开拓(追踪探测器17~25伤，帧追踪敌球) / 流浪地球(随机方向基础冲刺)
  EARTH: { interval: 5, healMin: 10, healMax: 20, damageMin: 10, damageMax: 15, probeMin: 17, probeMax: 25, probeSpeed: 340 },
  // 太阳（战场干扰球·星球分类）：体型3倍、速度1/4；触碰附着燃烧4s（每秒5~15伤）；
  //   每10~15s向随机球发射激光（±15：+15补充能量 / -15毁灭）
  SUN: { scale: 3, speedMul: 0.25, burnDuration: 4, burnMin: 5, burnMax: 15, laserInterval: [10, 15], laserDamage: 15 },
  // 火星【周期风暴】：特性奥林匹斯之巅（生命越低伤害越高，最多+150%）；铁锈沙尘暴周期出现
  //   （游走4~9s → 渐影消失5s → 再现）；范围基础球3~8倍；场内球每0.5s受5基础伤害（本体免疫）
  MARS: { boostMax: 1.5, appearMin: 4, appearMax: 9, hideDuration: 5, stormScaleMin: 3, stormScaleMax: 8, tick: 0.5, baseDamage: 5 },
  // 土星【冰晶光环】：特性凝固（每0.1s +1冰晶，自主积累≤50停，吃冰晶块可超50）；
  //   每5点冰晶抵挡1点伤害（保留余数、减伤不超过受伤量）；触发减伤时飞出一块冰晶块
  //   （菱形弹幕：飞行一小段后停住不消失；敌球碰10伤 / 自己碰+10冰晶且50%回1~10血）；光环厚度随冰晶增厚
  //   减伤触发 CD 0.5s（shieldCd）——防高频伤害瞬间耗光冰晶；冰晶块飞行中不判定、边界反弹
  SATURN: { gainRate: 0.1, autoCap: 50, shieldPer: 5, shieldCd: 0.5, shardDamage: 10, shardReturn: 10, shardHealChance: 0.5, shardHealMin: 1, shardHealMax: 10, shardSpeed: 260, shardFly: 0.5 },
  // 水星【公转双轨】：绕场地中心椭圆轨道公转（不自主游走）——碰撞10伤（无大气不打断）；
  //   轨道跃迁（主动5s冷却）：内轨（碰撞18伤但每秒自伤3）/ 外轨（每秒回血2）
  MERCURY: { orbitSpeed: 1.7, collideDmg: 10, innerDmg: 18, innerSelfDmg: 3, outerHeal: 2, switchCd: 5, innerRadius: 140, outerRadius: 320 },
  // 金星【温室红温】：每受1伤积1点气体（上限25，未满无效果）；满25启动红温——每1s扣2气体对全场（除自己）5伤；免减速
  VENUS: { gasMax: 25, redTick: 1, redDrain: 2, redDmg: 5 },
  // 木星【伽利略卫星】：3颗卫星环绕（碰敌球8伤，0.5s防抖）；卫星弹射（主动6s冷却，20伤，4s重生）
  JUPITER: { satCount: 3, satOrbits: [55, 80, 105], satRadius: 8, satDmg: 8, satCd: 0.5, launchSpeed: 500, launchDmg: 20, respawn: 4, cooldown: 6 },
  // 天王星【横躺冰封】：碰撞10伤+减速1.5s(×0.65)；每8s碰撞额外冻结1.5s（定身）+12伤
  URANUS: { collideDmg: 10, slowDur: 1.5, slowMul: 0.65, freezeCd: 8, freezeDur: 1.5, freezeDmg: 12 },
  // 海王星【风暴弹球】：发射反弹弹球（420速6s，碰12伤0.3s防抖，不可击碎）；本体3s超音速×1.5；冷却8s
  NEPTUNE: { ballSpeed: 420, ballLife: 6, ballDmg: 12, ballCd: 0.3, sonicDur: 3, sonicMul: 1.5, cooldown: 8 },
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