import CONFIG from '../../config.js';

// 天王星【横躺冰封】：碰撞流控制——碰撞敌球10伤+冰寒减速1.5s（×0.65）；每8s碰撞额外冻结1.5s（定身）+12伤
// 效果：uranus_slow（减速）/ uranus_frozen（冻结定身）——onUpdate 覆盖 speed；冻结时 ball.update 不转向
export default {
  id: 'uranus',
  name: '天王星',
  category: '星球',
  type: 'passive',
  skillName: '极寒冰封',
  desc: '特性【横躺自转】：碰撞敌球10伤并施加冰寒（减速1.5秒）。被动【极寒冰封】：每8秒碰撞额外冻结敌球1.5秒（完全定身）并造成12伤。',
  color: '#5BC8C8',
  effects: [{
    id: 'uranus_slow',
    onApply(b, p, ctx) { p.t = 0; },
    onUpdate(b, dt, st, ctx) {
      const p = st.params;
      p.t += dt;
      b.speed = b.baseSpeed * CONFIG.URANUS.slowMul;
      if (p.t >= CONFIG.URANUS.slowDur) ctx.effects.remove(b, 'uranus_slow');
    },
    onRemove(b) { b.speed = b.baseSpeed; },
  }, {
    id: 'uranus_frozen',
    onApply(b, p, ctx) { p.t = 0; },
    onUpdate(b, dt, st, ctx) {
      const p = st.params;
      p.t += dt;
      b.speed = 0;                    // 定身：无法移动
      b.turnTimer = 9999;             // 锁方向：不自主转向
      if (p.t >= CONFIG.URANUS.freezeDur) ctx.effects.remove(b, 'uranus_frozen');
    },
    onRemove(b) { b.speed = b.baseSpeed; b.turnTimer = Math.max(0.1, b.turnTimer); },
  }],
};