import CONFIG from '../config.js';

// 对局 HUD：HP条/技能状态条 + 双技能通道（基础冲刺 dash + 职业技能 active）
// 触屏：dash-btn（左下，全职业）+ active-btn（右下，仅主动职业）
// 电脑：dash-cd-bar（左下）+ cd-bar（职业，主动冷却/被动进度）
// prefix：单机 ''，联机 'online-'；myIndex：自己球下标（房主=0，客人=1）
// ★ 死灵术士：该侧 HP 条渲染为分段小管（各球血量/上限，段间有空隙），
//   最前段=当前意识球（最深红），从者按顺序渐浅（多级红色深度）
// ★ 每段宽度 = 该球当前血量 ÷ 总容量（ΣmaxHp）×100%——总和≤100%不溢出，
//   召唤越多每段越窄（挤压），一眼看出总血量百分比
// ★ 双侧阵营：自己侧/对方侧各自独立分段（按 _necroSide 过滤），互不干扰
// ★ 分段时原 fill 元素会被移出 bar——用 _necroBarCache 缓存 bar 引用，
//   避免下一帧 fillEl.parentElement 为 null 抛异常卡死（已修）
// ★ showResult(win, extra)：extra 为战绩等附加信息行（插在按钮前）
export class Hud {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.ctx = null;
    this._necroBarCache = new Map();  // fillEl -> bar（分段后 fillEl 被移出 DOM，缓存恢复用）
    this.el = {
      p1name: document.getElementById(prefix + 'p1-name'),
      p1hp: document.getElementById(prefix + 'p1-hp'),
      p1passive: document.getElementById(prefix + 'p1-passive'),
      p2name: document.getElementById(prefix + 'p2-name'),
      p2hp: document.getElementById(prefix + 'p2-hp'),
      p2passive: document.getElementById(prefix + 'p2-passive'),
      // 触屏：基础冲刺按钮（左下）
      dashBtn: document.getElementById(prefix + 'dash-btn'),
      dSname: document.querySelector('#' + prefix + 'dash-btn .sname'),
      dScd: document.querySelector('#' + prefix + 'dash-btn .scd'),
      // 触屏：职业技能按钮（右下，仅主动职业）
      activeBtn: document.getElementById(prefix + 'active-btn'),
      aSname: document.querySelector('#' + prefix + 'active-btn .sname'),
      aScd: document.querySelector('#' + prefix + 'active-btn .scd'),
      // 电脑：冲刺冷却条（左下）
      dashCdBar: document.getElementById(prefix + 'dash-cd-bar'),
      dashCdName: document.getElementById(prefix + 'dash-cd-name'),
      dashCdFill: document.getElementById(prefix + 'dash-cd-fill'),
      dashCdKey: document.getElementById(prefix + 'dash-cd-key'),
      // 电脑：职业技能条
      cdBar: document.getElementById(prefix + 'cd-bar'),
      cdName: document.getElementById(prefix + 'cd-name'),
      cdFill: document.getElementById(prefix + 'cd-fill'),
      cdKey: document.getElementById(prefix + 'cd-key'),
      matchTimer: document.getElementById(prefix + 'match-timer'),
    };
    this.balls = null;
    this.isTouch = false;
    this.myIndex = 0;
  }
  bind(balls, { isTouch, key, dashKey = 'Space', myIndex = 0, ctx = null }) {
    this.balls = balls;
    this.isTouch = isTouch;
    this.myIndex = myIndex;
    this.ctx = ctx;
    const [p1, p2] = balls;
    this.el.p1name.textContent = `你 · ${p1.skill?.def.name ?? '无'}`;
    this.el.p2name.textContent = `对方 · ${p2.skill?.def.name ?? '无'}`;
    if (isTouch) {
      this.el.cdBar.classList.add('hidden');
      this.el.dashCdBar.classList.add('hidden');
      this.el.dashBtn.classList.remove('hidden');
      this.el.activeBtn.classList.remove('hidden');  // 被动职业由 updateSkillUI 隐藏
    } else {
      this.el.dashBtn.classList.add('hidden');
      this.el.activeBtn.classList.add('hidden');
      this.el.cdBar.classList.remove('hidden');
      this.el.dashCdBar.classList.remove('hidden');
      this.el.cdKey.textContent = key.replace('Key', '');
      this.el.dashCdKey.textContent = dashKey === 'Space' ? 'SPACE' : dashKey;
    }
    this.tick();
  }
  // 覆盖名字文案（联机用：显示对方昵称）
  setNames(p1Text, p2Text) {
    if (p1Text) this.el.p1name.textContent = p1Text;
    if (p2Text) this.el.p2name.textContent = p2Text;
  }
  // 狂暴计时：顶部中间，red=true 时为狂暴阶段（正数计时）
  showMatchTimer(sec, red) {
    const el = this.el.matchTimer;
    el.textContent = red ? `狂暴 ${sec}` : sec;
    el.classList.toggle('berserk', !!red);
    el.classList.remove('hidden');
  }
  hideMatchTimer() { this.el.matchTimer.classList.add('hidden'); }
  // 技能状态：被动 = 积攒进度/生效剩余/冷却充能；主动 = 冷却充能
  skillState(ball) {
    const s = ball.skill;
    if (!s) return { ratio: 0, isCd: false };
    const isPassive = s.def.type === 'passive' || s.def.type === 'both';
    const p = s.def.passive || {};
    const giantSt = ball.effects.get('giant_form');
    if (isPassive) {
      // 冷却型被动（如荆棘）：生效中=剩余比例，冷却中=充能进度
      if (p.cooldown) {
        if (s.passiveActive) {
          const st = ball.effects.get(p.effectId);
          return { ratio: st ? Math.max(0, (st.duration - st.t) / st.duration) : 1, isCd: false };
        }
        return { ratio: Math.max(0, 1 - s.passiveTimer / p.cooldown), isCd: true };
      }
      const key = p.progressKey;
      if (!key) return { ratio: 1, isCd: false };  // 无进度条的被动（如毒液）= 常驻满格
      return {
        ratio: giantSt
          ? Math.max(0, (giantSt.duration - giantSt.t) / giantSt.duration)
          : (s.state[key] ?? 0) / (p.progressMax || 1),
        isCd: false,
      };
    }
    return { ratio: s.cd > 0 ? 1 - s.cdRatio : 1, isCd: true };
  }
  tick() {
    if (!this.balls) return;
    const [p1, p2] = this.balls;
    // 死灵术士：按侧分段血条（自己侧/对方侧各自渲染：各死灵球血量/总容量，前段=当前球最深红）
    // ★ 双侧阵营：自己（myIndex 球）若死灵 → 自己侧分段；对方侧同理；互不干扰
    const necros = this.ctx?.necros || [];
    const my = this.balls[this.myIndex] || p1;
    const enemy = my === p1 ? p2 : p1;
    const myFill = my === p1 ? this.el.p1hp : this.el.p2hp;
    const enemyFill = enemy === p1 ? this.el.p1hp : this.el.p2hp;
    const mySide = my._necroSide;
    const enemySide = mySide !== undefined ? (mySide === 0 ? 1 : 0) : enemy._necroSide;
    const myNecros = mySide !== undefined ? necros.filter(n => n._necroSide === mySide) : [];
    const enemyNecros = enemySide !== undefined ? necros.filter(n => n._necroSide === enemySide) : [];
    if (myNecros.length) this.renderNecroBar(myFill, myNecros);
    else { this.resetBar(myFill); this.setBar(myFill, my.hp / my.maxHp); }
    if (enemyNecros.length) this.renderNecroBar(enemyFill, enemyNecros);
    else { this.resetBar(enemyFill); this.setBar(enemyFill, enemy.hp / enemy.maxHp); }
    const st1 = this.skillState(p1);
    const st2 = this.skillState(p2);
    this.el.p1passive.classList.toggle('blue', st1.isCd);
    this.el.p2passive.classList.toggle('blue', st2.isCd);
    this.setBar(this.el.p1passive, st1.ratio);
    this.setBar(this.el.p2passive, st2.ratio);
    // 双通道：只显示自己的球（房主=0，客人=1）
    const myBall = this.balls[this.myIndex] || p1;
    this.updateDashUI(myBall);
    this.updateSkillUI(myBall);
  }
  // 死灵术士分段血条：每段 = 一个死灵球，宽度 = 该球当前血量/总容量（ΣmaxHp）——
  // 总和即总血量百分比，召唤越多各段挤压越窄，永不溢出；段间空隙=空槽
  renderNecroBar(fillEl, necros) {
    let bar = fillEl.parentElement || this._necroBarCache.get(fillEl);
    if (!bar) return;
    if (!bar.classList.contains('segmented')) {
      this._necroBarCache.set(fillEl, bar);
      bar.classList.add('segmented');
      bar.innerHTML = '';
    }
    const segs = necros.filter(n => !n.dead);
    while (bar.children.length < segs.length) {
      const d = document.createElement('div');
      d.className = 'hp-seg';
      bar.appendChild(d);
    }
    while (bar.children.length > segs.length) bar.removeChild(bar.lastChild);
    const total = segs.reduce((s, n) => s + (n.maxHp || 0), 0) || 1;
    // 多级红色深度：当前球 #B3001B 最深 → 从者依次渐浅
    const shades = ['#B3001B', '#c62828', '#d95f6a', '#e57373', '#ef9a9a'];
    [...bar.children].forEach((el, i) => {
      const n = segs[i];
      el.style.width = (Math.max(0, Math.min(1, n.hp / total)) * 100) + '%';
      el.style.background = shades[Math.min(i, shades.length - 1)];
    });
  }
  // 恢复单条血条（非死灵对局 / 对局切换时）
  resetBar(fillEl) {
    const bar = fillEl.parentElement || this._necroBarCache.get(fillEl);
    if (bar && bar.classList.contains('segmented')) {
      bar.classList.remove('segmented');
      bar.innerHTML = '';
      bar.appendChild(fillEl);
      this._necroBarCache.delete(fillEl);
    }
  }
  // 基础冲刺按钮/冷却条（全职业）
  updateDashUI(ball) {
    const s = ball.dashSkill;
    if (!s) return;
    if (this.isTouch) {
      this.el.dSname.textContent = s.def.skillName;
      this.el.dScd.textContent = s.cooldownLeft > 0 ? Math.ceil(s.cooldownLeft) : '⚡';
      this.el.dashBtn.classList.toggle('on-cd', s.cooldownLeft > 0);
    } else {
      this.el.dashCdName.textContent = s.def.skillName;
      this.el.dashCdFill.style.width = (100 * (1 - s.cdRatio)) + '%';
    }
  }
  // 职业技能：触屏=右下按钮（仅主动职业）；电脑=冷却条（主动冷却/被动进度）
  updateSkillUI(ball) {
    const s = ball.skill;
    if (!s) return;
    const isPassive = s.def.type === 'passive' || s.def.type === 'both';
    const p = s.def.passive || {};
    const giantSt = ball.effects.get('giant_form');
    if (this.isTouch) {
      const btn = this.el.activeBtn;
      if (isPassive) { btn.classList.add('hidden'); return; }
      btn.classList.remove('hidden');
      this.el.aSname.textContent = s.def.skillName;
      this.el.aScd.textContent = s.cooldownLeft > 0 ? Math.ceil(s.cooldownLeft) : '⚡';
      btn.classList.toggle('on-cd', s.cooldownLeft > 0);
      return;
    }
    this.el.cdName.textContent = s.def.skillName;
    if (isPassive) {
      if (p.cooldown) {
        if (s.passiveActive) {
          const st = ball.effects.get(p.effectId);
          const ratio = st ? Math.max(0, (st.duration - st.t) / p.duration) : 1;
          this.el.cdFill.style.width = (100 * ratio) + '%';
        } else {
          this.el.cdFill.style.width = (100 * Math.max(0, 1 - s.passiveTimer / p.cooldown)) + '%';
        }
        return;
      }
      const key = p.progressKey;
      if (!key) { this.el.cdFill.style.width = '100%'; return; }
      const ratio = giantSt
        ? Math.max(0, (giantSt.duration - giantSt.t) / giantSt.duration)
        : (s.state[key] ?? 0) / (p.progressMax || 1);
      this.el.cdFill.style.width = (100 * ratio) + '%';
    } else {
      this.el.cdFill.style.width = (100 * (1 - s.cdRatio)) + '%';
    }
  }
  setBar(el, ratio) {
    el.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
  }
  showResult(win, extra = '') {
    const el = document.getElementById(this.prefix + 'result');
    el.classList.remove('hidden');
    el.innerHTML = (win ? '<div class="rwin">🎉 胜利！</div>' : '<div class="rlose">💥 惜败…</div>')
      + extra
      + '<button id="' + this.prefix + 'btn-again" class="btn big">再来一局</button><button id="' + this.prefix + 'btn-home2" class="btn">返回大厅</button>';
  }
  hideResult() { document.getElementById(this.prefix + 'result').classList.add('hidden'); }
  showCountdown(n) {
    const el = document.getElementById(this.prefix + 'countdown');
    el.classList.remove('hidden');
    el.textContent = n > 0 ? n : 'GO!';
  }
  hideCountdown() { document.getElementById(this.prefix + 'countdown').classList.add('hidden'); }
}
