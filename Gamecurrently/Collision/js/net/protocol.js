// 联机消息协议（JSON over DataChannel）
// 所有消息：{ t: 类型, d: 数据 }
export const MSG = {
  PICK: 'pick',
  READY: 'ready',
  START: 'start',
  STATE: 'state',
  CMD: 'cmd',
  RESULT: 'result',
  REMATCH: 'rematch',
  PING: 'ping',
  PONG: 'pong',
};

// 房间号：5 位纯数字（好记好输，手机数字键盘直接输入）
export const ROOM_LEN = 5;
const DIGITS = '0123456789';

export function genRoomCode(len = ROOM_LEN) {
  let s = '';
  const u32 = new Uint32Array(1);
  for (let i = 0; i < len; i++) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(u32);
      s += DIGITS[u32[0] % DIGITS.length];
    } else {
      s += DIGITS[Math.floor(Math.random() * DIGITS.length)];
    }
  }
  return s;
}

export const isValidRoomCode = code => /^\d{5}$/.test(code || '');

export const pack = (t, d) => JSON.stringify({ t, d });
export function unpack(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// 主机 → 客户端：状态快照（渲染 + HUD 最小集）
// cd.dash = 基础冲刺冷却，cd.left = 职业技能冷却
export function encodeState(sim, balls, phantoms) {
  return {
    seq: ++sim._seq,
    time: +sim.time.toFixed(2),
    berserk: { active: sim.berserk, left: sim.berserkLeft() },
    balls: balls.map(b => ({
      x: +b.x.toFixed(1), y: +b.y.toFixed(1), angle: +b.angle.toFixed(3),
      hp: Math.max(0, Math.round(b.hp)), scale: +b.scale.toFixed(2),
      dashing: !!b.dashing, flash: b.flash > 0,
      effects: [...b.effects.values()].map(e => ({ id: e.def.id, left: +Math.max(0, e.duration - e.t).toFixed(1) })),
      cd: {
        dash: +(b.dashSkill?.cooldownLeft ?? 0).toFixed(1),
        left: +(b.skill?.cooldownLeft ?? 0).toFixed(1),
        total: b.skill?.cd ?? 0,
        passiveTimer: +(b.skill?.passiveTimer ?? 0).toFixed(1),
        passiveActive: !!b.skill?.passiveActive,
      },
    })),
    phantoms: (phantoms || []).map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), angle: +p.angle.toFixed(3), color: p.color })),
  };
}
