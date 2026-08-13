// 状态效果系统：巨大化/冲刺等可叠加、统一生命周期管理
// 效果定义: { id, onApply(ball,params,ctx), onUpdate(ball,dt,st,ctx), onCollision(ball,other,st,ctx), onRemove(ball,params,ctx) }
export class EffectSystem {
  constructor() { this.defs = new Map(); }
  register(def) { this.defs.set(def.id, def); }
  apply(ball, id, params = {}) {
    const def = this.defs.get(id);
    if (!def) return null;
    const st = { def, ball, t: 0, duration: params.duration ?? Infinity, params, alive: true };
    ball.effects.set(id, st);
    def.onApply?.(ball, params, this);
    return st;
  }
  remove(ball, id) {
    const st = ball.effects.get(id);
    if (!st) return;
    st.alive = false;
    ball.effects.delete(id);
    st.def.onRemove?.(ball, st.params, this);
  }
  has(ball, id) { return ball.effects.has(id); }
  update(ball, dt) {
    for (const st of [...ball.effects.values()]) {
      st.t += dt;
      st.def.onUpdate?.(ball, dt, st, this);
      if (st.t >= st.duration) this.remove(ball, st.def.id);
    }
  }
  emitCollision(ball, other, ctx) {
    for (const st of [...ball.effects.values()]) st.def.onCollision?.(ball, other, st, ctx);
  }
}
