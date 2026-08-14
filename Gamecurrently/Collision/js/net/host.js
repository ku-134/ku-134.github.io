import { MatchSim } from '../core/matchSim.js';
import { MSG, encodeState } from './protocol.js';

const STATE_HZ = 30;

// 主机权威：跑完整对战模拟 + 30Hz 状态广播 + 处理客人技能指令（dash=基础冲刺 / skill=职业技能）
// wild：战场干扰球（巨人），随状态广播给客户端渲染
// RESULT.win 语义：'host'=房主赢 / 'guest'=客人赢 / 'draw'=平局（明确视角，两端各自判断）
export class Host {
  constructor({ signal, ctx, balls, wild = null, onResult }) {
    this.signal = signal;
    this.ctx = ctx;
    this.balls = balls;
    this.wild = wild;
    this.onResult = onResult;
    this.sim = null;
    this._acc = 0;
    this._running = false;
    this._ended = false;
  }
  start() {
    this._ended = false;
    this._acc = 0;
    this.sim = new MatchSim(this.ctx, this.balls, this.wild);
    this._running = true;
  }
  update(dt) {
    if (!this._running) return;
    const res = this.sim.step(dt);
    this._acc += dt;
    if (this._acc >= 1 / STATE_HZ) {
      this._acc -= 1 / STATE_HZ;
      const all = this.wild ? [...this.balls, this.wild] : this.balls;
      this.signal.send(MSG.STATE, encodeState(this.sim, all, this.ctx.phantoms));
    }
    if (res.over && !this._ended) {
      this._ended = true;
      const [a, b] = this.balls;
      // 明确视角：host/guest/draw
      const win = a.dead && b.dead ? 'draw' : a.dead ? 'guest' : 'host';
      this.signal.send(MSG.RESULT, { win, hp1: a.hp, hp2: b.hp });
      this.onResult?.({ win });
    }
  }
  // 客人技能指令（客人 = balls[1]）；slot: dash=基础冲刺 / skill=职业技能
  handleCmd(cmd) {
    const gBall = this.balls[1];
    const s = cmd.slot === 'dash' ? gBall?.dashSkill : gBall?.skill;
    if (!s || !s.def?.active) return;
    if (cmd.type === 'aim') s.startAim();
    else if (cmd.type === 'release') s.releaseAim();
    else if (cmd.type === 'force' && typeof cmd.dir === 'number') s.forceUse(cmd.dir);
  }
  get berserk() { return this.sim?.berserk ?? false; }
  get berserkLeft() { return this.sim?.berserkLeft() ?? 0; }
}
