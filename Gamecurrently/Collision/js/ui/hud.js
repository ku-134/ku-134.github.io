import CONFIG from '../config.js';

// 对局 HUD：HP条/技能状态条（被动进度 or 主动冷却，敌我可见）
// 技能按钮（手机）/冷却条（电脑）/狂暴倒计时
// prefix：单机用 ''，联机用 'online-'（独立战场，元素不冲突）
// myIndex：技能按钮/冷却条显示哪颗球（单机与房主=0，客人=1）
export class Hud {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.el = {
      p1name: document.getElementById(prefix + 'p1-name'),
      p1hp: document.getElementById(prefix + 'p1-hp'),
      p1passive: document.getElementById(prefix + 'p1-passive'),
      p2name: document.getElementById(prefix + 'p2-name'),
      p2hp: document.getElementById(prefix + 'p2-hp'),
      p2passive: document.getElementById(prefix + 'p2-passive'),
      skillBtn: document.getElementById(prefix + 'skill-btn'),
      sname: document.querySelector('#' + prefix + 'skill-btn .sname'),
      scd: document.querySelector('#' + prefix + 'skill-btn .scd'),
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
  bind(balls, { isTouch, key, myIndex = 0 }) {
    this.balls = balls;
    this.isTouch = isTouch;
    this.myIndex = myIndex;
    const [p1, p2] = balls;
    this.el.p1name.textContent = `你 · ${p1.skill?.def.name ?? '无'}`;
    this.el.p2name.textContent = `对方 · ${p2.skill?.def.name ?? '无'}`;
    if (isTouch) {
      this.el.cdBar.classList.add('hidden');
      this.el.skillBtn.classList.remove('hidden');
    } else {
      this.el.skillBtn.classList.add('hidden');
      this.el.cdBar.classList.remove('hidden');
      this.el.cdKey.textContent = key.replace('Key', '');
    }
    this.tick();
  }
  // 覆盖名字文案（联机用：显示对方昵称）
  setNames(p1Text, p2Text) {
    if (p1Text) this.el.p1name.textContent = p1Text;
    if (p2Text) this.el.p2name.textContent = p2Text;
  }
  // 狂暴倒计时：顶部中间，red=true 时为狂暴阶段
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
    this.setBar(this.el.p1hp, p1.hp / p1.maxHp);
    this.setBar(this.el.p2hp, p2.hp / p2.maxHp);
    const st1 = this.skillState(p1);
    const st2 = this.skillState(p2);
    this.el.p1passive.classList.toggle('blue', st1.isCd);
    this.el.p2passive.classList.toggle('blue', st2.isCd);
    this.setBar(this.el.p1passive, st1.ratio);
    this.setBar(this.el.p2passive, st2.ratio);
    // 技能按钮/冷却条：只显示自己的球（房主=0，客人=1）
    this.updateSkillUI(this.balls[this.myIndex] || p1);
  }
  // 玩家技能按钮/冷却条：主动=冷却；被动=进度/生效剩余/冷却充能/就绪
  updateSkillUI(ball) {
    const s = ball.skill;
    if (!s) return;
    const isPassive = s.def.type === 'passive' || s.def.type === 'both';
    const p = s.def.passive || {};
    const giantSt = ball.effects.get('giant_form');
    if (this.isTouch) {
      const btn = this.el.skillBtn;
      if (isPassive) {
        if (p.cooldown) {
          this.el.sname.textContent = s.def.skillName;
          if (s.passiveActive) {
            const st = ball.effects.get(p.effectId);
            const left = st ? Math.max(0, Math.ceil(st.duration - st.t)) : p.duration;
            this.el.scd.textContent = left + 's';
            btn.classList.toggle('on-cd', false);
          } else {
            this.el.scd.textContent = Math.ceil(s.passiveTimer) + 's';
            btn.classList.toggle('on-cd', true);
          }
          return;
        }
        const key = p.progressKey;
        this.el.sname.textContent = giantSt ? '巨大化' : s.def.skillName;
        btn.classList.toggle('on-cd', !!giantSt);
        if (giantSt) {
          const left = Math.max(0, Math.ceil(giantSt.duration - giantSt.t));
          this.el.scd.textContent = left + 's';
        } else if (key) {
          this.el.scd.textContent = `${s.state[key] ?? 0}/${p.progressMax || 1}`;
        } else {
          this.el.scd.textContent = '被动';
        }
      } else if (s.cd > 0) {
        this.el.sname.textContent = s.def.skillName;
        this.el.scd.textContent = s.cooldownLeft > 0 ? Math.ceil(s.cooldownLeft) : '⚡';
        btn.classList.toggle('on-cd', s.cooldownLeft > 0);
      }
    } else {
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
  }
  setBar(el, ratio) {
    el.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
  }
  showResult(win) {
    const el = document.getElementById(this.prefix + 'result');
    el.classList.remove('hidden');
    el.innerHTML = win
      ? '<div class="rwin">🎉 胜利！</div><button id="' + this.prefix + 'btn-again" class="btn big">再来一局</button><button id="' + this.prefix + 'btn-home2" class="btn">返回大厅</button>'
      : '<div class="rlose">💥 惜败…</div><button id="' + this.prefix + 'btn-again" class="btn big">再来一局</button><button id="' + this.prefix + 'btn-home2" class="btn">返回大厅</button>';
  }
  hideResult() { document.getElementById(this.prefix + 'result').classList.add('hidden'); }
  showCountdown(n) {
    const el = document.getElementById(this.prefix + 'countdown');
    el.classList.remove('hidden');
    el.textContent = n > 0 ? n : 'GO!';
  }
  hideCountdown() { document.getElementById(this.prefix + 'countdown').classList.add('hidden'); }
}
