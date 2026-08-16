import { MatchSim } from '../core/matchSim.js';
import { MSG, encodeState } from './protocol.js';

const STATE_HZ = 30;

// 主机权威：跑完整对战模拟 + 30Hz 状态广播 + 处理客人技能指令（dash=基础冲刺 / skill=职业技能）
// wilds：战场干扰球数组（巨人=基础分类 / 魔王=剑与魔法分类），随状态广播给客户端渲染
// necros（死灵术士）：阵营多球数组，随 STATE.necros 广播（[0]=当前意识球）
// RESULT.win 语义：'host'=房主赢 / 'guest'=客人赢 / 'draw'=平局（明确视角，两端各自判断）
export class Host {
  constructor({ signal, ctx, balls, wilds = [], necros = [], onResult }) {
    this.signal = signal;
    this.ctx = ctx;
    this.balls = balls;
    this.wilds = Array.isArray(wilds) ? wilds : (wilds ? [wilds] : []);
    this.necros = Array.isArray(necros) ? necros : (necros ? [necros] : []);
    this.onResult = onResult;
    this.sim = null;
    this._acc = 0;
    this._running = false;
    this._ended = false;
  }
  start() {
    this._ended = false;
    this._acc = 0;
    this.sim = new MatchSim(this.ctx, this.balls, this.wilds, this.necros);
    this._running = true;
  }
  update(dt) {
    if (!this._running) return;
    const res = this.sim.step(dt);
    this._acc += dt;
    if (this._acc >= 1 / STATE_HZ) {
      this._acc -= 1 / STATE_HZ;
      const all = [...this.balls, ...this.wilds];
      this.signal.send(MSG.STATE, encodeState(this.sim, all, this.ctx.phantoms));
    }
    if (res.over && !this._ended) {
      this._ended = true;
      // 明确视角：winner 0=房主侧 / 1=客人侧 / -1=平局
      const win = res.winner === 0 ? 'host' : res.winner === 1 ? 'guest' : 'draw';
      this.signal.send(MSG.RESULT, { win, hp1: this.balls[0]?.hp ?? 0, hp2: this.balls[1]?.hp ?? 0 });
      this.onResult?.({ win });
    }
  }
  // 客人技能指令；slot: dash=基础冲刺 / skill=职业技能
  // ★ 客人侧死灵术士：指令作用于当前意识球（necros[0]）
  handleCmd(cmd) {
    let gBall = this.balls[1];
    const n = this.sim?.necros || [];
    if (n.length && !n.includes(this.balls[0])) gBall = n[0];
    const s = cmd.slot === 'dash' ? gBall?.dashSkill : gBall?.skill;
    if (!s || !s.def?.active) return;
    if (cmd.type === 'aim') s.startAim();
    else if (cmd.type === 'release') s.releaseAim();
    else if (cmd.type === 'force' && typeof cmd.dir === 'number') s.forceUse(cmd.dir);
  }
  get berserk() { return this.sim?.berserk ?? false; }
  get berserkLeft() { return this.sim?.berserkLeft() ?? 0; }
}
