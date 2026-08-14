// 状态效果系统：巨大化/冲刺/毒液/护盾等统一管理
// 效果定义: { id, onApply(ball,params,ctx), onUpdate(ball,dt,st,ctx), onCollision(ball,other,st,ctx), onRemove(ball,params,ctx) }
// 注意：onUpdate 的 ctx 为游戏上下文（通过 setCtx 注入）
export class EffectSystem {
  constructor() { this.defs = new Map(); this.ctx = null; }
  setCtx(ctx) { this.ctx = ctx; }
  register(def) { this.defs.set(def.id, def); }
  apply(ball, id, params = {}) {
    const def = this.defs.get(id);
    if (!def) return null;
    const st = { def, ball, t: 0, duration: params.duration ?? Infinity, params, alive: true };
    ball.effects.set(id, st);
    def.onApply?.(ball, params, this.ctx || this);
    return st;
  }
  remove(ball, id) {
    const st = ball.effects.get(id);
    if (!st) return;
    st.alive = false;
    ball.effects.delete(id);
    st.def.onRemove?.(ball, st.params, this.ctx || this);
  }
  has(ball, id) { return ball.effects.has(id); }
  update(ball, dt) {
    const env = this.ctx || this;
    for (const st of [...ball.effects.values()]) {
      st.t += dt;
      st.def.onUpdate?.(ball, dt, st, env);
      if (st.t >= st.duration) this.remove(ball, st.def.id);
    }
  }
  emitCollision(ball, other, ctx) {
    for (const st of [...ball.effects.values()]) st.def.onCollision?.(ball, other, st, ctx);
  }
}
