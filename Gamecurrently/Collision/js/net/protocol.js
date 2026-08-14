// 联机消息协议（JSON over DataChannel）
// 所有消息：{ t: 类型, d: 数据 }
export const MSG = {
  HELLO: 'hello',
  PICK: 'pick',
  START: 'start',
  STATE: 'state',
  CMD: 'cmd',
  RESULT: 'result',
  REMATCH: 'rematch',
  PING: 'ping',
  PONG: 'pong',
};

// 房间号字符集：去掉易混淆的 I/L/O/0/1
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function genRoomCode(len = 5) {
  let s = '';
  const u32 = new Uint32Array(1);
  for (let i = 0; i < len; i++) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(u32);
      s += ALPHA[u32[0] % ALPHA.length];
    } else {
      s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    }
  }
  return s;
}

export const pack = (t, d) => JSON.stringify({ t, d });
export function unpack(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// 主机 → 客户端：状态快照（渲染 + HUD 最小集）
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
        left: +(b.skill?.cooldownLeft ?? 0).toFixed(1),
        total: b.skill?.cd ?? 0,
        passiveTimer: +(b.skill?.passiveTimer ?? 0).toFixed(1),
        passiveActive: !!b.skill?.passiveActive,
      },
    })),
    phantoms: (phantoms || []).map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), angle: +p.angle.toFixed(3), color: p.color })),
  };
}
